import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // proxy.ts runs on every request, so Next buffers each body and silently truncates it at this
    // limit (default 10MB). A photo at the 10MB upload cap plus multipart overhead would arrive
    // corrupt, so leave headroom above MAX_PHOTO_BYTES (src/lib/photo-limits.ts) and the early 413 check in the complete route.
    proxyClientMaxBodySize: "12mb",
  },
};

export default nextConfig;
