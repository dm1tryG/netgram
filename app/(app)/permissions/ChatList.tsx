"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Chat = {
  id: string;
  title: string;
  kind: "user" | "bot" | "group" | "channel";
  read: boolean;
  write: boolean;
  full: boolean;
};

type Level = "off" | "read" | "write" | "full";

const KIND_LABEL: Record<Chat["kind"], string> = {
  user: "user",
  bot: "🤖 bot",
  group: "group",
  channel: "channel",
};

function levelOf(c: Chat): Level {
  if (c.full) return "full";
  if (c.write) return "write";
  if (c.read) return "read";
  return "off";
}

export default function ChatList() {
  const { t } = useI18n();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | Chat["kind"]>("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setChats(data.chats);
      })
      .catch(() => setError("load_error"));
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/chats?refresh=1");
      const data = await res.json();
      if (!data.error) setChats(data.chats);
    } catch {
      // keep the current list on a failed refresh
    } finally {
      setRefreshing(false);
    }
  }

  async function setLevel(id: string, level: Level) {
    setPending((p) => new Set(p).add(id));
    const prev = chats;
    setChats((cs) =>
      cs
        ? cs.map((c) =>
            c.id === id
              ? {
                  ...c,
                  read: level !== "off",
                  write: level === "write" || level === "full",
                  full: level === "full",
                }
              : c
          )
        : cs
    );
    const res = await fetch(`/api/chats/${id}/allow`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level }),
    });
    setPending((p) => {
      const copy = new Set(p);
      copy.delete(id);
      return copy;
    });
    if (!res.ok) {
      setChats(prev);
    }
  }

  const filtered = useMemo(() => {
    if (!chats) return null;
    const q = query.trim().toLowerCase();
    return chats.filter(
      (c) =>
        (kindFilter === "all" || c.kind === kindFilter) &&
        (!q || c.title.toLowerCase().includes(q))
    );
  }, [chats, query, kindFilter]);

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("permissions.title")}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t("permissions.desc")}</p>

      {error ? (
        <p className="text-red-600">{t("permissions.error")}</p>
      ) : !chats ? (
        <p className="text-neutral-500">{t("permissions.loading")}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("permissions.search")}
              className="w-full rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-neutral-400 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            />
            <select
              value={kindFilter}
              onChange={(e) =>
                setKindFilter(e.target.value as "all" | Chat["kind"])
              }
              className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            >
              <option value="all">{t("filter.all")}</option>
              <option value="user">{t("filter.user")}</option>
              <option value="bot">{t("filter.bot")}</option>
              <option value="group">{t("filter.group")}</option>
              <option value="channel">{t("filter.channel")}</option>
            </select>
            <button
              onClick={refresh}
              disabled={refreshing}
              className="shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-50"
            >
              {refreshing ? t("permissions.refreshing") : t("permissions.refresh")}
            </button>
          </div>
          <ul className="divide-y divide-neutral-200 rounded border border-neutral-200">
            {filtered!.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="text-xs text-neutral-500">
                    {KIND_LABEL[c.kind]} · {c.id}
                  </div>
                </div>
                <LevelSelector
                  level={levelOf(c)}
                  disabled={pending.has(c.id)}
                  onChange={(level) => setLevel(c.id, level)}
                />
              </li>
            ))}
            {filtered!.length === 0 && (
              <li className="px-4 py-3 text-sm text-neutral-500">
                {t("permissions.empty")}
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}

const SEGMENTS: {
  level: Exclude<Level, "off">;
  labelKey: string;
  tipKey: string;
  activeClass: string;
}[] = [
  {
    level: "read",
    labelKey: "level.read",
    tipKey: "level.read.tip",
    activeClass: "bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-sm",
  },
  {
    level: "write",
    labelKey: "level.write",
    tipKey: "level.write.tip",
    activeClass:
      "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm",
  },
  {
    level: "full",
    labelKey: "level.full",
    tipKey: "level.full.tip",
    activeClass: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-sm",
  },
];

function LevelSelector({
  level,
  disabled,
  onChange,
}: {
  level: Level;
  disabled: boolean;
  onChange: (level: Level) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex shrink-0 gap-0.5 rounded-full border border-neutral-200 bg-neutral-100 p-0.5 text-xs font-medium">
      {SEGMENTS.map((s) => {
        const active = level === s.level;
        return (
          <div key={s.level} className="group relative">
            <button
              onClick={() => onChange(active ? "off" : s.level)}
              disabled={disabled}
              className={`rounded-full px-3 py-1 transition-shadow ${
                active ? s.activeClass : "text-neutral-500 hover:text-neutral-800"
              } disabled:opacity-50`}
            >
              {t(s.labelKey)}
            </button>
            <div className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 hidden w-60 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg group-hover:block">
              {t(s.tipKey)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
