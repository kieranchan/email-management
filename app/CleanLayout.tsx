"use client";

import { useEffect } from "react";

export default function CleanLayout({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        // 1. 立即尝试移除
        const removeOverlay = () => {
            const selectors = [
                'nextjs-portal',
                '#__next-build-watcher',
                '#nextjs-dev-tools-overlay',
                'div[data-nextjs-dialog-overlay]',
                'div[data-nextjs-toast-wrapper]'
            ];

            selectors.forEach(sel => {
                document.querySelectorAll(sel).forEach(el => el.remove());
            });

            // 同时也尝试通过 ID 查找
            const element = document.getElementById('__next-build-watcher');
            if (element) element.remove();
        };

        removeOverlay();

        // 2. 使用 MutationObserver 监听 DOM 变化，防止被重新添加
        const observer = new MutationObserver((mutations) => {
            removeOverlay();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 3. 定时器作为后备
        const interval = setInterval(removeOverlay, 500);

        return () => {
            observer.disconnect();
            clearInterval(interval);
        };
    }, []);

    return <>{children}</>;
}
