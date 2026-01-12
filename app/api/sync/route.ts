import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { ImapFlow } from 'imapflow';
import type { Account } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function syncAccount(account: Account) {
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
        greetingTimeout: 5000,  // 5 秒连接超时
        socketTimeout: 10000,   // 10 秒操作超时
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
                return { success: true, email: account.email, message: 'Empty mailbox', synced: 0 };
            }

            // 增量同步：获取数据库中该账号最大 UID
            const lastEmail = await prisma.email.findFirst({
                where: { accountId: account.id },
                orderBy: { uid: 'desc' },
                select: { uid: true }
            });
            const lastUid = lastEmail?.uid || 0;

            // 构建 fetch 范围
            let fetchRange: string;
            if (lastUid === 0) {
                // 首次同步：只获取最近 50 封邮件
                const total = mailboxStatus.exists;
                const start = Math.max(1, total - 49);
                fetchRange = `${start}:*`;
                console.log(`[Sync] ${account.email}: First sync, fetching ${start}:* (last 50)`);
            } else {
                // 增量同步：只获取 lastUid 之后的邮件
                fetchRange = `${lastUid + 1}:*`;
                console.log(`[Sync] ${account.email}: Incremental sync from UID ${lastUid + 1}`);
            }

            // 延迟加载：不获取 source，content 在查看详情时按需加载
            const messages = client.fetch(fetchRange, {
                envelope: true,
                internalDate: true,
                flags: true,
                uid: true,
                // 不获取 source，大幅提升性能
            }, { uid: lastUid > 0 }); // 增量同步时使用 UID 范围

            let syncedCount = 0;
            const emailsToCreate: {
                accountId: string;
                providerKey: string;
                uid: number;
                subject: string;
                from: string;
                to: string;
                date: Date;
                flags: string;
                content: null;
            }[] = [];

            for await (const msg of messages) {
                if (!msg.envelope || !msg.uid) continue;
                // 增量模式下跳过已存在的 UID
                if (lastUid > 0 && msg.uid <= lastUid) continue;

                const providerKey = `uid:${msg.uid}`;

                emailsToCreate.push({
                    accountId: account.id,
                    providerKey,
                    uid: msg.uid,
                    subject: msg.envelope.subject || '(No Subject)',
                    from: msg.envelope.from?.[0]?.address || 'Unknown',
                    to: msg.envelope.to?.[0]?.address || 'Unknown',
                    date: msg.internalDate || new Date(),
                    flags: JSON.stringify(Array.from(msg.flags || [])),
                    content: null, // 延迟加载：详情页按需获取
                });
                syncedCount++;
            }

            // 批量插入（使用事务避免重复）
            if (emailsToCreate.length > 0) {
                await prisma.$transaction(
                    emailsToCreate.map(data =>
                        prisma.email.upsert({
                            where: {
                                accountId_providerKey: {
                                    accountId: data.accountId,
                                    providerKey: data.providerKey,
                                },
                            },
                            update: {
                                flags: data.flags,
                                uid: data.uid,
                            },
                            create: data,
                        })
                    )
                );
            }

            console.log(`[Sync] ${account.email}: Synced ${syncedCount} new emails`);
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

// 并发限制工具函数（保留以备将来扩展）
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _processWithConcurrencyLimit<T, R>(
    items: T[],
    limit: number,
    processor: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    let index = 0;

    async function worker(): Promise<void> {
        while (index < items.length) {
            const currentIndex = index++;
            results[currentIndex] = await processor(items[currentIndex]);
        }
    }

    // 创建 limit 个 worker 并行执行
    const workers = Array(Math.min(limit, items.length)).fill(null).map(() => worker());
    await Promise.all(workers);

    return results;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { accountId } = body;

        // 全量同步禁用：由 IMAP Worker 后台自动处理
        if (!accountId || accountId === 'all') {
            return NextResponse.json({
                message: '邮件已由后台自动同步，无需手动同步全部账号。请选择单个账号进行手动同步。',
                hint: 'auto_sync_enabled'
            });
        }

        // 单账号同步
        const account = await prisma.account.findUnique({ where: { id: accountId } });
        if (!account) {
            return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        console.log(`[Sync] Manual sync requested for ${account.email}`);
        const result = await syncAccount(account);

        return NextResponse.json({ results: [result] });
    } catch (error) {
        console.error('Sync Error:', error);
        return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
    }
}
