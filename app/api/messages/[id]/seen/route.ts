import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

/**
 * POST /api/messages/:id/seen
 * 
 * 标记邮件为已读/未读
 * 
 * Body:
 * - seen: boolean (true = 已读, false = 未读)
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { seen } = body;

        if (typeof seen !== 'boolean') {
            return NextResponse.json({ error: 'seen must be a boolean' }, { status: 400 });
        }

        // 获取当前邮件
        const email = await prisma.email.findUnique({
            where: { id },
            select: { flags: true },
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
        if (seen) {
            // 添加 \Seen
            if (!flags.some(f => f.toUpperCase() === '\\SEEN')) {
                flags.push('\\Seen');
            }
        } else {
            // 移除 \Seen
            flags = flags.filter(f => f.toUpperCase() !== '\\SEEN');
        }

        // 保存
        await prisma.email.update({
            where: { id },
            data: { flags: JSON.stringify(flags) },
        });

        return NextResponse.json({
            success: true,
            id,
            seen,
            flags,
        });
    } catch (error) {
        console.error('Mark seen error:', error);
        return NextResponse.json({ error: 'Failed to mark message' }, { status: 500 });
    }
}
