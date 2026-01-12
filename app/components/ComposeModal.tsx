'use client';

import { motion } from 'framer-motion';
import { X, RefreshCw } from 'lucide-react';

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
}

const transitionModal = { type: 'spring', damping: 30, stiffness: 400 };

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
}: ComposeModalProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transitionModal}
            onClick={onClose}
            className="modal-overlay"
        >
            <motion.div
                initial={{ scale: 0.98, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.98, opacity: 0, y: 6 }}
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
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={20} /></button>
                </div>

                {/* Form Content */}
                <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* From Select */}
                    <div style={{ position: 'relative' }}>
                        <select
                            value={form.from}
                            onChange={(ev) => setForm({ ...form, from: ev.target.value })}
                            style={{ width: '100%', padding: '12px', paddingRight: 32, background: 'var(--surface-1)', border: '1px solid var(--stroke-1)', borderRadius: 10, color: 'var(--text-1)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}
                        >
                            <option value="" style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>选择发件人...</option>
                            {accounts.map((a) => (
                                <option key={a.id} value={a.id} style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>{a.name} ({a.email})</option>
                            ))}
                        </select>
                        <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }}>
                            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                    </div>

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
