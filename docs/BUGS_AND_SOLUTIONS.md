# Nexus Mail Admin - Bug 记录与解决方案

> 本文档记录项目开发过程中遇到的 Bug 及其解决方案，供后续开发参考。

---

## 🐛 Bug #1: 页面出现神秘的斜线/虚线

### 问题描述

在 Next.js 16 + Tailwind CSS 4 环境下，页面上出现了多条斜向的虚线，覆盖在主内容区域上。这些线条在深色和浅色主题下都会出现。

### 截图

**问题出现时的界面：**

![斜线 Bug - 深色主题](../../.playwright-mcp/check_lines.png)

![斜线 Bug - 另一个角度](../../.playwright-mcp/scoped_scrollbar.png)

**修复后的界面：**

![修复后 - 干净界面](../../.playwright-mcp/inline_scrollbar.png)

### 问题原因

经过逐步排查，发现问题出在 `globals.css` 中的以下 CSS 选择器：

```css
/* 这些选择器会导致斜线出现 */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(128,128,128,0.3);
  border-radius: 4px;
}
```

具体原因推测：

1. Next.js 16 的 Turbopack 与 `::-webkit-scrollbar` 伪元素存在渲染冲突
2. Tailwind CSS 4 的 PostCSS 插件 (`@tailwindcss/postcss`) 处理这些选择器时产生了异常
3. 可能是 GPU 渲染层级的问题

### 解决方案

**方案 A（推荐）：使用标准 CSS 滚动条属性**

在需要自定义滚动条的元素上使用内联样式：

```tsx
<div style={{ 
  overflowY: 'auto', 
  scrollbarWidth: 'thin',  // Firefox 和现代浏览器
  scrollbarColor: 'rgba(128,128,128,0.4) transparent' 
}}>
  {/* 内容 */}
</div>
```

**方案 B：完全不使用自定义滚动条**

保持浏览器默认滚动条样式，删除所有 `::-webkit-scrollbar` 相关代码。

**方案 C：降级 Next.js 或 Tailwind 版本**

如果必须使用 `::-webkit-scrollbar`，可以考虑降级到 Next.js 15 或 Tailwind CSS 3。

### 最终采用方案

采用 **方案 A**，在 `page.tsx` 中对滚动区域使用内联样式设置 `scrollbarWidth: 'thin'` 和 `scrollbarColor`。

### 相关文件

- `app/globals.css` - 保持最小化，只包含动画定义
- `app/layout.tsx` - 不使用全局滚动条样式
- `app/page.tsx` - 在滚动容器上使用内联样式

---

## 🐛 Bug #2: API 请求 404 错误 (basePath 问题)

### 问题描述

设置 `basePath: "/admin"` 后，本地开发时 API 请求（如 `/api/accounts`）返回 404。

### 问题原因

`basePath` 设置会影响所有路由，包括 API 路由。在本地开发时，API 实际路径变成了 `/admin/api/accounts`，但前端代码仍在请求 `/api/accounts`。

### 解决方案

**开发环境（推荐）**：开发模式默认不启用 `basePath`（避免 `/api/*` 404），无需手动注释。

```ts
// next.config.ts（关键逻辑）
const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_BASE_PATH || (isProd ? "/admin" : undefined);
```

**生产环境**：确保 Nginx 正确代理

```nginx
location /admin {
    proxy_pass http://admin-dashboard:3000;
    # ...
}
```

---

## 🐛 Bug #3: Next.js DevTools 浮层遮挡界面

### 问题描述

开发模式下，右下角出现 "N" 按钮（Next.js DevTools），有时会干扰 UI。

### 截图

![DevTools 按钮](../../.playwright-mcp/new_ui.png)

*(右下角可见 "N" 按钮)*

### 解决方案

在 `next.config.ts` 中禁用：

```ts
const nextConfig: NextConfig = {
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};
```

---

## 🐛 Bug #4: 邮件内容 CSS 泄漏导致页面布局抖动

### 问题描述

在邮件详情面板中使用 `dangerouslySetInnerHTML` 渲染邮件 HTML 内容时，切换不同邮件会导致整个页面的字体大小和间距发生变化。

### 截图

切换邮件前后，侧边栏和邮件列表的字体/间距会改变。

### 问题原因

HTML 邮件通常包含内嵌的 `<style>` 标签，例如：

```html
<style>
  body { font-size: 11px; }
  * { margin: 0; }
</style>
```

使用 `dangerouslySetInnerHTML` 直接渲染这些内容时，邮件中的 CSS 规则会**泄漏到父页面**，影响整个应用的样式。

### 错误代码

```tsx
// ❌ 错误：CSS 会泄漏到父页面
<div dangerouslySetInnerHTML={{ __html: selectedEmail.content }} />
```

### 解决方案

使用 `<iframe>` 进行 CSS 隔离，并通过 `onLoad` 事件自动调整高度以实现统一滚动：

```tsx
// ✅ 正确：使用 iframe 隔离 CSS
<iframe
  srcDoc={`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          html, body { margin: 0; padding: 0; overflow: hidden; }
          body { padding: 16px; font-size: 14px; }
          /* 其他基础样式... */
        </style>
      </head>
      <body>${emailContent}</body>
    </html>
  `}
  style={{ width: '100%', border: 'none', minHeight: 200 }}
  onLoad={(e) => {
    const iframe = e.target as HTMLIFrameElement;
    if (iframe.contentDocument) {
      const height = iframe.contentDocument.body.scrollHeight;
      iframe.style.height = height + 'px';
    }
  }}
  sandbox="allow-same-origin"
/>
```

### 关键点

1. **CSS 隔离**：iframe 内的样式不会影响父页面
2. **自动高度**：`onLoad` 时读取内容高度并设置 iframe 高度
3. **统一滚动**：iframe 内部 `overflow: hidden`，父容器负责滚动
4. **安全沙箱**：`sandbox="allow-same-origin"` 限制脚本执行

### 相关文件

- `app/page.tsx` - 邮件详情面板渲染逻辑

---

## 🐛 Bug #5: Settings Modal 内容无法滚动

### 问题描述

Settings Modal 内容过多时（如标签管理列表较长），底部内容被截断，无法滚动查看。

### 问题原因

Modal card 的样式设置了 `overflow: 'hidden'`，但内容容器没有设置 `overflow-y: auto` 和合适的高度限制。

### 解决方案

修改 `page.tsx` 中 Settings Modal 的结构，添加 `maxHeight: '85vh'`、`display: 'flex'`、`flexDirection: 'column'`，内容区域添加 `overflowY: 'auto'`、`flex: 1`。

### 相关文件

- `app/page.tsx` - Settings Modal 结构 (约 line 716-721)

---

## 🐛 Bug #6: Settings Modal 关闭时闪烁

### 问题描述

关闭 Settings Modal 时，界面会"闪一下"才完全关闭，动画不流畅。

### 问题原因

`globals.css` 中的 CSS `animation: overlayIn` 和 `animation: modalIn` 与 Framer Motion 的 `exit` 动画产生冲突。此外存在重复的 modal 样式定义。

### 解决方案

1. 移除 `.modal-overlay` 和 `.modal-card` 的 CSS animation 属性
2. 删除重复的样式定义，只保留一组 modal 样式

### 相关文件

- `app/globals.css` - Modal 样式 (line 255-300)

---

## 🐛 Bug #7: 发送失败时邮件状态卡在 PENDING (发件箱残留)

### 问题描述

发送邮件失败（例如发件人账号被删除、网络错误、SMTP 认证失败）时，发件箱（SENT 文件夹）中会留下一封状态为的邮件，且永远无法发送成功或消失。

### 原因分析

`/api/send` 接口采用"先写库后发送"的策略：

1. 先在数据库 `Email` 表插入一条记录，`folder='SENT'`, `localStatus='PENDING'`。
2. 然后尝试 `transporter.sendMail(...)`。
3. 如果发送成功，将 `localStatus` 更新为 `NORMAL`。

**Bug 点**：代码没有正确处理 `catch` 块中的状态回滚。当 `sendMail` 抛出异常时，直接返回了 500 错误，而数据库中那条 `PENDING` 的记录没有被标记为失败或删除，导致前端一直显示它在发件箱中。

### 解决方案

在 `catch` 块中捕获错误后，尝试更新该邮件记录的状态为 `FAILED`。

```typescript
} catch (error) {
    console.error('Send Error:', error);
    
    // Update status to FAILED if record exists
    if (accountId && providerKey) {
        try {
            await prisma.email.update({
                where: { accountId_providerKey: { accountId, providerKey } },
                data: { localStatus: 'FAILED' }
            });
        } catch (ignore) {}
    }
    
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
}
```

### 修复后的行为

前端在收到 500 错误且数据库状态更新后，会提示错误信息，用户可以看到发送失败的状态（需前端配合显示 `FAILED` 状态或允许重发，目前暂时保留编辑状态并报错）。

### 相关文件

- `app/api/send/route.ts`

---

## 📝 开发注意事项

### CSS 使用建议

1. **优先使用内联样式** - 避免全局 CSS 选择器与框架冲突
2. **避免使用 `::-webkit-scrollbar`** - 在 Next.js 16 + Tailwind 4 环境下会产生渲染问题
3. **使用 `scrollbar-width` 和 `scrollbar-color`** - 更安全的跨浏览器方案
4. **渲染外部 HTML 时使用 iframe** - 防止 CSS 泄漏
5. **避免 CSS animation 与 Framer Motion 冲突** - 使用 JS 动画库时，不要在同一元素上同时使用 CSS animation

### 技术栈版本

- Next.js: 16.1.1
- React: 19.2.3
- Tailwind CSS: 4.x
- Node.js: 见 package.json

---

*最后更新: 2026-01-11*

---

## 🐛 Bug #8: 草稿无法恢复编辑 (Draft Resume Failure)

### 问题描述

点击“草稿箱”中的邮件时，系统错误地尝试打开详情预览页（往往加载失败或显示空白），而不是弹出“写邮件”模态框让用户继续编辑。且控制台报错或无反应。

### 问题原因

1. **逻辑顺序错误**：`selectEmail` 函数中，`setSelectedEmail`（打开详情页逻辑）在检查是否为草稿之前就执行了。
2. **拼写错误**：在草稿检查逻辑中，调用了不存在的 `setComposeOpen(true)`，正确的方法名应该是 `setCompose(true)`。

```tsx
// ❌ 错误代码
async function selectEmail(email: Email) {
  setSelectedEmail(email); // 抢跑：先打开了详情页
  if (activeFolder === 'drafts') {
     // ...
     setComposeOpen(true); // 报错：setComposeOpen is not defined
  }
}
```

### 解决方案

1. 将 `setSelectedEmail(email)` 移至草稿检查逻辑之后。
2. 修正状态 Setting 方法名为 `setCompose(true)`。

### 相关文件

- `app/page.tsx`

---

## 🐛 Bug #9: 发送失败报错 ReferenceError (500 Internal Server Error)

### 问题描述

当发送邮件失败（如 SMTP 错误）时，API 返回 500 错误，且服务端控制台打印 `ReferenceError: accountId is not defined`，导致原本预期的“更新邮件状态为 FAILED”逻辑失效，甚至导致服务端崩溃。

### 问题原因

变量作用域问题。`accountId` 和 `providerKey` 是在 `try` 块内部定义的，但在 `catch` 块中尝试访问它们以更新数据库状态。

```typescript
// ❌ 错误代码
export async function POST(req) {
  try {
    const { accountId } = await req.json(); // 作用域仅限于 try 块
    // ...
  } catch (e) {
    if (accountId) { ... } // 报错：accountId undefined
  }
}
```

### 解决方案

将 `accountId` 和 `providerKey` 的声明提升到 `try/catch` 外部。

```typescript
// ✅ 修复代码
export async function POST(req) {
  let accountId, providerKey; // 提升作用域
  try {
     const body = await req.json();
     accountId = body.accountId;
     // ...
  } catch (e) {
     if (accountId) { ... } // 正常访问
  }
}
```

### 相关文件

- `app/api/send/route.ts`

---

## 🐛 Bug #10: 草稿自动保存/发送后列表不刷新

### 问题描述

1. 在草稿箱页面撰写邮件时，自动保存触发后，列表中的草稿预览（如主题、时间）没有更新。
2. 发送邮件成功后，虽然“写邮件”窗口关闭了，但草稿箱列表中该草稿依然存在（实际上已被删除），点击会报错或没反应，需要手动刷新页面。

### 问题原因

前端在执行 Auto-save 和 Send 成功的回调逻辑中，漏掉了重新拉取邮件列表（`loadEmails`）的操作。

### 解决方案

1. **Auto-save**: 在 `saveDraft` 成功后，如果当前是在 `drafts` 视图，调用 `loadEmails()`。
2. **Send**: 在发送成功并 `DELETE` 草稿后，调用 `loadEmails()`。

### 相关文件

- `app/page.tsx`
