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

**开发环境**：暂时禁用 `basePath`

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: "standalone",
  // basePath: "/admin", // 开发时注释掉
};
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

## 📝 开发注意事项

### CSS 使用建议

1. **优先使用内联样式** - 避免全局 CSS 选择器与框架冲突
2. **避免使用 `::-webkit-scrollbar`** - 在 Next.js 16 + Tailwind 4 环境下会产生渲染问题
3. **使用 `scrollbar-width` 和 `scrollbar-color`** - 更安全的跨浏览器方案
4. **渲染外部 HTML 时使用 iframe** - 防止 CSS 泄漏

### 技术栈版本

- Next.js: 16.1.1
- React: 19.2.3
- Tailwind CSS: 4.x
- Node.js: 见 package.json

---

*最后更新: 2026-01-09*
