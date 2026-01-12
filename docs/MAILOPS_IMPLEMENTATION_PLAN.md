# MailOps 控制台实施计划 (基于《邮箱系统管理员项目企划书》& 现有 Nexus Mail 代码基线)

> 背景：现有前端已完成 P0-P7（主题、增量同步、无感同步等），但企划书撰写时尚未落地安全基线/资产管理/运维可观测。本文在保留现有 UI/IMAP Worker 能力的基础上，规划向“MailOps 控制台”升级的完整路线。

## 进度总览

| 阶段 | 任务 | 状态 | 目标完成 |
|:----:|------|:----:|:--------:|
| P0 | 安全基线与去敏 | ⏳ 进行中 | 2026-01 |
| P1 | 邮件资产管理 (域/账号/别名/配额) | ⏳ 进行中 | 2026-02 |
| P2 | 运维可观测性 (Trace/ELS/DNS 安全) | ⏳ 计划中 | 2026-03 |
| P3 | 平台化 (连接器/多租户/HA) | ⏳ 计划中 | 2026-Q2 |

---

## P0: 安全基线与去敏

### 目标
- 移除明文凭证，完成密码轮换与最小权限落地；为后续多成员协作打好安全底座。
- 登录链路增加 2FA、限速、会话管理与审计日志；补齐备份/恢复演练。

### 主要交付
- Secrets 管理：`.env` + Secrets Manager 方案；文档仅保留变量名和获取方式。
- RBAC：Owner / Operator / Auditor；默认最小权限。
- 审计日志：API 层写入 `AuditLog`，前端审计列表筛选/分页/导出。
- 登录安全：TOTP、登录限速（IP+账号）、可选 IP allowlist、CSRF、安全头。
- 备份/恢复脚本：DB（Prisma）+ 配置 + 证书；恢复演练记录。

### 实施要点（结合现有项目）
- Prisma 增表：`User/Role/Permission/UserRole/AuditLog`；`Credential` 加 envelope encryption（不存明文）。
- API：Auth 中间件 + RBAC 检查；所有管理操作（账号/域/别名/策略）写审计。
- 前端：登录页支持 TOTP；审计日志页面（分页、过滤用户/时间/资源）。
- 现有 IMAP Worker / WebSocket 不输出敏感信息；日志脱敏。

### 验收标准
- 仓库/文档无明文密码；核心账号已轮换并在审计中有记录。
- 登录支持 2FA，连续失败触发限速；CSRF/Security headers 生效。
- 管理操作均可在审计日志检索到用户/时间/IP/结果；备份/恢复演练有文档。

---

## P1: 邮件资产管理 (Domain/Mailbox/Alias/Quota)

### 目标
统一管理域名、邮箱账号、别名、配额，并对接 docker-mailserver (DMS) CLI，使“账号/域”成为权威数据源。

### 主要交付
- 域名/子域/域别名 CRUD；DKIM key 生成与展示（仅公钥）。
- 邮箱账号 CRUD、启停、重置密码（一次性展示）、配额设置。
- 别名/转发/群组管理；账号导入导出（CSV）。
- DMS CLI 适配器：账号/别名/配额/DKIM 同步下发，带幂等/回滚。

### 实施要点
- Prisma 新增：`Domain/Mailbox/Alias/Credential`（凭证加密）；`SyncState` 记录下发状态。
- Worker 新增：DMS Adapter（封装 `setup.sh email add/del`、DKIM 管理、配额）；记录审计。
- 前端新增：域/账号/别名管理页面；批量导入导出；操作结果 toast + 审计链接。
- 配额/状态回读：定时或手动 refresh 从 DMS 拉取现状并比对。

### 验收标准
- UI 可创建/禁用/重置账号并同步到 DMS，状态回读一致。
- 别名/转发/配额下发成功；导入导出 50+ 账号无错误。
- 所有操作有审计记录；下发失败可回滚/重试。

---

## P2: 运维可观测性 (Trace / ELS / DNS 安全)

### 目标
提供 Message Trace、Email Log Search、队列/退信视图，以及 DKIM/DMARC/SPF/MTA-STS/TLSRPT 可视化，形成可排障的 MailOps 面板。

### 主要交付
- Message Trace：按 Message-ID/发件人/收件人/时间段查询，展示状态时间线（received/rejected/deferred/delivered）。
- Email Log Search：日志元数据搜索与 CSV 导出（默认不显示正文）。
- 队列/退信视图：Postfix 队列、常见退信码分类与提示。
- DNS 安全面板：SPF/DKIM/DMARC/MTA-STS/TLSRPT 检查与修复指引。

### 实施要点
- 日志采集：解析 Postfix/Dovecot/Rspamd 日志入库 `MessageTrace`；先本地文件读取，后可接入集中日志。按时间/Message-ID 索引。
- 搜索与索引：分页查询 + CSV 导出；量大时可引入 Meilisearch/ES 索引元数据。
- 队列/退信：解析退信码、队列长度，提供常见原因与操作指引。
- DNS 检测：调用 dig/http 检查 SPF/DKIM/DMARC/MTA-STS/TLSRPT；结果缓存，前端卡片显示状态与修复步骤。

### 验收标准
- 指定 Message-ID 能查询到状态链路；导出 CSV 可用。
- 队列/退信统计每日可刷；DNS 面板显示通过/失败及修复方案。
- 1 万级日志样本下，搜索/分页响应 < 2s（带索引/缓存）。

---

## P3: 平台化 (连接器 / 多租户 / HA)

### 目标
支持多邮件后端、组织隔离与高可用，形成可扩展的 MailOps 平台。

### 主要交付
- 连接器模式：适配 mailcow/Mailu/Modoboa/自定义 SMTP/IMAP；统一接口（创建账号/别名/配额/DKIM）。
- 多租户：组织隔离，域/账号/审计按租户分域；租户级 RBAC。
- 高可用：Postgres + Redis + Worker 横向扩展；healthz/readyz；指标/告警。
- 合规：保留策略（Retention），eDiscovery（如需）。

### 实施要点
- Adapter 抽象：Worker/服务端暴露统一接口，具体后端通过驱动实现；错误码/超时/重试规范化。
- 租户隔离：DB 增加 `tenantId`；RBAC 绑定租户；审计包含租户上下文。
- 部署：docker-compose/k8s 模板；healthz/readyz；结构化日志；metrics（队列长度、错误率、同步延迟、证书过期）。
- 合规：Retention 策略，敏感操作审计不可篡改（追加写）。

### 验收标准
- 可为不同租户绑定不同邮件后端且互不影响；健康检查通过。
- 扩容后功能正常；关键指标/告警可在监控面板可视化。
- 合规策略可配置，审计不可篡改。

---

## 里程碑与依赖

| 里程碑 | 主要交付 | 依赖 |
|--------|----------|------|
| P0 完成 | RBAC/审计/2FA/去敏 | Prisma schema 更新 + 登录/鉴权改造 |
| P1 完成 | 资产管理 + DMS 同步 | docker-mailserver CLI 适配 + Credential 加密 |
| P2 完成 | Trace/Log Search/DNS 安全 | 日志采集管线 + 索引/缓存 |
| P3 完成 | 连接器 + 多租户 + HA | Adapter 抽象 + 部署/监控脚本 |

---

## 更新日志

| 日期 | 阶段 | 变更内容 |
|------|------|----------|
| 2026-01 | 创建 | 初版 MailOps 实施计划（结合企划书 + 现有 P0-P7 代码基线） |
