/**
 * IMAP IDLE Worker - Real-time email reception
 * 
 * This worker maintains persistent IMAP connections for all accounts
 * and uses IDLE mode to receive push notifications when new emails arrive.
 */

import { ImapFlow } from 'imapflow';
import { PrismaClient, type Account } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';

const prisma = new PrismaClient();

// WebSocket server for pushing updates to frontend
const wss = new WebSocketServer({ port: 3001 });
const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    clients.add(ws);

    ws.on('message', async (data) => {
        try {
            const msg = JSON.parse(data.toString());
            if (msg.type === 'sync' && msg.accountId) {
                console.log(`[WS] Sync request for account ${msg.accountId}`);
                const result = await worker.syncAccount(msg.accountId);
                ws.send(JSON.stringify({ type: 'sync_result', ...result }));
            } else if (msg.type === 'markSeen' && msg.accountId && msg.uid) {
                console.log(`[WS] Mark seen request: account=${msg.accountId}, uid=${msg.uid}`);
                const result = await worker.markSeen(msg.accountId, msg.uid);
                ws.send(JSON.stringify({ type: 'markSeen_result', ...result }));
            } else if (msg.type === 'archive' && msg.accountId && msg.uid !== undefined) {
                console.log(`[WS] Archive request: account=${msg.accountId}, uid=${msg.uid}, archive=${msg.archive}`);
                const result = await worker.archiveEmail(msg.accountId, msg.uid, msg.archive !== false);
                ws.send(JSON.stringify({ type: 'archive_result', ...result }));
            } else if (msg.type === 'delete' && msg.accountId && msg.uid !== undefined) {
                console.log(`[WS] Delete request: account=${msg.accountId}, uid=${msg.uid}, folder=${msg.folder || 'INBOX'}`);
                const result = await worker.deleteEmail(msg.accountId, msg.uid, msg.folder || 'INBOX');
                ws.send(JSON.stringify({ type: 'delete_result', ...result }));
            }
        } catch (e) {
            console.error('[WS] Message parse error:', e);
        }
    });

    ws.on('close', () => {
        console.log('[WS] Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('[WS] Error:', error);
        clients.delete(ws);
    });
});

// Broadcast message to all connected clients
function broadcast(data: object) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Parse email content using mailparser
async function parseEmailContent(source: Buffer): Promise<string> {
    try {
        const { simpleParser } = await import('mailparser');
        const parsed = await simpleParser(source);
        if (parsed.html) {
            return parsed.html;
        } else if (parsed.text) {
            return `<pre style="white-space: pre-wrap; font-family: inherit;">${parsed.text}</pre>`;
        }
        return '';
    } catch {
        return source.toString();
    }
}

// Connection state type for P7 zero-touch sync
type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

// Manage IMAP connection for a single account
class AccountWatcher {
    private client: ImapFlow | null = null;
    private account: Account;
    private running = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private folderSyncAt: Map<string, number> = new Map();

    // P7: Connection state tracking
    private connectionState: ConnectionState = 'disconnected';
    private lastSyncedAt: Date | null = null;
    private lastUid: number = 0;

    constructor(account: Account) {
        this.account = account;
    }

    // P7: Get current connection state
    getConnectionState(): ConnectionState {
        return this.connectionState;
    }

    // P7: Get account email
    getAccountEmail(): string {
        return this.account.email;
    }

    // P7: Get last sync timestamp
    getLastSyncedAt(): Date | null {
        return this.lastSyncedAt;
    }

    // P7: Broadcast connection state change
    private broadcastConnectionState(state: ConnectionState) {
        this.connectionState = state;
        broadcast({
            type: 'connection_state',
            accountId: this.account.id,
            email: this.account.email,
            state
        });
    }

    // P7: Broadcast sync progress
    private broadcastSyncProgress(syncedCount: number) {
        this.lastSyncedAt = new Date();
        broadcast({
            type: 'sync_progress',
            accountId: this.account.id,
            email: this.account.email,
            syncedCount,
            lastSyncedAt: this.lastSyncedAt.toISOString()
        });
    }

    async start() {
        this.running = true;
        await this.connect();
    }

    async stop() {
        this.running = false;
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.client) {
            try {
                await this.client.logout();
            } catch { }
        }
    }

    private async connect() {
        if (!this.running) return;

        console.log(`[IMAP] Connecting to ${this.account.email}...`);

        // 使用环境变量覆盖 host (支持跨VPS部署)
        const imapHost = process.env.IMAP_HOST || this.account.host;

        this.client = new ImapFlow({
            host: imapHost,
            port: this.account.port,
            secure: this.account.port === 465 || this.account.port === 993,
            auth: {
                user: this.account.email,
                pass: this.account.password,
            },
            logger: false,
            // TLS 证书验证已启用（默认安全配置）
        });

        this.client.on('close', () => {
            console.log(`[IMAP] Connection closed for ${this.account.email}`);
            this.scheduleReconnect();
        });

        this.client.on('error', (err) => {
            console.error(`[IMAP] Error for ${this.account.email}:`, err.message);
        });

        try {
            await this.client.connect();
            console.log(`[IMAP] Connected to ${this.account.email}`);

            // P7: Broadcast connected state
            this.broadcastConnectionState('connected');

            // Listen for new emails (IDLE will be automatically interrupted)

            // P7: Auto-sync on connect/reconnect to catch up
            const syncResult = await this.manualSync();
            if (!syncResult.success) {
                console.warn(`[IMAP] Auto-sync on connect failed for ${this.account.email}:`, syncResult.error);
            }

            // Start IDLE loop
            await this.idleLoop();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to connect ${this.account.email}:`, message);
            this.broadcastConnectionState('disconnected');
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (!this.running) return;
        // P7: Broadcast reconnecting state
        this.broadcastConnectionState('reconnecting');
        console.log(`[IMAP] Reconnecting ${this.account.email} in 30s...`);
        this.reconnectTimeout = setTimeout(() => this.connect(), 30000);
    }

    private async idleLoop() {
        if (!this.client || !this.running) return;

        try {
            // Lock INBOX
            const lock = await this.client.getMailboxLock('INBOX');

            try {
                // Get initial message count
                let lastExists = (this.client.mailbox && typeof this.client.mailbox === 'object') ? this.client.mailbox.exists : 0;
                console.log(`[IMAP] ${this.account.email} has ${lastExists} messages, entering IDLE...`);

                // IDLE loop
                while (this.running && this.client) {
                    try {
                        // IDLE with 15 minute timeout (will auto-break on new mail)
                        await this.client.idle();

                        const currentExists = (this.client.mailbox && typeof this.client.mailbox === 'object') ? this.client.mailbox.exists : 0;
                        if (currentExists > lastExists) {
                            await this.fetchNewEmails(lastExists + 1, currentExists);
                            lastExists = currentExists;
                        }
                    } catch { }
                }
            } finally {
                lock.release();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] IDLE error for ${this.account.email}:`, message);
            this.scheduleReconnect();
        }
    }

    private async fetchNewEmails(from: number, to: number) {
        if (!this.client) return;

        try {
            const messages = this.client.fetch(`${from}:${to}`, {
                envelope: true,
                internalDate: true,
                flags: true,
                uid: true,
                source: true
            });

            for await (const msg of messages) {
                if (!msg.envelope || !msg.uid) continue;

                // Parse content
                let content = '';
                if (msg.source) {
                    content = await parseEmailContent(msg.source);
                }

                const providerKey = `INBOX:uid:${msg.uid}`;
                const legacyKey = `uid:${msg.uid}`;
                const existingNew = await prisma.email.findUnique({
                    where: { accountId_providerKey: { accountId: this.account.id, providerKey } }
                });
                if (!existingNew) {
                    await prisma.email.updateMany({
                        where: { accountId: this.account.id, providerKey: legacyKey },
                        data: { providerKey, folder: 'INBOX' }
                    });
                }

                // Save to database
                const email = await prisma.email.upsert({
                    where: {
                        accountId_providerKey: {
                            accountId: this.account.id,
                            providerKey,
                        },
                    },
                    update: {
                        uid: msg.uid,
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                        folder: 'INBOX',
                    },
                    create: {
                        accountId: this.account.id,
                        providerKey,
                        uid: msg.uid,
                        subject: msg.envelope.subject || '(No Subject)',
                        from: msg.envelope.from?.[0]?.address || 'Unknown',
                        to: msg.envelope.to?.[0]?.address || 'Unknown',
                        date: msg.internalDate || new Date(),
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                        folder: 'INBOX',
                    },
                });

                console.log(`[IMAP] New email saved: ${email.subject}`);

                // Broadcast to frontend
                broadcast({
                    type: 'new_email',
                    accountId: this.account.id,
                    email: {
                        id: email.id,
                        from: email.from,
                        subject: email.subject,
                        date: email.date,
                    }
                });
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to fetch new emails:`, message);
        }
    }

    // Reconcile flags for a folder (recent N messages) to capture external changes
    private async reconcileFlagsForFolder(folderPath: string, targetFolder: string, limit = 200): Promise<number> {
        if (!this.client) return 0;

        // Find recent emails for this folder
        const existingEmails = await prisma.email.findMany({
            where: { accountId: this.account.id, folder: targetFolder },
            orderBy: { date: 'desc' },
            select: { id: true, uid: true, flags: true },
            take: limit
        });

        if (existingEmails.length === 0) return 0;

        const uidSeq = existingEmails.map((e) => e.uid).filter(Boolean).join(',');
        if (!uidSeq) return 0;

        let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>> | null = null;
        let updated = 0;
        try {
            lock = await this.client.getMailboxLock(folderPath);
            const existingMap = new Map(existingEmails.map((e) => [e.uid, e]));
            const flagMessages = this.client.fetch(uidSeq, { flags: true, uid: true }, { uid: true });

            for await (const msg of flagMessages) {
                if (!msg.uid) continue;
                const existing = existingMap.get(msg.uid);
                if (!existing) continue;

                const newFlags = JSON.stringify(Array.from(msg.flags || []));
                if (existing.flags !== newFlags) {
                    await prisma.email.update({
                        where: { id: existing.id },
                        data: { flags: newFlags }
                    });
                    updated++;
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Flag reconcile failed for ${folderPath} (${this.account.email}):`, message);
        } finally {
            if (lock) lock.release();
        }
        if (updated > 0) {
            console.log(`[IMAP] Reconciled ${updated} flags for ${folderPath} (${this.account.email})`);
        }
        return updated;
    }

    // Acquire mailbox lock with timeout to avoid deadlocks (e.g., IDLE holding INBOX)
    private async acquireMailboxLock(path: string, timeoutMs = 5000): Promise<Awaited<ReturnType<ImapFlow['getMailboxLock']>> | null> {
        if (!this.client) return null;

        const lockPromise = this.client.getMailboxLock(path);
        const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('Lock timeout')), timeoutMs)
        );

        try {
            const lock = await Promise.race([lockPromise, timeoutPromise]);
            return lock as Awaited<ReturnType<ImapFlow['getMailboxLock']>>;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`[IMAP] Skipping lock for ${path} (${this.account.email}) - ${message}`);
            return null;
        }
    }

    // 手动同步：复用现有 IMAP 连接获取最新邮件
    async manualSync(): Promise<{ success: boolean; synced: number; error?: string }> {
        if (!this.client) {
            return { success: false, synced: 0, error: 'Not connected' };
        }

        try {
            // 使用现有连接获取数据库中最大 UID 之后的新邮件
            const lastEmail = await prisma.email.findFirst({
                where: { accountId: this.account.id, folder: 'INBOX' },
                orderBy: { uid: 'desc' },
                select: { uid: true }
            });
            const lastUid = lastEmail?.uid || 0;

            // IMAP UID SEARCH with timeout to avoid deadlock
            const lockPromise = this.client.getMailboxLock('INBOX');
            const timeoutPromise = new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error('Lock timeout')), 5000)
            );

            let lock;
            try {
                lock = await Promise.race([lockPromise, timeoutPromise]);
            } catch {
                console.log(`[IMAP] Skipping manual sync for ${this.account.email} - lock timeout (IDLE may be active)`);
                this.lastSyncedAt = new Date();
                return { success: true, synced: 0 };
            }

            if (!lock) {
                return { success: true, synced: 0 };
            }

            let synced = 0;

            try {
                const messages = this.client.fetch(`${lastUid + 1}:*`, {
                    envelope: true,
                    internalDate: true,
                    flags: true,
                    uid: true,
                    source: true
                }, { uid: true });

                for await (const msg of messages) {
                    if (!msg.envelope || !msg.uid || msg.uid <= lastUid) continue;

                    let content = '';
                    if (msg.source) {
                        content = await parseEmailContent(msg.source);
                    }

                    const providerKey = `INBOX:uid:${msg.uid}`;
                    const legacyKey = `uid:${msg.uid}`;
                    const existingNew = await prisma.email.findUnique({
                        where: { accountId_providerKey: { accountId: this.account.id, providerKey } }
                    });
                    if (!existingNew) {
                        await prisma.email.updateMany({
                            where: { accountId: this.account.id, providerKey: legacyKey },
                            data: { providerKey, folder: 'INBOX' }
                        });
                    }
                    await prisma.email.upsert({
                        where: {
                            accountId_providerKey: {
                                accountId: this.account.id,
                                providerKey,
                            },
                        },
                        update: {
                            flags: JSON.stringify(Array.from(msg.flags || [])),
                            content: content || null,
                            folder: 'INBOX',
                        },
                        create: {
                            accountId: this.account.id,
                            providerKey,
                            uid: msg.uid,
                            subject: msg.envelope.subject || '(No Subject)',
                            from: msg.envelope.from?.[0]?.address || 'Unknown',
                            to: msg.envelope.to?.[0]?.address || 'Unknown',
                            date: msg.internalDate || new Date(),
                            flags: JSON.stringify(Array.from(msg.flags || [])),
                            content: content || null,
                            folder: 'INBOX',
                        },
                    });
                    synced++;
                }
            } finally {
                lock.release();
            }

            // Step 2: reconcile flags for INBOX (recent messages)
            // CRITICAL: Must be called AFTER lock.release() to avoid deadlock
            await this.reconcileFlagsForFolder('INBOX', 'INBOX');

            this.lastSyncedAt = new Date();
            this.broadcastSyncProgress(synced);
            console.log(`[IMAP] Manual sync ${this.account.email}: ${synced} new emails`);
            return { success: true, synced };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Manual sync failed for ${this.account.email}:`, message);
            return { success: false, synced: 0, error: message };
        }
    }

    // 标记已读：通过 UID 添加 \Seen 标志
    async markSeen(uid: number): Promise<{ success: boolean; error?: string }> {
        if (!this.client) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const currentPath = (typeof this.client.mailbox === 'object' && this.client.mailbox) ? this.client.mailbox.path : null;
            const needsLock = currentPath !== 'INBOX';
            const lock = needsLock ? await this.acquireMailboxLock('INBOX') : null;
            if (needsLock && !lock) {
                console.log(`[IMAP] Skipping markSeen for ${this.account.email} - mailbox busy`);
                return { success: false, error: 'Mailbox busy (IDLE active)' };
            }

            try {
                await this.client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
                console.log(`[IMAP] Marked UID ${uid} as seen for ${this.account.email}`);
                return { success: true };
            } finally {
                if (lock) lock.release();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to mark seen for ${this.account.email}:`, message);
            return { success: false, error: message };
        }
    }

    // 移动到归档：将邮件从 INBOX 移动到 Archive 文件夹
    async moveToArchive(uid: number): Promise<{ success: boolean; error?: string }> {
        if (!this.client) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const currentPath = (typeof this.client.mailbox === 'object' && this.client.mailbox) ? this.client.mailbox.path : null;
            const needsLock = currentPath !== 'INBOX';
            const lock = needsLock ? await this.acquireMailboxLock('INBOX') : null;
            if (needsLock && !lock) {
                console.log(`[IMAP] Skipping moveToArchive for ${this.account.email} - mailbox busy`);
                return { success: false, error: 'Mailbox busy (IDLE active)' };
            }

            try {
                // 尝试不同的 Archive 文件夹名称
                const archiveFolders = ['Archive', 'Archived', 'ARCHIVE', '[Gmail]/All Mail'];
                let moved = false;

                for (const folder of archiveFolders) {
                    try {
                        await this.client.messageMove(String(uid), folder, { uid: true });
                        console.log(`[IMAP] Moved UID ${uid} to ${folder} for ${this.account.email}`);
                        moved = true;
                        break;
                    } catch {
                        // 该文件夹不存在，尝试下一个
                    }
                }

                if (!moved) {
                    // 如果没有 Archive 文件夹，创建一个
                    try {
                        await this.client.mailboxCreate('Archive');
                        await this.client.messageMove(String(uid), 'Archive', { uid: true });
                        console.log(`[IMAP] Created Archive folder and moved UID ${uid} for ${this.account.email}`);
                        moved = true;
                    } catch (createErr) {
                        console.error(`[IMAP] Failed to create Archive folder:`, createErr);
                    }
                }

                return { success: moved, error: moved ? undefined : 'No Archive folder found' };
            } finally {
                if (lock) lock.release();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to move to archive for ${this.account.email}:`, message);
            return { success: false, error: message };
        }
    }

    // 从归档恢复：将邮件从 Archive 移回 INBOX
    async restoreFromArchive(uid: number): Promise<{ success: boolean; error?: string }> {
        if (!this.client) {
            return { success: false, error: 'Not connected' };
        }

        try {
            // 尝试不同的 Archive 文件夹名称
            const archiveFolders = ['Archive', 'Archived', 'ARCHIVE', '[Gmail]/All Mail'];

            for (const folder of archiveFolders) {
                try {
                    const lock = await this.client.getMailboxLock(folder);
                    try {
                        await this.client.messageMove(String(uid), 'INBOX', { uid: true });
                        console.log(`[IMAP] Restored UID ${uid} from ${folder} to INBOX for ${this.account.email}`);
                        return { success: true };
                    } finally {
                        lock.release();
                    }
                } catch {
                    // 该文件夹不存在或邮件不在其中
                }
            }

            return { success: false, error: 'Email not found in archive folders' };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to restore from archive for ${this.account.email}:`, message);
            return { success: false, error: message };
        }
    }

    // Delete email: mark as deleted and execute expunge
    async deleteEmail(uid: number, folder: string = 'INBOX'): Promise<{ success: boolean; error?: string }> {
        if (!this.client) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const currentPath = (typeof this.client.mailbox === 'object' && this.client.mailbox) ? this.client.mailbox.path : null;
            const needsLock = currentPath !== folder;
            const lock = needsLock ? await this.acquireMailboxLock(folder) : null;
            if (needsLock && !lock) {
                console.log(`[IMAP] Skipping deleteEmail for ${this.account.email} in ${folder} - mailbox busy`);
                return { success: false, error: 'Mailbox busy (IDLE active)' };
            }

            try {
                // Mark as deleted
                await this.client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true });
                // Execute expunge to permanently delete
                await this.client.messageDelete(String(uid), { uid: true });
                console.log(`[IMAP] Deleted UID ${uid} from ${folder} for ${this.account.email}`);
                return { success: true };
            } finally {
                if (lock) lock.release();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to delete from ${folder} for ${this.account.email}:`, message);
            return { success: false, error: message };
        }
    }

    // Sync additional folders (e.g., Sent/Archive) via fallback
    async syncOtherFolders(): Promise<void> {
        if (!this.client) return;

        const now = Date.now();
        const folders: Array<{ path: string; targetFolder: string; archived?: boolean }> = [
            { path: 'Sent', targetFolder: 'SENT' },
            { path: 'INBOX.Sent', targetFolder: 'SENT' },
            { path: '[Gmail]/Sent Mail', targetFolder: 'SENT' },
            { path: 'Archive', targetFolder: 'ARCHIVE', archived: true },
            { path: 'Archived', targetFolder: 'ARCHIVE', archived: true },
            { path: '[Gmail]/All Mail', targetFolder: 'ARCHIVE', archived: true },
        ];

        for (const folder of folders) {
            const last = this.folderSyncAt.get(folder.path) || 0;
            if (now - last < 2 * 60 * 1000) {
                continue; // throttle: skip if synced within last 2 minutes
            }
            await this.syncFolder(folder.path, folder.targetFolder, folder.archived === true);
            this.folderSyncAt.set(folder.path, Date.now());
        }
    }

    private async syncFolder(folderPath: string, targetFolder: string, archived: boolean = false): Promise<number> {
        if (!this.client) return 0;

        let lock: Awaited<ReturnType<ImapFlow['getMailboxLock']>> | null = null;
        let synced = 0;
        try {
            lock = await this.client.getMailboxLock(folderPath);

            const lastEmail = await prisma.email.findFirst({
                where: { accountId: this.account.id, folder: targetFolder },
                orderBy: { uid: 'desc' },
                select: { uid: true }
            });
            const lastUid = lastEmail?.uid || 0;

            const messages = this.client.fetch(`${lastUid + 1}:*`, {
                envelope: true,
                internalDate: true,
                flags: true,
                uid: true,
                source: true
            }, { uid: true });

            for await (const msg of messages) {
                if (!msg.envelope || !msg.uid || msg.uid <= lastUid) continue;

                let content = '';
                if (msg.source) {
                    content = await parseEmailContent(msg.source);
                }

                const providerKey = `${targetFolder}:uid:${msg.uid}`;
                const legacyKey = `uid:${msg.uid}`;
                const existingNew = await prisma.email.findUnique({
                    where: { accountId_providerKey: { accountId: this.account.id, providerKey } }
                });
                if (!existingNew) {
                    await prisma.email.updateMany({
                        where: { accountId: this.account.id, providerKey: legacyKey },
                        data: { providerKey, folder: targetFolder, archived }
                    });
                }
                await prisma.email.upsert({
                    where: {
                        accountId_providerKey: {
                            accountId: this.account.id,
                            providerKey,
                        },
                    },
                    update: {
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                        folder: targetFolder,
                        archived
                    },
                    create: {
                        accountId: this.account.id,
                        providerKey,
                        uid: msg.uid,
                        subject: msg.envelope.subject || '(No Subject)',
                        from: msg.envelope.from?.[0]?.address || 'Unknown',
                        to: msg.envelope.to?.[0]?.address || 'Unknown',
                        date: msg.internalDate || new Date(),
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                        folder: targetFolder,
                        archived
                    },
                });
                synced++;
            }

            // Reconcile flags for this folder as well
            await this.reconcileFlagsForFolder(folderPath, targetFolder);

            if (synced > 0) {
                this.broadcastSyncProgress(synced);
                console.log(`[IMAP] Synced ${synced} messages from ${folderPath} for ${this.account.email}`);
            }
            return synced;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Sync folder ${folderPath} failed for ${this.account.email}:`, message);
            return synced;
        } finally {
            if (lock) {
                lock.release();
            }
        }
    }
}

// Main worker class
class ImapWorker {
    private watchers: Map<string, AccountWatcher> = new Map();

    // P7: Fallback sync timer (shortened for faster degradation handling)
    private fallbackTimer: NodeJS.Timeout | null = null;
    private readonly FALLBACK_INTERVAL = 30 * 1000; // 30 seconds
    private readonly STALE_THRESHOLD = 1 * 60 * 1000; // 1 minute

    async start() {
        console.log('[Worker] Starting IMAP IDLE worker...');
        console.log('[WS] WebSocket server listening on port 3001');

        // Load all accounts
        const accounts = await prisma.account.findMany();
        console.log(`[Worker] Found ${accounts.length} accounts`);

        // Start watcher for each account
        for (const account of accounts) {
            const watcher = new AccountWatcher(account);
            this.watchers.set(account.id, watcher);
            watcher.start();
        }

        // P7: Start fallback sync timer
        this.startFallbackTimer();

        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }

    async stop() {
        console.log('[Worker] Shutting down...');
        // P7: Clear fallback timer
        if (this.fallbackTimer) {
            clearInterval(this.fallbackTimer);
        }
        for (const watcher of this.watchers.values()) {
            await watcher.stop();
        }
        wss.close();
        await prisma.$disconnect();
        process.exit(0);
    }

    // P7: Fallback sync for stale connections
    private startFallbackTimer() {
        this.fallbackTimer = setInterval(async () => {
            console.log('[Worker] Running fallback sync check...');
            const now = Date.now();

            for (const [accountId, watcher] of this.watchers.entries()) {
                const lastSync = watcher.getLastSyncedAt();
                const isStale = !lastSync || (now - lastSync.getTime()) > this.STALE_THRESHOLD;

                if (isStale && watcher.getConnectionState() === 'connected') {
                    console.log(`[Worker] Fallback sync for stale account: ${accountId}`);
                    try {
                        await watcher.manualSync();
                    } catch (e) {
                        console.error(`[Worker] Fallback sync failed for ${accountId}:`, e);
                    }
                }

                // Additional folder sync (Sent/Archive) as part of fallback
                if (watcher.getConnectionState() === 'connected') {
                    try {
                        await watcher.syncOtherFolders();
                    } catch (e) {
                        console.error(`[Worker] Fallback folder sync failed for ${accountId}:`, e);
                    }
                }
            }
        }, this.FALLBACK_INTERVAL);
    }

    // P7: Get all account connection states (for health check API)
    getConnectionStates(): { accountId: string; email: string; state: ConnectionState; lastSyncedAt: string | null }[] {
        const states: { accountId: string; email: string; state: ConnectionState; lastSyncedAt: string | null }[] = [];
        for (const [accountId, watcher] of this.watchers.entries()) {
            states.push({
                accountId,
                email: watcher.getAccountEmail(),
                state: watcher.getConnectionState(),
                lastSyncedAt: watcher.getLastSyncedAt()?.toISOString() || null
            });
        }
        return states;
    }

    // 手动同步单个账号（通过 WebSocket 调用）
    async syncAccount(accountId: string): Promise<{ success: boolean; accountId: string; email?: string; synced?: number; error?: string }> {
        const watcher = this.watchers.get(accountId);
        if (!watcher) {
            return { success: false, accountId, error: 'Account not found or not connected' };
        }
        const result = await watcher.manualSync();
        return { ...result, accountId, email: watcher.getAccountEmail() };
    }

    // 标记已读（通过 WebSocket 调用）
    async markSeen(accountId: string, uid: number): Promise<{ success: boolean; accountId: string; uid: number; error?: string }> {
        const watcher = this.watchers.get(accountId);
        if (!watcher) {
            return { success: false, accountId, uid, error: 'Account not found or not connected' };
        }
        const result = await watcher.markSeen(uid);
        return { ...result, accountId, uid };
    }

    // 归档/恢复邮件（通过 WebSocket 调用）
    async archiveEmail(accountId: string, uid: number, archive: boolean): Promise<{ success: boolean; accountId: string; uid: number; archive: boolean; error?: string }> {
        const watcher = this.watchers.get(accountId);
        if (!watcher) {
            return { success: false, accountId, uid, archive, error: 'Account not found or not connected' };
        }
        const result = archive ? await watcher.moveToArchive(uid) : await watcher.restoreFromArchive(uid);
        return { ...result, accountId, uid, archive };
    }

    // Delete email (called via WebSocket)
    async deleteEmail(accountId: string, uid: number, folder: string = 'INBOX'): Promise<{ success: boolean; accountId: string; uid: number; folder: string; error?: string }> {
        const watcher = this.watchers.get(accountId);
        if (!watcher) {
            return { success: false, accountId, uid, folder, error: 'Account not found or not connected' };
        }
        const result = await watcher.deleteEmail(uid, folder);
        return { ...result, accountId, uid, folder };
    }
}

// Start the worker
const worker = new ImapWorker();
worker.start().catch(console.error);
