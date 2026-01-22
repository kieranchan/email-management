'use client';

import { useEffect, useRef } from 'react';
import { Archive, Trash2, Eye, EyeOff } from 'lucide-react';

interface Email {
    id: string;
    unread?: boolean;
}

interface EmailContextMenuProps {
    email: Email;
    position: { x: number; y: number };
    onClose: () => void;
    onMarkRead: (id: string, read: boolean) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
}

/**
 * 邮件长按上下文菜单组件
 * 
 * 功能：
 * - 显示快捷操作菜单（标记已读/未读、归档、删除）
 * - 自动调整位置避免超出屏幕
 * - 点击外部自动关闭
 */
export default function EmailContextMenu({
    email,
    position,
    onClose,
    onMarkRead,
    onArchive,
    onDelete,
}: EmailContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        // 延迟添加监听器，避免立即触发
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }, 100);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [onClose]);

    // 自动调整菜单位置
    const getMenuStyle = (): React.CSSProperties => {
        const menuWidth = 180;
        const menuHeight = 200; // 估算高度
        const padding = 16;

        let left = position.x;
        let top = position.y;

        // 右边界检查
        if (left + menuWidth > window.innerWidth - padding) {
            left = window.innerWidth - menuWidth - padding;
        }

        // 下边界检查
        if (top + menuHeight > window.innerHeight - padding) {
            top = position.y - menuHeight;
        }

        // 左边界检查
        if (left < padding) {
            left = padding;
        }

        // 上边界检查
        if (top < padding) {
            top = padding;
        }

        return {
            left: `${left}px`,
            top: `${top}px`,
        };
    };

    const handleAction = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <div
            ref={menuRef}
            className="email-context-menu"
            style={getMenuStyle()}
        >
            {/* 标记已读/未读 */}
            <button
                className="email-context-menu-item"
                onClick={() => handleAction(() => onMarkRead(email.id, !email.unread))}
            >
                {email.unread ? <Eye size={16} /> : <EyeOff size={16} />}
                <span>{email.unread ? '标记已读' : '标记未读'}</span>
            </button>

            {/* 归档 */}
            <button
                className="email-context-menu-item"
                onClick={() => handleAction(() => onArchive(email.id))}
            >
                <Archive size={16} />
                <span>归档</span>
            </button>

            {/* 删除 */}
            <button
                className="email-context-menu-item danger"
                onClick={() => handleAction(() => onDelete(email.id))}
            >
                <Trash2 size={16} />
                <span>删除</span>
            </button>
        </div>
    );
}
