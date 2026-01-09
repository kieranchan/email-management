import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const accountId = searchParams.get('accountId');

        const where = accountId && accountId !== 'all' ? { accountId } : {};

        const emails = await prisma.email.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { account: { select: { email: true, name: true, tag: true } } },
            take: 100, // Limit for MVP
        });

        return NextResponse.json(emails);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}
