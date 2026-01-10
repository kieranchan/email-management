import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// POST /api/actions/archive - Archive or restore email
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { messageId, archived } = body;

        if (!messageId) {
            return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
        }

        if (typeof archived !== 'boolean') {
            return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 });
        }

        await prisma.email.update({
            where: { id: messageId },
            data: { archived },
        });

        return NextResponse.json({
            success: true,
            archived,
            action: archived ? 'archived' : 'restored'
        });
    } catch (error) {
        console.error('Archive action error:', error);
        return NextResponse.json({ error: 'Failed to archive/restore email' }, { status: 500 });
    }
}
