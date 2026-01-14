'use client';

import { useState, useMemo } from 'react';
import { Layers, Search, ChevronDown, ChevronRight, X } from 'lucide-react';

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
    // 搜索状态
    const [searchQuery, setSearchQuery] = useState('');
    // 标签筛选状态（null = 显示全部，string = 筛选特定标签）
    const [filterTag, setFilterTag] = useState<string | null>(null);
    // 标签折叠状态
    const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());
    // 显示标签图例
    const [showTagLegend, setShowTagLegend] = useState(false);

    // 筛选后的账号列表
    const filteredAccounts = useMemo(() => {
        return accounts.filter(a => {
            // 搜索筛选
            const query = searchQuery.toLowerCase();
            const matchesSearch = !query || 
                (a.name?.toLowerCase() || '').includes(query) || 
                (a.email?.toLowerCase() || '').includes(query);
            
            // 标签筛选
            const matchesTag = !filterTag || a.tag === filterTag;
            
            return matchesSearch && matchesTag;
        });
    }, [accounts, searchQuery, filterTag]);

    // 按标签分组的账号
    const accountsByTag = useMemo(() => {
        const grouped: Record<string, Account[]> = {};
        filteredAccounts.forEach(a => {
            const tag = a.tag || '未分类';
            if (!grouped[tag]) grouped[tag] = [];
            grouped[tag].push(a);
        });
        return grouped;
    }, [filteredAccounts]);

    // 切换标签折叠
    const toggleCollapse = (tag: string) => {
        setCollapsedTags(prev => {
            const next = new Set(prev);
            if (next.has(tag)) next.delete(tag);
            else next.add(tag);
            return next;
        });
    };

    // 获取标签列表
    const tagLabels = useMemo(() => {
        const usedTags = new Set(accounts.map(a => a.tag));
        return tags.filter(t => usedTags.has(t.label));
    }, [accounts, tags]);

    return (
        <div className="sidebar-accounts">
            {/* 搜索框 */}
            <div className="account-search-wrapper">
                <Search size={14} className="account-search-icon" />
                <input
                    type="text"
                    className="account-search-input"
                    placeholder="搜索账号..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button 
                        className="account-search-clear"
                        onClick={() => setSearchQuery('')}
                        aria-label="清除搜索"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>

            {/* 标签图例/筛选区 */}
            <div className="tag-legend-section">
                <button 
                    className="tag-legend-toggle"
                    onClick={() => setShowTagLegend(!showTagLegend)}
                >
                    <span>标签筛选</span>
                    {showTagLegend ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                
                {showTagLegend && (
                    <div className="tag-legend-list">
                        <button 
                            className={`tag-legend-item ${!filterTag ? 'active' : ''}`}
                            onClick={() => setFilterTag(null)}
                        >
                            <div className="tag-legend-dot" style={{ background: 'var(--text-3)' }} />
                            <span>全部</span>
                            <span className="tag-legend-count">{accounts.length}</span>
                        </button>
                        {tagLabels.map(tag => {
                            const count = accounts.filter(a => a.tag === tag.label).length;
                            return (
                                <button 
                                    key={tag.id}
                                    className={`tag-legend-item ${filterTag === tag.label ? 'active' : ''}`}
                                    onClick={() => setFilterTag(filterTag === tag.label ? null : tag.label)}
                                >
                                    <div className="tag-legend-dot" style={{ background: tag.color }} />
                                    <span>{tag.label}</span>
                                    <span className="tag-legend-count">{count}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 标题行 */}
            <div className="sidebar-section-title">
                系统账号 ({filteredAccounts.length}{filterTag ? ` · ${filterTag}` : ''})
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

            {filteredAccounts.length === 0 && accounts.length > 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    未找到匹配的账号
                </div>
            )}

            {accounts.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                    加载中...
                </div>
            )}

            {/* 按标签分组显示账号 */}
            {Object.entries(accountsByTag).map(([tagName, tagAccounts]) => {
                const isCollapsed = collapsedTags.has(tagName);
                const tagInfo = tags.find(t => t.label === tagName);
                
                return (
                    <div key={tagName} className="account-tag-group">
                        {/* 标签分组标题（仅在有多个标签时显示） */}
                        {Object.keys(accountsByTag).length > 1 && (
                            <button 
                                className="account-tag-header"
                                onClick={() => toggleCollapse(tagName)}
                            >
                                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                <div 
                                    className="account-tag-dot"
                                    style={{ background: tagInfo?.color || 'var(--text-3)' }}
                                />
                                <span>{tagName}</span>
                                <span className="account-tag-count">{tagAccounts.length}</span>
                            </button>
                        )}

                        {/* 账号列表 */}
                        {!isCollapsed && tagAccounts.map(a => {
                            const badge = getTagBadge(a.tag);
                            const isSelected = selected === a.id;
                            const isEditingTag = editingTagId === a.id;
                            return (
                                <div
                                    key={a.id}
                                    className={`account-item ${isSelected ? 'selected current-account' : ''}`}
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
                                    style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: 12, 
                                        padding: '8px 12px', 
                                        cursor: 'pointer', 
                                        marginBottom: 4, 
                                        position: 'relative', 
                                        zIndex: isEditingTag ? 20 : 1,
                                        marginLeft: Object.keys(accountsByTag).length > 1 ? 8 : 0
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                                        <div style={{ 
                                            width: 32, 
                                            height: 32, 
                                            borderRadius: '50%', 
                                            background: getColor(a.name), 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontSize: 13, 
                                            fontWeight: 600, 
                                            color: '#fff', 
                                            flexShrink: 0, 
                                            boxShadow: isSelected ? '0 0 0 2px var(--accent-1), 0 2px 5px rgba(0,0,0,0.2)' : '0 2px 5px rgba(0,0,0,0.2)'
                                        }}>
                                            {a.name?.[0]?.toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                                            <div style={{ 
                                                fontSize: 14, 
                                                fontWeight: isSelected ? 600 : 500, 
                                                color: isSelected ? 'var(--text-1)' : 'var(--text-2)', 
                                                whiteSpace: 'nowrap', 
                                                overflow: 'hidden', 
                                                textOverflow: 'ellipsis' 
                                            }}>
                                                {a.name}
                                            </div>
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
            })}
        </div>
    );
}

export type { Account, Tag, TagBadge };
