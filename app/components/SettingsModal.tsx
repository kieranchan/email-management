'use client';

import { motion } from 'framer-motion';
import { X, Sun, Moon, Check, ArrowLeft } from 'lucide-react';
import { useVisualViewport } from '../hooks/useVisualViewport';

interface AccentColor {
    id: string;
    name: string;
    color: string;
}

interface Tag {
    id: string;
    label: string;
    color: string;
}

interface SettingsModalProps {
    isDark: boolean;
    accent: string;
    accentColors: AccentColor[];
    tags: Tag[];
    tagError: string | null;
    tagLoading: boolean;
    newTagLabel: string;
    newTagColor: string;
    onClose: () => void;
    toggleMode: (dark: boolean) => void;
    changeAccent: (color: string) => void;
    setNewTagLabel: (label: string) => void;
    setNewTagColor: (color: string) => void;
    setTagError: (error: string | null) => void;
    addTag: () => void;
    deleteTag: (id: string) => void;
    isMobile?: boolean;
}

const transitionModal = { type: 'spring', damping: 30, stiffness: 400 };
const transitionBase = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] };

export default function SettingsModal({
    isDark,
    accent,
    accentColors,
    tags,
    tagError,
    tagLoading,
    newTagLabel,
    newTagColor,
    onClose,
    toggleMode,
    changeAccent,
    setNewTagLabel,
    setNewTagColor,
    setTagError,
    addTag,
    deleteTag,
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

                    {/* Tag Management */}
                    <div style={{ marginTop: 24, borderTop: '1px solid var(--stroke-1)', paddingTop: 24 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>标签管理</div>

                        {/* Error Message */}
                        {tagError && (
                            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#ef4444' }}>
                                {tagError}
                            </div>
                        )}

                        {/* Tag List */}
                        <div style={{ marginBottom: 16 }}>
                            {tags.map((tag) => (
                                <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-1)', borderRadius: 8, marginBottom: 6 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: 4, background: tag.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>{tag.label}</span>
                                    <button
                                        onClick={() => deleteTag(tag.id)}
                                        disabled={tagLoading}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: tagLoading ? 'not-allowed' : 'pointer', padding: 4, opacity: tagLoading ? 0.5 : 1 }}
                                        title="删除标签"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add New Tag */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                                title="选择颜色"
                            />
                            <input
                                type="text"
                                value={newTagLabel}
                                onChange={(e) => { setNewTagLabel(e.target.value); setTagError(null); }}
                                placeholder="新标签名称 (如: VIP)"
                                style={{ flex: 1, padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--stroke-1)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
                                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                            />
                            <button
                                onClick={addTag}
                                disabled={tagLoading || !newTagLabel.trim()}
                                style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: tagLoading || !newTagLabel.trim() ? 'not-allowed' : 'pointer', opacity: tagLoading || !newTagLabel.trim() ? 0.5 : 1 }}
                            >
                                添加
                            </button>
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

                    {/* Tag Management */}
                    <div style={{ marginTop: 24, borderTop: '1px solid var(--stroke-1)', paddingTop: 24 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>标签管理</div>

                        {/* Error Message */}
                        {tagError && (
                            <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, marginBottom: 12, fontSize: 12, color: '#ef4444' }}>
                                {tagError}
                            </div>
                        )}

                        {/* Tag List */}
                        <div style={{ marginBottom: 16 }}>
                            {tags.map((tag) => (
                                <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-1)', borderRadius: 8, marginBottom: 6 }}>
                                    <div style={{ width: 16, height: 16, borderRadius: 4, background: tag.color, flexShrink: 0 }} />
                                    <span style={{ flex: 1, fontSize: 13, color: 'var(--text-1)' }}>{tag.label}</span>
                                    <button
                                        onClick={() => deleteTag(tag.id)}
                                        disabled={tagLoading}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: tagLoading ? 'not-allowed' : 'pointer', padding: 4, opacity: tagLoading ? 0.5 : 1 }}
                                        title="删除标签"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add New Tag */}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                                title="选择颜色"
                            />
                            <input
                                type="text"
                                value={newTagLabel}
                                onChange={(e) => { setNewTagLabel(e.target.value); setTagError(null); }}
                                placeholder="新标签名称 (如: VIP)"
                                style={{ flex: 1, padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--stroke-1)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
                                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                            />
                            <button
                                onClick={addTag}
                                disabled={tagLoading || !newTagLabel.trim()}
                                style={{ padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: tagLoading || !newTagLabel.trim() ? 'not-allowed' : 'pointer', opacity: tagLoading || !newTagLabel.trim() ? 0.5 : 1 }}
                            >
                                添加
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
