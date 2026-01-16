import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET() {
    try {
        const accounts = await prisma.account.findMany({
            orderBy: { createdAt: 'asc' },
        });
        // Don't return passwords in list ideally, but for this admin tool it's fine/needed sometimes. 
        // We'll return full object for now as it makes "Edit" easier.
        return NextResponse.json(accounts);
    } catch (error) {
        console.error('GET Accounts Error:', error);
        return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Support Bulk Import (Array) or Single (Object)
        const data = Array.isArray(body) ? body : [body];

        const results = [];

        for (const item of data) {
            const { email, password, name } = item;

            if (!email || !password) continue;

            // Upsert to update password if exists
            const account = await prisma.account.upsert({
                where: { email },
                update: { password, name },
                create: {
                    email,
                    password,
                    name,
                    host: 'mail.oragenode.online', // Default
                    port: 993,
                    smtpPort: 587
                },
            });
            results.push(account);
        }

        return NextResponse.json({ success: true, count: results.length, accounts: results });
    } catch (error) {
        console.error('Create Account Error:', error);
        return NextResponse.json({ error: 'Failed to create accounts' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
        }

        await prisma.account.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
    }
}

// Update account (name, etc.)
export async function PATCH(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Account ID required' }, { status: 400 });
        }

        const body = await request.json();
        const { name } = body;

        const account = await prisma.account.update({
            where: { id },
            data: {
                ...(name && { name }),
            },
        });

        return NextResponse.json({ success: true, account });
    } catch (error) {
        console.error('Update Account Error:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}
