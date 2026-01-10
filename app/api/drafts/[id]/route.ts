import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// DELETE /api/drafts/:id
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        await prisma.draft.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Draft delete error:', error);
        return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }
}
