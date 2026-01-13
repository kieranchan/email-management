import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/messages/:id/star
 * 
 * 切换邮件星标状态
 * 
 * Body:
 * - starred: boolean (true = 加星标, false = 取消星标)
 * 
 * Returns:
 * - success, id, starred, flags
 * - uid, accountId (供前端调用 WebSocket 同步 IMAP)
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { starred } = body;

        if (typeof starred !== 'boolean') {
            return NextResponse.json({ error: 'starred must be a boolean' }, { status: 400 });
        }

        // 获取当前邮件（包含 uid 和 accountId）
        const email = await prisma.email.findUnique({
            where: { id },
            select: { flags: true, uid: true, accountId: true },
        });

        if (!email) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // 解析现有 flags
        let flags: string[] = [];
        if (email.flags) {
            try {
                const raw = JSON.parse(email.flags);
                if (Array.isArray(raw)) {
                    flags = raw.map((f) => String(f));
                }
            } catch { /* ignore */ }
        }

        // 更新 flags
        if (starred) {
            // 添加 \Flagged (IMAP 星标标志)
            if (!flags.some(f => f.toUpperCase() === '\\FLAGGED')) {
                flags.push('\\Flagged');
            }
        } else {
            // 移除 \Flagged
            flags = flags.filter(f => f.toUpperCase() !== '\\FLAGGED');
        }

        // 保存
        await prisma.email.update({
            where: { id },
            data: { flags: JSON.stringify(flags) },
        });

        return NextResponse.json({
            success: true,
            id,
            starred,
            flags,
            uid: email.uid,           // 供前端 WebSocket 同步
            accountId: email.accountId // 供前端 WebSocket 同步
        });
    } catch (error) {
        console.error('Toggle star error:', error);
        return NextResponse.json({ error: 'Failed to toggle star' }, { status: 500 });
    }
}
