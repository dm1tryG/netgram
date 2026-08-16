"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  url: string;
  token: string | null;
  tools: { name: string; description: string }[];
};

function Snippet({ label, code }: { label: string; code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the snippet is selectable either way.
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-sm font-medium text-neutral-700">{label}</div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? t("connect.copied") : t("connect.copy")}
        </button>
      </div>
      <pre className="overflow-x-auto rounded border border-neutral-200 bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-800">
        {code}
      </pre>
    </div>
  );
}

export default function ConnectPanel({ url, token, tools }: Props) {
  const { t } = useI18n();

  const cli = [
    "claude mcp add --transport http netgram",
    url,
    ...(token ? [`--header "x-netgram-token: ${token}"`] : []),
  ].join(" \\\n  ");

  const json = JSON.stringify(
    {
      mcpServers: {
        netgram: {
          type: "http",
          url,
          ...(token ? { headers: { "x-netgram-token": token } } : {}),
        },
      },
    },
    null,
    2
  );

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("connect.title")}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t("connect.desc")}</p>

      <Snippet label={t("connect.cli")} code={cli} />
      <Snippet label={t("connect.json")} code={json} />

      {!token && (
        <p className="mb-6 rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {t("connect.noToken")}
        </p>
      )}

      <div className="rounded border border-neutral-200 p-4">
        <div className="mb-3 text-sm font-medium text-neutral-700">
          {t("connect.tools")}
        </div>
        <ul className="flex flex-col gap-2.5">
          {tools.map((tool) => (
            <li key={tool.name} className="text-xs">
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-800">
                {tool.name}
              </code>
              <div className="mt-1 text-neutral-500">{tool.description}</div>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
          {t("connect.safety")}
        </p>
      </div>
    </>
  );
}
