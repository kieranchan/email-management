'use client';

import { motion } from 'framer-motion';
import { X, Sun, Moon, Check, ArrowLeft } from 'lucide-react';
import { useVisualViewport } from '../hooks/useVisualViewport';

interface AccentColor {
    id: string;
    name: string;
    color: string;
}

interface SettingsModalProps {
    isDark: boolean;
    accent: string;
    accentColors: AccentColor[];
    onClose: () => void;
    toggleMode: (dark: boolean) => void;
    changeAccent: (color: string) => void;
    previewAccent?: (color: string | null) => void;
    resetAccent?: () => void;
    defaultAccent?: string;
    isMobile?: boolean;
}

const transitionModal = { type: 'spring', damping: 30, stiffness: 400 };
const transitionBase = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] };

export default function SettingsModal({
    isDark,
    accent,
    accentColors,
    onClose,
    toggleMode,
    changeAccent,
    previewAccent,
    resetAccent,
    defaultAccent = '#8b5cf6',
    isMobile = false,
}: SettingsModalProps) {
    // M5.1: Keyboard detection for mobile
    const { keyboardHeight, isKeyboardOpen } = useVisualViewport();

    // Mobile: Fullscreen view
    if (isMobile) {
        return (
            <motion.div
                initial={{ x: '100%', opacity: 0.8 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0.8 }}
                transition={transitionBase}
                style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 200,
                    background: 'var(--bg-0)',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                {/* Header */}
                <div className="view-header">
                    <button
                        onClick={onClose}
                        className="glass-button"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <span>设置</span>
                    <div style={{ width: 36 }} /> {/* Spacer for centering */}
                </div>

                {/* Content (scrollable, keyboard-aware) */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 24,
                    paddingBottom: isKeyboardOpen ? keyboardHeight + 24 : 24,
                    transition: 'padding-bottom 0.15s ease-out',
                }}>
                    {/* Theme Mode */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>主题模式</div>
                        <div style={{ display: 'flex', gap: 10, background: 'var(--bg-0)', padding: 4, borderRadius: 12, border: '1px solid var(--stroke-1)' }}>
                            <button
                                onClick={() => toggleMode(false)}
                                style={{ flex: 1, padding: '10px', borderRadius: 8, background: !isDark ? 'var(--surface-3)' : 'transparent', color: !isDark ? 'var(--text-1)' : 'var(--text-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s', fontWeight: !isDark ? 600 : 400 }}
                            >
                                <Sun size={16} /> Light
                            </button>
                            <button
                                onClick={() => toggleMode(true)}
                                style={{ flex: 1, padding: '10px', borderRadius: 8, background: isDark ? 'var(--surface-3)' : 'transparent', color: isDark ? 'var(--text-1)' : 'var(--text-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s', fontWeight: isDark ? 600 : 400 }}
                            >
                                <Moon size={16} /> Dark
                            </button>
                        </div>
                    </div>

                    {/* Accent Colors */}
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>强调色</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            {accentColors.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => changeAccent(c.color)}
                                    style={{ padding: 10, borderRadius: 10, background: 'var(--surface-1)', border: `2px solid ${accent === c.color ? c.color : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                                >
                                    <div style={{ width: 14, height: 14, borderRadius: 4, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {accent === c.color && <Check size={10} color="#fff" />}
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    }

    // Desktop: Modal
    return (
        <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="modal-overlay"
        >
            <motion.div
                initial={{ scale: 0.98, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10, transition: { duration: 0.15 } }}
                transition={transitionModal}
                onClick={(ev) => ev.stopPropagation()}
                className="modal-card"
                style={{ width: 360, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--stroke-1)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 16 }}>设置</span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                {/* Content */}
                <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                    {/* Theme Mode */}
                    <div style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>主题模式</div>
                        <div style={{ display: 'flex', gap: 10, background: 'var(--bg-0)', padding: 4, borderRadius: 12, border: '1px solid var(--stroke-1)' }}>
                            <button
                                onClick={() => toggleMode(false)}
                                style={{ flex: 1, padding: '10px', borderRadius: 8, background: !isDark ? 'var(--surface-3)' : 'transparent', color: !isDark ? 'var(--text-1)' : 'var(--text-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s', fontWeight: !isDark ? 600 : 400 }}
                            >
                                <Sun size={16} /> Light
                            </button>
                            <button
                                onClick={() => toggleMode(true)}
                                style={{ flex: 1, padding: '10px', borderRadius: 8, background: isDark ? 'var(--surface-3)' : 'transparent', color: isDark ? 'var(--text-1)' : 'var(--text-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s', fontWeight: isDark ? 600 : 400 }}
                            >
                                <Moon size={16} /> Dark
                            </button>
                        </div>
                    </div>

                    {/* Accent Colors */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>强调色</span>
                            {resetAccent && accent !== defaultAccent && (
                                <button
                                    onClick={resetAccent}
                                    style={{ fontSize: 11, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                    title="重置为默认强调色"
                                >
                                    重置默认
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                            {accentColors.map((c) => (
                                <button
                                    key={c.id}
                                    onClick={() => changeAccent(c.color)}
                                    onMouseEnter={() => previewAccent?.(c.color)}
                                    onMouseLeave={() => previewAccent?.(null)}
                                    style={{ padding: 10, borderRadius: 10, background: 'var(--surface-1)', border: `2px solid ${accent === c.color ? c.color : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}
                                    title={`选择 ${c.name}`}
                                >
                                    <div style={{ width: 14, height: 14, borderRadius: 4, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {accent === c.color && <Check size={10} color="#fff" />}
                                    </div>
                                    <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
