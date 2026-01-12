'use client';

import { Inbox, Send, FileText, Archive, Pencil } from 'lucide-react';

export type FolderType = 'inbox' | 'sent' | 'drafts' | 'archive';

interface BottomTabProps {
    activeFolder: FolderType;
    setActiveFolder: (folder: FolderType) => void;
    onComposeClick: () => void;
}

const tabs: { id: FolderType; icon: typeof Inbox; label: string }[] = [
    { id: 'inbox', icon: Inbox, label: '收件箱' },
    { id: 'sent', icon: Send, label: '已发送' },
    // FAB space is in the middle
    { id: 'drafts', icon: FileText, label: '草稿箱' },
    { id: 'archive', icon: Archive, label: '归档' },
];

/**
 * Bottom tab navigation for mobile devices
 * Includes 4 folder tabs and a centered FAB for compose
 */
export default function BottomTab({ activeFolder, setActiveFolder, onComposeClick }: BottomTabProps) {
    return (
        <>
            {/* Bottom Tab Bar */}
            <nav className="bottom-tab" role="tablist">
                {/* First two tabs */}
                {tabs.slice(0, 2).map((tab) => (
                    <button
                        key={tab.id}
                        className={`bottom-tab-item ${activeFolder === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveFolder(tab.id)}
                        role="tab"
                        aria-selected={activeFolder === tab.id}
                    >
                        <tab.icon />
                        <span>{tab.label}</span>
                    </button>
                ))}

                {/* FAB placeholder space */}
                <div className="bottom-tab-fab-space" />

                {/* Last two tabs */}
                {tabs.slice(2).map((tab) => (
                    <button
                        key={tab.id}
                        className={`bottom-tab-item ${activeFolder === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveFolder(tab.id)}
                        role="tab"
                        aria-selected={activeFolder === tab.id}
                    >
                        <tab.icon />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            {/* FAB - Floating Action Button */}
            <button
                className="fab"
                onClick={onComposeClick}
                aria-label="写邮件"
            >
                <Pencil />
            </button>
        </>
    );
}
