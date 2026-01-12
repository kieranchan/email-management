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
                console.log(`[WS] Delete request: account=${msg.accountId}, uid=${msg.uid}`);
                const result = await worker.deleteEmail(msg.accountId, msg.uid);
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

// Manage IMAP connection for a single account
class AccountWatcher {
    private client: ImapFlow | null = null;
    private account: Account;
    private running = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(account: Account) {
        this.account = account;
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

        this.client = new ImapFlow({
            host: this.account.host,
            port: this.account.port,
            secure: this.account.port === 465 || this.account.port === 993,
            auth: {
                user: this.account.email,
                pass: this.account.password,
            },
            logger: false,
            tls: {
                rejectUnauthorized: false
            }
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

            // Listen for new emails to break IDLE
            this.client.on('exists', () => {
                // If we are idling, stop it so we can fetch
                this.client?.idleLogout?.();
            });

            // Start IDLE loop
            await this.idleLoop();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to connect ${this.account.email}:`, message);
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect() {
        if (!this.running) return;
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
                let lastExists = this.client.mailbox?.exists || 0;
                console.log(`[IMAP] ${this.account.email} has ${lastExists} messages, entering IDLE...`);

                // IDLE loop
                while (this.running && this.client) {
                    try {
                        const idlePromise = this.client.idle();
                        const timeoutId = setTimeout(() => {
                            this.client?.idleLogout?.();
                        }, 15 * 60 * 1000);

                        await idlePromise;
                        clearTimeout(timeoutId);

                        const currentExists = this.client.mailbox?.exists || 0;
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

                const providerKey = `uid:${msg.uid}`;

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

    // 手动同步：复用现有 IMAP 连接获取最新邮件
    async manualSync(): Promise<{ success: boolean; synced: number; error?: string }> {
        if (!this.client) {
            return { success: false, synced: 0, error: 'Not connected' };
        }

        try {
            // 使用现有连接获取数据库中最大 UID 之后的新邮件
            const lastEmail = await prisma.email.findFirst({
                where: { accountId: this.account.id },
                orderBy: { uid: 'desc' },
                select: { uid: true }
            });
            const lastUid = lastEmail?.uid || 0;

            // IMAP UID SEARCH
            const lock = await this.client.getMailboxLock('INBOX');
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

                    const providerKey = `uid:${msg.uid}`;
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
                        },
                    });
                    synced++;
                }
            } finally {
                lock.release();
            }

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
            const lock = await this.client.getMailboxLock('INBOX');
            try {
                await this.client.messageFlagsAdd({ uid: true }, String(uid), ['\\Seen']);
                console.log(`[IMAP] Marked UID ${uid} as seen for ${this.account.email}`);
                return { success: true };
            } finally {
                lock.release();
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
            const lock = await this.client.getMailboxLock('INBOX');
            try {
                // 尝试不同的 Archive 文件夹名称
                const archiveFolders = ['Archive', 'Archived', 'ARCHIVE', '[Gmail]/All Mail'];
                let moved = false;

                for (const folder of archiveFolders) {
                    try {
                        await this.client.messageMove({ uid: true }, String(uid), folder);
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
                        await this.client.messageMove({ uid: true }, String(uid), 'Archive');
                        console.log(`[IMAP] Created Archive folder and moved UID ${uid} for ${this.account.email}`);
                        moved = true;
                    } catch (createErr) {
                        console.error(`[IMAP] Failed to create Archive folder:`, createErr);
                    }
                }

                return { success: moved, error: moved ? undefined : 'No Archive folder found' };
            } finally {
                lock.release();
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
                        await this.client.messageMove({ uid: true }, String(uid), 'INBOX');
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

    // 删除邮件：标记为删除并执行 expunge
    async deleteEmail(uid: number): Promise<{ success: boolean; error?: string }> {
        if (!this.client) {
            return { success: false, error: 'Not connected' };
        }

        try {
            const lock = await this.client.getMailboxLock('INBOX');
            try {
                // 标记为删除
                await this.client.messageFlagsAdd({ uid: true }, String(uid), ['\\Deleted']);
                // 执行 expunge 永久删除
                await this.client.messageDelete({ uid: true }, String(uid));
                console.log(`[IMAP] Deleted UID ${uid} for ${this.account.email}`);
                return { success: true };
            } finally {
                lock.release();
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[IMAP] Failed to delete for ${this.account.email}:`, message);
            return { success: false, error: message };
        }
    }
}

// Main worker class
class ImapWorker {
    private watchers: Map<string, AccountWatcher> = new Map();

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

        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
        process.on('SIGTERM', () => this.stop());
    }

    async stop() {
        console.log('[Worker] Shutting down...');
        for (const watcher of this.watchers.values()) {
            await watcher.stop();
        }
        wss.close();
        await prisma.$disconnect();
        process.exit(0);
    }

    // 手动同步单个账号（通过 WebSocket 调用）
    async syncAccount(accountId: string): Promise<{ success: boolean; email?: string; synced?: number; error?: string }> {
        const watcher = this.watchers.get(accountId);
        if (!watcher) {
            return { success: false, error: 'Account not found or not connected' };
        }
        const result = await watcher.manualSync();
        return { ...result, email: accountId };
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

    // 删除邮件（通过 WebSocket 调用）
    async deleteEmail(accountId: string, uid: number): Promise<{ success: boolean; accountId: string; uid: number; error?: string }> {
        const watcher = this.watchers.get(accountId);
        if (!watcher) {
            return { success: false, accountId, uid, error: 'Account not found or not connected' };
        }
        const result = await watcher.deleteEmail(uid);
        return { ...result, accountId, uid };
    }
}

// Start the worker
const worker = new ImapWorker();
worker.start().catch(console.error);
