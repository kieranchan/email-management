# Nexus Mail 移动端 UI 适配 - Bug 记录

> 本文档专门记录移动端 UI 适配过程中发现的 Bug 及其解决方案。
> 通用 Bug 请参考 `BUGS_AND_SOLUTIONS.md`。

---

## 📊 Bug 统计

| 状态       | 数量 |
| ---------- | ---- |
| 🔴 待修复 | 0 |
| 🟢 已修复 | 27 |
| 🟡 进行中 | 0 |

---

## 🔴 待修复

### 暂无

---

- [x] Bug #26-28 已修复

---

## 🟢 已修复

### Bug #28: EmailDetail 导航和操作 props 未连接（M6）

**发现日期**：2026-01-13
**来源**：GPT Code Review
**优先级**：🔥 高

**问题描述**：
`EmailDetail.tsx` 新增了 `onPrev/onNext/onMarkRead/onStar/onForward` props，但 `page.tsx` 渲染 `<EmailDetail>` 时没有传递这些 props，导致上一封/下一封按钮始终禁用，键盘 ←/→ 快捷键无效，标记已读/星标/转发按钮不工作或隐藏。

**解决方案**：
在 `page.tsx` 中为 `<EmailDetail>` 添加所有导航和操作 props：

- `hasPrev/hasNext` 基于当前邮件在列表中的索引计算
- `onPrev/onNext` 调用 `selectEmail()` 切换邮件
- `onMarkRead` 调用 `markAsRead()/markAsUnread()`
- `onStar` 打印日志（TODO: 实现 API）
- `onForward` 打开写邮件弹窗并预填转发内容

**相关文件**：`app/page.tsx` (第 1145-1175 行)

**状态**：🟢 已修复 (2026-01-13 20:00)

---

### Bug #27: starred/hasAttachment 字段缺失（M6）

**发现日期**：2026-01-13
**来源**：GPT Code Review
**优先级**：🔥 高

**问题描述**：
`MessageList.tsx` 的筛选/图标依赖 `email.starred` 和 `email.hasAttachment`，但 `page.tsx` 的 `loadEmails()` 函数在映射 API 数据时丢弃了这些字段，导致星标/附件筛选按钮永远返回空结果，邮件行的星标/附件图标永远不显示。

**解决方案**：
在 `loadEmails()` 的数据映射中添加 `starred` 和 `hasAttachment` 字段：

```typescript
const enhanced = (data.items || []).map((e) => ({
  // ... 其他字段
  starred: e.starred,           // 新增
  hasAttachment: e.hasAttachment, // 新增
  // ...
}));
```

**相关文件**：`app/page.tsx` (第 544-545 行)

**状态**：🟢 已修复 (2026-01-13 20:00)

---

### Bug #26: syncError 状态从未被设置（M6）

**发现日期**：2026-01-13
**来源**：GPT Code Review
**优先级**：🔥 高

**问题描述**：
`syncError` 状态在 `page.tsx:103` 定义，但只在刷新时被重置为 `null`，WebSocket 的同步失败事件没有捕获并设置 `syncError`，导致 TopBar 的错误状态/tooltip/"重试" UI 永远不会显示真实的同步失败。

**解决方案**：
在 WebSocket 的 `sync_result` 事件处理中捕获错误：

```typescript
} else if (data.type === 'sync_result') {
  setSyncing(false);
  if (data.error) {
    setSyncError(data.error);
  } else {
    setSyncError(null);
  }
}
```

**相关文件**：`app/page.tsx` (第 319-328 行)

**状态**：🟢 已修复 (2026-01-13 20:00)

---

### Bug #25: 轮询/WebSocket 推送无法更新非收件箱邮件

**发现日期**：2026-01-13
**来源**：用户反馈

**问题描述**：
在"已发送"或其他非收件箱文件夹，等待自动轮询（30s）或收到 WebSocket `sync_progress`/`new_email` 推送时，列表不会刷新。

**原因分析**：
`startPolling` 和 `throttledRefresh` 使用了 `useCallback([], ...)`，导致它们闭包捕获的是组件第一次渲染时的 `loadEmails` 函数。而第一次渲染时 `activeFolder` 状态尚未更新（默认为 `inbox`）。因此，无论用户切换到哪个文件夹，轮询器始终在请求收件箱的数据。

**解决方案**：
引入 `loadEmailsRef` (useRef) 来保持对最新 `loadEmails` 函数的引用，并在 `useEffect` 中每次渲染后更新它。轮询器通过 `loadEmailsRef.current()` 调用，从而始终执行最新的逻辑（包含最新的 `activeFolder` 和 `selectedAccount` 状态）。

**相关文件**：

- `app/page.tsx`

**状态**：🟢 已修复 (2026-01-13)

### Bug #23: 缺少虚拟键盘处理

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：
在移动端写邮件（ComposeModal）时，当虚拟键盘弹出时，底部的"发送"/"丢弃"按钮可能被键盘遮挡，用户无法点击。

**解决方案**：

1. 新增 `useVisualViewport` Hook 监听视口变化
2. 计算键盘高度，动态调整 Modal 底部 padding

**相关文件**：

- `app/components/ComposeModal.tsx`
- `app/hooks/useVisualViewport.ts` (新增)

**状态**：🟢 已修复 (2026-01-13)

---

### Bug #22: Safe-area 顶部安全区未处理

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：
在带刘海屏（notch）的 iOS 设备上，TopBar 和全屏视图的顶部内容会被状态栏遮挡。

**解决方案**：

1. `.topbar` 添加 `padding-top: env(safe-area-inset-top, 0px)` 和动态高度
2. `.view-header` 添加 `padding-top: env(safe-area-inset-top, 0px)` 和动态高度

**相关文件**：`app/globals.css`

**状态**：🟢 已修复 (2026-01-13)

---

### Bug #1: SaveStatus 类型不匹配导致 TS 编译错误

**发现日期**：2026-01-12
**来源**：GPT Code Review

**问题描述**：
`ComposeModal.tsx` 定义 `type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'`（不含 `null`），但 `page.tsx` 初始化状态为 `useState<... | null>(null)`，导致类型不兼容。

**影响范围**：

- TypeScript 严格模式下编译失败
- 写邮件弹窗状态显示异常

**解决方案**：
将 `page.tsx` 第 80 行初始值改为 `'idle'`，并导入 `SaveStatus` 类型：

```typescript
import ComposeModal, { type SaveStatus } from './components/ComposeModal';
const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
```

**相关文件**：`app/page.tsx`

**状态**：🟢 已修复 (2026-01-12)

---

### Bug #2: WebSocket cleanup 竞态导致内存泄漏

**发现日期**：2026-01-12
**来源**：GPT Code Review

**问题描述**：
`useEffect` cleanup 中调用 `socket?.close()` 会触发 `onclose` 回调，后者又调用 `startPolling()` 和 `setTimeout(connect, 5000)`。组件 unmount 后这些定时器仍在运行，造成：

1. 内存泄漏
2. 状态更新到已卸载组件（React 警告）
3. 无意义的网络请求

**影响范围**：

- 页面导航时后台仍有网络请求
- 控制台可能出现 "Can't perform a React state update on an unmounted component" 警告

**解决方案**：
添加 `isMounted` 守卫变量，在 cleanup 时设为 `false`，`onclose` 中检查该变量：

```typescript
let isMounted = true;

socket.onclose = () => {
  if (!isMounted) return; // 新增守卫
  // ... 原有逻辑
};

return () => {
  isMounted = false; // 新增
  // ... cleanup
};
```

**相关文件**：`app/page.tsx` (第 194-281 行)

**状态**：🟢 已修复 (2026-01-12)

---

### Bug #3: loadEmails 网络错误时 loading 状态卡死

**发现日期**：2026-01-12
**来源**：GPT Code Review

**问题描述**：
`loadEmails()` 函数缺少 `try/finally`，当 `fetch` 抛出网络错误时，`setLoading(false)` 永远不会执行，导致：

1. 邮件列表一直显示加载状态
2. 批量操作条无法使用
3. 用户无法进行任何操作

**复现步骤**：

1. 断开网络连接
2. 切换账号或文件夹
3. 观察到 loading 状态永远不结束

**解决方案**：
使用 `try/finally` 包裹 fetch 逻辑，确保 `setLoading(false)` 总会执行：

```typescript
async function loadEmails() {
  setLoading(true);
  try {
    // ... fetch 逻辑
  } catch (e) {
    console.error('Failed to load emails:', e);
  } finally {
    setLoading(false);
  }
}
```

**相关文件**：`app/page.tsx` (第 416-476 行)

**状态**：🟢 已修复 (2026-01-12)

---

### Bug #4: iframe sandbox 阻止脚本执行导致死代码

**发现日期**：2026-01-12
**来源**：GPT Code Review

**问题描述**：
`EmailDetail.tsx` 中 iframe 使用 `sandbox="allow-same-origin"` 但不包含 `allow-scripts`，导致 `<script>` 块永远不会执行。图片懒加载脚本是死代码，相关 CSS 规则（`img[data-lazy-src]`）也无效。

**影响范围**：

- 图片懒加载功能实际未生效
- 代码中存在误导性的无效代码

**解决方案**：
删除无效的脚本和相关 CSS，因为添加 `allow-scripts` 有安全风险（可能执行恶意邮件中的 JS）。浏览器原生 `loading="lazy"` 属性已足够。

删除内容：

- `img[data-lazy-src]` 相关 CSS 规则
- 整个 `<script>` 块（约 22 行）

**相关文件**：`app/components/EmailDetail.tsx`

**状态**：🟢 已修复 (2026-01-12)

---

### Bug #5: CSS 层叠顺序导致移动端媒体查询失效

**发现日期**：2026-01-12
**来源**：移动端验证测试

**问题描述**：
M2 添加的移动端媒体查询 `.sidebar { display: none }` 不生效，移动端 Sidebar 仍然显示。

**问题原因**（两个）：

1. **`@supports` 块未关闭**：`globals.css` 第 67-71 行的 `@supports (height: 100dvh)` 缺少闭合 `}`，导致后续所有 CSS（包括媒体查询）都被嵌套在该块内。
2. **CSS 层叠顺序**：媒体查询（第 556-566 行）在 `.sidebar` 定义（第 883-889 行）之前，后者的 `display: flex` 覆盖了媒体查询的 `display: none`。

**复现步骤**：

1. 访问 `http://localhost:3000`
2. 使用 Chrome DevTools 切换到 iPhone 模拟器（<768px）
3. 观察 Sidebar 仍然显示

**解决方案**：

1. 关闭 `@supports` 块（第 71 行添加 `}`）
2. 将媒体查询移动到文件末尾
3. 使用 `!important` 确保覆盖

```css
/* 文件末尾 */
@media (max-width: 768px) {
    .sidebar {
        display: none !important;
    }
}
```

**相关文件**：`app/globals.css`

**状态**：🟢 已修复 (2026-01-12 23:35)

---

### Bug #6: setSaveStatus(null) 类型回归

**发现日期**：2026-01-12
**来源**：GPT Code Review (第二轮)

**问题描述**：
`page.tsx` 第 649 行的 `discardDraft()` 函数中仍有 `setSaveStatus(null)`，但状态类型已改为 `SaveStatus`（不含 `null`），导致类型错误回归。

**影响范围**：

- TypeScript 严格模式下编译失败

**解决方案**：
将 `setSaveStatus(null)` 改为 `setSaveStatus('idle')`。

**相关文件**：`app/page.tsx` (第 649 行)

**状态**：🟢 已修复 (2026-01-12 23:50)

---

### Bug #7: 重复的 @media 块导致死代码

**发现日期**：2026-01-12
**来源**：GPT Code Review (第二轮)

**问题描述**：
`globals.css` 中有两个 `@media (max-width: 768px)` 块：

- 第 557 行：不含 `!important`，被后面的 `.sidebar` 规则覆盖
- 第 1401 行：含 `!important`，实际生效

第一个块是死代码，会造成维护混乱。

**影响范围**：

- CSS 文件中存在无效代码
- 未来修改时可能产生歧义

**解决方案**：
删除第 557-566 行的第一个 @media 块，保留注释说明媒体查询已移至文件末尾。

**相关文件**：`app/globals.css`

**状态**：🟢 已修复 (2026-01-12 23:50)

---

### Bug #8: Drawer 中文件夹导航与 BottomTab 重复

**发现日期**：2026-01-13
**来源**：用户测试反馈

**问题描述**：
移动端 Drawer（账号切换抽屉）和 BottomTab 都显示了文件夹导航（收件箱/已发送/草稿箱/归档），功能重复，界面混乱。

**设计意图**：

- **Drawer**: 仅用于切换账号和访问设置
- **BottomTab**: 仅用于切换文件夹（收件箱/已发送/草稿箱/归档）

**影响范围**：

- 移动端用户体验下降
- 界面功能重复

**解决方案**：

1. 隐藏 Drawer 打开时的 BottomTab（避免视觉冲突）
2. **从 Drawer 中移除 SidebarFolders 组件**（避免功能重复）

```tsx
// Before: Drawer 包含账号列表 + 文件夹导航
<MobileDrawer>
  <SidebarAccounts />
  <SidebarFolders />  // ❌ 删除这个
  <Settings />
</MobileDrawer>

// After: Drawer 仅包含账号列表 + 设置
<MobileDrawer>
  <SidebarAccounts />
  <Settings />
</MobileDrawer>
```

**相关文件**：

- `app/page.tsx` (第 979 行 - BottomTab 条件渲染)
- `app/page.tsx` (第 910-917 行 - 删除 Drawer 中的 SidebarFolders)

**状态**：🟢 已修复 (2026-01-13 00:32)

---

### Bug #9: 移动端邮件详情无法全屏显示

**发现日期**：2026-01-13
**来源**：用户测试反馈

**问题描述**：
移动端点击邮件时，`EmailDetail` 组件被 BottomTab 遮挡或显示不全，导致无法正常查看邮件详情。

**影响范围**：

- 移动端无法查看邮件内容
- 主要功能阻塞

**根本原因**：
EmailDetail 组件使用固定宽度 700px 的桌面端样式，在移动端需要全屏显示（`position: fixed`）并提高 z-index。

**解决方案**：

1. 在 `EmailDetail.tsx` 添加 `isMobile` prop
2. 根据 `isMobile` 调整样式：
   - Mobile: `position: fixed`, `inset: 0`, `width: 100%`, `zIndex: 200`
   - Desktop: `position: relative`, `width: 700`, `zIndex: 10`
3. 在 `page.tsx` 传入 `isMobile={isMobile}` prop

**相关文件**：

- `app/components/EmailDetail.tsx` (第 17-53 行)
- `app/page.tsx` (第 1002 行)

**状态**：🟢 已修复 (2026-01-13 00:20)

---

### Bug #10: 设置模态框打开时 FAB 按钮穿透显示

**发现日期**：2026-01-13
**来源**：用户测试反馈

**问题描述**：
移动端打开设置模态框时，底部的 FAB（写邮件）按钮仍然显示在设置界面上方，造成视觉穿透。

**影响范围**：

- 移动端视觉体验下降
- FAB 可能被误点击

**根本原因**：

- **modal-overlay**: z-index: 100
- **FAB**: z-index: 101

FAB 的 z-index 比模态框高，导致穿透显示。

**解决方案**：
在 `page.tsx` 的 BottomTab（包含 FAB）渲染逻辑中添加 `!showSettings` 检查：

```tsx
{/* Mobile: Bottom Tab (hidden when drawer or settings modal is open) */}
{isMobile && !drawerOpen && !showSettings && (
  <BottomTab ... />
)}
```

**相关文件**：

- `app/page.tsx` (第 970 行)
- `app/globals.css` (FAB z-index: 1536 行, modal-overlay z-index: 272 行)

**状态**：🟢 已修复 (2026-01-13 00:38)

---

### Bug #11: 写邮件时发件人下拉框超出屏幕

**发现日期**：2026-01-13
**来源**：用户测试反馈

**问题描述**：
移动端写邮件时，点击发件人选择器，原生 `<select>` 的下拉列表超出屏幕底部，无法选择底部的账号。

**影响范围**：

- 移动端无法选择底部的发件人账号
- 用户体验下降

**尝试方案A（失败）**：
CSS `max-height` 限制 - 原生 select 下拉列表样式由浏览器控制，CSS 无法生效。

**实施方案B（成功）**：
创建自定义下拉组件 `SenderDropdown.tsx` 替代原生 select：

**技术细节**：

1. 新增文件：`app/components/SenderDropdown.tsx`
   - useState 管理展开/收起状态
   - useEffect + useRef 实现点击外部关闭
   - maxHeight: 40vh，overflow-y: auto

2. 修改文件：`app/components/ComposeModal.tsx`
   - 导入 SenderDropdown 组件
   - 替换原生 select（第 78-90 行 → 第 78-83 行）

3. 样式文件：`app/globals.css`
   - 添加 `.sender-dropdown-trigger:hover` 样式
   - 添加 `.sender-dropdown-option:hover` 样式
   - 添加 `@keyframes dropdown-appear` 动画
   - 移动端最大高度：`min(40vh, 300px)`

**验证结果**：

- ✅ `npm run lint` 通过
- ✅ 移动端下拉框限制在屏幕内，可滚动
- ✅ 桌面端功能正常
- ✅ 动画效果平滑
- ✅ 用户反馈：样式很好看

**相关文件**：

- `app/components/SenderDropdown.tsx` (新增)
- `app/components/ComposeModal.tsx` (第 5, 78-83 行)
- `app/globals.css` (第 1582-1611 行)

**状态**：🟢 已修复 (2026-01-13 01:00)

---

### Bug #12: FAB 在 Compose Modal 上方显示（z-index 穿透）

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：
BottomTab（包含 FAB）仅在 `drawerOpen || showSettings` 时隐藏，但写邮件 modal (`compose === true`) 打开时，FAB (z-index: 101) 仍显示在 modal overlay (z-index: 100) 上方。

**影响范围**：

- 移动端写邮件时 FAB 视觉穿透
- 与 Bug #10 相同模式的问题

**解决方案**：
在 `page.tsx` 的 BottomTab 渲染条件中添加 `!compose` 检查：

```tsx
{isMobile && !drawerOpen && !showSettings && !compose && (
  <BottomTab ... />
)}
```

**验证结果**：

- ✅ `npm run lint` 通过
- ✅ 写邮件时 FAB 自动隐藏

**相关文件**：`app/page.tsx` (第 990 行)

**状态**：🟢 已修复 (2026-01-13 01:14)

---

### Bug #13: TopBar lastSyncedAt 类型不匹配

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：
`TopBar.tsx` 期望 `lastSyncedAt: Date | null`，但 `page.tsx` state 存储的是 `string | null`。

**解决方案**：
修改 TopBar props 类型接受 `string | null`：

```typescript
// Before
lastSyncedAt: Date | null;

// After
lastSyncedAt: string | null;
```

**验证结果**：

- ✅ `npm run lint` 通过
- ✅ TopBar 内部已使用 `new Date(lastSyncedAt)` 转换

**相关文件**：`app/components/TopBar.tsx` (第 13 行)

**状态**：🟢 已修复 (2026-01-13 01:18)

---

### Bug #14: SenderDropdown 缺少键盘无障碍支持

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：
自定义 SenderDropdown 组件缺少键盘和屏幕阅读器支持。

**解决方案**：
完整重构 SenderDropdown.tsx，添加：

1. ARIA 属性 (`aria-haspopup`, `aria-expanded`, `role`, `aria-selected`)
2. 键盘导航 (Enter/Space/Escape/Arrow keys)
3. 焦点管理和 scrollIntoView
4. CSS focus 样式

**验证结果**：

- ✅ `npm run lint` 通过
- ✅ 键盘导航完全可用

**相关文件**：

- `app/components/SenderDropdown.tsx` (重构)
- `app/globals.css` (第 1588-1596 行)

**状态**：🟢 已修复 (2026-01-13 01:28)

---

### Feature #15: 全局 Escape 键层级退出

**实现日期**：2026-01-13
**来源**：用户需求

**功能描述**：
按 Escape 键可以逐层关闭当前打开的界面，直到回到主页面。

**优先级顺序**：

1. 邮件详情 (selectedEmail)
2. 写邮件 (compose)
3. 设置 (showSettings)
4. 抽屉 (drawerOpen)

**相关文件**：`app/page.tsx` (第 171-191 行)

**状态**：🟢 已实现 (2026-01-13 01:42)

---

### Feature #16: 移除模态框背景渐变动画

**实现日期**：2026-01-13
**来源**：用户需求

**功能描述**：
写邮件和设置模态框的背景遮罩从渐变显示改为立即显示。

**相关文件**：

- `app/components/ComposeModal.tsx` (第 50 行)
- `app/components/SettingsModal.tsx` (第 59 行)

**状态**：🟢 已实现 (2026-01-13 01:42)

---

### Bug #17: Escape 键冲突修复

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：按 Escape 关闭 SenderDropdown 时会同时关闭 compose modal。

**解决方案**：在 SenderDropdown Escape 处理中添加 `event.stopPropagation()`。

**相关文件**：`app/components/SenderDropdown.tsx` (第 61 行)

**状态**：🟢 已修复 (2026-01-13 02:03)

---

### Bug #18: SenderDropdown ARIA 模式修复

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：ARIA 属性在 button 上无效，静态 ID 会重复。

**解决方案**：

1. 添加 `role="combobox"` 到 trigger button
2. 使用 `useId()` 生成唯一 ID

**相关文件**：`app/components/SenderDropdown.tsx` (第 3, 147, 157 行)

**状态**：🟢 已修复 (2026-01-13 02:03)

---

### Bug #19: 模态框退出动画修复

**发现日期**：2026-01-13
**来源**：GPT Code Review

**问题描述**：Feature #16 只移除了进入动画，退出动画仍在。

**解决方案**：设置 `exit={{ opacity: 1 }}` 和 `transition={{ duration: 0 }}`。

**相关文件**：

- `app/components/ComposeModal.tsx` (第 52-53 行)
- `app/components/SettingsModal.tsx` (第 61-62 行)

**状态**：🟢 已修复 (2026-01-13 02:03)

---

### Bug #20: ComposeModal 按钮缺少无障碍标签

**发现日期**：2026-01-13
**来源**：Code Review

**问题描述**：
在 Code Review 中发现，`ComposeModal` 组件的图标按钮缺少 `aria-label` 或 `title` 属性，导致屏幕阅读器无法识别按钮功能。

涉及按钮：

1. 移动端全屏模式下的"返回"按钮 (ArrowLeft)
2. 桌面端模态框右上角的"关闭"按钮 (X)

**影响范围**：

- 移动端和桌面端
- 辅助功能 (Accessibility) 体验受损

**解决方案**：
为相关按钮添加 `aria-label` 属性。

```tsx
// 移动端返回按钮
<button aria-label="返回">...</button>

// 桌面端关闭按钮
<button aria-label="关闭">...</button>
```

**相关文件**：`app/components/ComposeModal.tsx`

**状态**：🟢 已修复 (2026-01-13)

---

### Bug #21: 模态框关闭动画背景延迟

**发现日期**：2026-01-13
**来源**：用户反馈

**问题描述**：
用户反馈 "取消弹窗时候的动画太长了，弹窗都取消了，结果背景还没取消"。

**原因分析**：
当前模态框 Overlay 设置为 `exit={{ opacity: 1 }}`（不消失），需等待子元素（Modal Card）的 Spring 动画彻底结束才会 Unmount。Spring 动画往往有不可见的"长尾"（settling time），导致视觉上卡片已消失，但背景遮罩仍停留约 0.5-1秒。

**解决方案**：

1. **Overlay**: 添加淡出动画 `exit={{ opacity: 0 }}`，`duration: 0.2`。
2. **Modal Card**: 退出时强制使用短时间的 easeOut 动画，替代 Spring 动画。

**相关文件**：

- `app/components/ComposeModal.tsx`
- `app/components/SettingsModal.tsx`

**状态**：🟢 已修复 (2026-01-13)

---

## 📝 Bug 模板

复制以下模板记录新 Bug：

```markdown
## 🐛 Bug #[序号]: [简短标题]

### 问题描述

[详细描述问题现象，包括在哪个设备/断点出现]

### 截图/录屏

[如有截图，使用相对路径引用]

### 复现步骤

1. 访问 `http://localhost:3000`
2. 调整浏览器宽度至 `[xxx]px`
3. [具体操作]
4. [观察到的问题]

### 影响范围

- 设备：[ ] iPhone SE / [ ] iPhone 14 / [ ] Android / [ ] iPad / [ ] 桌面端
- 浏览器：[ ] Chrome / [ ] Safari / [ ] Firefox
- 断点：[ ] <768px / [ ] 768-1023px / [ ] ≥1024px

### 问题原因

[分析根本原因，包括代码位置]

### 解决方案

[详细描述解决方法]

\`\`\`css
/* 示例代码 */
\`\`\`

### 相关文件

- `app/globals.css` - [说明]
- `app/page.tsx` - [说明]

### 验证结果

- [ ] iPhone Safari 测试通过
- [ ] Android Chrome 测试通过
- [ ] 桌面端布局无影响

### 状态

🟢 已修复 / 🔴 待修复 / 🟡 进行中
```

---

## 🔗 相关文档

- [移动端 UI 适配实施计划](./Nexus%20Mail%20移动端%20UI%20适配实施计划.md)
- [移动端 UI 适配方案](./邮箱管理员后台%20-%20移动端%20UI%20适配方案.md)
- [通用 Bug 记录](./BUGS_AND_SOLUTIONS.md)
- [开发工作流](./WORKFLOW_MOBILE_DEV.md)
- [Code Review 工作流](./WORKFLOW_CODE_REVIEW.md)

---

*创建日期: 2026-01-12*
*最后更新: 2026-01-12 23:26*
