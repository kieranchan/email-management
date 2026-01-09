import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/admin",
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
