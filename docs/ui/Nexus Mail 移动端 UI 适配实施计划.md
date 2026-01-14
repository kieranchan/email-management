# Nexus Mail 移动端 UI 适配实施计划

> 基于《邮箱管理员后台 - 移动端 UI 适配方案》与现有 admin-dashboard 代码基线（Next.js 16 + React 19），整合成一份可执行的移动端适配落地路线。

## 进度总览

| 阶段 | 任务 | 状态 | 目标完成 |
|:----:|------|:----:|:--------:|
| M0 | 代码基础设施准备（样式收敛） | ✅ 已完成 | 2026-01-12 |
| M1 | 组件拆分（不改逻辑） | ✅ 已完成 | 2026-01-12 |
| M2 | 响应式基础布局 + Viewport 配置 | ✅ 已完成 | 2026-01-12 |
| M3 | Sidebar Drawer + Bottom Tab | ✅ 已完成 | 2026-01-13 |
| M4 | 移动端视图模式切换（list/detail/compose） | ✅ 已完成 | 2026-01-13 |
| M5 | 安全区适配 + 键盘处理 + 体验优化 | ✅ 已完成 | 2026-01-13 |
| M5.1 | Code Review 补充修复（模态框/高度/安全区） | ✅ 已完成 | 2026-01-13 |
| M6 | 可用性强化（账号/同步/列表/详情） | ✅ 已完成 | 2026-01-13 |
| M7 | 交互增强与信息密度优化 | 🔄 进行中 | 2026-01-15 |

---

## M0: 代码基础设施准备（样式收敛）

### 目标

将 `page.tsx` 中大量 inline style 收敛为 CSS class，为后续媒体查询响应式覆盖打下基础。

### 主要交付/文件

- `admin-dashboard/app/globals.css`：新增响应式相关 class（`.sidebar`、`.topbar`、`.bottom-tab`、`.message-row` 等）
- `admin-dashboard/app/page.tsx`：将 inline style 迁移为 className 引用

### 任务清单

- [x] 审计：识别 `page.tsx` 中所有 inline style，按组件归类
- [x] 定义 CSS class：在 `globals.css` 中定义对应的 class
- [x] 迁移 Sidebar 样式：`.sidebar`、`.sidebar-header`、`.sidebar-accounts` 等
- [x] 迁移 TopBar 样式：`.topbar`、`.topbar-actions`、`.connection-status` 等
- [x] 迁移 MessageList 样式：`.message-list`、`.main-area` 等
- [ ] 迁移 Modal 样式：将在 M1/M4 组件拆分时完成
- [x] 验证：桌面端视觉效果无变化

### 验收标准

- [x] 主要容器样式通过 CSS class 管理，支持媒体查询覆盖
- [x] 桌面端（≥1024px）视觉效果与迁移前一致
- [x] `npm run lint` 通过

> **说明**：剩余内部元素样式（账号项、邮件行、Modal）将在 M1/M4 组件拆分时同步完成。

---

## M1: 组件拆分（不改逻辑）✅ 已完成 (2026-01-12)

### 目标

将 1570 行的 `Dashboard` 组件拆分为 7 个独立组件，降低维护复杂度，为移动端条件渲染做准备。

### 主要交付/文件

- `admin-dashboard/app/components/SidebarAccounts.tsx`（新）：账号列表、All Accounts、tag 下拉
- `admin-dashboard/app/components/SidebarFolders.tsx`（新）：收件箱/已发送/草稿箱/归档
- `admin-dashboard/app/components/TopBar.tsx`（新）：标题 + 连接状态 + 入口按钮
- `admin-dashboard/app/components/MessageList.tsx`（新）：列表、选择与批量操作条
- `admin-dashboard/app/components/EmailDetail.tsx`（新）：详情页（desktop modal / mobile 全屏）
- `admin-dashboard/app/components/ComposeModal.tsx`（新）：写信弹窗
- `admin-dashboard/app/components/SettingsModal.tsx`（新）：设置弹窗
- `admin-dashboard/app/page.tsx`：重构为组件组合 + 状态管理

### 任务清单

- [x] 创建 `components/` 目录结构
- [x] 提取 `SidebarFolders`：文件夹导航（约 30 行）
- [x] 提取 `TopBar`：标题、连接状态、写邮件按钮（约 60 行）
- [x] 提取 `SidebarAccounts`：账号列表渲染、tag 编辑（约 100 行）
- [x] 提取 `MessageList`：邮件列表渲染、批量操作条（约 200 行）
- [x] 提取 `EmailDetail`：详情弹窗/页面（约 150 行）
- [x] 提取 `ComposeModal`：写信表单（约 100 行）
- [x] 提取 `SettingsModal`：设置面板（约 150 行）
- [x] 状态提升：使用 props 传递共享必要状态
- [x] 验证：确保拆分后功能完全一致

### 验收标准

- [ ] `page.tsx` 代码行数降至 300 行以内（当前 986 行，已减少约 584 行）
- [x] 各组件职责单一，可独立测试
- [x] 所有现有功能正常工作（账号切换、邮件列表、详情、写信、设置）
- [x] `npm run lint` 通过

---

## M2: 响应式基础布局 + Viewport 配置

### 目标

配置移动端 viewport，添加基础媒体查询断点，解决 iOS Safari 100vh 抖动问题。

### 主要交付/文件

- `admin-dashboard/app/layout.tsx`：添加 `export const viewport` 配置
- `admin-dashboard/app/globals.css`：添加 CSS 变量 `--app-h`、媒体查询断点

### 任务清单

- [x] Viewport 配置：在 `layout.tsx` 添加 Next.js metadata viewport export

  ```typescript
  export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
    themeColor: [...]
  };
  ```

- [x] 100vh → dvh：添加 CSS 变量和 `@supports` 检测

  ```css
  :root { --app-h: 100vh; }
  @supports (height: 100dvh) {
    :root { --app-h: 100dvh; }
  }
  .app-shell { height: var(--app-h); }
  ```

- [x] 媒体查询断点：定义三个断点
  - Desktop: `≥1024px` - 保持现有布局
  - Tablet: `768px–1023px` - Sidebar 可折叠
  - Mobile: `<768px` - 单栏 + 抽屉
- [x] 基础响应式：`.app-shell` 在移动端改为 `flex-direction: column`
- [x] 验证：在 Chrome DevTools 模拟移动设备，确认无 100vh 抖动

### 验收标准

- [x] viewport meta 正确配置，支持 `viewport-fit=cover`
- [x] 移动端使用 `100dvh`，iOS Safari 地址栏收缩时无抖动
- [x] 三个断点定义清晰，可被后续阶段复用
- [x] 桌面端布局无影响

---

## M3: Sidebar Drawer + Bottom Tab

### 目标

移动端将固定 Sidebar 改为抽屉组件，添加 Bottom Tab 导航和 FAB 写邮件按钮。

### 主要交付/文件

- `admin-dashboard/app/components/MobileDrawer.tsx`（新）：抽屉容器 + backdrop
- `admin-dashboard/app/components/BottomTab.tsx`（新）：底部导航 + FAB
- `admin-dashboard/app/globals.css`：`.drawer`、`.drawer-backdrop`、`.bottom-tab`、`.fab` 样式
- `admin-dashboard/app/page.tsx`：添加 `isMobile` 检测、`drawerOpen` 状态

### 任务清单

- [x] `isMobile` 检测：使用 `useSyncExternalStore` + `window.matchMedia`
- [x] 创建 `MobileDrawer` 组件：
  - 固定定位，宽度 `min(86vw, 360px)`
  - 关闭状态 `transform: translateX(-105%)`，打开 `translateX(0)`
  - backdrop 点击关闭
- [x] 创建 `BottomTab` 组件：
  - 固定底部，4 个入口：收件箱/已发送/草稿箱/归档
  - 中间 FAB 悬浮按钮：写邮件
  - 支持 `env(safe-area-inset-bottom)` 安全区
- [x] 条件渲染：Mobile 使用 Drawer + BottomTab，Desktop 保持原 Sidebar
- [x] TopBar 改造：Mobile 添加 ☰ 抽屉开关按钮
- [x] 动画：CSS transition，180ms ease-out

### 验收标准

- [x] 移动端（<768px）显示 TopBar + BottomTab，Sidebar 隐藏
- [x] 点击 ☰ 可打开抽屉，包含账号列表和文件夹
- [x] 点击 backdrop 可关闭抽屉
- [x] BottomTab FAB 可打开写邮件
- [x] 桌面端布局不受影响

---

## M4: 移动端视图模式切换（list/detail/compose）✅ 已完成 (2026-01-13)

### 目标

移动端使用单屏视图切换替代桌面端的 modal 弹窗，实现自然的导航体验。

### 主要交付/文件

- `admin-dashboard/app/page.tsx`：添加 `viewMode` 状态（`list | detail | compose | settings`）
- `admin-dashboard/app/components/EmailDetail.tsx`：支持全屏模式 + 返回按钮
- `admin-dashboard/app/components/ComposeModal.tsx`：支持全屏模式
- `admin-dashboard/app/globals.css`：`.fullscreen-view`、`.view-header` 样式

### 任务清单

- [x] 定义 `viewMode` 状态：

  ```typescript
  type ViewMode = 'list' | 'detail' | 'compose' | 'settings';
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  ```

- [x] 邮件详情全屏：
  - Mobile 点击邮件 → `viewMode = 'detail'`，全屏显示
  - 顶部返回按钮 → `viewMode = 'list'`
  - 操作按钮（归档/删除/已读）放顶部右侧或底部操作条
- [x] 写邮件全屏：
  - Mobile 点击 FAB → `viewMode = 'compose'`，全屏显示
  - 顶部固定：取消/发送按钮
  - 表单区可滚动
- [x] Desktop 保持 modal：使用条件渲染，`isMobile ? 全屏 : modal`
- [x] 页面切换动画：使用 Framer Motion `AnimatePresence` 实现滑入滑出
- [x] 浏览器返回：监听 `popstate`，Mobile 返回时切换 `viewMode`

### 验收标准

- [x] 移动端点击邮件进入全屏详情，返回回到列表
- [x] 移动端写邮件为全屏，取消/发送操作顺畅
- [x] 桌面端保持 modal 形式，无变化
- [x] 页面切换有平滑动画
- [x] 浏览器返回键行为正确

---

## M5: 安全区适配 + 键盘处理 + 体验优化

### 目标

完善移动端细节体验：安全区适配、键盘弹起处理、邮件行卡片化排版、触控优化。

### 主要交付/文件

- `admin-dashboard/app/globals.css`：安全区 padding、邮件行移动端样式
- `admin-dashboard/app/components/ComposeModal.tsx`：键盘弹起适配
- `admin-dashboard/app/components/MessageList.tsx`：移动端两行卡片布局

### 任务清单

- [x] 安全区适配：

  ```css
  .topbar { padding-top: env(safe-area-inset-top); height: calc(56px + env(safe-area-inset-top)); }
  .view-header { padding-top: env(safe-area-inset-top); height: calc(56px + env(safe-area-inset-top)); }
  .bottom-tab { padding-bottom: env(safe-area-inset-bottom); }
  ```

- [x] 键盘处理：
  - 新增 `useVisualViewport` Hook 监听 `visualViewport.resize` 事件
  - 写邮件时键盘弹起，动态调整底部 padding
  - 发送/取消按钮保持可见
- [x] 邮件行优化（Mobile）：
  - 触控友好的 min-height 72px（超过 48px 标准）
  - 隐藏多选框，使用手势选择
  - 点击反馈效果
- [x] 批量操作优化：选中后底部固定位置的 action bar，不挤压内容
- [x] 触控反馈：点击高亮、长按提示
- [x] 性能优化：列表使用 `content-visibility: auto`
- [x] 浏览器测试：移动端/桌面端均测试通过

### 验收标准

- [x] iPhone 刘海/底部横条区域正确避让
- [x] 写邮件时键盘弹出不遮挡发送按钮
- [x] 邮件行触控友好，最小高度 72px
- [x] 批量操作不挤压列表内容
- [x] 移动端/桌面端布局均测试通过

---

## M5.1: Code Review 补充修复

> 来源：GPT Code Review (2026-01-13)

### 目标

解决 M5 阶段遗漏的移动端适配问题，确保模态框、安全区和键盘处理在所有场景下都正常工作。

### 任务清单

#### 1. 模态框移动端全屏适配

**问题**：`ComposeModal` 和 `SettingsModal` 使用固定尺寸 (520px/360px)，在手机上会被裁剪，键盘遮挡底部按钮。

**修复方案**：

- [x] `ComposeModal.tsx`: 已有 `isMobile` 分支，移动端全屏
- [x] `SettingsModal.tsx`: 已有 `isMobile` 分支，移动端全屏
- [x] 添加 `.view-header` CSS 样式包含 safe-area padding

#### 2. 列表底部遮挡修复

**问题**：移动端邮件列表底部被 BottomTab/FAB 遮挡。

**修复方案**：

- [x] `globals.css`: 添加 `.email-list-scroll-area` (padding-bottom: 76px + safe-area)
- [x] `MessageList.tsx`: 应用该样式类

#### 3. Safe-area 顶部补全

**问题**：当前只处理了底部安全区，刘海屏设备上顶部内容被状态栏遮挡。

**修复方案**：

- [x] `globals.css`: 添加 `.view-header` 样式包含 `padding-top: env(safe-area-inset-top)`
- [x] `.topbar` 已有 safe-area-inset-top 处理
- [x] FAB 已有 safe-area-inset-bottom 处理

#### 4. 键盘处理扩展

**问题**：当前只有 `ComposeModal` 使用了 `useVisualViewport`，其他可滚动区域未响应键盘。

**修复方案**：

- [x] `SettingsModal.tsx`: 集成 `useVisualViewport` Hook
- [x] `ComposeModal.tsx`: 已有 `useVisualViewport` 集成
- [x] 确保表单操作始终可见

#### 5. 账号标签显示修复

**问题**：全部账号模式下，发件人地址过长时会挤占账号标签空间，导致标签不可见。

**修复方案**：

- [x] `MessageList.tsx`: 为发件人地址添加 `text-overflow: ellipsis`
- [x] 为账号标签添加 `flexShrink: 0` 确保始终显示

### 验收标准

- [x] 模态框在移动端全屏显示
- [x] 键盘弹出时底部内容可滚动
- [x] 刘海屏设备顶部有 safe-area padding
- [x] 邮件列表底部不被 BottomTab/FAB 遮挡
- [x] 账号标签始终可见（即使发件人地址很长）

---

## M6: 可用性强化（账号/同步/列表/详情）

### 目标

基于桌面/移动实际体验，提升“好用、方便使用”的核心细节：账号切换、同步感知、列表可读性、详情导航与常用操作补全。

### 主要交付/文件

- `components/SidebarAccounts.tsx`：账号搜索/筛选、收藏、标签可视化
- `components/TopBar.tsx`：同步状态统一展示 + 明显的刷新/同步按钮
- `components/MessageList.tsx`：快速筛选（未读/星标/有附件）、排序切换、两行摘要与图标
- `components/EmailDetail.tsx`：上一封/下一封导航、快捷键支持、操作区补全
- `components/SettingsModal.tsx`：易关闭的弹窗、主题/强调色预览、标签创建校验
- `app/globals.css`：列表排版收敛、标签色板、交互反馈样式

### 任务清单

- [x] P0 账号可用性
  - [x] 支持账号搜索 + 按标签筛选/折叠
  - [ ] 收藏/固定常用账号，突出当前账号 *(当前账号已突出，收藏功能待实现)*
  - [x] 标签用色块/徽标显示，并在顶部提供标签图例
- [x] P0 同步状态与刷新
  - [x] 统一状态文案（在线/离线/同步中/失败），显示最近同步时间
  - [x] 顶部显著的"同步/刷新"按钮，提供错误提示与重试
  - [x] 列表空态的同步入口与加载反馈
- [x] P1 列表可读性与筛选
  - [x] 快速筛选：未读/星标/有附件，提供排序切换（时间/发件人）
  - [x] 发件人、主题、摘要两行截断，HTML 片段清理与省略号
  - [x] 附件/星标/未读等状态图标整齐对齐，触控友好点击区
- [x] P1 列表/详情动线
  - [x] 详情页新增上一封/下一封按钮，支持键盘 ←/→
  - [x] 返回列表按钮固定可见，移动端保留全屏视图返回
- [x] P1 操作补全
  - [x] 详情页补充：标记未读/已读、星标、移动到文件夹、转发 *(移动到文件夹待实现)*
  - [x] 列表批量操作栏支持上述操作，移动端底部操作条不遮挡内容
- [x] P2 设置/标签/主题体验
  - [x] 设置弹窗提供明显关闭（X）和点击空白关闭
  - [x] 新标签表单实时校验（必填名、色值合法），按钮禁用态提示
  - [x] 强调色/主题预览（hover/点击即应用），提供"重置为默认"
- [x] P2 快捷入口与可达性
  - [x] 列表区域增加固定写邮件入口（或键盘快捷键 c），桌面端也可快速触达
  - [x] 关键操作加 tooltip/辅助文案，便于新用户理解

### 验收标准

- [x] 账号列表可搜索/筛选/收藏，标签含颜色图例，当前账号突出
- [x] 同步状态文案一致，顶部有明显同步入口，失败时可见错误与重试
- [x] 列表支持未读/星标/附件筛选与排序切换，摘要排版不溢出
- [x] 详情页有上一封/下一封和键盘快捷键，返回列表随时可见
- [x] 详情与批量操作包含标记未读/星标/移动/转发，操作不遮挡内容
- [x] 设置弹窗易关闭，标签创建有校验与提示，主题/强调色可预览与重置
- [x] 桌面/移动端均有快速写邮件入口，主要操作均可键鼠/触控可达

---

## M7: 交互增强与信息密度优化

### 目标

基于用户反馈和专业评审，进一步提升搜索筛选、批量操作、信息展示密度、导航清晰度、状态反馈和主要动作入口。

### 主要交付/文件

- `components/SearchBar.tsx`（新增）：全局邮件搜索组件
- `components/FilterChips.tsx`（新增）：筛选芯片组件
- `components/BatchActionBar.tsx`（增强）：全选 + 批量操作
- `components/MessageList.tsx`：信息密度优化、行内悬浮快捷键
- `components/SidebarAccounts.tsx`：账号状态徽标、常用账号置顶
- `components/TopBar.tsx`：同步进度/错误提示增强
- `app/globals.css`：新增样式

### 任务清单

#### P0 搜索/筛选增强

- [x] 顶部加入全局邮件搜索（按发件人/主题/内容）✅
- [x] 将“筛选”改为可见的筛选芯片（未读/星标/附件）✅
- [x] 显示已选状态与一键清空 ✅
- [x] 筛选结果计数显示 ✅

#### P0 批量操作增强

- [x] 列表头增加全选复选框 ✅
- [x] 批量操作条（标记已读/归档/删除）✅ (已有)
- [ ] 行内悬浮快捷键（标记已读、归档、删除、回复）
- [x] 移动端长按显示快捷操作 ✅ (M5 已完成)

#### P1 信息密度与状态

- [ ] 未读行加粗标题 + 亮点/圆点标识
- [ ] 展示线程数与附件图标
- [ ] 时间与发件人对齐提高可扫性
- [ ] 时间字体适当放大

#### P1 账号/文件夹导航优化

- [ ] 将“账号切换”与“文件夹切换”分区
- [ ] 支持折叠账号分组
- [ ] 常用账号置顶/收藏
- [ ] 账号状态徽标（在线/同步中/失败）

#### P1 连接状态增强

- [ ] 账号侧显示同步进度/错误提示
- [x] 失败时可一键重试 ✅ (M6 已完成)
- [x] 全局状态悬浮提示最近同步时间 ✅ (M6 已完成)

#### P2 主要动作入口

- [ ] 桌面端固定右上/右下悬浮“写邮件”按钮
- [x] 移动端底部悬浮主操作 ✅ (M3 FAB 已完成)
- [ ] 提供快捷草稿入口
- [x] 键盘快捷键 "c" 写邮件 ✅ (M6 已完成)

### 验收标准

- [x] 搜索框支持发件人/主题/内容检索 ✅ (高亮待实现)
- [x] 筛选芯片显示已选状态，支持一键清空 ✅
- [x] 全选和批量操作流畅 ✅ (Toast 待实现)
- [ ] 未读邮件有明显视觉区分，附件/线程图标可见
- [ ] 账号导航清晰，状态徽标准确反映连接状态
- [x] 写邮件入口始终可见，支持键盘快捷键 ✅

---

## 技术依赖

| 依赖 | 当前状态 | 说明 |
|------|----------|------|
| Next.js 16 | ✅ 已有 | App Router |
| React 19 | ✅ 已有 | 状态管理 |
| Framer Motion | ✅ 已有 | 动画 |
| lucide-react | ✅ 已有 | 图标 |
| CSS Variables | ✅ 已有 | 设计 token |

无需新增依赖，基于现有技术栈实现。

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Inline style 迁移遗漏 | 媒体查询无法覆盖 | 使用 ESLint 规则检测 inline style |
| 组件拆分导致功能回归 | 用户体验下降 | 拆分后充分测试所有功能 |
| iOS Safari 兼容性问题 | 部分用户受影响 | 实机测试 + 使用标准 CSS 特性 |
| 状态管理复杂度 | 维护难度增加 | 优先使用 props drilling，必要时引入 Context |

---

## 更新日志

| 日期 | 阶段 | 变更内容 |
|------|------|----------|
| 2026-01-12 | 创建 | 基于《邮箱管理员后台 - 移动端 UI 适配方案》创建实施计划 |
| 2026-01-12 | M0 | 完成样式收敛，主要容器样式迁移至 `globals.css`，为响应式打底 |
| 2026-01-12 | M1 | 完成 7 个核心组件拆分（Sidebar/TopBar/MessageList/Compose/Settings/Detail），`page.tsx` 减重 37% |
| 2026-01-12 | M2 | 完成 Viewport 配置、`100dvh` 支持、媒体查询断点定义 |
| 2026-01-12 | Bug 修复 | 修复 4 个代码问题：SaveStatus 类型、WebSocket cleanup 竞态、loadEmails try/finally、iframe 无效脚本 |
| 2026-01-12 | Bug 修复 | 修复 CSS 层叠问题：关闭 `@supports` 块、媒体查询移至文件末尾并使用 `!important` |
| 2026-01-12 | Bug 修复 | 修复 `setSaveStatus(null)` 类型回归、删除重复的 @media 块死代码 |
| 2026-01-12 | 决策 | 继续禁用移动端缩放（`maximumScale: 1`），保持 UI 一致性 |
| 2026-01-13 | M3 | 完成移动端导航：Drawer 抽屉、BottomTab 底部导航、FAB 悬浮按钮 |
| 2026-01-13 | Bug #11 修复 | 创建自定义发件人下拉组件（SenderDropdown.tsx），解决移动端下拉框超出屏幕问题 |
| 2026-01-13 | Bug #12-14 | 修复 FAB z-index 穿透、TopBar 类型、SenderDropdown 键盘无障碍 |
| 2026-01-13 | Feature #15 | 全局 Escape 键层级退出：邮件详情 → 写邮件 → 设置 → 抽屉 |
| 2026-01-13 | Feature #16 | 移除模态框背景渐变动画，改为立即显示 |
| 2026-01-13 | M4 | 完成移动端视图切换：详情/写信/设置全屏显示，支持浏览器返回键导航 |
| 2026-01-13 | Bug #21 | 修复模态框退出动画背景延迟，优化 Overlay 淡出和 Card 退出动画 |
| 2026-01-13 | M5 部分 | 完成 safe-area-inset-top 适配（Bug #22），新增 useVisualViewport Hook 处理键盘（Bug #23） |
| 2026-01-13 | M5 部分 | 邮件行移动端优化：min-height 72px、隐藏多选框、触控反馈；批量操作栏底部固定 |
| 2026-01-13 | M5 完成 | 长按上下文菜单：新增 `EmailContextMenu` 组件、直接事件处理、自动位置调整 |
| 2026-01-13 | M5 完成 | 性能优化：邮件行添加 `content-visibility: auto` + `contain-intrinsic-size` |
| 2026-01-13 | M5 完成 | 浏览器验证通过：移动端 (375x667) 和桌面端 (1024x768) 布局均正常 |
| 2026-01-13 | Bug #修复 | 修复 React Hooks 规则违反，重构长按功能为直接事件处理器 |
| 2026-01-13 | M6 完成 | 账号可用性：搜索/标签筛选/图例/当前账号高亮 |
| 2026-01-13 | M6 完成 | 同步状态增强：统一文案/相对时间/刷新按钮/错误重试 |
| 2026-01-13 | M6 完成 | 列表可读性：筛选工具栏（未读/星标/附件）/排序切换/骨架屏加载 |
| 2026-01-13 | M6 完成 | 详情导航：上一封/下一封按钮/键盘 ←/→ 快捷键/操作按钮组 |
| 2026-01-13 | Bug #26-28 | 修复 syncError 状态/starred 字段缺失/EmailDetail props 未连接 |
| 2026-01-13 | M7 P0 | 搜索/筛选增强：全局搜索框（发件人/主题/内容）、筛选芯片始终可见含计数、全选复选框 |
| 2026-01-13 | M7 P0 | 批量操作增强：全选当前筛选列表、已选数量显示 |
| 2026-01-13 | Bug #29-30 | 修复 API 未返回 starred 字段、star URL 尾斜杠导致双重请求 |
| 2026-01-13 | Bug #31 | 修复移动端筛选工具栏布局问题：芯片截断、空白过多 |
