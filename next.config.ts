import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small Docker runtime image.
  output: "standalone",
  // Type safety is enforced separately via `tsc --noEmit`; Next's in-build
  // type-check crashes against the pinned TS toolchain, so skip it here.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
