import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_BASE_PATH || (isProd ? "/admin" : undefined);

const nextConfig: NextConfig = {
  output: "standalone",
  ...(basePath ? { basePath } : {}),
  trailingSlash: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  // 正确的配置方式
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
};

export default nextConfig;
