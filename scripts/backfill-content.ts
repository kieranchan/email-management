/**
 * 一次性脚本：补全历史邮件的 content
 * 
 * 运行方式：npx ts-node scripts/backfill-content.ts
 */

import { PrismaClient } from '@prisma/client';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

const prisma = new PrismaClient();

async function parseEmailContent(source: Buffer): Promise<string> {
    try {
        const parsed = await simpleParser(source);
        if (parsed.html) {
            return parsed.html;
        } else if (parsed.text) {
            return `<pre style="white-space: pre-wrap; font-family: inherit;">${parsed.text}</pre>`;
        }
        return '';
    } catch (e) {
        console.error('Parse error:', e);
        return '';
    }
}

async function backfillAccount(account: {
    id: string;
    email: string;
    host: string;
    port: number;
    password: string;
}) {
    // 获取该账号缺少 content 的邮件
    const emails = await prisma.email.findMany({
        where: {
            accountId: account.id,
            OR: [{ content: null }, { content: '' }]
        },
        select: { id: true, uid: true, subject: true }
    });

    if (emails.length === 0) {
        console.log(`[${account.email}] No missing content`);
        return;
    }

    console.log(`[${account.email}] Found ${emails.length} emails missing content`);

    // 使用本地 SSH 隧道连接 (143 STARTTLS)
    const client = new ImapFlow({
        host: 'localhost',
        port: 143,
        secure: false, // local SSH tunnel usually plaintext or STARTTLS
        auth: {
            user: account.email,
            pass: account.password,
        },
        logger: false,
        greetingTimeout: 10000,
        socketTimeout: 30000,
        // TLS 验证由 SSH 隧道保证或确认为安全内网环境，移除不安全的忽略证书配置
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        try {
            for (const email of emails) {
                try {
                    const msg = await client.fetchOne(String(email.uid), { source: true }, { uid: true });

                    if (msg?.source) {
                        const content = await parseEmailContent(msg.source);
                        if (content) {
                            await prisma.email.update({
                                where: { id: email.id },
                                data: { content }
                            });
                            console.log(`  ✅ ${email.subject?.substring(0, 40)}...`);
                        }
                    }
                } catch (e) {
                    console.error(`  ❌ Failed to fetch UID ${email.uid}:`, e);
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();
    } catch (e) {
        console.error(`[${account.email}] Connection failed:`, e);
    }
}

async function main() {
    console.log('=== Backfill Email Content ===\n');

    // 获取所有有缺失 content 邮件的账号
    const accountsWithMissing = await prisma.email.groupBy({
        by: ['accountId'],
        where: {
            OR: [{ content: null }, { content: '' }]
        }
    });

    console.log(`Found ${accountsWithMissing.length} accounts with missing content\n`);

    for (const { accountId } of accountsWithMissing) {
        const account = await prisma.account.findUnique({
            where: { id: accountId },
            select: { id: true, email: true, host: true, port: true, password: true }
        });

        if (account) {
            await backfillAccount(account);
        }
    }

    console.log('\n=== Done ===');
    await prisma.$disconnect();
}

main().catch(console.error);
