'use client';

import { motion } from 'framer-motion';
import { X, RefreshCw, ArrowLeft, Send } from 'lucide-react';
import SenderDropdown from './SenderDropdown';
import { useVisualViewport } from '../hooks/useVisualViewport';

interface Account {
    id: string;
    email: string;
    name: string;
    tag: string;
}

interface ComposeForm {
    from: string;
    to: string;
    subject: string;
    content: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ComposeModalProps {
    accounts: Account[];
    form: ComposeForm;
    setForm: (form: ComposeForm) => void;
    sending: boolean;
    sendError: string | null;
    saveStatus: SaveStatus;
    onClose: () => void;
    onSend: () => void;
    onDiscard: () => void;
    isMobile?: boolean;
}

const transitionModal = { type: 'spring', damping: 30, stiffness: 400 };
const transitionBase = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] };

export default function ComposeModal({
    accounts,
    form,
    setForm,
    sending,
    sendError,
    saveStatus,
    onClose,
    onSend,
    onDiscard,
    isMobile = false,
}: ComposeModalProps) {
    // Keyboard detection for mobile
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
                        aria-label="返回"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <span>写邮件</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Save status indicator */}
                        <div style={{ fontSize: 11, fontWeight: 500 }}>
                            {saveStatus === 'saving' && <span className="animate-pulse" style={{ color: 'var(--text-3)' }}>保存中</span>}
                            {saveStatus === 'saved' && <span style={{ color: 'var(--accent)' }}>已保存</span>}
                            {saveStatus === 'error' && <span style={{ color: '#ef4444' }}>失败</span>}
                        </div>
                        <button
                            onClick={onSend}
                            disabled={sending}
                            className="btn-primary"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 16px',
                                cursor: sending ? 'not-allowed' : 'pointer',
                                opacity: sending ? 0.8 : 1,
                                fontSize: 14,
                            }}
                        >
                            {sending ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    发送中
                                </>
                            ) : (
                                <>
                                    <Send size={14} />
                                    发送
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Form Content (scrollable, keyboard-aware) */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 16,
                    paddingBottom: isKeyboardOpen ? keyboardHeight + 16 : 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    transition: 'padding-bottom 0.15s ease-out',
                }}>
                    <SenderDropdown
                        accounts={accounts}
                        value={form.from}
                        onChange={(accountId) => setForm({ ...form, from: accountId })}
                    />

                    <input
                        value={form.to}
                        onChange={(ev) => setForm({ ...form, to: ev.target.value })}
                        placeholder="收件人"
                        className="input-glass"
                    />
                    <input
                        value={form.subject}
                        onChange={(ev) => setForm({ ...form, subject: ev.target.value })}
                        placeholder="主题"
                        className="input-glass"
                    />
                    <textarea
                        value={form.content}
                        onChange={(ev) => setForm({ ...form, content: ev.target.value })}
                        placeholder="正文内容..."
                        className="textarea-glass"
                        style={{ minHeight: 300 }}
                    />

                    {/* Error Message */}
                    {sendError && (
                        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                            {sendError}
                        </div>
                    )}

                    {/* Discard button at bottom */}
                    <button
                        onClick={onDiscard}
                        className="btn-secondary"
                        style={{ justifyContent: 'center', color: '#ef4444', borderColor: '#ef4444' }}
                    >
                        丢弃草稿
                    </button>
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
                style={{ width: 520, overflow: 'hidden' }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--stroke-1)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 16 }}>写邮件</span>
                    <div className="text-sm font-medium flex items-center gap-2" style={{ fontSize: 12 }}>
                        {saveStatus === 'saving' && <span className="animate-pulse" style={{ color: 'var(--text-3)' }}>保存中...</span>}
                        {saveStatus === 'saved' && <span style={{ color: 'var(--accent)' }}>已保存</span>}
                        {saveStatus === 'error' && <span style={{ color: '#ef4444' }}>保存失败</span>}
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }} aria-label="关闭"><X size={20} /></button>
                </div>

                {/* Form Content */}
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* From Select */}
                    {/* From Dropdown */}
                    <SenderDropdown
                        accounts={accounts}
                        value={form.from}
                        onChange={(accountId) => setForm({ ...form, from: accountId })}
                    />

                    <input
                        value={form.to}
                        onChange={(ev) => setForm({ ...form, to: ev.target.value })}
                        placeholder="收件人"
                        className="input-glass"
                    />
                    <input
                        value={form.subject}
                        onChange={(ev) => setForm({ ...form, subject: ev.target.value })}
                        placeholder="主题"
                        className="input-glass"
                    />
                    <textarea
                        value={form.content}
                        onChange={(ev) => setForm({ ...form, content: ev.target.value })}
                        placeholder="正文内容..."
                        className="textarea-glass"
                    />

                    {/* Error Message */}
                    {sendError && (
                        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                            {sendError}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 12 }}>
                        <button
                            onClick={onDiscard}
                            className="btn-secondary"
                            style={{ flex: 1, justifyContent: 'center', color: '#ef4444', borderColor: '#ef4444' }}
                        >
                            丢弃
                        </button>
                        <button
                            onClick={onSend}
                            disabled={sending}
                            className="btn-primary"
                            style={{ flex: 2, justifyContent: 'center', cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.8 : 1 }}
                        >
                            {sending ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    发送中...
                                </>
                            ) : '发送邮件'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

export type { ComposeForm, SaveStatus };
