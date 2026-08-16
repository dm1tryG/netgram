// electron-builder afterPack hook. The Next standalone server goes into
// Resources/server via a plain recursive copy — extraResources silently
// filters out node_modules (npm-aware copying), which broke the bundled
// server ("Cannot find module 'next'"). Runs before signing, so everything
// copied here gets signed normally.
const path = require("node:path");
const fs = require("node:fs");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;
  const src = path.join(__dirname, "..", "server-dist");
  const app = `${context.packager.appInfo.productFilename}.app`;
  const dest = path.join(context.appOutDir, app, "Contents", "Resources", "server");
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  // sanity: the server must be able to require('next')
  if (!fs.existsSync(path.join(dest, "node_modules", "next", "package.json"))) {
    throw new Error("afterPack: node_modules/next missing in bundled server");
  }
};
