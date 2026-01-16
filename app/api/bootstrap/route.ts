import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/bootstrap
 * 
 * 返回首屏加载所需的所有数据：
 * - accounts: 账号列表
 * - counts: 未读数统计（按账号和文件夹）
 */
export async function GET() {
    try {
        // 获取所有账号
        const accounts = await prisma.account.findMany({
            select: {
                id: true,
                email: true,
                name: true,
                host: true,
                port: true,
                smtpPort: true,
                // 不返回密码
            },
            orderBy: { createdAt: 'asc' },
        });

        // 获取每个账号的未读数
        const unreadCounts = await prisma.$queryRaw<Array<{ accountId: string; count: bigint }>>`
            SELECT accountId, COUNT(*) as count 
            FROM Email 
            WHERE folder = 'INBOX' 
              AND archived = false 
              AND (flags IS NULL OR flags NOT LIKE '%\\Seen%')
            GROUP BY accountId
        `;

        // 转换为 map
        const unreadMap: Record<string, number> = {};
        for (const row of unreadCounts) {
            unreadMap[row.accountId] = Number(row.count);
        }

        // 获取总邮件数
        const totalEmails = await prisma.email.count();

        // 获取归档数
        const archivedCount = await prisma.email.count({
            where: { archived: true }
        });

        // 获取草稿数
        const draftsCount = await prisma.draft.count();

        return NextResponse.json({
            accounts: accounts.map(acc => ({
                ...acc,
                unreadCount: unreadMap[acc.id] || 0,
            })),
            counts: {
                total: totalEmails,
                archived: archivedCount,
                drafts: draftsCount,
                unreadTotal: Object.values(unreadMap).reduce((a, b) => a + b, 0),
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Bootstrap fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch bootstrap data' }, { status: 500 });
    }
}
