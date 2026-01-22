# P0+P1 前置任务实施指南

> **优先级**: 🔴 P0 (最高优先级 - 必须立即完成)  
> **作者**: Admin Dashboard Team  
> **日期**: 2026-01-20  
> **目标**: 在开发 Provisioning Agent 之前，先解决安全裸奔问题，建立完整的登录和权限体系

---

## 📋 执行摘要

### 为什么 P0+P1 必须优先完成

**当前风险**：

- ❌ `/admin` 和 `/api` 对公网完全开放，任何人都可以访问
- ❌ 没有用户认证，没有权限控制
- ❌ 调试接口可能暴露敏感信息
- ❌ 文档和日志中存在明文密码

**本指南目标**：

1. ✅ **P0 临时方案（1-2 天）**: 使用 Nginx BasicAuth 立即保护管理后台
2. ✅ **P1 永久方案（1-2 周）**: 实现完整的管理员登录、RBAC 和审计系统

**实施后效果**：

- ✅ 管理后台需要登录才能访问
- ✅ 不同角色有不同权限（SuperAdmin / DomainAdmin / Viewer）
- ✅ 所有管理操作都有审计日志
- ✅ 敏感信息不再泄露

---

## 第一部分：P0 安全基线（临时保护方案）

### 目标

在 P1 开发期间，使用 Nginx BasicAuth 作为临时门禁，立即阻止未授权访问。

### 前置条件

- [ ] 确认有服务器 SSH 访问权限
- [ ] 备份当前 Nginx 配置文件
- [ ] 准备测试浏览器（退出所有已登录会话）

---

### Task 1: Nginx BasicAuth 网关保护

#### 1.1 生成密码文件

```bash
# SSH 登录服务器
ssh user@your-server-ip

# 安装 apache2-utils（如果没有）
sudo apt-get update
sudo apt-get install -y apache2-utils

# 创建密码文件（第一个用户，会创建新文件）
sudo htpasswd -c /etc/nginx/.htpasswd admin

# 添加更多用户（不使用 -c 参数，避免覆盖）
sudo htpasswd /etc/nginx/.htpasswd viewer

# 验证文件内容
sudo cat /etc/nginx/.htpasswd
# 输出示例：
# admin:$apr1$xxxxx...
# viewer:$apr1$xxxxx...
```

#### 1.2 修改 Nginx 配置

编辑 Nginx 配置文件（通常在 `/etc/nginx/sites-available/default` 或 `/etc/nginx/nginx.conf`）：

```nginx
# 保护管理后台
location /admin/ {
    auth_basic "Admin Dashboard - Please Login";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    # 原有的反向代理配置保持不变
    proxy_pass http://localhost:3000/admin/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# 保护 API（重要！）
location /api/ {
    auth_basic "Admin API - Please Login";
    auth_basic_user_file /etc/nginx/.htpasswd;
    
    proxy_pass http://localhost:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Roundcube 保持公开访问
location / {
    proxy_pass http://localhost:8080/;
    # ... 其他配置
}
```

#### 1.3 应用配置并测试

```bash
# 测试配置文件语法
sudo nginx -t

# 如果测试通过，重载配置
sudo systemctl reload nginx

# 或者重启 Nginx
sudo systemctl restart nginx
```

#### 1.4 验证保护生效

```bash
# 应该返回 401 Unauthorized
curl -I https://your-domain.com/admin/

# 使用用户名密码应该返回 200 或 302
curl -I -u admin:password https://your-domain.com/admin/
```

**浏览器测试**：

1. 访问 `https://your-domain.com/admin/`
2. 应该弹出登录框
3. 输入用户名密码后才能访问

✅ **检查点**: `/admin` 和 `/api` 必须弹出登录框，Roundcube (`/`) 可以直接访问

---

### Task 2: 禁用调试接口

#### 2.1 识别所有调试路由

当前已知的调试接口：

- `app/api/debug-auth/route.ts`
- `app/api/dev-mode/route.ts`

#### 2.2 添加环境变量检查

编辑 `admin-dashboard/.env` 和 `.env.production`：

```bash
# .env (本地开发)
NODE_ENV=development
ENABLE_DEBUG_ROUTES=true

# .env.production (生产环境) - 创建此文件
NODE_ENV=production
ENABLE_DEBUG_ROUTES=false
```

#### 2.3 修改调试接口代码

**`app/api/debug-auth/route.ts`**:

```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  // 生产环境禁用
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json(
      { error: 'This endpoint is disabled in production' },
      { status: 403 }
    );
  }

  // 原有调试逻辑...
}
```

**`app/api/dev-mode/route.ts`** - 同样添加检查

#### 2.4 验证

```bash
# 设置生产环境变量
export NODE_ENV=production
export ENABLE_DEBUG_ROUTES=false

# 启动应用
npm run build
npm run start

# 测试调试接口应该返回 403
curl http://localhost:3000/api/debug-auth
# 预期输出: {"error":"This endpoint is disabled in production"}
```

✅ **检查点**: 生产环境下调试接口返回 403

---

### Task 3: 去敏与口令轮换

#### 3.1 创建 `.env.example`

```bash
# admin-dashboard/.env.example
# 数据库
DATABASE_URL="file:./dev.db"

# IMAP/SMTP 服务器
IMAP_HOST="mail.example.com"
SMTP_HOST="mail.example.com"

# 应用配置
NODE_ENV="development"
ENABLE_DEBUG_ROUTES="true"

# 未来 P2 需要的
# APP_ENCRYPTION_KEY="<generate-a-32-byte-random-key>"
# DATABASE_URL="postgresql://user:password@localhost:5432/nexusmail"
```

#### 3.2 清理文档中的明文密码

**需要检查的文件**：

- `部署/邮箱服务器部署日志.md` - 移除所有明文密码，替换为 `<PASSWORD_REDACTED>`
- `部署/cmd.md` - 同上
- `文档/VIP 邮箱账号完整列表.md` - **不要提交此文件到 Git**

**添加到 `.gitignore`**:

```bash
# admin-dashboard/.gitignore
.env
.env.local
.env.production
*.db
*.db-journal

# 部署目录的敏感文件
../部署/邮箱服务器部署日志.md
../文档/VIP*.md
```

#### 3.3 轮换关键密码

**需要轮换的密码**：

1. ✅ 服务器 root 密码
2. ✅ 所有邮箱账号密码（通过 docker-mailserver CLI）
3. ✅ 数据库密码（未来迁移到 Postgres 时）

**轮换步骤示例（邮箱密码）**:

```bash
# 连接到 docker-mailserver
docker exec -it mailserver bash

# 重置密码
setup email update user@domain.com new-secure-password

# 退出容器
exit
```

**记录轮换日志**（创建新文件 `部署/密码轮换记录.md`，不提交到 Git）:

```markdown
# 密码轮换记录

| 日期 | 项目 | 操作人 | 备注 |
|------|------|--------|------|
| 2026-01-20 | 服务器 root 密码 | Admin | 已轮换 |
| 2026-01-20 | 邮箱账号密码（全部） | Admin | 已通过 setup 命令轮换 |
```

✅ **检查点**:

- `.env.example` 已创建
- 文档中无明文密码
- 关键密码已轮换并记录

---

### Task 4: TLS 校验修复

#### 4.1 检查当前 TLS 配置

**检查文件**：

- `worker/imap-worker.ts`
- `app/api/send/route.ts`
- `app/api/sync/route.ts`

#### 4.2 移除不安全的 TLS 配置

**错误示例（需要删除）**:

```typescript
// ❌ 不要这样做
const client = new ImapFlow({
  host: '...',
  port: 993,
  secure: true,
  tls: {
    rejectUnauthorized: false  // ❌ 危险！
  }
});
```

**正确做法**:

```typescript
// ✅ 正确：默认验证证书
const client = new ImapFlow({
  host: process.env.IMAP_HOST || 'mail.oragenode.online',
  port: 993,
  secure: true,
  // 不需要 tls 配置，默认会验证
  auth: {
    user: account.email,
    pass: account.password,
  },
});
```

#### 4.3 如果必须使用自签证书

如果你的邮件服务器使用自签证书，正确的做法是：

```typescript
import fs from 'fs';

const client = new ImapFlow({
  host: process.env.IMAP_HOST,
  port: 993,
  secure: true,
  tls: {
    // 提供自签证书的 CA
    ca: fs.readFileSync('/path/to/ca-cert.pem'),
  },
  auth: { user, pass },
});
```

✅ **检查点**: 所有 IMAP/SMTP 连接都正确验证 TLS 证书

---

### Task 5: 日志脱敏

#### 5.1 识别日志输出点

**需要检查的地方**：

- `console.log()` - 搜索整个项目
- `console.error()` - 同上
- `worker/imap-worker.ts` - Worker 日志

#### 5.2 创建日志工具函数

**`app/lib/logger.ts`** (新文件):

```typescript
/**
 * 安全日志工具 - 自动脱敏敏感字段
 */

const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key', 'authorization'];

/**
 * 脱敏对象中的敏感字段
 */
function sanitize(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: any = {};
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
  info: (message: string, data?: any) => {
    console.log(`[INFO] ${message}`, data ? sanitize(data) : '');
  },
  error: (message: string, error?: any) => {
    console.error(`[ERROR] ${message}`, error ? sanitize(error) : '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[WARN] ${message}`, data ? sanitize(data) : '');
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data ? sanitize(data) : '');
    }
  },
};
```

#### 5.3 替换现有日志

**错误示例**:

```typescript
// ❌ 危险：可能泄露密码
console.log('Creating account:', { email, password, host });
```

**正确示例**:

```typescript
// ✅ 安全：自动脱敏
import { logger } from '@/app/lib/logger';

logger.info('Creating account', { email, password, host });
// 输出: [INFO] Creating account { email: 'user@domain.com', password: '***REDACTED***', host: 'mail.example.com' }
```

✅ **检查点**:

- 创建了 `logger.ts` 工具
- 项目中使用 `logger` 替代 `console.log`
- 测试验证密码不会出现在日志中

---

### P0 验收标准

- [ ] 访问 `/admin` 和 `/api` 必须通过 BasicAuth 认证
- [ ] Roundcube (`/`) 可以直接访问（不受影响）
- [ ] 调试接口在生产环境返回 403
- [ ] `.env.example` 已创建，文档中无明文密码
- [ ] 关键密码已轮换并记录
- [ ] TLS 证书验证已启用
- [ ] 日志中不再出现明文密码

**完成 P0 后可以立即获得**：

- ✅ 临时保护，阻止未授权访问
- ✅ 敏感信息不再泄露

**但 P0 的局限性**：

- ⚠️ 所有管理员共用一个 BasicAuth 账号，无法区分操作者
- ⚠️ 没有审计日志
- ⚠️ 没有细粒度权限控制

**因此必须继续推进 P1！**

---

## 第二部分：P1 管理员登录与 RBAC 系统

### 目标

实现完整的管理员登录、角色权限和审计系统，替代 P0 的 BasicAuth 临时方案。

---

### 一、架构设计

#### 1.1 登录流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant L as 登录页
    participant A as /api/auth/login
    participant DB as Database (Prisma)
    participant M as Middleware

    U->>L: 访问 /admin/
    L->>M: 检查会话
    M-->>L: 未登录，重定向
    L->>U: 显示登录表单
    U->>A: POST {email, password}
    A->>DB: 查询 User
    DB-->>A: 返回用户（密码哈希）
    A->>A: bcrypt.compare()
    alt 密码正确
        A->>DB: 创建 Session
        A-->>U: Set-Cookie (sessionId)
        U->>L: 重定向到 /admin/
        L->>M: 检查会话
        M->>DB: 查询 Session
        M-->>L: 通过，返回用户信息
    else 密码错误
        A-->>U: 401 Unauthorized
    end
```

#### 1.2 RBAC 权限模型

```
┌─────────────┐
│    User     │ 用户（管理员）
├─────────────┤
│ id          │
│ email       │
│ passwordHash│
│ name        │
│ isActive    │
└──────┬──────┘
       │ 1:N
       ↓
┌─────────────┐
│  UserRole   │ 用户-角色关联（多对多）
├─────────────┤
│ userId      │
│ roleId      │
└──────┬──────┘
       │ N:1
       ↓
┌─────────────┐
│    Role     │ 角色
├─────────────┤
│ id          │
│ name        │ SuperAdmin / DomainAdmin / Viewer
│ description │
└──────┬──────┘
       │ 1:N
       ↓
┌─────────────┐
│ Permission  │ 权限
├─────────────┤
│ roleId      │
│ resource    │ accounts / domains / aliases / settings
│ action      │ create / read / update / delete
└─────────────┘
```

**预置角色**：

| 角色 | 权限范围 | 典型用例 |
|------|----------|----------|
| **SuperAdmin** | 所有资源的 CRUD | 系统管理员 |
| **DomainAdmin** | 仅限指定域的账号/别名管理 | 部门管理员 |
| **Viewer** | 只读所有资源 | 运维观察者 |

---

### 二、数据模型设计

#### 2.1 Prisma Schema 扩展

编辑 `admin-dashboard/prisma/schema.prisma`，添加以下模型：

```prisma
// ============ P1 新增：用户认证与权限 ============

// User: 管理员用户（不是邮箱用户）
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String   // bcrypt 哈希
  name          String
  isActive      Boolean  @default(true)
  
  // 2FA (可选)
  totpSecret    String?  // TOTP 密钥（加密存储）
  totpEnabled   Boolean  @default(false)
  
  // 关联
  sessions      Session[]
  userRoles     UserRole[]
  auditLogs     AuditLog[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  @@index([email])
}

// Session: 会话管理
model Session {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  token         String   @unique  // 会话 Token (随机生成)
  expiresAt     DateTime
  
  // 安全信息
  ipAddress     String?
  userAgent     String?
  lastActiveAt  DateTime @default(now())
  
  createdAt     DateTime @default(now())
  
  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}

// Role: 角色
model Role {
  id            String   @id @default(cuid())
  name          String   @unique  // SuperAdmin, DomainAdmin, Viewer
  description   String?
  isSystem      Boolean  @default(false)  // 系统预置角色不可删除
  
  userRoles     UserRole[]
  permissions   Permission[]
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

// UserRole: 用户-角色关联
model UserRole {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  // 域限制（仅 DomainAdmin 使用）
  domainScope String?  // 限制到特定域，如 "example.com"
  
  createdAt DateTime @default(now())
  
  @@unique([userId, roleId])
  @@index([userId])
  @@index([roleId])
}

// Permission: 权限
model Permission {
  id        String   @id @default(cuid())
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  
  resource  String   // accounts, domains, aliases, settings, audits
  action    String   // create, read, update, delete, export
  
  createdAt DateTime @default(now())
  
  @@unique([roleId, resource, action])
  @@index([roleId])
}

// AuditLog: 审计日志
model AuditLog {
  id            String   @id @default(cuid())
  
  // 操作者
  userId        String?
  user          User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  // 操作信息
  action        String   // login, create_account, delete_account, update_alias, etc.
  resource      String   // users, accounts, domains, aliases, settings
  resourceId    String?  // 被操作资源的 ID
  
  // 操作结果
  status        String   // success, failure
  errorMessage  String?
  
  // 操作详情
  changes       String?  // JSON 格式：记录变更前后的值
  
  // 安全信息
  ipAddress     String?
  userAgent     String?
  
  createdAt     DateTime @default(now())
  
  @@index([userId])
  @@index([action])
  @@index([resource])
  @@index([createdAt])
}
```

#### 2.2 生成 Prisma Client

```bash
cd admin-dashboard

# 生成 TypeScript 类型
npx prisma generate

# 同步到数据库（开发环境）
npx prisma db push

# 查看数据库结构
npx prisma studio
```

---

### 三、API 设计

#### 3.1 认证 API

**`app/api/auth/login/route.ts`**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import prisma from '@/app/lib/prisma';
import { logger } from '@/app/lib/logger';

// 登录限速（简单实现，生产环境建议用 Redis）
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // 参数校验
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // 登录限速检查
    const clientIp = request.headers.get('x-real-ip') || 'unknown';
    const attemptKey = `${clientIp}:${email}`;
    const attempt = loginAttempts.get(attemptKey);
    const now = Date.now();

    if (attempt && attempt.count >= 5 && attempt.resetAt > now) {
      logger.warn('Login rate limit exceeded', { email, ip: clientIp });
      return NextResponse.json(
        { error: 'Too many login attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // 查询用户
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      // 记录失败尝试
      const currentAttempt = loginAttempts.get(attemptKey) || { count: 0, resetAt: now + 15 * 60 * 1000 };
      loginAttempts.set(attemptKey, {
        count: currentAttempt.count + 1,
        resetAt: currentAttempt.resetAt,
      });

      logger.warn('Login failed: user not found or inactive', { email, ip: clientIp });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // 记录失败尝试
      const currentAttempt = loginAttempts.get(attemptKey) || { count: 0, resetAt: now + 15 * 60 * 1000 };
      loginAttempts.set(attemptKey, {
        count: currentAttempt.count + 1,
        resetAt: currentAttempt.resetAt,
      });

      logger.warn('Login failed: invalid password', { email, ip: clientIp });
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // 登录成功，清除失败计数
    loginAttempts.delete(attemptKey);

    // 创建会话
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: sessionToken,
        expiresAt,
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    // 写入审计日志
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'login',
        resource: 'users',
        resourceId: user.id,
        status: 'success',
        ipAddress: clientIp,
        userAgent: request.headers.get('user-agent') || undefined,
      },
    });

    logger.info('User logged in successfully', { email, userId: user.id });

    // 返回会话 Token（通过 Cookie）
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.userRoles.map(ur => ({
          name: ur.role.name,
          domainScope: ur.domainScope,
        })),
      },
    });

    response.cookies.set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      expires: expiresAt,
      path: '/',
    });

    return response;
  } catch (error) {
    logger.error('Login error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**`app/api/auth/logout/route.ts`**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { logger } from '@/app/lib/logger';

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return NextResponse.json({ success: true });
  }

  try {
    // 查询会话
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (session) {
      // 删除会话
      await prisma.session.delete({
        where: { id: session.id },
      });

      // 写入审计日志
      await prisma.auditLog.create({
        data: {
          userId: session.userId,
          action: 'logout',
          resource: 'users',
          resourceId: session.userId,
          status: 'success',
          ipAddress: request.headers.get('x-real-ip') || undefined,
          userAgent: request.headers.get('user-agent') || undefined,
        },
      });

      logger.info('User logged out', { userId: session.userId, email: session.user.email });
    }

    // 清除 Cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('session_token');

    return response;
  } catch (error) {
    logger.error('Logout error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**`app/api/auth/me/route.ts`**:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    permissions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // 更新最后活动时间
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        roles: session.user.userRoles.map(ur => ({
          name: ur.role.name,
          domainScope: ur.domainScope,
          permissions: ur.role.permissions,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

---

### 四、Middleware 实现

**`admin-dashboard/middleware.ts`** (新文件):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公开路径（不需要认证）
  const publicPaths = ['/api/auth/login', '/login'];
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // 检查会话
  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    // 未登录
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    } else {
      // 重定向到登录页
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  try {
    // 验证会话（这里简化处理，生产环境建议用 Redis 缓存）
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: {
                  include: {
                    permissions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      // 会话过期或用户被禁用
      const response = pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Session expired' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', request.url));

      response.cookies.delete('session_token');
      return response;
    }

    // 将用户信息添加到请求头（供 API Route 使用）
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', session.user.id);
    requestHeaders.set('x-user-email', session.user.email);
    requestHeaders.set('x-user-roles', JSON.stringify(session.user.userRoles.map(ur => ur.role.name)));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
```

---

### 五、前端页面

#### 5.1 登录页面

**`app/login/page.tsx`**:

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // 登录成功，重定向到管理后台
        router.push('/admin/');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-8">
          Nexus Mail Admin
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indoo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
```

#### 5.2 审计日志页面

**`app/admin/audits/page.tsx`**:

```typescript
'use client';

import { useEffect, useState } from 'react';

interface AuditLog {
  id: string;
  action: string;
  resource: string;
  status: string;
  user: { name: string; email: string } | null;
  ipAddress: string;
  createdAt: string;
}

export default function AuditsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('/api/audits');
      const data = await response.json();
      setLogs(data.logs || []);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Audit Logs</h1>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user?.name || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.resource}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ipAddress}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**`app/api/audits/route.ts`**:

```typescript
import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';

export async function GET() {
  try {
    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json({ logs });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
```

---

### 六、初始化脚本

**`admin-dashboard/scripts/seed-admin.ts`**:

```typescript
/**
 * 创建首个超级管理员账号
 * 使用方法: npx tsx scripts/seed-admin.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Initializing admin user and roles...\n');

  // 1. 创建系统角色
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'SuperAdmin' },
    update: {},
    create: {
      name: 'SuperAdmin',
      description: 'Full system access',
      isSystem: true,
      permissions: {
        create: [
          { resource: 'users', action: 'create' },
          { resource: 'users', action: 'read' },
          { resource: 'users', action: 'update' },
          { resource: 'users', action: 'delete' },
          { resource: 'accounts', action: 'create' },
          { resource: 'accounts', action: 'read' },
          { resource: 'accounts', action: 'update' },
          { resource: 'accounts', action: 'delete' },
          { resource: 'domains', action: 'create' },
          { resource: 'domains', action: 'read' },
          { resource: 'domains', action: 'update' },
          { resource: 'domains', action: 'delete' },
          { resource: 'aliases', action: 'create' },
          { resource: 'aliases', action: 'read' },
          { resource: 'aliases', action: 'update' },
          { resource: 'aliases', action: 'delete' },
          { resource: 'audits', action: 'read' },
          { resource: 'audits', action: 'export' },
          { resource: 'settings', action: 'read' },
          { resource: 'settings', action: 'update' },
        ],
      },
    },
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'Viewer' },
    update: {},
    create: {
      name: 'Viewer',
      description: 'Read-only access',
      isSystem: true,
      permissions: {
        create: [
          { resource: 'accounts', action: 'read' },
          { resource: 'domains', action: 'read' },
          { resource: 'aliases', action: 'read' },
          { resource: 'audits', action: 'read' },
        ],
      },
    },
  });

  console.log('✅ Roles created: SuperAdmin, Viewer\n');

  // 2. 创建首个超级管理员
  const adminEmail = 'admin@local.com';  // 修改为你的邮箱
  const tempPassword = randomBytes(8).toString('hex'); // 随机生成临时密码
  const passwordHash = await bcrypt.hash(tempPassword, 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`⚠️  Admin user already exists: ${adminEmail}`);
  } else {
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: 'System Administrator',
        isActive: true,
        userRoles: {
          create: {
            roleId: superAdminRole.id,
          },
        },
      },
    });

    console.log('✅ Admin user created!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${adminEmail}`);
    console.log(`🔑 Temporary Password: ${tempPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  IMPORTANT: Please change this password after first login!\n');
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**使用方法**:

```bash
# 安装依赖
npm install bcryptjs @types/bcryptjs tsx

# 运行脚本
npx tsx scripts/seed-admin.ts

# 输出示例：
# ✅ Admin user created!
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📧 Email: admin@local.com
# 🔑 Temporary Password: a3f8d2e1c4b7
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### 七、实施步骤

#### Step 1: 数据库迁移

```bash
cd admin-dashboard

# 1. 修改 schema.prisma（已在上文提供）

# 2. 生成 Prisma Client
npx prisma generate

# 3. 同步数据库结构
npx prisma db push

# 4. 查看数据库（可选）
npx prisma studio
```

#### Step 2: 安装依赖

```bash
npm install bcryptjs @types/bcryptjs
```

#### Step 3: 创建文件

按照上文创建以下文件：

- `app/lib/logger.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `middleware.ts`
- `app/login/page.tsx`
- `app/admin/audits/page.tsx`
- `app/api/audits/route.ts`
- `scripts/seed-admin.ts`

#### Step 4: 初始化管理员

```bash
npx tsx scripts/seed-admin.ts
```

记录输出的临时密码！

#### Step 5: 测试登录流程

```bash
# 启动开发服务器
npm run dev

# 浏览器访问
open http://localhost:3000/login

# 使用临时密码登录
# Email: admin@local.com
# Password: <从 seed-admin 输出中复制>
```

#### Step 6: 移除 Nginx BasicAuth（可选）

登录系统验证通过后，可以移除 P0 中配置的 BasicAuth：

```nginx
# 注释掉或删除这两行
# auth_basic "Admin Dashboard";
# auth_basic_user_file /etc/nginx/.htpasswd;
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### 八、P1 验收标准

- [ ] 访问 `/admin/` 未登录时自动跳转到 `/login`
- [ ] 登录成功后可以访问管理后台
- [ ] 登录失败 5 次触发限速（15 分钟）
- [ ] 会话过期后需要重新登录
- [ ] 审计日志记录所有登录/登出操作
- [ ] SuperAdmin 可以访问所有功能
- [ ] Viewer 只能查看，不能修改
- [ ] 登出后 Cookie 被清除，无法访问管理后台

---

## 第三部分：P0+P1 完成后的效果

### 安全提升

| 项目 | P0 前 | P0 后 | P1 后 |
|------|-------|-------|-------|
| **访问控制** | ❌ 无保护 | ⚠️ BasicAuth | ✅ 应用层登录 + RBAC |
| **用户识别** | ❌ 无法识别 | ⚠️ 共享账号 | ✅ 每个管理员独立账号 |
| **审计日志** | ❌ 无 | ❌ 无 | ✅ 完整审计 |
| **权限控制** | ❌ 无 | ❌ 无 | ✅ 细粒度 RBAC |
| **密码安全** | ❌ 明文 | ⚠️ 部分清理 | ✅ bcrypt 哈希 |
| **会话管理** | ❌ 无 | ❌ 无 | ✅ Token + 过期机制 |

### 下一步

完成 P0+P1 后，系统已经具备基本的安全保障，可以开始：

1. **P2: 数据库迁移到 Postgres**（提升并发和性能）
2. **P3: Provisioning Agent**（真正实现账号管理）
3. **P4: Worker 队列化**（提升稳定性）

---

## 附录：常见问题

### Q1: 忘记管理员密码怎么办？

重新运行 seed 脚本生成新密码：

```bash
# 删除现有管理员
npx prisma studio
# 在 User 表中删除 admin@local.com

# 重新生成
npx tsx scripts/seed-admin.ts
```

### Q2: 如何添加更多管理员？

创建脚本 `scripts/create-user.ts`：

```typescript
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const roleName = process.argv[4] || 'Viewer';

  if (!email || !password) {
    console.error('Usage: npx tsx scripts/create-user.ts <email> <password> [role]');
    process.exit(1);
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    console.error(`Role ${roleName} not found`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: email.split('@')[0],
      isActive: true,
      userRoles: {
        create: { roleId: role.id },
      },
    },
  });

  console.log(`✅ User created: ${email} (${roleName})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

使用：

```bash
npx tsx scripts/create-user.ts viewer@example.com password123 Viewer
```

### Q3: P0 和 P1 可以同时进行吗？

**推荐顺序**：

1. **先完成 P0 Task 1-3**（1 天内）：立即保护系统
2. **并行开始 P1 开发**（1-2 周）：完整登录系统
3. **P1 上线后移除 P0 的 BasicAuth**

这样既保证安全，又不延误开发进度。

---

## 总结

本指南整合了 P0（安全基线）和 P1（管理员登录/RBAC）的完整实施方案。

**核心要点**：

- ✅ P0 提供临时保护（BasicAuth），立即阻止裸奔
- ✅ P1 提供永久方案（登录/权限/审计），建立长期安全体系
- ✅ 两者可以并行推进，先上 P0 顶住，再用 P1 替换

**完成后可以获得**：

- ✅ 管理后台需要登录才能访问
- ✅ 不同角色有不同权限
- ✅ 所有管理操作都有审计日志
- ✅ 敏感信息不再泄露

**下一步**：完成 P0+P1 后，即可安全地开始 P2（数据库迁移）和 P3（Provisioning Agent）的开发！

---

**文档状态**: ✅ 已完成  
**更新时间**: 2026-01-20  
**下一步**: 立即开始 P0 实施，同时规划 P1 开发
