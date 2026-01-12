import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Mail Admin",
  description: "Unified Email Management Console",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0D12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" data-theme="dark" suppressHydrationWarning>
      <head>
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
