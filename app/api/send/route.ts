import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId, to, subject, content } = body;

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

        const info = await transporter.sendMail({
            from: `"${account.name || account.email}" <${account.email}>`,
            to,
            subject,
            text: content, // Plain text for MVP
            html: content.replace(/\n/g, '<br>'), // Simple HTML conversion
        });

        return NextResponse.json({ success: true, messageId: info.messageId });
    } catch (error) {
        console.error('Send Error:', error);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
}
