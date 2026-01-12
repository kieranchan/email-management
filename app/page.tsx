"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, RefreshCw, Send, Inbox, Archive, Settings, FileText, X, Moon, Sun, Check, ArrowLeft, Layers, Trash2 } from 'lucide-react';

// 强调色定义
const ACCENT_COLORS = [
  { id: 'purple', name: '紫色', color: '#8b5cf6' },
  { id: 'blue', name: '蓝色', color: '#3b82f6' },
  { id: 'green', name: '绿色', color: '#10b981' },
  { id: 'orange', name: '橙色', color: '#f59e0b' },
  { id: 'pink', name: '粉色', color: '#ec4899' },
  { id: 'red', name: '红色', color: '#ef4444' },
];

interface Account { id: string; email: string; name: string; tag: string; }
interface Email {
  id: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  unread?: boolean;
  snippet?: string;
  content?: string;
  archived?: boolean;
  isDraft?: boolean;
  accountLabel?: string;
  accountColorTag?: string;
  uid?: number;          // IMAP UID，用于同步
  accountId?: string;    // 账号 ID，用于同步
}
interface Tag { id: string; label: string; color: string; }

// Fallback tags if API fails
const FALLBACK_TAGS: Tag[] = [
  { id: 'vip', label: 'VIP', color: '#fbbf24' },
  { id: 'important', label: '重要', color: '#a78bfa' },
  { id: 'normal', label: '普通', color: '#60a5fa' },
  { id: 'low', label: '低优先', color: '#34d399' },
  { id: 'admin', label: '管理', color: '#ef4444' }
];

const avatarColors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffd93d', '#a29bfe', '#fd79a8', '#00b894'];
const getColor = (s: string) => avatarColors[(s?.charCodeAt(0) || 0) % avatarColors.length];

// Dynamic tag badge lookup
function makeTagBadge(tags: Tag[]) {
  return (tag: string) => {
    const t = tag?.toLowerCase() || '';
    const found = tags.find(tr => t.includes(tr.label.toLowerCase()));
    if (found) {
      // Use first character as short label
      const short = found.label[0];
      return { color: found.color, label: short };
    }
    return { color: '#9ca3af', label: '?' };
  };
}

export default function Dashboard() {
  const [isDark, setIsDark] = useState(true);
  const [accent, setAccent] = useState('#8b5cf6');
  const [showSettings, setShowSettings] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [compose, setCompose] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | null>(null);
  const [form, setForm] = useState({ from: '', to: '', subject: '', content: '' });
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<string>(''); // 动效增强：自定义 Toast 消息

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null); // 批量操作进度

  // WebSocket 连接用于接收实时更新和同步结果
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Auto-save Debounce Effect
  useEffect(() => {
    if (!compose) return;

    // Don't save if empty or no sender
    if ((!form.to && !form.subject && !form.content) || !form.from) return;

    const timer = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch('/api/drafts/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draftId,
            accountId: form.from,
            to: form.to,
            subject: form.subject,
            htmlBody: form.content,
            textBody: form.content // Simple fallback
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.id) setDraftId(data.id);
          setSaveStatus('saved');
          // Refresh list if in drafts folder to show new draft immediately
          if (activeFolder === 'drafts') {
            loadEmails();
          }
        } else {
          setSaveStatus('error');
        }
      } catch (err) {
        console.error('Auto-save failed', err);
        setSaveStatus('error');
      }
    }, 2000); // 2s debounce

    return () => clearTimeout(timer);
  }, [form, compose, draftId]);

  // Reset state when closing
  useEffect(() => {
    if (!compose) {
      setDraftId(null);
      setSaveStatus(null);
      setSendError(null);
    }
  }, [compose]);

  // WebSocket 连接：接收实时邮件更新和同步结果
  // WebSocket connection: new mail push + sync results with auto-reconnect
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      // avoid duplicate open connections
      if (socket && socket.readyState === WebSocket.OPEN) return;

      try {
        // 使用环境变量配置 WebSocket URL，默认为本地开发地址
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
        socket = new WebSocket(wsUrl);
        setWs(socket);

        socket.onopen = () => {
          console.log('[WS] Connected to worker');
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'new_email') {
              loadEmails();
            } else if (data.type === 'sync_result') {
              console.log('[WS] Sync result:', data);
              setSyncing(false);
              loadEmails();
            }
          } catch (e) {
            console.error('[WS] Parse error:', e);
          }
        };

        socket.onerror = () => {
          console.warn('[WS] Connect failed - worker may be stopped (npm run worker)');
        };

        socket.onclose = () => {
          console.log('[WS] Disconnected, reconnecting in 5s...');
          setWs(null);
          setSyncing(false);
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch (e) {
        console.error('[WS] Connection failed:', e);
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  // Folder Navigation
  type FolderType = 'inbox' | 'sent' | 'drafts' | 'archive';
  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');

  const FOLDER_NAMES: Record<FolderType, string> = {
    inbox: '收件箱',
    sent: '已发送',
    drafts: '草稿箱',
    archive: '归档'
  };

  const FOLDER_EMPTY: Record<FolderType, { title: string; hint: string }> = {
    inbox: { title: '收件箱为空', hint: '点击"同步"获取最新邮件' },
    sent: { title: '暂无已发送邮件', hint: '点击"写邮件"发送第一封' },
    drafts: { title: '暂无草稿', hint: '开始写新邮件' },
    archive: { title: '归档为空', hint: '归档功能用于清理收件箱' }
  };

  // Dynamic Tags
  const [tags, setTags] = useState<Tag[]>(FALLBACK_TAGS);
  const getTagBadge = useMemo(() => makeTagBadge(tags), [tags]);

  // Tag Editing
  const [editingTagId, setEditingTagId] = useState<string | null>(null);

  // Tag Management (Settings Panel)
  const [newTagLabel, setNewTagLabel] = useState('');
  const [newTagColor, setNewTagColor] = useState('#9ca3af');
  const [tagError, setTagError] = useState<string | null>(null);
  const [tagLoading, setTagLoading] = useState(false);

  async function updateTag(accountId: string, newTag: string) {
    const res = await fetch(`/api/accounts/?id=${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: newTag })
    });
    if (res.ok) {
      // Update local state
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, tag: newTag } : a));
    }
    setEditingTagId(null);
  }



  // Load dynamic tags from API
  async function loadTags() {
    try {
      const r = await fetch('/api/settings/tags/');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setTags(data);
        }
      }
    } catch {
      // Keep fallback tags on error
    }
  }

  // Load email details
  async function selectEmail(email: Email) {
    // If it's a draft, open compose instead of details
    if (activeFolder === 'drafts') {
      try {
        // Fetch full draft details
        const r = await fetch(`/api/drafts/${email.id}/`);
        if (r.ok) {
          const draft = await r.json();
          setForm({
            from: draft.accountId,
            to: draft.to || '',
            subject: draft.subject || '',
            content: draft.htmlBody || draft.textBody || ''
          });
          setDraftId(draft.id);
          setCompose(true);
        }
      } catch (e) {
        console.error("Failed to load draft", e);
      }
      return;
    }

    setSelectedEmail(email);

    // If content is missing, fetch details
    if (!email.content && !email.isDraft) {
      try {
        const r = await fetch(`/api/messages/${email.id}/`);
        if (r.ok) {
          const detail = await r.json();
          setSelectedEmail(prev => prev?.id === email.id ? { ...prev, ...detail } : prev);
          // 更新邮件的 uid 和 accountId 用于后续同步
          if (detail.uid) email.uid = detail.uid;
          if (detail.accountId) email.accountId = detail.accountId;
        }
      } catch (e) {
        console.error('Failed to load email details', e);
      }
    }

    // 标记为已读（如果是未读邮件）
    if (email.unread) {
      try {
        const r = await fetch(`/api/messages/${email.id}/seen/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seen: true })
        });
        if (r.ok) {
          const result = await r.json();
          // 更新本地状态
          setEmails(prev => prev.map(e => e.id === email.id ? { ...e, unread: false } : e));
          setSelectedEmail(prev => prev?.id === email.id ? { ...prev, unread: false } : prev);

          // 通过 WebSocket 同步到 IMAP
          if (ws && ws.readyState === WebSocket.OPEN && result.uid && result.accountId) {
            ws.send(JSON.stringify({
              type: 'markSeen',
              accountId: result.accountId,
              uid: result.uid
            }));
            console.log('[WS] Sent markSeen:', result.uid);
          }
        }
      } catch (e) {
        console.error('Failed to mark as read', e);
      }
    }
  }

  // Define functions BEFORE useEffect
  async function loadEmails() {
    setLoading(true);

    // Drafts use a different API endpoint
    if (activeFolder === 'drafts') {
      const r = await fetch(selected && selected !== 'all' ? `/api/drafts/?scope=account&accountId=${selected}` : '/api/drafts/?scope=all');
      if (r.ok) {
        const data = await r.json();
        const enhanced = data.items?.map((d: { id: string; to?: string; subject?: string; updatedAt?: string; preview?: string; account?: { name?: string; tag?: string } }) => ({
          id: d.id,
          from: d.to || '(无收件人)',
          subject: d.subject || '(无主题)',
          date: d.updatedAt,
          unread: false,
          snippet: d.preview || '(草稿)',
          content: '',
          isDraft: true,
          accountLabel: d.account?.name,
          accountColorTag: d.account?.tag
        })) || [];
        setEmails(enhanced);
      }
      setLoading(false);
      return;
    }

    // For inbox/sent/archive, use the new messages API
    let url = `/api/messages/?folderType=${activeFolder}&limit=50`;
    if (selected === 'all' || !selected) {
      url += `&scope=all`;
    } else {
      url += `&scope=account&accountId=${selected}`;
    }

    const r = await fetch(url);
    if (r.ok) {
      const data = await r.json();
      // Map API response to UI model
      const enhanced = (data.items || []).map((e: { id: string; from?: string; to?: string; subject?: string; date?: string; unread?: boolean; snippet?: string; archived?: boolean; accountLabel?: string; accountColorTag?: string; uid?: number; accountId?: string }) => ({
        id: e.id,
        from: e.from,
        to: e.to,
        subject: e.subject,
        date: e.date,
        unread: e.unread,
        snippet: e.snippet,
        content: '', // Detail loaded on demand
        archived: e.archived,
        accountLabel: e.accountLabel,
        accountColorTag: e.accountColorTag
      }));
      setEmails(enhanced);
    }
    setLoading(false);
  }

  // Add new tag
  async function addTag() {
    if (!newTagLabel.trim()) {
      setTagError('标签名称不能为空');
      return;
    }
    setTagLoading(true);
    setTagError(null);
    try {
      const r = await fetch('/api/settings/tags/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newTagLabel.trim(), color: newTagColor })
      });
      if (r.ok) {
        setNewTagLabel('');
        setNewTagColor('#9ca3af');
        await loadTags();
      } else {
        const data = await r.json();
        setTagError(data.error || '添加失败');
      }
    } catch {
      setTagError('网络错误');
    }
    setTagLoading(false);
  }

  // Delete tag
  async function deleteTag(tagId: string) {
    setTagLoading(true);
    setTagError(null);
    try {
      const r = await fetch(`/api/settings/tags/?id=${tagId}`, { method: 'DELETE' });
      if (r.ok) {
        await loadTags();
      } else {
        const data = await r.json();
        setTagError(data.error || '删除失败');
      }
    } catch {
      setTagError('网络错误');
    }
    setTagLoading(false);
  }

  async function load() {
    await loadTags();
    const r = await fetch('/api/accounts/');
    if (r.ok) setAccounts(await r.json());
    // Auto select 'all' if no selection
    if (!selected) setSelected('all');
  }

  // Init Logic - 自动加载所有系统账号
  useEffect(() => {
    const savedMode = localStorage.getItem('theme-mode');
    const savedAccent = localStorage.getItem('theme-accent');
    const mode = savedMode === 'light' ? 'light' : 'dark';
    setIsDark(mode === 'dark');
    document.documentElement.setAttribute('data-theme', mode);
    if (savedAccent) setAccent(savedAccent);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
  }, [accent]);

  // 切换账号或文件夹时自动加载邮件
  useEffect(() => {
    loadEmails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeFolder]);


  function toggleMode(targetMode: boolean) {
    setIsDark(targetMode);
    const modeStr = targetMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', modeStr);
    localStorage.setItem('theme-mode', modeStr);
  }

  function changeAccent(color: string) {
    setAccent(color);
    localStorage.setItem('theme-accent', color);
  }

  async function sync() {
    setSyncing(true);

    // 如果选中了特定账号（非 'all'）且 WebSocket 已连接，通过 Worker 同步（复用现有 IMAP 连接，毫秒级）
    if (selected && selected !== 'all' && ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'sync', accountId: selected }));
      // syncing 状态会在收到 sync_result 消息时关闭
      return;
    }

    // Fallback: 刷新邮件列表
    await loadEmails();
    setSyncing(false);
  }

  async function sendEmail() {
    if (!form.from) { setSendError('请选择发件账号'); return; }
    if (!form.to) { setSendError('请填写收件人'); return; }

    setSending(true);
    setSendError(null);

    try {
      const r = await fetch('/api/send/', {
        method: 'POST',
        body: JSON.stringify({ accountId: form.from, ...form }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (r.ok) {
        setCompose(false);
        // Cleanup draft if exists
        if (draftId) {
          await fetch(`/api/drafts/${draftId}/`, { method: 'DELETE' });
        }
        await loadEmails(); // Refresh list to remove draft or show sent email
        setForm({ from: '', to: '', subject: '', content: '' });
        // Show success toast
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
      } else {
        const d = await r.json();
        setSendError(d.error || '发送失败，请重试');
      }
    } catch {
      setSendError('网络错误，无法发送');
    }
    setSending(false);
  }

  async function discardDraft() {
    if (!confirm('确定要丢弃草稿吗？此操作无法撤销。')) return;

    if (draftId) {
      try {
        await fetch(`/api/drafts/${draftId}/`, { method: 'DELETE' });
      } catch (e) {
        console.error('Failed to delete draft', e);
      }
    }

    setCompose(false);
    setForm({ from: '', to: '', subject: '', content: '' });
    setDraftId(null);
    setSaveStatus(null);

    if (activeFolder === 'drafts') {
      loadEmails();
    }
  }

  // Archive/Restore email
  async function archiveEmail(emailId: string, archive: boolean) {
    const r = await fetch('/api/actions/archive/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId: emailId, archived: archive })
    });
    if (r.ok) {
      const result = await r.json();

      // 通过 WebSocket 同步到 IMAP
      if (ws && ws.readyState === WebSocket.OPEN && result.uid && result.accountId) {
        ws.send(JSON.stringify({
          type: 'archive',
          accountId: result.accountId,
          uid: result.uid,
          archive: archive
        }));
        console.log('[WS] Sent archive:', result.uid, 'archive:', archive);
      }

      // Close detail panel and refresh list
      setSelectedEmail(null);
      await loadEmails();
    }
  }

  // Delete email
  async function deleteEmail(emailId: string) {
    if (!confirm('确定要永久删除这封邮件吗？此操作不可撤销。')) {
      return;
    }

    const r = await fetch(`/api/messages/${emailId}/`, {
      method: 'DELETE'
    });
    if (r.ok) {
      const result = await r.json();

      // 通过 WebSocket 同步到 IMAP
      if (ws && ws.readyState === WebSocket.OPEN && result.uid && result.accountId) {
        ws.send(JSON.stringify({
          type: 'delete',
          accountId: result.accountId,
          uid: result.uid
        }));
        console.log('[WS] Sent delete:', result.uid);
      }

      // Close detail panel and refresh list
      setSelectedEmail(null);
      await loadEmails();

      // 显示成功 Toast
      setToastMessage('🗑️ 邮件已删除');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }
  }

  const transitionBase = { duration: 0.15, ease: [0.2, 0.8, 0.2, 1] };
  const transitionModal = { duration: 0.18, ease: [0.2, 0.8, 0.2, 1] };
  const getPreview = (e: Email) => e.snippet || "No preview available for this message...";

  // 多选操作函数
  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function batchMarkRead() {
    const ids = Array.from(selectedIds);
    const total = ids.length;
    setBatchProgress({ current: 0, total });

    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const r = await fetch(`/api/messages/${id}/seen/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seen: true })
        });
        if (r.ok) {
          const result = await r.json();
          successCount++;
          // 同步到 IMAP
          if (ws && ws.readyState === WebSocket.OPEN && result.uid && result.accountId) {
            ws.send(JSON.stringify({ type: 'markSeen', accountId: result.accountId, uid: result.uid }));
          }
        }
        setBatchProgress({ current: i + 1, total });
      } catch (e) {
        console.error('Batch mark read failed:', id, e);
      }
    }

    setBatchProgress(null);
    clearSelection();
    await loadEmails();

    // 显示成功 Toast
    setToastMessage(`✅ 已标记 ${successCount} 封邮件为已读`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  async function batchArchive() {
    const ids = Array.from(selectedIds);
    const total = ids.length;
    setBatchProgress({ current: 0, total });

    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const r = await fetch('/api/actions/archive/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: id, archived: true })
        });
        if (r.ok) {
          const result = await r.json();
          successCount++;
          // 同步到 IMAP
          if (ws && ws.readyState === WebSocket.OPEN && result.uid && result.accountId) {
            ws.send(JSON.stringify({ type: 'archive', accountId: result.accountId, uid: result.uid, archive: true }));
          }
        }
        setBatchProgress({ current: i + 1, total });
      } catch (e) {
        console.error('Batch archive failed:', id, e);
      }
    }

    setBatchProgress(null);
    clearSelection();
    await loadEmails();

    // 显示成功 Toast
    setToastMessage(`📦 已归档 ${successCount} 封邮件`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  async function batchDelete() {
    if (!confirm(`确定要永久删除 ${selectedIds.size} 封邮件吗？此操作不可撤销。`)) {
      return;
    }

    const ids = Array.from(selectedIds);
    const total = ids.length;
    setBatchProgress({ current: 0, total });

    let successCount = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      try {
        const r = await fetch(`/api/messages/${id}/`, {
          method: 'DELETE'
        });
        if (r.ok) {
          const result = await r.json();
          successCount++;
          // 同步到 IMAP
          if (ws && ws.readyState === WebSocket.OPEN && result.uid && result.accountId) {
            ws.send(JSON.stringify({ type: 'delete', accountId: result.accountId, uid: result.uid }));
          }
        }
        setBatchProgress({ current: i + 1, total });
      } catch (e) {
        console.error('Batch delete failed:', id, e);
      }
    }

    setBatchProgress(null);
    clearSelection();
    await loadEmails();

    // 显示成功 Toast
    setToastMessage(`🗑️ 已删除 ${successCount} 封邮件`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <div className="glass-lg" style={{ width: 260, display: 'flex', flexDirection: 'column', zIndex: 10, padding: 0 }}>
        {/* Header */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '1px solid var(--stroke-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 0 10px var(--accent)' }}>
              <Mail size={18} />
            </div>
            <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Nexus Mail</span>
          </div>
          <button onClick={() => setShowSettings(true)} className="glass-button" style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} title="设置">
            <Settings size={16} />
          </button>
        </div>

        {/* Account List - 自动显示所有系统账号 */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'var(--stroke-2) transparent' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '0 8px 8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            系统账号 ({accounts.length})
          </div>

          {/* All Accounts Entry */}
          <div
            className={`account-item ${selected === 'all' ? 'selected' : ''}`}
            tabIndex={0}
            role="button"
            onClick={() => setSelected('all')}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelected('all'); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', cursor: 'pointer', marginBottom: 8 }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '1px solid var(--stroke-2)' }}>
              <Layers size={16} color="var(--text-1)" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: selected === 'all' ? 'var(--text-1)' : 'var(--text-2)' }}>
              全部账号 (聚合)
            </div>
          </div>
          {accounts.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              加载中...
            </div>
          )}
          {accounts.map(a => {
            const badge = getTagBadge(a.tag);
            const isSelected = selected === a.id;
            const isEditingTag = editingTagId === a.id;
            return (
              <div
                key={a.id}
                className={`account-item ${isSelected ? 'selected' : ''}`}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? null : a.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(isSelected ? null : a.id);
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', cursor: 'pointer', marginBottom: 4, position: 'relative', zIndex: isEditingTag ? 20 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: getColor(a.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }}>
                    {a.name?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: isSelected ? 'var(--text-1)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.email}</div>
                  </div>
                </div>
                {/* Tag Badge - Clickable */}
                <div
                  onClick={(e) => { e.stopPropagation(); setEditingTagId(isEditingTag ? null : a.id); }}
                  style={{ flexShrink: 0, padding: '0 8px', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, background: badge.color, fontSize: 10, fontWeight: 700, color: '#000', cursor: 'pointer', transition: 'transform 0.1s', transform: isEditingTag ? 'scale(1.1)' : 'scale(1)' }}
                  title="点击修改标签"
                >
                  {badge.label}
                </div>
                {/* Tag Dropdown */}
                {isEditingTag && (
                  <div style={{ position: 'absolute', right: 8, top: '100%', marginTop: 4, background: 'var(--surface-3)', border: '1px solid var(--stroke-2)', borderRadius: 10, padding: 4, zIndex: 50, boxShadow: 'var(--elev-2)' }}>
                    {tags.map(tag => {
                      const opt = getTagBadge(tag.label);
                      return (
                        <div
                          key={tag.id}
                          onClick={(e) => { e.stopPropagation(); updateTag(a.id, tag.label); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', borderRadius: 6, fontSize: 12, color: 'var(--text-1)' }}
                          className="list-item"
                        >
                          <div style={{ width: 16, height: 16, borderRadius: 4, background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#000' }}>{opt.label}</div>
                          <span>{tag.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div style={{ borderTop: '1px solid var(--stroke-1)', padding: 16 }}>
          {([
            { id: 'inbox' as FolderType, icon: Inbox, label: '收件箱' },
            { id: 'sent' as FolderType, icon: Send, label: '已发送' },
            { id: 'drafts' as FolderType, icon: FileText, label: '草稿箱' },
            { id: 'archive' as FolderType, icon: Archive, label: '归档' },
          ]).map((n) => {
            const isActive = activeFolder === n.id;
            return (
              <div
                key={n.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveFolder(n.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveFolder(n.id);
                  }
                }}
                className={`folder-item ${isActive ? 'selected' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: 'pointer', marginBottom: 2 }}
              >
                <n.icon size={18} style={{ opacity: isActive ? 1 : 0.7 }} />
                <span style={{ fontSize: 13, fontWeight: isActive ? 500 : 400 }}>{n.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
        {/* TopBar */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', borderBottom: '1px solid var(--stroke-1)', backdropFilter: 'blur(10px)', zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)' }}>
              {FOLDER_NAMES[activeFolder]}
            </span>
            {selected && (
              <span style={{ fontSize: 13, color: 'var(--text-3)', padding: '4px 10px', background: 'var(--surface-1)', borderRadius: 20 }}>
                {selected === 'all' ? '全部账号' : accounts.find(a => a.id === selected)?.name}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={sync} disabled={syncing} className="btn-secondary">
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              同步
            </button>
            <button
              onClick={() => {
                setCompose(true);
                setSendError(null);
                // Pre-fill account if selected specific one
                if (selected && selected !== 'all') {
                  setForm(prev => ({ ...prev, from: selected }));
                }
              }}
              className="btn-primary"
            >
              <Send size={14} />
              写邮件
            </button>
          </div>
        </div>

        {/* Message List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', scrollbarWidth: 'thin', scrollbarColor: 'var(--stroke-2) transparent' }}>
          {/* 批量操作栏 */}
          {(selectedIds.size > 0 || batchProgress) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 16px',
                marginBottom: 16,
                borderRadius: 10,
              }}
            >
              {batchProgress ? (
                <>
                  <div style={{
                    width: 16, height: 16, border: '2px solid var(--accent)',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                    处理中... {batchProgress.current}/{batchProgress.total}
                  </span>
                  <div style={{
                    flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden',
                    maxWidth: 200
                  }}>
                    <motion.div
                      style={{
                        height: '100%', background: 'var(--accent)', borderRadius: 2
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>
                    已选择 {selectedIds.size} 封邮件
                  </span>
                  <button onClick={batchMarkRead} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    <Check size={12} />
                    标记已读
                  </button>
                  <button onClick={batchArchive} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    <Archive size={12} />
                    批量归档
                  </button>
                  <button onClick={batchDelete} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, color: '#ef4444' }}>
                    <Trash2 size={12} />
                    批量删除
                  </button>
                  <button onClick={clearSelection} className="glass-button" style={{ padding: '6px 12px', fontSize: 12 }}>
                    取消选择
                  </button>
                </>
              )}
            </motion.div>
          )}
          {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-3)' }}>加载邮件中...</div>}
          {!loading && emails.length === 0 && (
            <div style={{ textAlign: 'center', padding: 100, color: 'var(--text-3)' }}>
              <Mail size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: 'var(--text-2)' }}>{FOLDER_EMPTY[activeFolder].title}</div>
              <div style={{ fontSize: 13 }}>{FOLDER_EMPTY[activeFolder].hint}</div>
            </div>
          )}
          {emails.map((e, i) => (
            <motion.div
              key={e.id}
              role="button"
              tabIndex={0}
              onClick={() => selectEmail(e)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  selectEmail(e);
                }
              }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, ...transitionBase }}
              className={`message-row ${e.unread ? 'unread' : ''} ${selectedEmail?.id === e.id ? 'selected' : ''}`}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px', marginBottom: 10, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            >
              {/* 多选框 */}
              <input
                type="checkbox"
                checked={selectedIds.has(e.id)}
                onClick={(ev) => ev.stopPropagation()}
                onChange={(ev) => toggleSelect(e.id, ev.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
              {e.unread && <div className="unread-indicator" style={{ position: 'absolute', left: 0, top: 12, bottom: 12, borderTopRightRadius: 3, borderBottomRightRadius: 3 }} />}
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: getColor(e.from), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 600, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', marginLeft: e.unread ? 6 : 0 }}>
                {e.from?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: e.unread ? 600 : 500, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {e.from}
                    {(selected === 'all' || !selected) && e.accountLabel && (
                      (() => {
                        const badge = getTagBadge(e.accountColorTag || '');
                        return (
                          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: badge.color, color: '#000', fontWeight: 700, opacity: 0.9 }}>
                            {e.accountLabel}
                          </span>
                        );
                      })()
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-ui)' }}>
                    {e.date ? new Date(e.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: e.unread ? 'var(--text-1)' : 'var(--text-2)', fontWeight: e.unread ? 500 : 400 }}>{e.subject || '(无主题)'}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>-</span>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{getPreview(e)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Email Detail Panel */}
      <AnimatePresence>
        {selectedEmail && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={transitionBase}
            className="glass-lg"
            style={{
              width: 700,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              zIndex: 10,
              padding: 0,
              borderLeft: '1px solid var(--stroke-1)'
            }}
          >
            {/* Detail Header */}
            <div style={{ height: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', borderBottom: '1px solid var(--stroke-1)' }}>
              <button
                onClick={() => setSelectedEmail(null)}
                className="glass-button"
                style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title="返回列表"
              >
                <ArrowLeft size={18} />
              </button>
              <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)', flex: 1 }}>邮件详情</span>
              <button
                onClick={() => deleteEmail(selectedEmail.id)}
                className="glass-button"
                style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}
                title="删除邮件"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {/* Email Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin', scrollbarColor: 'var(--stroke-2) transparent' }}>
              {/* Subject */}
              <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-1)', marginBottom: 12, lineHeight: 1.3 }}>
                {selectedEmail.subject || '(无主题)'}
              </h2>

              {/* Sender Info */}
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--stroke-1)' }}>
                {/* Date - Top Right */}
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, textAlign: 'right' }}>
                  {selectedEmail.date ? new Date(selectedEmail.date).toLocaleString('zh-CN', {
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
                    background: getColor(selectedEmail.from),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    flexShrink: 0
                  }}>
                    {selectedEmail.from?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2, wordBreak: 'break-all' }}>
                      {selectedEmail.from}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', wordBreak: 'break-all' }}>
                      收件人: {selectedEmail.to || '未知'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Body - Using iframe for CSS isolation with auto-height */}
              <div style={{ marginTop: 8 }}>
                {selectedEmail.content ? (
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
                              /* 图片懒加载优化 */
                              content-visibility: auto;
                              contain-intrinsic-size: 200px;
                            }
                            img[data-lazy-src] {
                              opacity: 0;
                              transition: opacity 0.3s ease;
                            }
                            img[data-lazy-src].loaded {
                              opacity: 1;
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
                          <script>
                            // 图片懒加载：使用 Intersection Observer
                            document.addEventListener('DOMContentLoaded', function() {
                              const images = document.querySelectorAll('img');
                              if ('IntersectionObserver' in window) {
                                const observer = new IntersectionObserver((entries) => {
                                  entries.forEach(entry => {
                                    if (entry.isIntersecting) {
                                      const img = entry.target;
                                      img.classList.add('loaded');
                                      observer.unobserve(img);
                                    }
                                  });
                                }, { rootMargin: '50px' });
                                images.forEach(img => {
                                  img.loading = 'lazy';
                                  observer.observe(img);
                                });
                              } else {
                                // 降级处理
                                images.forEach(img => img.classList.add('loaded'));
                              }
                            });
                          <\/script>
                        </head>
                        <body>${selectedEmail.content}</body>
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
                    {selectedEmail.snippet || '暂无邮件内容预览'}
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, padding: '0 20px', borderTop: '1px solid var(--stroke-1)' }}>
              <button
                onClick={() => archiveEmail(selectedEmail.id, !selectedEmail.archived)}
                className="glass-button"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
              >
                <Archive size={14} />
                {selectedEmail.archived ? '恢复' : '归档'}
              </button>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', cursor: 'pointer', fontSize: 13 }}>
                <Send size={14} />
                回复
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transitionModal} onClick={() => setShowSettings(false)} className="modal-overlay">
            <motion.div initial={{ scale: 0.98, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 6 }} transition={transitionModal} onClick={ev => ev.stopPropagation()} className="modal-card" style={{ width: 360, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--stroke-1)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 16 }}>设置</span>
                <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>主题模式</div>
                  <div style={{ display: 'flex', gap: 10, background: 'var(--bg-0)', padding: 4, borderRadius: 12, border: '1px solid var(--stroke-1)' }}>
                    <button onClick={() => toggleMode(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: !isDark ? 'var(--surface-3)' : 'transparent', color: !isDark ? 'var(--text-1)' : 'var(--text-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s', fontWeight: !isDark ? 600 : 400 }}>
                      <Sun size={16} /> Light
                    </button>
                    <button onClick={() => toggleMode(true)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: isDark ? 'var(--surface-3)' : 'transparent', color: isDark ? 'var(--text-1)' : 'var(--text-3)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, transition: 'all 0.2s', fontWeight: isDark ? 600 : 400 }}>
                      <Moon size={16} /> Dark
                    </button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 12, fontWeight: 500 }}>强调色</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {ACCENT_COLORS.map(c => (
                      <button key={c.id} onClick={() => changeAccent(c.color)} style={{ padding: 10, borderRadius: 10, background: 'var(--surface-1)', border: `2px solid ${accent === c.color ? c.color : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
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
                    {tags.map(tag => (
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
                      onChange={e => setNewTagColor(e.target.value)}
                      style={{ width: 32, height: 32, border: 'none', borderRadius: 6, cursor: 'pointer', padding: 0 }}
                      title="选择颜色"
                    />
                    <input
                      type="text"
                      value={newTagLabel}
                      onChange={e => { setNewTagLabel(e.target.value); setTagError(null); }}
                      placeholder="新标签名称 (如: VIP)"
                      style={{ flex: 1, padding: '8px 12px', background: 'var(--surface-1)', border: '1px solid var(--stroke-1)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, outline: 'none' }}
                      onKeyDown={e => e.key === 'Enter' && addTag()}
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
        )}
      </AnimatePresence>

      {/* Compose Modal */}
      <AnimatePresence>
        {compose && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transitionModal} onClick={() => setCompose(false)} className="modal-overlay">
            <motion.div initial={{ scale: 0.98, opacity: 0, y: 6 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 6 }} transition={transitionModal} onClick={ev => ev.stopPropagation()} className="modal-card" style={{ width: 520, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--stroke-1)' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 16 }}>写邮件</span>
                <div className="text-sm font-medium flex items-center gap-2" style={{ fontSize: 12 }}>
                  {saveStatus === 'saving' && <span className="animate-pulse" style={{ color: 'var(--text-3)' }}>保存中...</span>}
                  {saveStatus === 'saved' && <span style={{ color: 'var(--accent)' }}>已保存</span>}
                  {saveStatus === 'error' && <span style={{ color: '#ef4444' }}>保存失败</span>}
                </div>
                <button onClick={() => setCompose(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={20} /></button>
              </div>
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ position: 'relative' }}>
                  <select value={form.from} onChange={ev => setForm({ ...form, from: ev.target.value })} style={{ width: '100%', padding: '12px', paddingRight: 32, background: 'var(--surface-1)', border: '1px solid var(--stroke-1)', borderRadius: 10, color: 'var(--text-1)', fontSize: 14, outline: 'none', appearance: 'none', cursor: 'pointer' }}>
                    <option value="" style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>选择发件人...</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} style={{ background: 'var(--bg-2)', color: 'var(--text-1)' }}>{a.name} ({a.email})</option>
                    ))}
                  </select>
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
                <input value={form.to} onChange={ev => setForm({ ...form, to: ev.target.value })} placeholder="收件人" className="input-glass" />
                <input value={form.subject} onChange={ev => setForm({ ...form, subject: ev.target.value })} placeholder="主题" className="input-glass" />
                <textarea value={form.content} onChange={ev => setForm({ ...form, content: ev.target.value })} placeholder="正文内容..." className="textarea-glass" />

                {sendError && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor' }} />
                    {sendError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={discardDraft}
                    className="btn-secondary"
                    style={{ flex: 1, justifyContent: 'center', color: '#ef4444', borderColor: '#ef4444' }}
                  >
                    丢弃
                  </button>
                  <button
                    onClick={sendEmail}
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
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            style={{ position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)', background: 'var(--surface-1)', border: '1px solid var(--stroke-2)', padding: '12px 24px', borderRadius: 50, boxShadow: 'var(--elev-2)', display: 'flex', alignItems: 'center', gap: 12, zIndex: 100 }}
          >
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check size={12} color="#fff" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)' }}>{toastMessage || '操作成功'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
