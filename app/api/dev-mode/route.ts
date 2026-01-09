import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

// Switch between development (localhost) and production (mail.oragenode.online)
export async function POST(request: Request) {
    try {
        const { mode } = await request.json();

        const host = mode === 'dev' ? 'localhost' : 'mail.oragenode.online';
        const port = mode === 'dev' ? 143 : 993;

        const result = await prisma.account.updateMany({
            data: { host, port }
        });

        return NextResponse.json({
            success: true,
            mode,
            host,
            updatedCount: result.count
        });
    } catch (error) {
        console.error('Switch Mode Error:', error);
        return NextResponse.json({ error: 'Failed to switch mode' }, { status: 500 });
    }
}

export async function GET() {
    try {
        const account = await prisma.account.findFirst({
            select: { host: true }
        });

        const mode = account?.host === 'localhost' ? 'dev' : 'prod';

        return NextResponse.json({ mode, host: account?.host });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to get mode' }, { status: 500 });
    }
}
