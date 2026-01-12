import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import prisma from '@/app/lib/prisma';

type Tag = {
    id: string;
    label: string;
    color: string;
};

const DATA_FILE = path.join(process.cwd(), 'data', 'tags.json');

// Helper to ensure data file exists
async function ensureDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        const initialData = [
            { "id": "vip", "label": "VIP", "color": "#fbbf24" },
            { "id": "important", "label": "重要", "color": "#a78bfa" },
            { "id": "normal", "label": "普通", "color": "#60a5fa" },
            { "id": "low", "label": "低优先", "color": "#34d399" },
            { "id": "admin", "label": "管理", "color": "#ef4444" }
        ];
        await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
    }
}

export async function GET() {
    await ensureDataFile();
    try {
        const data = await fs.readFile(DATA_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch {
        return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    await ensureDataFile();
    try {
        const body = await request.json();
        const { label, color } = body;

        if (!label || !label.trim()) {
            return NextResponse.json({ error: '标签名称不能为空' }, { status: 400 });
        }

        const dataStr = await fs.readFile(DATA_FILE, 'utf-8');
        const tags = JSON.parse(dataStr) as Tag[];

        // Duplicate Check
        if (tags.some((t) => t.label.toLowerCase() === label.trim().toLowerCase())) {
            return NextResponse.json({ error: '该标签名称已存在' }, { status: 400 });
        }

        const newTag = {
            id: label.trim().toLowerCase().replace(/\s+/g, '-'),
            label: label.trim(),
            color: color || '#9ca3af' // Default gray if no color provided
        };

        tags.push(newTag);
        await fs.writeFile(DATA_FILE, JSON.stringify(tags, null, 2));

        return NextResponse.json(newTag);
    } catch {
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    await ensureDataFile();
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Tag ID required' }, { status: 400 });
        }

        const dataStr = await fs.readFile(DATA_FILE, 'utf-8');
        let tags = JSON.parse(dataStr) as Tag[];
        const tagToDelete = tags.find((t) => t.id === id);

        if (!tagToDelete) {
            return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
        }

        // BOUNDARY CHECK: Usage
        // Check if any account is using this tag (by label)
        const usageCount = await prisma.account.count({
            where: { tag: tagToDelete.label }
        });

        if (usageCount > 0) {
            return NextResponse.json({
                error: `无法删除: 有 ${usageCount} 个账号正在使用此标签。请先修改这些账号的标签。`
            }, { status: 400 });
        }

        // Safe to delete
        tags = tags.filter((t) => t.id !== id);
        await fs.writeFile(DATA_FILE, JSON.stringify(tags, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete tag error:', error);
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }
}
