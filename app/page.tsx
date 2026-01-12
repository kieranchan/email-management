"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Settings, Check } from 'lucide-react';
import SidebarFolders, { FolderType } from './components/SidebarFolders';
import TopBar from './components/TopBar';
import SidebarAccounts from './components/SidebarAccounts';
import MessageList from './components/MessageList';
import ComposeModal, { type SaveStatus } from './components/ComposeModal';
import SettingsModal from './components/SettingsModal';
import EmailDetail from './components/EmailDetail';
import MobileDrawer from './components/MobileDrawer';
import BottomTab from './components/BottomTab';
import { useIsMobile } from './hooks/useMediaQuery';

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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
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

  // P7: 连接状态跟踪
  type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // M3: Mobile drawer state
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // P7: 节流刷新，避免消息风暴
  const lastRefreshRef = useRef<number>(0);
  const REFRESH_THROTTLE = 4000; // 4 秒节流

  // P7: 轮询引用（仿照 Roundcube，始终运行）
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const POLLING_INTERVAL = 30000; // 30 秒

  // P7: 跟踪当前选中账号，用于 WebSocket 事件处理
  const selectedRef = useRef<string | null>(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

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
      setSaveStatus('idle');
      setSendError(null);
    }
  }, [compose]);

  // Global Escape key handler - close layers in priority order
  const hasSelectedEmail = !!selectedEmail;
  useEffect(() => {
    const handleGlobalEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      // Priority order: selectedEmail → compose → settings → drawer
      if (hasSelectedEmail) {
        setSelectedEmail(null);
      } else if (compose) {
        setCompose(false);
      } else if (showSettings) {
        setShowSettings(false);
      } else if (drawerOpen) {
        setDrawerOpen(false);
      }
    };

    document.addEventListener('keydown', handleGlobalEscape);
    return () => document.removeEventListener('keydown', handleGlobalEscape);
  }, [hasSelectedEmail, compose, showSettings, drawerOpen]);

  // P7: 节流刷新函数
  const throttledRefresh = useCallback(() => {
    const now = Date.now();
    if (now - lastRefreshRef.current > REFRESH_THROTTLE) {
      lastRefreshRef.current = now;
      loadEmails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P7: 启动轮询（仿照 Roundcube，始终运行，不仅离线时）
  const startPolling = useCallback(() => {
    if (pollingTimerRef.current) return;
    console.log('[P7] Starting auto-refresh polling (Roundcube style)...');
    pollingTimerRef.current = setInterval(() => {
      console.log('[P7] Auto-refresh polling...');
      loadEmails();
    }, POLLING_INTERVAL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // P7: 停止离线轮询
  const stopPolling = useCallback(() => {
    if (pollingTimerRef.current) {
      console.log('[P7] Stopping offline polling');
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }, []);

  // WebSocket 连接：new mail push + sync results with auto-reconnect
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;
    let isMounted = true; // Guard for cleanup race condition

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
          setConnectionStatus('connected');
          // P7: 连接成功后也保持轮询（仿照 Roundcube）
          startPolling();
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // P7: 处理连接状态事件
            if (data.type === 'connection_state') {
              console.log('[P7] Connection state:', data.state);
              // 这里可以扩展为每个账号的连接状态
            }

            // P7: 处理同步进度事件
            if (data.type === 'sync_progress') {
              console.log('[P7] Sync progress:', data);
              setLastSyncedAt(data.lastSyncedAt);
              setSyncing(false);
              const targetAccount = data.accountId || data.email;
              // P7: 只有当同步的账号是当前选中账号或 scope=all 时才刷新
              if (data.syncedCount > 0 && (selectedRef.current === 'all' || selectedRef.current === targetAccount)) {
                throttledRefresh();
              }
            }

            if (data.type === 'new_email') {
              // P7: 只有当新邮件属于当前选中账号或 scope=all 时才刷新
              const targetAccount = data.accountId || data.email;
              if (selectedRef.current === 'all' || selectedRef.current === targetAccount) {
                throttledRefresh();
              }
            } else if (data.type === 'sync_result') {
              console.log('[WS] Sync result:', data);
              setSyncing(false);
            }
          } catch (e) {
            console.error('[WS] Parse error:', e);
          }
        };

        socket.onerror = () => {
          console.warn('[WS] Connect failed - worker may be stopped (npm run worker)');
        };

        socket.onclose = () => {
          console.log('[WS] Disconnected');
          setWs(null);
          setSyncing(false);
          setConnectionStatus('disconnected');
          // Guard: 如果已 unmount，不再重连或轮询
          if (!isMounted) return;
          console.log('[WS] Reconnecting in 5s...');
          // P7: 启动离线轮询
          startPolling();
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch (e) {
        console.error('[WS] Connection failed:', e);
        setConnectionStatus('disconnected');
        startPolling();
        reconnectTimer = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      isMounted = false; // Prevent reconnect/polling after unmount
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      socket?.close();
    };
  }, [throttledRefresh, startPolling, stopPolling]);

  // Folder Navigation
  // FolderType is now imported from SidebarFolders
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
    // 记录本次刷新时间，避免后续事件在短时间内重复刷新
    lastRefreshRef.current = Date.now();

    // P7: 使用 ref 获取最新的 selected 值，避免闭包问题
    const currentSelected = selectedRef.current;

    try {
      // Drafts use a different API endpoint
      if (activeFolder === 'drafts') {
        const r = await fetch(currentSelected && currentSelected !== 'all' ? `/api/drafts/?scope=account&accountId=${currentSelected}` : '/api/drafts/?scope=all');
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
        return;
      }

      // For inbox/sent/archive, use the new messages API
      let url = `/api/messages/?folderType=${activeFolder}&limit=50`;
      if (currentSelected === 'all' || !currentSelected) {
        url += `&scope=all`;
      } else {
        url += `&scope=account&accountId=${currentSelected}`;
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
    } catch (e) {
      console.error('Failed to load emails:', e);
    } finally {
      setLoading(false);
    }
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

  // 切换账号或文件夹时自动加载邮件 + 触发 Worker 同步
  useEffect(() => {
    loadEmails();

    // P7: 切换账号时触发 Worker 同步，确保获取最新邮件（仿照 Roundcube 的"主动请求"模式）
    if (selected && selected !== 'all' && ws && ws.readyState === WebSocket.OPEN) {
      // 延迟 500ms 触发同步，避免与 loadEmails 冲突
      const syncTimer = setTimeout(() => {
        setSyncing(true);
        ws.send(JSON.stringify({ type: 'sync', accountId: selected }));
        console.log('[P7] Triggered sync on account switch:', selected);
      }, 500);
      return () => clearTimeout(syncTimer);
    }
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
        setToastMessage('✅ 邮件已发送');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);

        // P7: 发送成功后，检查接收方是否是系统内账号，如果是则触发同步
        const recipientEmail = form.to.trim().toLowerCase();
        const recipientAccount = accounts.find(a => a.email.toLowerCase() === recipientEmail);
        if (recipientAccount && ws && ws.readyState === WebSocket.OPEN) {
          // 延迟 2 秒后触发接收方同步，给邮件服务器处理时间
          setTimeout(() => {
            setSyncing(true);
            ws.send(JSON.stringify({ type: 'sync', accountId: recipientAccount.id }));
            console.log('[P7] Triggered sync for recipient:', recipientEmail);
          }, 2000);
        }
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
    setSaveStatus('idle');

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
      {/* Desktop: Sidebar */}
      {!isMobile && (
        <div className="glass-lg sidebar">
          {/* Header */}
          <div className="sidebar-header">
            <div className="sidebar-logo">
              <div className="sidebar-logo-icon">
                <Mail size={18} />
              </div>
              <span className="sidebar-logo-text">Nexus Mail</span>
            </div>
            <button onClick={() => setShowSettings(true)} className="glass-button sidebar-settings-btn" title="设置">
              <Settings size={16} />
            </button>
          </div>

          {/* Account List - 自动显示所有系统账号 */}
          <SidebarAccounts
            accounts={accounts}
            selected={selected}
            setSelected={setSelected}
            tags={tags}
            editingTagId={editingTagId}
            setEditingTagId={setEditingTagId}
            getTagBadge={getTagBadge}
            getColor={getColor}
            updateTag={updateTag}
          />

          {/* Navigation */}
          <SidebarFolders activeFolder={activeFolder} setActiveFolder={setActiveFolder} />
        </div>
      )}

      {/* Mobile: Drawer */}
      {isMobile && (
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
          {/* Account List */}
          <SidebarAccounts
            accounts={accounts}
            selected={selected}
            setSelected={(id) => {
              setSelected(id);
              setDrawerOpen(false); // Close drawer on selection
            }}
            tags={tags}
            editingTagId={editingTagId}
            setEditingTagId={setEditingTagId}
            getTagBadge={getTagBadge}
            getColor={getColor}
            updateTag={updateTag}
          />

          {/* Settings button in drawer */}
          <div style={{ padding: 16, marginTop: 'auto', borderTop: '1px solid var(--stroke-1)' }}>
            <button
              onClick={() => {
                setShowSettings(true);
                setDrawerOpen(false);
              }}
              className="glass-button"
              style={{ width: '100%', justifyContent: 'flex-start', gap: 12 }}
            >
              <Settings size={16} />
              设置
            </button>
          </div>
        </MobileDrawer>
      )}

      {/* Main Area */}
      <div className="main-area">
        {/* TopBar */}
        <TopBar
          folderName={FOLDER_NAMES[activeFolder]}
          selected={selected}
          selectedAccountName={accounts.find(a => a.id === selected)?.name}
          connectionStatus={connectionStatus}
          syncing={syncing}
          lastSyncedAt={lastSyncedAt}
          isMobile={isMobile}
          onMenuClick={() => setDrawerOpen(true)}
          onComposeClick={() => {
            setCompose(true);
            setSendError(null);
            if (selected && selected !== 'all') {
              setForm(prev => ({ ...prev, from: selected }));
            }
          }}
        />

        {/* Message List */}
        <MessageList
          emails={emails}
          loading={loading}
          folderEmpty={FOLDER_EMPTY[activeFolder]}
          selectedEmail={selectedEmail}
          selectedIds={selectedIds}
          batchProgress={batchProgress}
          selected={selected}
          getColor={getColor}
          getTagBadge={getTagBadge}
          getPreview={getPreview}
          selectEmail={selectEmail}
          toggleSelect={toggleSelect}
          clearSelection={clearSelection}
          batchMarkRead={batchMarkRead}
          batchArchive={batchArchive}
          batchDelete={batchDelete}
        />
      </div>

      {/* Mobile: Bottom Tab (hidden when drawer, settings, or compose modal is open) */}
      {isMobile && !drawerOpen && !showSettings && !compose && (
        <BottomTab
          activeFolder={activeFolder}
          setActiveFolder={setActiveFolder}
          onComposeClick={() => {
            setCompose(true);
            setSendError(null);
            if (selected && selected !== 'all') {
              setForm(prev => ({ ...prev, from: selected }));
            }
          }}
        />
      )}

      {/* Email Detail Panel */}
      <AnimatePresence>
        {selectedEmail && (
          <EmailDetail
            email={selectedEmail}
            getColor={getColor}
            onClose={() => setSelectedEmail(null)}
            onDelete={deleteEmail}
            onArchive={archiveEmail}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <SettingsModal
            isDark={isDark}
            accent={accent}
            accentColors={ACCENT_COLORS}
            tags={tags}
            tagError={tagError}
            tagLoading={tagLoading}
            newTagLabel={newTagLabel}
            newTagColor={newTagColor}
            onClose={() => setShowSettings(false)}
            toggleMode={toggleMode}
            changeAccent={changeAccent}
            setNewTagLabel={setNewTagLabel}
            setNewTagColor={setNewTagColor}
            setTagError={setTagError}
            addTag={addTag}
            deleteTag={deleteTag}
          />
        )}
      </AnimatePresence>

      {/* Compose Modal */}
      <AnimatePresence>
        {compose && (
          <ComposeModal
            accounts={accounts}
            form={form}
            setForm={setForm}
            sending={sending}
            sendError={sendError}
            saveStatus={saveStatus}
            onClose={() => setCompose(false)}
            onSend={sendEmail}
            onDiscard={discardDraft}
          />
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
