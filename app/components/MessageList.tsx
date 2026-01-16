'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mail, Check, Archive, Trash2, Clock, User, Star, Paperclip, MailOpen, Search, X, CheckSquare } from 'lucide-react';
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
}

interface BatchProgress {
    current: number;
    total: number;
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
    // M7: 搜索支持
    searchQuery?: string;
    onSearchChange?: (query: string) => void;
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
    searchQuery = '',
    onSearchChange,
}: MessageListProps) {
    // M6: 筛选和排序状态
    const [filter, setFilter] = useState<FilterType>('all');
    const [sort, setSort] = useState<SortType>('date');

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

    const hasActiveFilter = filter !== 'all';

    // 上下文菜单状态
    const [contextMenu, setContextMenu] = useState<{
        email: Email;
        position: { x: number; y: number };
    } | null>(null);

    // 长按处理逻辑 (不使用 Hook，避免在循环中调用)
    const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
    const swipeHandledRef = useRef(false);

    const handleTouchStart = useCallback((e: Email) => (event: React.TouchEvent) => {
        const touch = event.touches[0];
        if (!touch) return;

        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
        swipeHandledRef.current = false;
        longPressTimerRef.current = setTimeout(() => {
            setContextMenu({
                email: e,
                position: { x: touch.clientX, y: touch.clientY },
            });
        }, 500);
    }, []);

    const handleTouchEnd = useCallback((email: Email) => (event: React.TouchEvent) => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        const touch = event.changedTouches[0];
        if (touch && touchStartPosRef.current) {
            const deltaX = touch.clientX - touchStartPosRef.current.x;
            const deltaY = touch.clientY - touchStartPosRef.current.y;
            // 右滑选择：水平位移足够且垂直偏移小
            if (deltaX > 45 && Math.abs(deltaY) < 30) {
                swipeHandledRef.current = true;
                event.preventDefault();
                event.stopPropagation();
                toggleSelect(email.id, true);
            }
        }
        touchStartPosRef.current = null;
    }, [toggleSelect]);

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
        <div className="message-list">
            {/* M7: 增强筛选芯片（始终可见） */}
            <div className="list-toolbar-enhanced">
                {/* M7: 搜索输入框 */}
                {onSearchChange && (
                    <div className="search-box">
                        <Search size={14} className="search-icon" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="搜索邮件..."
                            className="search-input"
                        />
                        {searchQuery && (
                            <button
                                className="search-clear-btn"
                                onClick={() => onSearchChange('')}
                                title="清空搜索"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                )}

                {/* 筛选行：全选 + 芯片 + 排序同一行，避免割裂 */}
                <div className="filters-row">
                    <div className="select-all-wrapper">
                        <input
                            type="checkbox"
                            checked={filteredEmails.length > 0 && filteredEmails.every(e => selectedIds.has(e.id))}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    // Bug #34: 先清空再全选，避免跨上下文累积
                                    clearSelection();
                                    filteredEmails.forEach(email => toggleSelect(email.id, true));
                                } else {
                                    clearSelection();
                                }
                            }}
                            className="select-all-checkbox"
                            title={filteredEmails.every(e => selectedIds.has(e.id)) ? '取消全选' : '全选当前列表'}
                        />
                    </div>

                    <div className="filter-chips">
                        <button
                            className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
                            onClick={() => setFilter('all')}
                        >
                            全部
                            <span className="chip-count">{stats.total}</span>
                        </button>
                        <button
                            className={`filter-chip ${filter === 'unread' ? 'active' : ''}`}
                            onClick={() => setFilter('unread')}
                        >
                            <MailOpen size={12} />
                            未读
                            <span className="chip-count">{stats.unread}</span>
                        </button>
                        <button
                            className={`filter-chip ${filter === 'starred' ? 'active' : ''}`}
                            onClick={() => setFilter('starred')}
                        >
                            <Star size={12} />
                            星标
                            <span className="chip-count">{stats.starred}</span>
                        </button>
                        <button
                            className={`filter-chip ${filter === 'attachment' ? 'active' : ''}`}
                            onClick={() => setFilter('attachment')}
                        >
                            <Paperclip size={12} />
                            附件
                            <span className="chip-count">{stats.attachment}</span>
                        </button>

                        <button
                            className={`filter-clear-btn ${hasActiveFilter ? '' : 'hidden'}`}
                            onClick={() => setFilter('all')}
                            title="清空筛选"
                            type="button"
                        >
                            ✕ 清空
                        </button>
                    </div>

                    <div className="sort-toggle">
                        <button
                            className={`sort-btn ${sort === 'date' ? 'active' : ''}`}
                            onClick={() => setSort('date')}
                            title="按时间排序"
                        >
                            <Clock size={14} />
                        </button>
                        <button
                            className={`sort-btn ${sort === 'from' ? 'active' : ''}`}
                            onClick={() => setSort('from')}
                            title="按发件人排序"
                        >
                            <User size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="message-list-body email-list-scroll-area">
                {/* 批量操作栏 */}
                {(selectedIds.size > 0 || batchProgress) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="glass batch-action-bar"
                    >
                        {batchProgress ? (
                            <div className="batch-progress">
                                <div className="batch-spinner" />
                                <span className="batch-progress-text">
                                    处理中... {batchProgress.current}/{batchProgress.total}
                                </span>
                            </div>
                        ) : (
                            <div className="batch-action-content">
                                <div className="batch-action-summary">
                                    <CheckSquare size={14} />
                                    <span>已选择 {selectedIds.size} 封</span>
                                </div>
                                <div className="batch-action-buttons">
                                    <button onClick={batchMarkRead} className="batch-action-btn">
                                        <Check size={12} />
                                        已读
                                    </button>
                                    <button onClick={batchArchive} className="batch-action-btn">
                                        <Archive size={12} />
                                        归档
                                    </button>
                                    <button onClick={batchDelete} className="batch-action-btn danger">
                                        <Trash2 size={12} />
                                        删除
                                    </button>
                                    <button onClick={clearSelection} className="batch-action-btn ghost">
                                        取消
                                    </button>
                                </div>
                            </div>
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
                        onClick={() => {
                            if (swipeHandledRef.current) {
                                swipeHandledRef.current = false;
                                return;
                            }
                            selectEmail(e);
                        }}
                        onKeyDown={(ev) => {
                            if (ev.key === 'Enter' || ev.key === ' ') {
                                ev.preventDefault();
                                selectEmail(e);
                            }
                        }}
                        onTouchStart={handleTouchStart(e)}
                        onTouchEnd={handleTouchEnd(e)}
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
                                        <span className="email-account-tag" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 500, flexShrink: 0, whiteSpace: 'nowrap' }}>
                                            {e.accountLabel}
                                        </span>
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
        </div>
    );
}

export type { Email, BatchProgress, FilterType, SortType };
