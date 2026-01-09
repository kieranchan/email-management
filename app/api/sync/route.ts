import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { ImapFlow } from 'imapflow';
import * as quotedPrintable from 'quoted-printable';
import * as utf8 from 'utf8';

export const dynamic = 'force-dynamic';

async function syncAccount(account: any) {
    // 使用环境变量覆盖 host (生产环境使用 mailserver)
    const imapHost = process.env.IMAP_HOST || account.host;

    const client = new ImapFlow({
        host: imapHost,
        port: account.port,
        secure: account.port === 465 || account.port === 993,
        auth: {
            user: account.email,
            pass: account.password,
        },
        logger: false,
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();

        // Lock INBOX
        const lock = await client.getMailboxLock('INBOX');
        try {
            // Check if mailbox has any messages
            const mailboxStatus = client.mailbox;
            if (!mailboxStatus || mailboxStatus.exists === 0) {
                // Empty mailbox, nothing to sync
                lock.release();
                await client.logout();
                return { success: true, email: account.email, message: 'Empty mailbox' };
            }

            // Fetch all messages with raw source for proper parsing
            const messages = client.fetch('1:*', {
                envelope: true,
                internalDate: true,
                flags: true,
                uid: true,
                source: true  // Get raw email source for proper parsing
            });

            for await (const msg of messages) {
                if (!msg.envelope || !msg.uid) continue;

                // Parse raw email source with mailparser
                let content = '';
                if (msg.source) {
                    try {
                        const { simpleParser } = await import('mailparser');
                        const parsed = await simpleParser(msg.source);
                        // Prefer HTML content for proper formatting, fallback to text
                        if (parsed.html) {
                            content = parsed.html;
                        } else if (parsed.text) {
                            // Wrap plain text in pre tag for formatting
                            content = `<pre style="white-space: pre-wrap; font-family: inherit;">${parsed.text}</pre>`;
                        }
                    } catch (e) {
                        // If parsing fails, try raw source
                        content = msg.source.toString();
                    }
                }

                await prisma.email.upsert({
                    where: {
                        accountId_uid: {
                            accountId: account.id,
                            uid: msg.uid,
                        },
                    },
                    update: {
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                    },
                    create: {
                        accountId: account.id,
                        uid: msg.uid,
                        subject: msg.envelope.subject || '(No Subject)',
                        from: msg.envelope.from?.[0]?.address || 'Unknown',
                        to: msg.envelope.to?.[0]?.address || 'Unknown',
                        date: msg.internalDate || new Date(),
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                    },
                });
            }
        } finally {
            lock.release();
        }

        await client.logout();
        return { success: true, email: account.email };
    } catch (error) {
        console.error(`Sync failed for ${account.email}:`, error);
        return { success: false, email: account.email, error: String(error) };
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId } = body;

        let accounts = [];
        if (accountId) {
            const acc = await prisma.account.findUnique({ where: { id: accountId } });
            if (acc) accounts.push(acc);
        } else {
            accounts = await prisma.account.findMany();
        }

        const results = await Promise.all(accounts.map(syncAccount));

        return NextResponse.json({ results });
    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
    }
}
