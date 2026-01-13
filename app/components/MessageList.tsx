'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, Archive, Trash2, Filter, Clock, User, Star, Paperclip, MailOpen } from 'lucide-react';
import EmailContextMenu from './EmailContextMenu';

interface Email {
    id: string;
    from: string;
    subject: string;
    date: string;
    unread?: boolean;
    starred?: boolean;
    hasAttachment?: boolean;
    snippet?: string;
    content?: string;
    accountLabel?: string;
    accountColorTag?: string;
}

interface BatchProgress {
    current: number;
    total: number;
}

interface TagBadge {
    label: string;
    color: string;
}

type FilterType = 'all' | 'unread' | 'starred' | 'attachment';
type SortType = 'date' | 'from';

interface MessageListProps {
    emails: Email[];
    loading: boolean;
    folderEmpty: { title: string; hint: string };
    selectedEmail: Email | null;
    selectedIds: Set<string>;
    batchProgress: BatchProgress | null;
    selected: string | null;
    getColor: (name: string) => string;
    getTagBadge: (tag: string) => TagBadge;
    getPreview: (email: Email) => string;
    selectEmail: (email: Email) => void;
    toggleSelect: (id: string, checked: boolean) => void;
    clearSelection: () => void;
    batchMarkRead: () => void;
    batchArchive: () => void;
    batchDelete: () => void;
    markAsRead: (id: string) => void;
    markAsUnread: (id: string) => void;
    archiveSingle: (id: string) => void;
    deleteSingle: (id: string) => void;
    onRefresh?: () => void;
}

const transitionBase = { type: 'spring', damping: 25, stiffness: 300 };

// 清理 HTML 片段，提取纯文本预览
function cleanSnippet(html: string): string {
    if (!html) return '';
    // 移除 HTML 标签
    const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    // 截断到合理长度
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
}

export default function MessageList({
    emails,
    loading,
    folderEmpty,
    selectedEmail,
    selectedIds,
    batchProgress,
    selected,
    getColor,
    getTagBadge,
    getPreview,
    selectEmail,
    toggleSelect,
    clearSelection,
    batchMarkRead,
    batchArchive,
    batchDelete,
    markAsRead,
    markAsUnread,
    archiveSingle,
    deleteSingle,
    onRefresh,
}: MessageListProps) {
    // M6: 筛选和排序状态
    const [filter, setFilter] = useState<FilterType>('all');
    const [sort, setSort] = useState<SortType>('date');
    const [showFilterBar, setShowFilterBar] = useState(false);

    // 筛选和排序后的邮件列表
    const filteredEmails = useMemo(() => {
        let result = [...emails];

        // 应用筛选
        switch (filter) {
            case 'unread':
                result = result.filter(e => e.unread);
                break;
            case 'starred':
                result = result.filter(e => e.starred);
                break;
            case 'attachment':
                result = result.filter(e => e.hasAttachment);
                break;
        }

        // 应用排序
        result.sort((a, b) => {
            if (sort === 'date') {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            } else {
                return (a.from || '').localeCompare(b.from || '');
            }
        });

        return result;
    }, [emails, filter, sort]);

    // 统计数据
    const stats = useMemo(() => ({
        total: emails.length,
        unread: emails.filter(e => e.unread).length,
        starred: emails.filter(e => e.starred).length,
        attachment: emails.filter(e => e.hasAttachment).length,
    }), [emails]);

    // 上下文菜单状态
    const [contextMenu, setContextMenu] = useState<{
        email: Email;
        position: { x: number; y: number };
    } | null>(null);

    // 长按处理逻辑 (不使用 Hook，避免在循环中调用)
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

    const handleTouchStart = useCallback((e: Email) => (event: React.TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;

        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        longPressTimerRef.current = setTimeout(() => {
            setContextMenu({
                email: e,
                position: { x: touch.clientX, y: touch.clientY },
            });
        }, 500);
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        touchStartPosRef.current = null;
    }, []);

    const handleTouchMove = useCallback((event: React.TouchEvent) => {
        if (!touchStartPosRef.current) return;
        const touch = event.touches[0];
        if (!touch) return;

        const deltaX = Math.abs(touch.clientX - touchStartPosRef.current.x);
        const deltaY = Math.abs(touch.clientY - touchStartPosRef.current.y);

        // 移动超过 10px，取消长按
        if (deltaX > 10 || deltaY > 10) {
            if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
            }
            touchStartPosRef.current = null;
        }
    }, []);

    return (
        <div className="message-list email-list-scroll-area">
            {/* M6: 筛选/排序工具栏 */}
            <div className="list-toolbar">
                <button
                    className={`toolbar-filter-btn ${showFilterBar ? 'active' : ''}`}
                    onClick={() => setShowFilterBar(!showFilterBar)}
                    title="筛选与排序"
                >
                    <Filter size={14} />
                    <span>筛选</span>
                    {filter !== 'all' && <span className="filter-badge">{stats[filter]}</span>}
                </button>

                {showFilterBar && (
                    <div className="filter-bar">
                        {/* 筛选按钮组 */}
                        <div className="filter-group">
                            <button
                                className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
                                onClick={() => setFilter('all')}
                            >
                                全部 ({stats.total})
                            </button>
                            <button
                                className={`filter-chip ${filter === 'unread' ? 'active' : ''}`}
                                onClick={() => setFilter('unread')}
                            >
                                <MailOpen size={12} />
                                未读 ({stats.unread})
                            </button>
                            <button
                                className={`filter-chip ${filter === 'starred' ? 'active' : ''}`}
                                onClick={() => setFilter('starred')}
                            >
                                <Star size={12} />
                                星标 ({stats.starred})
                            </button>
                            <button
                                className={`filter-chip ${filter === 'attachment' ? 'active' : ''}`}
                                onClick={() => setFilter('attachment')}
                            >
                                <Paperclip size={12} />
                                附件 ({stats.attachment})
                            </button>
                        </div>

                        {/* 排序切换 */}
                        <div className="sort-group">
                            <span className="sort-label">排序:</span>
                            <button
                                className={`sort-chip ${sort === 'date' ? 'active' : ''}`}
                                onClick={() => setSort('date')}
                            >
                                <Clock size={12} />
                                时间
                            </button>
                            <button
                                className={`sort-chip ${sort === 'from' ? 'active' : ''}`}
                                onClick={() => setSort('from')}
                            >
                                <User size={12} />
                                发件人
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 批量操作栏 */}
            {(selectedIds.size > 0 || batchProgress) && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="glass batch-action-bar"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 16px',
                        marginBottom: 16,
                        borderRadius: 10,
                    }}
                >
                    {batchProgress ? (
                        <>
                            <div style={{
                                width: 16, height: 16, border: '2px solid var(--accent)',
                                borderTopColor: 'transparent', borderRadius: '50%',
                                animation: 'spin 1s linear infinite'
                            }} />
                            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                                处理中... {batchProgress.current}/{batchProgress.total}
                            </span>
                            <div style={{
                                flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden',
                                maxWidth: 200
                            }}>
                                <motion.div
                                    style={{
                                        height: '100%', background: 'var(--accent)', borderRadius: 2
                                    }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                                    transition={{ duration: 0.2 }}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                                已选择 {selectedIds.size} 封邮件
                            </span>
                            <button onClick={batchMarkRead} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                                <Check size={12} />
                                标记已读
                            </button>
                            <button onClick={batchArchive} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                                <Archive size={12} />
                                批量归档
                            </button>
                            <button onClick={batchDelete} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>
                                <Trash2 size={12} />
                                批量删除
                            </button>
                            <button onClick={clearSelection} className="glass-button" style={{ padding: '6px 12px', fontSize: 12 }}>
                                取消选择
                            </button>
                        </>
                    )}
                </motion.div>
            )}

            {/* 加载状态 - 骨架屏 */}
            {loading && (
                <div className="email-skeleton-list">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="email-skeleton-item">
                            <div className="skeleton-avatar" />
                            <div className="skeleton-content">
                                <div className="skeleton-line short" />
                                <div className="skeleton-line long" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 空状态 */}
            {!loading && filteredEmails.length === 0 && (
                <div style={{ textAlign: 'center', padding: 100, color: 'var(--text-3)' }}>
                    <Mail size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                    {emails.length === 0 ? (
                        <>
                            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: 'var(--text-2)' }}>{folderEmpty.title}</div>
                            <div style={{ fontSize: 13, marginBottom: 16 }}>{folderEmpty.hint}</div>
                            {onRefresh && (
                                <button onClick={onRefresh} className="btn-secondary">
                                    刷新邮件
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: 'var(--text-2)' }}>
                                没有符合条件的邮件
                            </div>
                            <div style={{ fontSize: 13, marginBottom: 16 }}>
                                尝试更改筛选条件
                            </div>
                            <button onClick={() => setFilter('all')} className="btn-secondary">
                                显示全部
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* 邮件列表 */}
            {filteredEmails.map((e, i) => (
                <motion.div
                    key={e.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectEmail(e)}
                    onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                            ev.preventDefault();
                            selectEmail(e);
                        }
                    }}
                    onTouchStart={handleTouchStart(e)}
                    onTouchEnd={handleTouchEnd}
                    onTouchMove={handleTouchMove}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, ...transitionBase }}
                    className={`message-row ${e.unread ? 'unread' : ''} ${selectedEmail?.id === e.id ? 'selected' : ''}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', marginBottom: 10, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                >
                    {/* 多选框 */}
                    <input
                        type="checkbox"
                        checked={selectedIds.has(e.id)}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => toggleSelect(e.id, ev.target.checked)}
                        className="message-checkbox"
                        style={{
                            width: 16,
                            height: 16,
                            accentColor: 'var(--accent)',
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    />
                    {e.unread && <div className="unread-indicator" style={{ position: 'absolute', left: 0, top: 12, bottom: 12, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: getColor(e.from), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginLeft: e.unread ? 6 : 0 }}>
                        {e.from?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {/* 第一行：发件人 + 状态图标 + 时间 */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                            <div style={{ fontSize: 15, fontWeight: e.unread ? 600 : 500, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1, overflow: 'hidden' }}>
                                <span className="email-from" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 1 }}>
                                    {e.from}
                                </span>
                                {/* 状态图标：星标、附件 */}
                                <div className="email-status-icons">
                                    {e.starred && <Star size={12} className="email-starred-icon" />}
                                    {e.hasAttachment && <Paperclip size={12} className="email-attachment-icon" />}
                                </div>
                                {(selected === 'all' || !selected) && e.accountLabel && (
                                    (() => {
                                        const badge = getTagBadge(e.accountColorTag || '');
                                        return (
                                            <span className="email-account-tag" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: badge.color, color: '#000', fontWeight: 700, opacity: 0.9, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                                {e.accountLabel}
                                            </span>
                                        );
                                    })()
                                )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-ui)', flexShrink: 0, marginLeft: 8 }}>
                                {e.date ? new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </div>
                        </div>
                        {/* 第二行：主题 + 摘要 */}
                        <div className="email-subject-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span className="email-subject" style={{ fontSize: 14, color: e.unread ? 'var(--text-1)' : 'var(--text-2)', fontWeight: e.unread ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50%' }}>
                                {e.subject || '(无主题)'}
                            </span>
                            <span style={{ fontSize: 13, color: 'var(--text-4)' }}>-</span>
                            <span className="email-snippet" style={{ fontSize: 13, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                {cleanSnippet(getPreview(e))}
                            </span>
                        </div>
                    </div>
                </motion.div>
            ))}

            {/* 上下文菜单 */}
            {contextMenu && (
                <EmailContextMenu
                    email={contextMenu.email}
                    position={contextMenu.position}
                    onClose={() => setContextMenu(null)}
                    onMarkRead={(id, read) => {
                        if (read) {
                            markAsRead(id);
                        } else {
                            markAsUnread(id);
                        }
                    }}
                    onArchive={archiveSingle}
                    onDelete={deleteSingle}
                />
            )}
        </div>
    );
}

export type { Email, BatchProgress, FilterType, SortType };
