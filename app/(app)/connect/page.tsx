import ConnectPanel from "./ConnectPanel";
import { TOOLS } from "@/lib/tools";

// Must render per request: the desktop app picks the port and token at launch,
// so a prerendered page would ship whatever was set at build time (nothing).
export const dynamic = "force-dynamic";

export default function ConnectPage() {
  // Read on the server: the token is an env var of the running instance, and
  // the desktop app picks the port at launch, so both are only known here.
  const port = process.env.PORT || "3000";
  const token = process.env.NETGRAM_AUTH_TOKEN || null;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <ConnectPanel
        url={`http://127.0.0.1:${port}/api/mcp`}
        token={token}
        tools={TOOLS.map((tool) => ({
          name: tool.name,
          description: tool.description,
        }))}
      />
    </div>
  );
}
