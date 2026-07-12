import path from "node:path";

// All mutable state (Telegram session, allowlist, drafts) lives under one dir
// so a single Docker volume persists everything. Defaults to ./data locally;
// the container sets NETGRAM_DATA_DIR=/data.
export const DATA_DIR =
  process.env.NETGRAM_DATA_DIR || path.join(process.cwd(), "data");
