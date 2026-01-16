'use client';

import { useState, useMemo } from 'react';
import { Layers, Search, X } from 'lucide-react';

interface Account {
    id: string;
    email: string;
    name: string;
}

interface SidebarAccountsProps {
    accounts: Account[];
    selected: string | null;
    setSelected: (id: string | null) => void;
    getColor: (name: string) => string;
}

export default function SidebarAccounts({
    accounts,
    selected,
    setSelected,
    getColor,
}: SidebarAccountsProps) {
    // 搜索状态
    const [searchQuery, setSearchQuery] = useState('');

    // 筛选后的账号列表
    const filteredAccounts = useMemo(() => {
        return accounts.filter(a => {
            const query = searchQuery.toLowerCase();
            return !query ||
                (a.name?.toLowerCase() || '').includes(query) ||
                (a.email?.toLowerCase() || '').includes(query);
        });
    }, [accounts, searchQuery]);

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

            {/* 标题行 */}
            <div className="sidebar-section-title">
                系统账号 ({filteredAccounts.length})
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

            {/* 账号列表 */}
            {filteredAccounts.map(a => {
                const isSelected = selected === a.id;
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
                    </div>
                );
            })}
        </div>
    );
}

export type { Account };
