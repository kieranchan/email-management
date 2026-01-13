'use client';

import { Send, Wifi, WifiOff, RefreshCw, Menu, AlertCircle } from 'lucide-react';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface TopBarProps {
    folderName: string;
    selected: string | null;
    selectedAccountName: string | undefined;
    connectionStatus: ConnectionStatus;
    syncing: boolean;
    lastSyncedAt: string | null;
    syncError?: string | null;
    onComposeClick: () => void;
    onRefreshClick?: () => void;
    /** Mobile: show menu button */
    isMobile?: boolean;
    /** Mobile: callback when menu button clicked */
    onMenuClick?: () => void;
}

// 格式化相对时间
function formatRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;

    return date.toLocaleDateString();
}

export default function TopBar({
    folderName,
    selected,
    selectedAccountName,
    connectionStatus,
    syncing,
    lastSyncedAt,
    syncError,
    onComposeClick,
    onRefreshClick,
    isMobile = false,
    onMenuClick,
}: TopBarProps) {
    // 状态文案
    const getStatusText = () => {
        if (syncing) return '同步中...';
        if (syncError) return '同步失败';
        switch (connectionStatus) {
            case 'connected': return '在线';
            case 'reconnecting': return '重连中';
            case 'disconnected': return '离线';
            default: return '未知';
        }
    };

    // 状态图标
    const getStatusIcon = () => {
        if (syncing) return <RefreshCw size={14} className="animate-spin" />;
        if (syncError) return <AlertCircle size={14} />;
        switch (connectionStatus) {
            case 'connected': return <Wifi size={14} />;
            case 'reconnecting': return <RefreshCw size={14} className="animate-spin" />;
            case 'disconnected': return <WifiOff size={14} />;
            default: return <WifiOff size={14} />;
        }
    };

    // 状态 tooltip
    const getStatusTooltip = () => {
        let tooltip = getStatusText();
        if (lastSyncedAt) {
            tooltip += `\n上次同步: ${formatRelativeTime(lastSyncedAt)}`;
        }
        if (syncError) {
            tooltip += `\n错误: ${syncError}`;
        }
        return tooltip;
    };

    return (
        <div className="topbar">
            <div className="topbar-title">
                {/* Mobile: Menu button */}
                {isMobile && onMenuClick && (
                    <button
                        className="mobile-menu-btn"
                        onClick={onMenuClick}
                        aria-label="Open menu"
                    >
                        <Menu size={20} />
                    </button>
                )}
                <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>
                    {folderName}
                </span>
                {selected && (
                    <span className="topbar-account-badge">
                        {selected === 'all' ? '全部账号' : selectedAccountName}
                    </span>
                )}
            </div>
            <div className="topbar-actions">
                {/* M6: 同步状态指示器 - 增强版 */}
                <div
                    className={`connection-status ${syncError ? 'error' : connectionStatus}`}
                    title={getStatusTooltip()}
                >
                    {getStatusIcon()}
                    <span className="sync-status-text">{getStatusText()}</span>
                    {lastSyncedAt && !syncing && !syncError && (
                        <span className="sync-time">{formatRelativeTime(lastSyncedAt)}</span>
                    )}
                </div>

                {/* M6: 刷新/同步按钮 - 显著的位置 */}
                {onRefreshClick && (
                    <button
                        className={`sync-refresh-btn ${syncing ? 'syncing' : ''} ${syncError ? 'has-error' : ''}`}
                        onClick={onRefreshClick}
                        disabled={syncing}
                        title={syncError ? '点击重试' : '刷新邮件'}
                        aria-label={syncError ? '重试同步' : '刷新邮件'}
                    >
                        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                        {syncError && <span className="retry-text">重试</span>}
                    </button>
                )}

                {/* Desktop: Show compose button, Mobile: hidden (use FAB instead) */}
                {!isMobile && (
                    <button onClick={onComposeClick} className="btn-primary">
                        <Send size={14} />
                        写邮件
                    </button>
                )}
            </div>
        </div>
    );
}

export type { ConnectionStatus };
