import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    // 仅允许开发环境访问 - 双重检查
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEBUG_ROUTES !== 'true') {
        return NextResponse.json(
            { error: 'This endpoint is disabled in production' },
            { status: 403 }
        );
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
