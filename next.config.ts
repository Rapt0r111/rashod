import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Cache Components (PPR): static shells prerender; dynamic holes stream.
   * Live operational numbers stay outside `use cache` and use no-store APIs.
   */
  cacheComponents: true,
  allowedDevOrigins: [
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.2*.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "192.168.*.*",
    "localhost",
    "127.0.0.1",
  ],
  experimental: {
    proxyClientMaxBodySize: "256kb",
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
