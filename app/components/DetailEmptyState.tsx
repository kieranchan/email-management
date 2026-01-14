'use client';

import { Mail, ArrowLeft, ArrowRight, Search, RefreshCw, Edit3 } from 'lucide-react';

interface DetailEmptyStateProps {
    onComposeClick?: () => void;
    onRefreshClick?: () => void;
    syncing?: boolean;
    lastSyncedAt?: Date | null;
}

export default function DetailEmptyState({
    onComposeClick,
    onRefreshClick,
    syncing = false,
    lastSyncedAt = null,
}: DetailEmptyStateProps) {
    // 格式化相对时间
    const formatRelativeTime = (date: Date): string => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes} 分钟前`;
        if (hours < 24) return `${hours} 小时前`;
        return date.toLocaleDateString('zh-CN');
    };

    return (
        <div className="detail-empty-state">
            {/* Icon */}
            <div className="detail-empty-icon">
                <Mail size={48} strokeWidth={1.2} />
            </div>

            {/* Title */}
            <h3 className="detail-empty-title">选择一封邮件</h3>

            {/* Subtitle */}
            <p className="detail-empty-subtitle">
                从左侧列表中选择邮件查看详情
            </p>

            {/* Keyboard Shortcuts */}
            <div className="detail-empty-shortcuts">
                <div className="shortcut-item">
                    <span className="shortcut-key">
                        <ArrowLeft size={14} />
                    </span>
                    <span className="shortcut-label">上一封</span>
                </div>
                <div className="shortcut-item">
                    <span className="shortcut-key">
                        <ArrowRight size={14} />
                    </span>
                    <span className="shortcut-label">下一封</span>
                </div>
                <div className="shortcut-item">
                    <span className="shortcut-key">C</span>
                    <span className="shortcut-label">写邮件</span>
                </div>
                <div className="shortcut-item">
                    <span className="shortcut-key">/</span>
                    <span className="shortcut-label">搜索</span>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="detail-empty-actions">
                {onComposeClick && (
                    <button onClick={onComposeClick} className="btn-primary">
                        <Edit3 size={16} />
                        写邮件
                    </button>
                )}
                {onRefreshClick && (
                    <button
                        onClick={onRefreshClick}
                        className="btn-secondary"
                        disabled={syncing}
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncing ? '同步中...' : '同步'}
                    </button>
                )}
            </div>

            {/* Sync Status */}
            {lastSyncedAt && (
                <div className="detail-empty-sync-status">
                    <Search size={12} />
                    <span>上次同步: {formatRelativeTime(lastSyncedAt)}</span>
                </div>
            )}
        </div>
    );
}
