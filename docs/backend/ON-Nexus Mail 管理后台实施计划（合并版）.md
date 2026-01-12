# Nexus Mail 管理后台实施计划（合并版）

> 基于《Nexus_Mail_项目企划书_v0.2+_v0.1》《MailOps 控制台实施计划》与现有 Nexus Mail 代码基线（Next.js + Prisma/SQLite + IMAP Worker），整合成一份统一的 Control Plane 落地路线。

## 进度总览

| 阶段 | 任务 | 状态 | 目标完成 |
|:----:|------|:----:|:--------:|
| P0 | 安全基线与网关封锁（去敏） | ⏳ 计划中 | 2026-01 |
| P1 | 管理员登录 / RBAC / 审计 v1 | ⏳ 计划中 | 2026-01 |
| P2 | 数据存储与密钥加固（Postgres / AES） | ⏳ 计划中 | 2026-01 |
| P3 | Provisioning Agent + 域/账号/别名/配额 | ⏳ 计划中 | 2026-02 |
| P4 | Worker 拆分 + 队列化同步/回写 + SSE | ⏳ 计划中 | 2026-02 |
| P5 | 统一收件箱 / 搜索 / 运维可观测性 | ⏳ 计划中 | 2026-03 |
| P6 | 备份/恢复演练与发布保障 | ⏳ 计划中 | 2026-03 |
| P7 | 平台化（连接器 / 多租户 / HA） | ⏳ 计划中 | 2026-Q2 |

---

## P0: 安全基线与网关封锁（去敏）

### 目标

堵住后台裸奔与调试入口，清理明文口令，确保 TLS 校验与日志脱敏，为后续多成员协作打牢安全底座。

### 主要交付/文件

- `部署/nginx.conf`：BasicAuth 或 IP allowlist 保护 `/admin`、`/api`；SSE/WS 反代；HSTS/安全头
- `部署/compose.yaml`、`admin-dashboard/docker-compose.yml`：限制暴露端口、挂载 secrets/env
- `admin-dashboard/app/api/(dev-mode|debug-auth)/**`：生产默认禁用，构建期/环境变量控制
- `admin-dashboard/.env*`、`部署/cmd.md`、`部署/邮箱服务器部署日志.md`：去敏与口令轮换记录
- `admin-dashboard/worker/imap-worker.ts`、`admin-dashboard/app/api/**/*`：移除 `tls_insecure_skip_verify`/`rejectUnauthorized=false`

### 任务清单

- [ ] 网关：为 `/admin`、`/api` 上 BasicAuth 或 IP 白名单，TLS 强制校验，SSE/WS 路径透传
- [ ] 禁用调试：生产环境屏蔽 dev-mode/debug-auth 等路由，默认 404/403
- [ ] 去敏与轮换：清理仓库/日志/文档明文密码，轮换管理员/邮箱/服务器口令，补充 `.env.example`
- [ ] TLS 正确校验：IMAP/SMTP/DB 连接校验证书；若自签则提供可信链
- [ ] 日志脱敏：密码/Token/SessionId 打码；前端不吐敏感信息

### 验收标准

- [ ] 公网只能访问 Roundcube；`/admin`、`/api` 必须网关认证
- [ ] 生产调试接口不可用，未授权无法读业务数据
- [ ] 仓库与部署文档无明文口令，核心口令已轮换留痕
- [ ] TLS 校验开启，无 `insecure_skip_verify` 类配置

---

## P1: 管理员登录 / RBAC / 审计 v1

### 目标

建立安全的身份体系、最小权限和审计，支撑后续资产管理与动作回写。

### 主要交付/文件

- `admin-dashboard/prisma/schema.prisma`：`User`、`Role`、`Permission`、`UserRole`、`Session`、`AuditLog`
- `admin-dashboard/app/api/auth/(login|logout|me)/route.ts`：登录/登出/当前用户
- `admin-dashboard/middleware.ts`：API/页面鉴权 + RBAC 校验
- `admin-dashboard/app/(login|audits)/page.tsx`：登录页、审计列表
- `admin-dashboard/app/api/**/*`：包装审计写入（账号/域/别名/配额/同步）
- `admin-dashboard/scripts/seed-admin.ts`：首个超级管理员一次性密码

### 任务清单

- [ ] 登录/会话：bcrypt + 会话表；IP+账号限速；CSRF/Security Headers；可选 TOTP
- [ ] RBAC：预置 `SuperAdmin / DomainAdmin / Viewer`，按资源/动作鉴权，默认最小权限
- [ ] 审计：记录操作者/动作/对象/结果/IP/UserAgent/耗时；前端分页筛选/导出 CSV
- [ ] 首次安装：seed 脚本生成一次性密码，首次登录强制修改
- [ ] E2E：login → 创建/禁用账号 → 审计可检索 → 会话过期需重登

### 验收标准

- [ ] 管理面需登录；连续失败触发限速；TOTP 可开启
- [ ] 角色权限生效，Viewer 只读，DomainAdmin 仅限所属域
- [ ] 管理操作均有审计记录，可筛选/导出

---

## P2: 数据存储与密钥加固（Postgres / AES）

### 目标

替换 SQLite，使用 Postgres 与应用层加密安全保存敏感字段，缓解并发与体积风险。

### 主要交付/文件

- `admin-dashboard/prisma/schema.prisma`：provider 改为 postgresql，新增 `Credential` 表（AES-GCM）
- `admin-dashboard/docker-compose.yml`、`部署/compose.yaml`：增加 `postgres` 服务/卷/healthcheck
- `admin-dashboard/.env.example`、`.env.production`：`DATABASE_URL`、`POSTGRES_*`、`APP_ENCRYPTION_KEY`
- `admin-dashboard/scripts/migrate-sqlite-to-postgres.ts`：迁移脚本 + 校验
- `admin-dashboard/lib/crypto.ts`（新）及调用处：凭证加解密

### 任务清单

- [ ] Prisma provider 切换、生成迁移、补充索引（账号/域/别名唯一约束）
- [ ] `Credential` 设计：`ciphertext`、`iv`、`tag`、`keyId`、`purpose`；API 不回明文
- [ ] 账号/SMTP/IMAP 凭证引用 `credentialId`
- [ ] 迁移脚本：SQLite → Postgres，校验行数/哈希，可重跑
- [ ] Compose/Helm：Postgres 初始化、备份卷，确保启动顺序

### 验收标准

- [ ] 本地/生产使用 Postgres，Prisma Client 正常生成
- [ ] 敏感字段落库为密文，接口不泄露明文
- [ ] 迁移脚本跑通，行数一致，幂等可回滚

---

## P3: Provisioning Agent + 域/账号/别名/配额

### 目标

将 docker-mailserver 账号/别名/配额管理产品化，UI 成为权威数据源，可下发、回读、审计。

### 主要交付/文件

- `admin-dashboard/scripts/provisioner-agent/`（或独立服务）：封装 `setup.sh` add/del/update，HTTP + token 鉴权，仅内网
- `admin-dashboard/docker-compose.yml`、`部署/compose.yaml`：新增 `provisioner-agent` 服务与网络
- `admin-dashboard/prisma/schema.prisma`：`Domain`、`Mailbox`、`Alias`、`Quota`、`SyncState`
- `admin-dashboard/app/api/provisioning/**`：域/账号/别名/配额 CRUD + 下发/回读
- `admin-dashboard/app/(domains|mailboxes|aliases)/page.tsx`：管理 UI + CSV 导入导出
- `admin-dashboard/app/api/cron/refresh-provisioning/route.ts`：定时回读 mailserver 现状

### 任务清单

- [ ] Agent 白名单命令：账号 add/del/disable/reset、别名 add/del、配额 set、DKIM 公钥展示；写审计
- [ ] API 幂等：下发/回读接口、重试/死信，失败落 `SyncState`，返回审计 ID
- [ ] 前端：域/账号/别名列表；创建/禁用/重置密码（一次性展示）；配额设置；CSV 导入导出
- [ ] 对账：定时回读 DMS 状态，生成差异，支持“变更预览/一键同步”
- [ ] 安全：DMS 凭证加密，Agent 不暴露 Docker socket 给 Web

### 验收标准

- [ ] UI 创建/禁用账号下发成功，状态回读一致；失败可重试/回滚
- [ ] 别名/转发/配额生效；导入 50+ 账号无错误
- [ ] 关键动作均有审计记录并可追踪

---

## P4: Worker 拆分 + 队列化同步/回写 + SSE

### 目标

将 IMAP 同步与动作回写队列化，Worker 独立运行，前端通过 SSE/WS 获得进度，保证稳定与弹性。

### 主要交付/文件

- `admin-dashboard/worker/imap-worker.ts`：改造为独立进程/容器，消费队列并回执
- `admin-dashboard/scripts/queue-runner.ts`（新）：定义 job schema（sync/markSeen/archive/delete/provision-sync）
- `admin-dashboard/docker-compose.yml`、`部署/compose.yaml`：新增 `redis`（BullMQ）或复用 Postgres（pg-boss），健康检查
- `admin-dashboard/app/api/events/route.ts`：SSE 事件流（sync_progress/job_done/job_error/audit_link）
- `admin-dashboard/app/api/messages/*`、`app/api/actions/*`：改为投递 job + 乐观 UI

### 任务清单

- [ ] 队列化：幂等重试、死信、按账号/域限流
- [ ] 事件推送：Worker → SSE/WS，前端节流刷新
- [ ] 同步链路：列表按需拉取，正文按需缓存；保持 `/api/messages` scope=account/all
- [ ] 健康监测：`/healthz` 包含队列长度、心跳、上次成功时间；结构化日志
- [ ] 兜底：IDLE 断线/失败自动补偿，支持手动触发同步

### 验收标准

- [ ] 同步/动作经队列执行，失败可重试；UI 展示进度/错误
- [ ] Worker 崩溃后可恢复消费，无长时间积压；健康检查通过
- [ ] 手动/自动同步 2-3 秒内刷新列表，正文按需加载

---

## P5: 统一收件箱 / 搜索 / 运维可观测性

### 目标

为管理员提供跨账号聚合视图、全文检索、DNS 安全与监控告警，形成可排障的 MailOps 体验。

### 主要交付/文件

- `admin-dashboard/docker-compose.yml`、`部署/compose.yaml`：可选 `search`（Meilisearch/Elasticsearch）与监控 exporter
- `admin-dashboard/app/api/search/route.ts`、`app/api/dns/route.ts`：搜索与 DNS 检查接口
- `admin-dashboard/app/(inbox|search|monitor)/page.tsx`：统一收件箱、搜索结果、监控面板
- `admin-dashboard/worker/search-indexer.ts`：索引邮件元数据/摘要，权限过滤
- `admin-dashboard/worker/dns-checker.ts`：SPF/DKIM/DMARC/MTA-STS/TLSRPT 检查与缓存

### 任务清单

- [ ] 统一收件箱：跨账号聚合 + Account Chip，支持保存搜索；批量归档/标记已读
- [ ] 搜索：索引主题/发件人/收件人/摘要；按账号/域/标签/时间过滤；默认不存正文
- [ ] 监控告警：同步失败率、证书到期、磁盘/队列水位；邮件/Webhook 告警
- [ ] DNS 安全面板：展示 SPF/DKIM/DMARC/MTA-STS/TLSRPT 状态与修复步骤，结果缓存
- [ ] 导出：日志/搜索结果 CSV，带审计 ID

### 验收标准

- [ ] 聚合视图与原邮箱视图一致，保存搜索可复用
- [ ] 1 万条索引下搜索 <2s，权限过滤正确
- [ ] 监控面板显示健康度，证书/同步异常可告警
- [ ] DNS 面板能定位失败点并给出修复指引

---

## P6: 备份/恢复演练与发布保障

### 目标

形成可验证的备份/恢复流程与发布前检查，降低升级风险。

### 主要交付/文件

- `admin-dashboard/scripts/backup.sh`、`admin-dashboard/scripts/restore.sh`：DB + 配置 + 证书 + mail 卷备份
- `部署/cmd.md`：备份/恢复演练步骤与频率，发布检查清单
- `admin-dashboard/.github/workflows/*`（如有）：CI 增加 lint/test/build、镜像扫描

### 任务清单

- [ ] 定期备份：Postgres dump、mailserver mail/state 卷、配置与密钥模板；保留最近 N 份
- [ ] 恢复演练：在新环境按文档恢复并跑冒烟测试（登录/RBAC/同步/下发）
- [ ] 发布流程：预检（迁移/密钥/健康检查），变更预览 + 回滚计划，发布后观测指标
- [ ] CI/CD：lint/test/build/镜像扫描，拦截明文 secret

### 验收标准

- [ ] 备份/恢复在演练环境可复现，核心功能正常
- [ ] 发布前有检查清单，失败可快速回滚
- [ ] CI/CD 能拦截低级错误与敏感信息

---

## P7: 平台化（连接器 / 多租户 / HA）

### 目标

支持多邮件后端、组织隔离与高可用，形成可扩展的 MailOps 平台。

### 主要交付/文件

- `admin-dashboard/prisma/schema.prisma`：`tenantId` 等租户字段；Retention/合规字段（如需）
- `admin-dashboard/worker/connectors/*`：mailcow/Mailu/Modoboa/自定义 SMTP/IMAP 适配器
- `admin-dashboard/app/api/tenant/**`、`app/(tenants|settings)/page.tsx`：租户管理、策略配置
- 部署模板：docker-compose/k8s，包含 healthz/readyz、结构化日志、metrics

### 任务清单

- [ ] Adapter 抽象：创建账号/别名/配额/DKIM 的统一接口，错误码/超时/重试规范
- [ ] 多租户 RBAC：租户隔离（域/账号/审计绑定租户），租户级角色
- [ ] HA：Postgres + Redis 横向扩展；healthz/readyz；指标/告警（队列长度、错误率、同步延迟、证书过期）
- [ ] 合规：Retention 策略，敏感操作审计不可篡改（追加写）

### 验收标准

- [ ] 不同租户绑定不同邮件后端互不影响；健康检查通过
- [ ] 扩容后功能正常，关键指标可在监控面板可视化
- [ ] 合规策略可配置，审计不可篡改

---

## 更新日志

| 日期 | 阶段 | 变更内容 |
|------|------|----------|
| 2026-01-12 | 合并 | 将《Nexus Mail 管理后台实施计划》与《MailOps 控制台实施计划》合并，统一里程碑与任务清单 |
