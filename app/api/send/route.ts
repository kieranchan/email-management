import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import nodemailer from 'nodemailer';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
    let accountId: string | undefined;
    let providerKey: string | undefined;

    try {
        const body = await request.json();
        accountId = body.accountId;
        const { to, subject, content } = body;

        if (!accountId) {
            return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }
        if (!to || !String(to).trim()) {
            return NextResponse.json({ error: 'recipient is required' }, { status: 400 });
        }
        const toValue = String(to).trim();

        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        const transporter = nodemailer.createTransport({
            host: account.host,
            port: account.smtpPort,
            secure: false, // 587 uses STARTTLS, so secure: false
            auth: {
                user: account.email,
                pass: account.password,
            },
            tls: {
                rejectUnauthorized: false // Self-signed certs often used in internal docker setup
            }
        });

        // 先写入本地 Sent 记录，标记为 PENDING
        providerKey = `local:${randomUUID()}`;
        const htmlContent = content ? content.replace(/\n/g, '<br>') : '';

        const email = await prisma.email.create({
            data: {
                accountId,
                providerKey,
                uid: 0,
                folder: 'SENT',
                subject,
                from: account.email,
                to: toValue,
                date: new Date(),
                flags: JSON.stringify(['\\Seen']),
                content: htmlContent,
                archived: false,
                localStatus: 'PENDING',
            },
        });

        // 发送 SMTP
        const info = await transporter.sendMail({
            from: `"${account.name || account.email}" <${account.email}>`,
            to: toValue,
            subject,
            text: content,
            html: htmlContent,
        });

        // 发送成功后更新状态为 NORMAL
        await prisma.email.update({
            where: { accountId_providerKey: { accountId, providerKey } },
            data: { localStatus: 'NORMAL' },
        });

        return NextResponse.json({ success: true, messageId: info.messageId, localId: email.id });
    } catch (error) {
        console.error('Send Error:', error);

        // Update status to FAILED if record exists
        if (accountId && providerKey) {
            try {
                await prisma.email.update({
                    where: { accountId_providerKey: { accountId, providerKey } },
                    data: { localStatus: 'ERROR' }
                });
            } catch { /* If record creation failed, this update will fail too, just ignore */ }
        }

        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
