import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages/:id
 * 
 * 获取单封邮件详情
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
            content: email.content,
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
