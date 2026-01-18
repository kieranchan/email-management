import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    // 仅允许开发环境访问
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'This endpoint is only available in development' }, { status: 403 });
    }

    const acc = await prisma.account.findUnique({
        where: { email: 'omega@oragenode.online' }
    });
    return NextResponse.json({
        email: acc?.email,
        password: acc?.password, // returning password for debug only
        host: acc?.host,
        port: acc?.port
    });
}
