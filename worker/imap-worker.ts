/**
 * IMAP IDLE Worker - Real-time email reception
 * 
 * This worker maintains persistent IMAP connections for all accounts
 * and uses IDLE mode to receive push notifications when new emails arrive.
 */

import { ImapFlow } from 'imapflow';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer, WebSocket } from 'ws';

const prisma = new PrismaClient();

// WebSocket server for pushing updates to frontend
const wss = new WebSocketServer({ port: 3001 });
const clients: Set<WebSocket> = new Set();

wss.on('connection', (ws) => {
    console.log('[WS] Client connected');
    clients.add(ws);

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
    private account: any;
    private running = false;
    private reconnectTimeout: NodeJS.Timeout | null = null;

    constructor(account: any) {
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
            this.client.on('exists', (data) => {
                // If we are idling, stop it so we can fetch
                this.client?.idleLogout?.();
            });

            // Start IDLE loop
            await this.idleLoop();
        } catch (err: any) {
            console.error(`[IMAP] Failed to connect ${this.account.email}:`, err.message);
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
                    } catch (err: any) { }
                }
            } finally {
                lock.release();
            }
        } catch (err: any) {
            console.error(`[IMAP] IDLE error for ${this.account.email}:`, err.message);
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

                // Save to database
                const email = await prisma.email.upsert({
                    where: {
                        accountId_uid: {
                            accountId: this.account.id,
                            uid: msg.uid,
                        },
                    },
                    update: {
                        flags: JSON.stringify(Array.from(msg.flags || [])),
                        content: content || null,
                    },
                    create: {
                        accountId: this.account.id,
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
        } catch (err: any) {
            console.error(`[IMAP] Failed to fetch new emails:`, err.message);
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
}

// Start the worker
const worker = new ImapWorker();
worker.start().catch(console.error);
