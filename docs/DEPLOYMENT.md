# Admin Dashboard VPS 部署文档

## 部署概述

将 `admin-dashboard` Next.js 应用部署到 VPS，通过 Docker Compose 管理，Nginx 反向代理。

**访问地址**: `https://mail.oragenode.online/admin/`

---

## 架构

```
用户 → Nginx (443) → admin-dashboard (3000)
                   → roundcube (80)
                   → mailserver (25/143/465/587/993)
```

---

## 关键配置文件

### 1. `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/admin",
  trailingSlash: true,  // 必须！防止与 nginx 重定向冲突
};
```

### 2. `prisma/schema.prisma`

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]  // Docker Alpine 兼容
}
```

### 3. `Dockerfile` 关键点

- 基础镜像: `node:20-alpine` (Next.js 16 要求)
- Runner 阶段安装 OpenSSL: `RUN apk add --no-cache openssl openssl-dev`
- 不复制 `dev.db`，通过 volume 挂载

### 4. `compose.yaml` (VPS)

```yaml
admin-dashboard:
  build: /root/admin-dashboard
  container_name: admin-dashboard
  restart: always
  environment:
    - DATABASE_URL=file:/app/dev.db
  volumes:
    - /root/docker-mailserver/docker-data/admin-db/dev.db:/app/dev.db
  depends_on:
    - mailserver
```

### 5. `nginx.conf`

```nginx
# API 路由代理
location /api/ {
    proxy_pass http://admin-dashboard:3000/admin/api/;
    ...
}

# /admin 无尾斜杠重定向
location = /admin {
    return 301 /admin/;
}

# Admin Dashboard
location /admin/ {
    proxy_pass http://admin-dashboard:3000/admin/;
    ...
}
```

---

## 部署步骤

### 本地打包

```powershell
cd F:\WorkSpace\WebStorm\email
tar --exclude="node_modules" --exclude=".next" -czvf admin-dashboard.tar.gz admin-dashboard
scp admin-dashboard.tar.gz root@66.154.127.152:/root/
```

### VPS 部署

```bash
cd /root
rm -rf admin-dashboard
tar -xzvf admin-dashboard.tar.gz
cd docker-mailserver
docker compose up -d --build admin-dashboard
docker compose restart nginx
```

---

## 已解决的问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Dockerfile 构建失败 | `mkdir`/`chown` 缺少 `RUN` | 添加 `RUN` 前缀 |
| Node.js 版本错误 | Next.js 16 需要 Node 20+ | 改用 `node:20-alpine` |
| Prisma 引擎不兼容 | Alpine + OpenSSL 3.0 | 添加 `binaryTargets` |
| 308/301 重定向循环 | Next.js 默认去掉尾斜杠 | 添加 `trailingSlash: true` |
| API 403 Forbidden | 前端请求 `/api/` 未代理 | nginx 添加 `/api/` location |
| 邮件同步失败 | `host: localhost` 不可用 | 数据库改为 `host: mailserver` |

---

## 数据库维护

```bash
# 进入容器 (root)
docker exec -it -u root admin-dashboard sh

# 安装 sqlite
apk add sqlite

# 查看账号
sqlite3 /app/dev.db "SELECT email, host FROM Account LIMIT 5;"

# 修改 host
sqlite3 /app/dev.db "UPDATE Account SET host = 'mailserver' WHERE host = 'localhost';"
```

---

## 注意事项

1. **本地开发** 使用 `host: localhost`
2. **生产环境** 使用 `host: mailserver` (Docker 网络名)
3. 每次重新部署代码后，数据库不会被覆盖（volume 挂载）
4. 修改 `nginx.conf` 后需要 `docker compose restart nginx`
