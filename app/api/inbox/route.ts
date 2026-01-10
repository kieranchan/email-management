import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');
        const folder = searchParams.get('folder') || 'INBOX';

        // Build where clause
        const where: Record<string, unknown> = {};

        // Account filter
        if (accountId && accountId !== 'all') {
            where.accountId = accountId;
        }

        // Folder-based filtering
        switch (folder) {
            case 'INBOX':
                where.folder = 'INBOX';
                where.archived = false;
                break;
            case 'SENT':
                where.folder = 'SENT';
                break;
            case 'ARCHIVE':
                where.archived = true;
                break;
            default:
                where.folder = folder;
        }

        const emails = await prisma.email.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { account: { select: { id: true, email: true, name: true, tag: true } } },
            take: 100,
        });

        // Map to response format with account info for All Accounts support
        const items = emails.map(email => ({
            id: email.id,
            accountId: email.accountId,
            accountLabel: email.account.name || email.account.email.split('@')[0],
            accountColorTag: email.account.tag,
            uid: email.uid,
            from: email.from,
            to: email.to,
            subject: email.subject,
            date: email.date?.toISOString(),
            unread: !email.flags?.includes('\\Seen'),
            snippet: email.content?.replace(/<[^>]*>/g, '').slice(0, 100),
            content: email.content,
            folder: email.folder,
            archived: email.archived,
            localStatus: email.localStatus,
        }));

        return NextResponse.json(items);
    } catch (error) {
        console.error('Inbox fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
