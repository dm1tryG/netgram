import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for a small Docker runtime image.
  output: "standalone",
  // Keep non-server folders (and above all local state in data/) out of the
  // traced standalone bundle — it gets shipped inside the desktop app.
  outputFileTracingExcludes: {
    "*": ["desktop/**", "data/**", "mcp/**"],
  },
  // Type safety is enforced separately via `tsc --noEmit`; Next's in-build
  // type-check crashes against the pinned TS toolchain, so skip it here.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
