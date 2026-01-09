import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Mail Admin",
  description: "Unified Email Management Console",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{
          __html: `
          :root {
            /* === Foundations: Design Tokens === */
            --font-ui: system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif;

            /* Motion */
            --dur-fast: 120ms;
            --dur-base: 150ms;
            --dur-modal: 180ms;
            --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);

            /* Radius & Spacing */
            --r-sm: 12px;
            --r-md: 16px;
            --r-lg: 22px;
            --s-1: 8px;
            --s-2: 12px;
            --s-3: 16px;
            --s-4: 24px;
          }

          /* Dark Theme (Nexus S2 Delivery Spec) */
          [data-theme='dark'] {
            color-scheme: dark; /* Helper for native inputs/scrollbars */
            /* Backgrounds */
            --bg-0: #0B0D12;
            --bg-1: #0F1220;
            --bg-2: #14182A;

            /* Surfaces (Glass Tint) */
            --surface-1: rgba(255, 255, 255, 0.06);  /* panels */
            --surface-2: rgba(255, 255, 255, 0.09);  /* hover/selected */
            --surface-3: rgba(255, 255, 255, 0.12);  /* modal/focused */

            /* Strokes */
            --stroke-1: rgba(255, 255, 255, 0.10);
            --stroke-2: rgba(255, 255, 255, 0.16);
            --divider:  rgba(255, 255, 255, 0.06);

            /* Text */
            --text-1: rgba(255, 255, 255, 0.92); /* titles */
            --text-2: rgba(255, 255, 255, 0.72); /* body */
            --text-3: rgba(255, 255, 255, 0.52); /* meta */
            --text-4: rgba(255, 255, 255, 0.38); /* placeholder */

            /* Elevation Shadows */
            --elev-1: 0 10px 40px rgba(0,0,0,0.35);
            --elev-2: 0 14px 55px rgba(0,0,0,0.45);
            --elev-3: 0 22px 85px rgba(0,0,0,0.55);

            /* Glass Insets */
            --glass-inset-top: 0 1px 0 rgba(255,255,255,0.06) inset;
            --glass-inset-bottom: 0 -1px 0 rgba(0,0,0,0.25) inset;
          }

          /* Light Theme (Placeholder / Auto-generated) */
          [data-theme='light'] {
            --bg-0: #f8f9fa;
            --bg-1: #ffffff;
            --bg-2: #e9ecef;
            --surface-1: rgba(0, 0, 0, 0.03); 
            --surface-2: #ffffff;
            --surface-3: #f1f3f5;
            --stroke-1: #e9ecef;
            --stroke-2: #dee2e6;
            --text-1: #212529;
            --text-2: #868e96;
            --text-3: #adb5bd;
            /* Light theme specialized shadows would go here */
            --elev-1: 0 2px 5px rgba(0,0,0,0.05);
            --elev-2: 0 4px 10px rgba(0,0,0,0.1);
            --elev-3: 0 8px 20px rgba(0,0,0,0.15);
            --glass-inset-top: 0 1px 0 rgba(255,255,255,0.5) inset;
            --glass-inset-bottom: 0 -1px 0 rgba(0,0,0,0.05) inset;
          }

          /* Base Reset */
          *, *::before, *::after { box-sizing: border-box; }
          
          html, body { 
            height: 100%; 
            width: 100%; 
            overflow: hidden; 
            margin: 0; 
            padding: 0;
            background-color: var(--bg-0);
            color: var(--text-2); /* Spec: body should use text-2 */
            font-family: var(--font-ui);
            transition: background-color 0.3s, color 0.3s;
          }

          /* Atmosphere Background (Exactly as Spec) */
          [data-theme='dark'] body {
            background:
              radial-gradient(900px 600px at 72% 18%, rgba(139,92,246,0.18), transparent 60%),
              radial-gradient(820px 560px at 20% 84%, rgba(96,165,250,0.12), transparent 55%),
              linear-gradient(160deg, var(--bg-0), var(--bg-1));
          }

          /* Noise texture */
          [data-theme='dark'] body::after {
            content: '';
            position: fixed;
            inset: 0;
            z-index: -1;
            opacity: 0.06;
            pointer-events: none;
            /* Simple noise SVG data URI */
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
          }

          @keyframes spin { to { transform: rotate(360deg); } }
          .animate-spin { animation: spin 1s linear infinite; }

          /* App Shell & Glass Components */
          .app-shell { display: flex; height: 100vh; width: 100vw; }
          
          /* Glass Helper Class */
          .glass-panel { 
            background: var(--surface-1); 
            backdrop-filter: blur(16px) saturate(120%); 
            -webkit-backdrop-filter: blur(16px) saturate(120%); 
            border-right: 1px solid var(--stroke-1); 
            box-shadow: var(--elev-1), var(--glass-inset-top), var(--glass-inset-bottom);
          }
          
          .glass-button { 
            background: var(--surface-1); 
            border: 1px solid var(--stroke-1); 
            color: var(--text-1); 
            border-radius: 999px;
            transition: transform var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
            box-shadow: var(--elev-1), var(--glass-inset-top), var(--glass-inset-bottom);
            backdrop-filter: blur(16px) saturate(120%);
          }
          
          .glass-button:hover { 
            transform: translateY(-1px);
            border-color: var(--stroke-2);
          }
          
          .accent-button { 
            background: linear-gradient(135deg, rgba(139,92,246,0.95), rgba(96,165,250,0.85)); 
            color: rgba(255,255,255,0.92); 
            border: 1px solid rgba(255,255,255,0.14);
            border-radius: 999px;
            /* Reduced glow per user feedback: 28px -> 15px, opacity reduced */
            box-shadow: 0 12px 35px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 15px rgba(139,92,246,0.3);
            opacity: 1; 
            transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
          }
          
          .accent-button:hover { 
            transform: translateY(-1px); 
            /* Reduced hover glow again: tighter shadow to feel less "floating" */
            box-shadow: 0 8px 25px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 15px rgba(139,92,246,0.4); 
          }
          
          .list-item { transition: all 0.1s; border-radius: var(--r-md); border: 1px solid transparent; }
          
          /* Hover: translateY(-1px) + elev-2 + stroke-2 + surface-2 */
          .list-item:hover { 
            transform: translateY(-1px);
            background: var(--surface-2); 
            border-color: var(--stroke-2);
            box-shadow: var(--elev-2), var(--glass-inset-top), var(--glass-inset-bottom);
          }
          
          .list-item.selected { 
            background: var(--surface-2); 
            border-color: var(--stroke-2);
            /* Soft glow for selected */
            box-shadow: 0 0 15px rgba(139,92,246,0.15), inset 0 0 0 1px var(--stroke-2);
          }

          /* Unread Bar */
          .unread-indicator {
            width: 2px;
            height: 100%;
            border-radius: 999px;
            background: linear-gradient(180deg, #8B5CF6, #60A5FA);
            box-shadow: 0 0 14px rgba(139,92,246,0.45);
          }
        `}} />
        <script dangerouslySetInnerHTML={{
          __html: `
          (function() {
            try {
              var saved = localStorage.getItem('theme-mode');
              var theme = saved === 'light' ? 'light' : 'dark';
              document.documentElement.setAttribute('data-theme', theme);
              
              var accent = localStorage.getItem('theme-accent');
              if (accent) document.documentElement.style.setProperty('--accent', accent);
              else document.documentElement.style.setProperty('--accent', 'rgba(139,92,246,0.45)'); // Default glow color
            } catch (e) {}
          })()
        `}} />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
