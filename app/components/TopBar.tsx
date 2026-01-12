'use client';

import { Send, Wifi, WifiOff, RefreshCw, Menu } from 'lucide-react';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface TopBarProps {
    folderName: string;
    selected: string | null;
    selectedAccountName: string | undefined;
    connectionStatus: ConnectionStatus;
    syncing: boolean;
    lastSyncedAt: string | null;
    onComposeClick: () => void;
    /** Mobile: show menu button */
    isMobile?: boolean;
    /** Mobile: callback when menu button clicked */
    onMenuClick?: () => void;
}

export default function TopBar({
    folderName,
    selected,
    selectedAccountName,
    connectionStatus,
    syncing,
    lastSyncedAt,
    onComposeClick,
    isMobile = false,
    onMenuClick,
}: TopBarProps) {
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
                {/* P7: 连接状态指示器 */}
                <div
                    className={`connection-status ${connectionStatus}`}
                    title={lastSyncedAt ? `上次同步: ${new Date(lastSyncedAt).toLocaleTimeString()}` : '尚未同步'}
                >
                    {connectionStatus === 'connected' ? (
                        <><Wifi size={14} /> 在线</>
                    ) : connectionStatus === 'reconnecting' ? (
                        <><RefreshCw size={14} className="animate-spin" /> 重连中</>
                    ) : (
                        <><WifiOff size={14} /> 离线</>
                    )}
                    {syncing && <RefreshCw size={12} className="animate-spin" style={{ marginLeft: 4 }} />}
                </div>
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
