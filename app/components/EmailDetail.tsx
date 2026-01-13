'use client';

import { useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trash2, Archive, Send, ChevronLeft, ChevronRight, Star, Mail, MailOpen, Forward } from 'lucide-react';

interface Email {
  id: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  content?: string;
  snippet?: string;
  archived?: boolean;
  unread?: boolean;
  starred?: boolean;
}

interface EmailDetailProps {
  email: Email;
  getColor: (name: string) => string;
  onClose: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onMarkRead?: (id: string, read: boolean) => void;
  onStar?: (id: string, starred: boolean) => void;
  onForward?: (email: Email) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  isMobile?: boolean;
}

const transitionBase = { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] };

export default function EmailDetail({
  email,
  getColor,
  onClose,
  onDelete,
  onArchive,
  onMarkRead,
  onStar,
  onForward,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  isMobile = false,
}: EmailDetailProps) {
  // M6: 键盘导航支持
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'ArrowLeft' && hasPrev && onPrev) {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'ArrowRight' && hasNext && onNext) {
      e.preventDefault();
      onNext();
    }
  }, [hasPrev, hasNext, onPrev, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isMobile ? '100%' : 20, y: 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: isMobile ? '100%' : 20, y: 0 }}
      transition={transitionBase}
      className="glass-lg"
      style={{
        // Mobile: fixed full-screen, Desktop: sidebar panel
        position: isMobile ? 'fixed' : 'relative',
        inset: isMobile ? 0 : undefined,
        width: isMobile ? '100%' : 700,
        height: isMobile ? '100%' : undefined,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        zIndex: isMobile ? 200 : 10, // Above BottomTab (z-index: 100)
        padding: 0,
        borderLeft: isMobile ? 'none' : '1px solid var(--stroke-1)',
        borderRadius: isMobile ? 0 : undefined,
      }}
    >
      {/* Detail Header */}
      <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderBottom: '1px solid var(--stroke-1)' }}>
        <button
          onClick={onClose}
          className="glass-button"
          style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title="返回列表"
        >
          <ArrowLeft size={18} />
        </button>

        {/* M6: 上一封/下一封导航 */}
        <div className="email-nav-buttons" style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="glass-button"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: hasPrev ? 'pointer' : 'not-allowed',
              opacity: hasPrev ? 1 : 0.4
            }}
            title="上一封 (←)"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="glass-button"
            style={{
              width: 32, height: 32, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: hasNext ? 'pointer' : 'not-allowed',
              opacity: hasNext ? 1 : 0.4
            }}
            title="下一封 (→)"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)', flex: 1 }}>邮件详情</span>

        {/* M6: 操作按钮组 */}
        <div className="email-action-buttons" style={{ display: 'flex', gap: 4 }}>
          {/* 标记已读/未读 */}
          {onMarkRead && (
            <button
              onClick={() => onMarkRead(email.id, email.unread === true)}
              className="glass-button"
              style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title={email.unread ? '标记已读' : '标记未读'}
            >
              {email.unread ? <MailOpen size={16} /> : <Mail size={16} />}
            </button>
          )}

          {/* 星标 */}
          {onStar && (
            <button
              onClick={() => onStar(email.id, !email.starred)}
              className="glass-button"
              style={{
                width: 32, height: 32, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: email.starred ? '#fbbf24' : undefined
              }}
              title={email.starred ? '取消星标' : '加星标'}
            >
              <Star size={16} fill={email.starred ? '#fbbf24' : 'none'} />
            </button>
          )}

          {/* 转发 */}
          {onForward && (
            <button
              onClick={() => onForward(email)}
              className="glass-button"
              style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title="转发"
            >
              <Forward size={16} />
            </button>
          )}

          {/* 删除 */}
          <button
            onClick={() => onDelete(email.id)}
            className="glass-button"
            style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}
            title="删除邮件"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Email Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'var(--stroke-2) transparent' }}>
        {/* Subject */}
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 12, lineHeight: 1.3 }}>
          {email.subject || '(无主题)'}
        </h2>

        {/* Sender Info */}
        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--stroke-1)' }}>
          {/* Date - Top Right */}
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textAlign: 'right' }}>
            {email.date ? new Date(email.date).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            }) : ''}
          </div>

          {/* Sender Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: getColor(email.from),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 600,
              color: '#fff',
              flexShrink: 0
            }}>
              {email.from?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2, wordBreak: 'break-all' }}>
                {email.from}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', wordBreak: 'break-all' }}>
                收件人: {email.to || '未知'}
              </div>
            </div>
          </div>
        </div>

        {/* Email Body - Using iframe for CSS isolation with auto-height */}
        <div style={{ marginTop: 8 }}>
          {email.content ? (
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <style>
                      * { box-sizing: border-box; }
                      html, body { 
                        margin: 0; 
                        padding: 0;
                        overflow: hidden;
                      }
                      body { 
                        padding: 16px; 
                        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; 
                        font-size: 14px; 
                        line-height: 1.6; 
                        color: #333;
                        background: #fafafa;
                        word-wrap: break-word;
                      }
                      a { color: #0066cc; text-decoration: none; }
                      a:hover { text-decoration: underline; }
                      img { 
                        max-width: 100%; 
                        height: auto;
                        content-visibility: auto;
                        contain-intrinsic-size: 200px;
                      }
                      blockquote, .gmail_quote {
                        margin: 8px 0;
                        padding: 0 0 0 10px;
                        border-left: 2px solid #0066cc;
                        color: #666;
                      }
                      pre {
                        background: #f0f0f0;
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                        font-size: 13px;
                      }
                      table { border-collapse: collapse; max-width: 100%; }
                      td, th { padding: 6px 8px; border: 1px solid #ddd; }
                      p { margin: 0 0 8px 0; }
                    </style>
                  </head>
                  <body>${email.content}</body>
                </html>
              `}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 6,
                minHeight: 200
              }}
              onLoad={(e) => {
                const iframe = e.target as HTMLIFrameElement;
                if (iframe.contentDocument) {
                  const height = iframe.contentDocument.body.scrollHeight;
                  iframe.style.height = height + 'px';
                }
              }}
              sandbox="allow-same-origin"
              title="Email content"
            />
          ) : (
            <div style={{
              background: '#fafafa',
              borderRadius: 6,
              padding: 16,
              color: '#999',
              fontStyle: 'italic'
            }}>
              {email.snippet || '暂无邮件内容预览'}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '0 20px', borderTop: '1px solid var(--stroke-1)' }}>
        <button
          onClick={() => onArchive(email.id, !email.archived)}
          className="glass-button"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
        >
          <Archive size={14} />
          {email.archived ? '恢复' : '归档'}
        </button>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
          <Send size={14} />
          回复
        </button>
      </div>
    </motion.div>
  );
}
