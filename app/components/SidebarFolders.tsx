'use client';

import { Inbox, Send, FileText, Archive } from 'lucide-react';

export type FolderType = 'inbox' | 'sent' | 'drafts' | 'archive';

interface SidebarFoldersProps {
    activeFolder: FolderType;
    setActiveFolder: (folder: FolderType) => void;
}

const FOLDERS = [
    { id: 'inbox' as FolderType, icon: Inbox, label: '收件箱' },
    { id: 'sent' as FolderType, icon: Send, label: '已发送' },
    { id: 'drafts' as FolderType, icon: FileText, label: '草稿箱' },
    { id: 'archive' as FolderType, icon: Archive, label: '归档' },
];

export default function SidebarFolders({ activeFolder, setActiveFolder }: SidebarFoldersProps) {
    return (
        <div className="sidebar-nav">
            {FOLDERS.map((folder) => {
                const isActive = activeFolder === folder.id;
                const Icon = folder.icon;
                return (
                    <div
                        key={folder.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveFolder(folder.id)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setActiveFolder(folder.id);
                            }
                        }}
                        className={`folder-item ${isActive ? 'selected' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer', marginBottom: 2 }}
                    >
                        <Icon size={18} style={{ opacity: isActive ? 1 : 0.7 }} />
                        <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400 }}>{folder.label}</span>
                    </div>
                );
            })}
        </div>
    );
}
