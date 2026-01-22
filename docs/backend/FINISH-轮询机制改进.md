# 轮询机制改进方案

> **文档版本**：v2.2  
> **更新时间**：2026-01-22  
> **状态**：方案 B（纯推送）已完成 P0 修复 + P1.1/P1.2；保留可选 HTTP 回退与后续优化

---

## 背景

原实现同时存在 IMAP IDLE 推送 + 前端 30s 轮询 + Worker 1 分钟 fallback，导致资源浪费且与 IMAP IDLE 设计相悖。主流客户端（Gmail/Outlook/Roundcube）在有推送时不做前端轮询。

已实施方案 B：完全依赖 IMAP IDLE + WebSocket 推送，前端轮询移除，fallback 兜底。

---

## 已完成修复

### P0（必须）
1) **flags/folder 变更无感知**  
   - `worker/imap-worker.ts`：`manualSync()` 对 INBOX 做 flags 对账；新增通用 `reconcileFlagsForFolder()`，`syncFolder()` 也会对各文件夹（Sent/Archive 等）近期邮件做 flags 对账，覆盖所有文件夹。

2) **单文件夹监听（只 INBOX）**  
   - 新增 `syncOtherFolders()/syncFolder()`，fallback 同步 Sent/Archive（含常见 Gmail 路径），写入 `folder/archived` 并广播；同步使用 folder-aware providerKey。

3) **WS 重连后未自动补刷**  
   - `app/page.tsx`：`socket.onopen` 立即 `loadEmails()`，离线恢复无需等推送。

4) **跨文件夹 providerKey 冲突**  
   - providerKey 统一包含 folder：`<FOLDER>:uid:<uid>`，避免 INBOX/SENT 等文件夹 UID 相同导致覆盖。

5) **同步过频（Sent/Archive）**  
   - `syncOtherFolders()` 增加 2 分钟节流，避免 30s fallback 周期内重复同步。

### P1（应该）
4) **浏览器后台/睡眠恢复**  
   - 监听 `visibilitychange`/`online`，回到前台或联网后自动刷新；增加 400ms 防抖避免快速切换触发多次。

5) **WS 断开降级体验**  
   - fallback 参数缩短为 30s 周期、1min stale 阈值，提升断线降级时效（HTTP 回退未做，见未完事项）。

---

## 待办/未完事项
- [ ] 可选：HTTP API 回退（手动刷新降级通道）  
- [ ] 可选：智能调整 fallback 频率/多文件夹独立 IDLE（视负载再做）
- [ ] 代码健康：如有新增改动需保持 lint 通过；当前 ESLint 已清理。

---

## 当前配置速览
- 前端：无轮询；WS 重连即刷新；前台/联网事件刷新（400ms 防抖）。
- Worker：fallback 30s 周期；stale 阈值 1min；全文件夹 flags 对账（INBOX + 其他文件夹）；Sent/Archive fallback 拉取（2 分钟节流）；providerKey 含 folder。

---

## 验证要点（建议回归）
- 多客户端标记已读/星标/归档后，1 分钟内状态是否对齐。
- Sent/Archive 新邮件或移动邮件能否出现在列表。
- WS 断开/浏览器离线再上线，页面能否自动刷新。
- 观察 fallback 30s 周期的资源占用，必要时再做“智能延长”。

---

## 实施记录
- 2026-01-22：方案 B 落地；完成 P0 全部、P1.1/P1.2；fallback 参数调整。
