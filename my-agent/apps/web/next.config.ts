import type { NextConfig } from "next";
import { withEve } from "eve/next";
import { fileURLToPath } from "node:url";

// Project root: holds agent/ (the eve agent) and lib/ (code shared with it).
const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: { root: projectRoot },
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ["@upstash/redis", "@vercel/blob"],
  images: { unoptimized: true },
};

export default withEve(nextConfig, { eveRoot: projectRoot });
