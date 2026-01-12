'use client';

import { Send, Wifi, WifiOff, RefreshCw } from 'lucide-react';

type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface TopBarProps {
    folderName: string;
    selected: string | null;
    selectedAccountName: string | undefined;
    connectionStatus: ConnectionStatus;
    syncing: boolean;
    lastSyncedAt: Date | null;
    onComposeClick: () => void;
}

export default function TopBar({
    folderName,
    selected,
    selectedAccountName,
    connectionStatus,
    syncing,
    lastSyncedAt,
    onComposeClick,
}: TopBarProps) {
    return (
        <div className="topbar">
            <div className="topbar-title">
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
                <button onClick={onComposeClick} className="btn-primary">
                    <Send size={14} />
                    写邮件
                </button>
            </div>
        </div>
    );
}

export type { ConnectionStatus };
