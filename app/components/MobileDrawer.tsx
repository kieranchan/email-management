'use client';

import { useEffect } from 'react';
import { X, Mail } from 'lucide-react';

interface MobileDrawerProps {
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

/**
 * Mobile drawer component with backdrop
 * Slides in from the left on mobile devices
 */
export default function MobileDrawer({ open, onClose, children }: MobileDrawerProps) {
    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (typeof document !== 'undefined') {
            document.body.style.overflow = open ? 'hidden' : '';
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.body.style.overflow = '';
            }
        };
    }, [open]);

    return (
        <>
            {/* Backdrop */}
            <div
                className={`drawer-backdrop ${open ? 'active' : ''}`}
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <aside className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-modal="true">
                {/* Drawer Header */}
                <div className="drawer-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <Mail size={18} />
                        </div>
                        <span className="sidebar-logo-text">Nexus Mail</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="glass-button"
                        aria-label="Close drawer"
                        style={{ padding: 8 }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Drawer Content */}
                <div className="drawer-content">
                    {children}
                </div>
            </aside>
        </>
    );
}
