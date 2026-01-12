'use client';

import { Layers } from 'lucide-react';

interface Account {
    id: string;
    email: string;
    name: string;
    tag: string;
}

interface Tag {
    id: string;
    label: string;
    color: string;
}

interface TagBadge {
    label: string;
    color: string;
}

interface SidebarAccountsProps {
    accounts: Account[];
    selected: string | null;
    setSelected: (id: string | null) => void;
    tags: Tag[];
    editingTagId: string | null;
    setEditingTagId: (id: string | null) => void;
    getTagBadge: (tag: string) => TagBadge;
    getColor: (name: string) => string;
    updateTag: (accountId: string, tag: string) => void;
}

export default function SidebarAccounts({
    accounts,
    selected,
    setSelected,
    tags,
    editingTagId,
    setEditingTagId,
    getTagBadge,
    getColor,
    updateTag,
}: SidebarAccountsProps) {
    return (
        <div className="sidebar-accounts">
            <div className="sidebar-section-title">
                系统账号 ({accounts.length})
            </div>

            {/* All Accounts Entry */}
            <div
                className={`account-item ${selected === 'all' ? 'selected' : ''}`}
                tabIndex={0}
                role="button"
                onClick={() => setSelected('all')}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected('all'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', cursor: 'pointer', marginBottom: 8 }}
            >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--stroke-2)' }}>
                    <Layers size={16} color="var(--text-1)" />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: selected === 'all' ? 'var(--text-1)' : 'var(--text-2)' }}>
                    全部账号 (聚合)
                </div>
            </div>

            {accounts.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    加载中...
                </div>
            )}

            {accounts.map(a => {
                const badge = getTagBadge(a.tag);
                const isSelected = selected === a.id;
                const isEditingTag = editingTagId === a.id;
                return (
                    <div
                        key={a.id}
                        className={`account-item ${isSelected ? 'selected' : ''}`}
                        tabIndex={0}
                        role="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelected(isSelected ? null : a.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelected(isSelected ? null : a.id);
                            }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', cursor: 'pointer', marginBottom: 4, position: 'relative', zIndex: isEditingTag ? 20 : 1 }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: getColor(a.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                                {a.name?.[0]?.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                <div style={{ fontSize: 14, fontWeight: 500, color: isSelected ? 'var(--text-1)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-3)', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</div>
                            </div>
                        </div>
                        {/* Tag Badge - Clickable */}
                        <div
                            onClick={(e) => { e.stopPropagation(); setEditingTagId(isEditingTag ? null : a.id); }}
                            style={{ flexShrink: 0, padding: '0 8px', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: badge.color, fontSize: 10, fontWeight: 700, color: '#000', cursor: 'pointer', transition: 'transform 0.1s', transform: isEditingTag ? 'scale(1.1)' : 'scale(1)' }}
                            title="点击修改标签"
                        >
                            {badge.label}
                        </div>
                        {/* Tag Dropdown */}
                        {isEditingTag && (
                            <div style={{ position: 'absolute', right: 8, top: '100%', marginTop: 4, background: 'var(--surface-3)', border: '1px solid var(--stroke-2)', borderRadius: 10, padding: 4, zIndex: 50, boxShadow: 'var(--elev-2)' }}>
                                {tags.map(tag => {
                                    const opt = getTagBadge(tag.label);
                                    return (
                                        <div
                                            key={tag.id}
                                            onClick={(e) => { e.stopPropagation(); updateTag(a.id, tag.label); }}
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 12, color: 'var(--text-1)' }}
                                            className="list-item"
                                        >
                                            <div style={{ width: 16, height: 16, borderRadius: 4, background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000' }}>{opt.label}</div>
                                            <span>{tag.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export type { Account, Tag, TagBadge };
