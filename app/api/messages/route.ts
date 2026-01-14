import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/messages
 * 
 * 邮件列表 API，支持多种过滤条件
 * 
 * Query params:
 * - scope: 'all' | 'account' (默认 account)
 * - accountId: 账号ID（scope=account 时必需）
 * - folderType: 'inbox' | 'sent' | 'archive' | 'drafts' (默认 inbox)
 * - page: 页码 (默认 1)
 * - limit: 每页数量 (默认 50, 最大 100)
 * - search: 搜索关键词（在发件人、主题、内容中搜索）
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || 'account';
        const accountId = searchParams.get('accountId');
        const folderType = searchParams.get('folderType') || 'inbox';
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
        const search = searchParams.get('search')?.trim() || '';

        // 构建查询条件
        const where: Record<string, unknown> = {};

        // 账号过滤
        if (scope === 'account' && accountId) {
            where.accountId = accountId;
        }

        // M7: 搜索条件
        if (search) {
            where.OR = [
                { from: { contains: search, mode: 'insensitive' } },
                { subject: { contains: search, mode: 'insensitive' } },
                { content: { contains: search, mode: 'insensitive' } },
            ];
        }

        // 文件夹类型过滤
        switch (folderType) {
            case 'inbox':
                where.folder = 'INBOX';
                where.archived = false;
                break;
            case 'sent':
                where.folder = 'SENT';
                where.archived = false;
                break;
            case 'archive':
                where.archived = true;
                break;
            case 'drafts':
                // 草稿从 Draft 表获取，这里返回空
                return NextResponse.json({
                    items: [],
                    pagination: { page, limit, total: 0, hasMore: false },
                    message: 'Use /api/drafts for drafts'
                });
            default:
                where.folder = folderType.toUpperCase();
        }

        // 查询邮件
        const [emails, total] = await Promise.all([
            prisma.email.findMany({
                where,
                orderBy: { date: 'desc' },
                include: {
                    account: {
                        select: { id: true, email: true, name: true, tag: true }
                    }
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.email.count({ where }),
        ]);

        // 格式化响应
        const items = emails.map(email => {
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
            // Bug #29 fix: 从 flags 解析 starred 状态
            const isStarred = parsedFlags.some(f => f.toUpperCase() === '\\FLAGGED');
            // hasAttachment: 暂时从 content 判断（简单启发式）
            const hasAttachment = email.content?.includes('attachment') ||
                email.content?.includes('filename=') ||
                email.content?.includes('Content-Disposition: attachment') || false;

            return {
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
                starred: isStarred,           // Bug #29: 添加 starred 字段
                hasAttachment: hasAttachment, // Bug #29: 添加 hasAttachment 字段
                snippet: email.content?.replace(/<[^>]*>/g, '').slice(0, 100),
                folder: email.folder,
                archived: email.archived,
                localStatus: email.localStatus,
            };
        });

        return NextResponse.json({
            items,
            pagination: {
                page,
                limit,
                total,
                hasMore: page * limit < total,
            },
        });
    } catch (error) {
        console.error('Messages fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
