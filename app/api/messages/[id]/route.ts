import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { ImapFlow } from 'imapflow';

export const dynamic = 'force-dynamic';

/**
 * 按需从 IMAP 获取邮件正文
 */
async function fetchEmailContent(email: {
    id: string;
    uid: number;
    accountId: string;
}): Promise<string | null> {
    const account = await prisma.account.findUnique({
        where: { id: email.accountId },
    });

    if (!account) return null;

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
        tls: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        try {
            // 通过 UID 获取邮件源
            const msg = await client.fetchOne(String(email.uid), { source: true }, { uid: true });

            if (!msg?.source) return null;

            // 解析邮件内容
            const { simpleParser } = await import('mailparser');
            const parsed = await simpleParser(msg.source);

            let content = '';
            if (parsed.html) {
                content = parsed.html;
            } else if (parsed.text) {
                content = `<pre style="white-space: pre-wrap; font-family: inherit;">${parsed.text}</pre>`;
            }

            // 缓存到数据库
            if (content) {
                await prisma.email.update({
                    where: { id: email.id },
                    data: { content },
                });
            }

            return content;
        } finally {
            lock.release();
        }
    } catch (error) {
        console.error(`Failed to fetch email content for UID ${email.uid}:`, error);
        return null;
    } finally {
        try {
            await client.logout();
        } catch { /* ignore */ }
    }
}

/**
 * GET /api/messages/:id
 * 
 * 获取单封邮件详情（支持按需加载正文）
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const email = await prisma.email.findUnique({
            where: { id },
            include: {
                account: {
                    select: { id: true, email: true, name: true, tag: true }
                }
            },
        });

        if (!email) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // 延迟加载：若 content 为空，从 IMAP 按需获取
        let content = email.content;
        if (!content && email.uid > 0) {
            console.log(`[Messages/${id}] Lazy loading content for UID ${email.uid}`);
            content = await fetchEmailContent({
                id: email.id,
                uid: email.uid,
                accountId: email.accountId,
            });
        }

        // 解析 flags
        let parsedFlags: string[] = [];
        if (email.flags) {
            try {
                const raw = JSON.parse(email.flags);
                if (Array.isArray(raw)) {
                    parsedFlags = raw.map((f) => String(f));
                }
            } catch { /* ignore */ }
        }
        const isUnread = !parsedFlags.some(f => f.toUpperCase() === '\\SEEN');

        return NextResponse.json({
            id: email.id,
            providerKey: email.providerKey,
            accountId: email.accountId,
            accountLabel: email.account.name || email.account.email.split('@')[0],
            accountColorTag: email.account.tag,
            uid: email.uid,
            from: email.from,
            to: email.to,
            subject: email.subject,
            date: email.date?.toISOString(),
            unread: isUnread,
            content: content,
            folder: email.folder,
            archived: email.archived,
            localStatus: email.localStatus,
            flags: parsedFlags,
        });
    } catch (error) {
        console.error('Message fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch message' }, { status: 500 });
    }
}

/**
 * DELETE /api/messages/:id
 * 
 * 删除邮件（本地数据库），返回 uid 和 accountId 供 WebSocket 调用 IMAP 删除
 */
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // 查找邮件获取 uid 和 accountId
        const email = await prisma.email.findUnique({
            where: { id },
            select: { id: true, uid: true, accountId: true }
        });

        if (!email) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // 删除本地数据库记录
        await prisma.email.delete({
            where: { id }
        });

        console.log(`[Messages/${id}] Deleted email, uid=${email.uid}, accountId=${email.accountId}`);

        // 返回 uid 和 accountId 供前端调用 WebSocket 同步
        return NextResponse.json({
            success: true,
            id: email.id,
            uid: email.uid,
            accountId: email.accountId
        });
    } catch (error) {
        console.error('Message delete error:', error);
        return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 });
    }
}
