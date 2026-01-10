# Nexus Mail 风格增强实施计划

> 基于《Nexus Mail 风格管理台：视觉规范与递进式设计方案》的逐步实施计划

## 进度总览

| 阶段 | 任务 | 状态 | 完成日期 |
|:----:|------|:----:|:--------:|
| P0 | 全局样式落地 | ✅ 完成 | 2026-01-10 |
| P1 | 组件状态对齐 S1 | ✅ 完成 | 2026-01-10 |
| P2 | 数据模型加固 | ✅ 完成 | 2026-01-10 |
| P2 | API 补齐 | ✅ 完成 | 2026-01-10 |
| P3 | All Accounts 逻辑 | ✅ 完成 | 2026-01-10 |
| P4 | 草稿与 Compose | ✅ 完成 | 2026-01-11 |
| P5 | QA 检查 | ⬜ 待开始 | - |
| P6 | 自动同步与增强 | ⬜ 规划中 | - |

---

## P0: 全局样式落地

### 目标

把设计规范第 5 节的 tokens/glass/hover/按钮/动画搬到 `globals.css`，在 `page.tsx` 里改用这些类。

### 变更文件

- `app/globals.css` - 添加 Design Tokens 和工具类 ✅
- `app/page.tsx` - 使用新的样式类 🔄 进行中

### Design Tokens 清单

- [x] Color Tokens (bg/surface/stroke/text/accent)
- [x] Typography Tokens
- [x] Radius/Spacing Tokens
- [x] Elevation (shadow) Tokens
- [x] Motion Tokens
- [x] Glass 材质类 (.glass)
- [x] Hover 交互类 (.lift)
- [x] 按钮类 (.btn-primary, .btn-secondary)
- [x] Modal 类 (.modal-overlay, .modal-card)
- [x] Unread bar 样式
- [x] Focus ring 样式
- [x] Reduced motion 媒体查询
- [x] Backdrop-filter 降级

### 组件样式迁移进度

- [x] TopBar 按钮 (同步/写邮件)
- [x] Compose Modal (overlay/card/inputs/button)
- [x] Settings Modal (overlay/card)
- [x] 侧边栏容器 (.glass-lg)
- [x] 邮件列表项 (.glass .lift)

### 验收标准

- [x] 渐变背景 + 两处柔光（紫/蓝）
- [x] 面板具备玻璃材质（Tint + Blur + 边缘高光 + 阴影）
- [x] 强调色只用于 CTA、选中态、未读条
- [x] hover 仅 1px 上浮

---

## P1: 组件状态对齐 S1

### 目标

重做 AccountItem/FolderItem/MessageRow 的 default/hover/selected/focus/unread 状态。

### 变更文件

- `app/page.tsx` - 组件样式重构

### 状态表

| 组件 | default | hover | selected | focus | unread |
|------|---------|-------|----------|-------|--------|
| AccountItem | 透明 | surface-1 + stroke-2 + elev-1 | surface-2 + glow | ring | - |
| FolderItem | text-3 | text-2 + surface-1 | text-1 + surface-2 + stroke-2 | ring | - |
| MessageRow | glass + stroke-1 | translateY(-1px) + elev-2 + stroke-2 | surface-2 + glow | ring | text-1 + weight 600 + unread-bar |

### 验收标准

- [x] Hover 仅 1px 上浮 + stroke/elev-2
- [x] Unread 只在需要时显示渐变条
- [x] 所有可交互元素有 focus ring

---

## P2: 数据模型加固

### 目标

在 Prisma Email 增加 `providerKey` 唯一键，确保 `archived`、`localStatus` 正确使用。

### 变更文件

- `prisma/schema.prisma`

### Schema 变更

```prisma
model Email {
  // 新增
  providerKey String   // "uid:<uid>" 或 "local:<cuid>"
  
  // 修改唯一约束
  @@unique([accountId, providerKey])  // 替换原有的 [accountId, uid]
}
```

### 迁移步骤

1. 修改 schema.prisma
2. 运行 `npx prisma generate`
3. 运行 `npx prisma db push`

---

## P2: API 补齐

### 目标

按设计规范 9.4 增补 API 端点。

### 新增 API

- [x] `GET /api/bootstrap` - 首屏数据（counts + accounts）
- [x] `GET /api/messages` - 邮件列表（支持 scope/folderType/分页）
- [x] `GET /api/messages/:id` - 邮件详情
- [x] `POST /api/messages/:id/seen` - 标记已读
- [x] `POST /api/actions/archive` - 归档/恢复（已有）
- [x] `POST /api/send` - 发送邮件（已有）
- [x] `DELETE /api/drafts/:id` - 删除草稿（已有）

### 兼容性

- 考虑将 `/api/inbox` 兼容或替换为 `/api/messages`

---

## P3: All Accounts 逻辑与反馈优化

> 目标：提供单屏管理所有邮件的聚合视图，并提升操作的即时反馈。

### 1. API 变更

- [x] **`/api/messages`**: 支持 `scope=all` 参数，返回所有账号邮件。
- [x] **`/api/messages`**: 聚合模式下返回的数据需包含 `accountColor` 和 `accountTag`。

### 2. UI 组件升级

- [x] **Sidebar**: 增加 "All Accounts" 虚拟入口（ID: `all`），点击后触发聚合查询。
- [x] **MessageList**: 聚合模式下显示账号标签（Chip），区分不同账号来源。
- [x] **Compose**: 当在聚合视图下写邮件时，强制要求选择发件人（默认上次使用的）。

### 3. 反馈体验优化 (User Feedback)

- [x] **发送中**: 点击发送后显示全局 Loading 或 Button Loading。
- [x] **发送成功**: 显示 Toast 提示“发送成功”，并自动关闭窗口/刷新列表。
- [x] **发送失败**: 保持编辑状态，并在模态框内显示错误提示。

---

## P4: 草稿与 Compose (进行中)

### 1. API 扩展 (Drafts)

- [x] **`POST /api/drafts`**: 创建/更新草稿 (Upsert Logic)。
- [x] **`PUT /api/drafts`**: 已合并至 POST 接口，支持 Upsert。
- [x] **`DELETE /api/drafts`**: 删除草稿。

### 2. Frontend Logic (Compose)

- [x] **Auto-save**: 使用 `useDebounce` 监听表单变化，自动调用保存 API。
- [x] **Draft Resume**: 在草稿箱点击邮件时，不进入详情页，而是打开 Compose Modal 并回显数据。
- [x] **Status Indicator**: 在 Modal 标题栏显示 "已保存" 或 "保存中..."。
- [x] **Cleanup**: 发送邮件成功后，如果该邮件是从草稿恢复的，需调用 DELETE 接口清理。

---

## P6: 自动同步与增强 (Roundcube Parity)

### 目标

实现类似 Roundcube 的自动接收体验和丰富功能，打造“指挥中心”。

### 核心功能

- [ ] **实时推送 (IMAP IDLE 2.0)**: Worker 断线重连、实时写入数据库、WebSocket 推送前端。
- [ ] **后台自动同步**: 定时轮询所有账号，确保数据一致性。
- [ ] **丰富功能**: 附件管理、富文本编辑器优化、快捷回复。

---

## 变更日志

| 日期 | 阶段 | 变更内容 |
|------|------|----------|
| 2026-01-10 | P2 | 完成 API 补齐：新增 bootstrap、messages、messages/:id、messages/:id/seen 四个 API 端点，全部测试通过 |
| 2026-01-10 | P2 | 完成数据模型加固：Email 模型添加 providerKey 字段，更新唯一约束为 [accountId, providerKey]，手动迁移 28 条现有数据 |
| 2026-01-10 | P3 | All Accounts 逻辑：Sidebar 增加聚合入口，列表支持 scope=all 并显示 Account Chip，Compose 增加发送反馈（Loading/Toast/Error），修复 /api/sync 支持 all 参数，切换前端至于 /api/messages |
| 2026-01-10 | P2 | providerKey 全链路修复：sync/worker/upsert 改用 accountId_providerKey 唯一键写入 uid + providerKey；发送 API 插入本地 PENDING 记录并成功后改为 NORMAL；补充 drafts DELETE；/api/messages scope=account 强制要求 accountId |
| 2026-01-10 | 修复 | Settings Modal 滚动和关闭闪烁：添加 maxHeight/flex 布局使内容可滚动；移除 CSS animation 避免与 Framer Motion 冲突 |
| 2026-01-10 | P1 | 完成组件状态对齐：AccountItem/FolderItem/MessageRow 使用统一样式类，Hover 1px 浮动，未读条按状态显示，增加键盘可达性与 focus ring |
| 2026-01-10 | P0 | ✅ 完成全局样式落地：添加 Design Tokens 到 globals.css；迁移 TopBar 按钮、Compose/Settings Modal、侧边栏容器、邮件列表项样式 |
| 2026-01-10 | P0 | 完成 P0 验收：全局样式集中到 globals.css，移除 layout 内联样式；修复 MessageRow hover/未读逻辑与 API 未读标志解析 |
| 2026-01-10 | 优化 | 全局 API 请求优化：为所有 fetch 请求添加末尾斜杠（/），解决 `trailingSlash: true` 配置下的 308 重定向问题，提升请求效率 |
| 2026-01-10 | 修复 | Bug #7 发送逻辑修复：发送失败时将本地临时邮件状态更新为 FAILED，防止长期卡在 PENDING 状态；执行脚本清理了历史脏数据 |
| 2026-01-11 | P4 | 草稿与 Compose 完成（前端自动保存/恢复/状态指示，发送后清理草稿；后端草稿 GET/DELETE/POST upsert 打通）。 |
| 2026-01-11 | 修复 | P4 细节打磨：修复了草稿详情页覆盖编辑框的问题 (Resumption Logic)；增加了丢弃草稿功能；修复了发送失败时 ReferenceError 导致的 500 错误；优化了自动保存和发送后的列表刷新逻辑 |
| 2026-01-11 | 修复 | 发送接口修复：校验收件人并沿用 providerKey，本地写入 PENDING，成功转 NORMAL，失败标记 ERROR，避免空收件人请求与挂起。|
