import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export const dynamic = 'force-dynamic';

// GET /api/drafts - List drafts
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || 'all';
        const accountId = searchParams.get('accountId');

        const where = scope === 'account' && accountId
            ? { accountId }
            : {};

        const drafts = await prisma.draft.findMany({
            where,
            include: {
                account: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    }
                }
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });

        const items = drafts.map(draft => ({
            id: draft.id,
            accountId: draft.accountId,
            accountLabel: draft.account.name || draft.account.email.split('@')[0],
            to: draft.to,
            subject: draft.subject,
            preview: draft.textBody?.slice(0, 100),
            updatedAt: draft.updatedAt.toISOString(),
            status: draft.status,
        }));

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Drafts list error:', error);
        return NextResponse.json({ error: 'Failed to fetch drafts' }, { status: 500 });
    }
}

// POST /api/drafts - Create or update draft
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { id, accountId, to, cc, bcc, subject, textBody, htmlBody } = body;

        // Validation: at least one field must be non-empty to save
        const hasContent = to || cc || bcc || subject || textBody || htmlBody;
        if (!hasContent) {
            return NextResponse.json({ error: 'Draft must have at least one non-empty field' }, { status: 400 });
        }

        if (!accountId) {
            return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }

        // Upsert: update if id exists, create otherwise
        const draft = id
            ? await prisma.draft.update({
                where: { id },
                data: { to, cc, bcc, subject, textBody, htmlBody, status: 'SAVED' },
            })
            : await prisma.draft.create({
                data: { accountId, to, cc, bcc, subject, textBody, htmlBody, status: 'SAVED' },
            });

        return NextResponse.json({ id: draft.id, status: 'SAVED' });
    } catch (error) {
        console.error('Draft save error:', error);
        return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }
}

// DELETE /api/drafts/:id - handled by [id]/route.ts
