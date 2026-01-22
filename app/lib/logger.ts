/**
 * 安全日志工具 - 自动脱敏敏感字段
 * 
 * 用法:
 * import { logger } from '@/app/lib/logger';
 * logger.info('Creating account', { email, password, host });
 * // 输出: [INFO] Creating account { email: 'user@domain.com', password: '***REDACTED***', host: 'mail.example.com' }
 */

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'authorization', 'passwordHash', 'totpSecret'];

/**
 * 脱敏对象中的敏感字段
 */
function sanitize(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitize);
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = SENSITIVE_FIELDS.some(field => lowerKey.includes(field));

        if (isSensitive && typeof value === 'string') {
            sanitized[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
            sanitized[key] = sanitize(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}

export const logger = {
    info: (message: string, data?: unknown) => {
        console.log(`[INFO] ${message}`, data ? sanitize(data) : '');
    },
    error: (message: string, error?: unknown) => {
        console.error(`[ERROR] ${message}`, error ? sanitize(error) : '');
    },
    warn: (message: string, data?: unknown) => {
        console.warn(`[WARN] ${message}`, data ? sanitize(data) : '');
    },
    debug: (message: string, data?: unknown) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${message}`, data ? sanitize(data) : '');
        }
    },
};
