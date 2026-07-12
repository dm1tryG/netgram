"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

type Draft = {
  id: string;
  kind: "message" | "click";
  chatId: string;
  createdAt: number;
  status: "pending" | "sent";
  text?: string;
  messageId?: number;
  buttonText?: string;
  sentMessageId?: number;
  clickResult?: string;
};

type Chat = { id: string; title: string; kind: string };

export default function DraftList() {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/drafts")
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(true);
        else setDrafts(data.drafts);
      })
      .catch(() => setError(true));

    fetch("/api/chats")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.chats)) {
          const map: Record<string, string> = {};
          for (const c of data.chats as Chat[]) map[c.id] = c.title;
          setTitles(map);
        }
      })
      .catch(() => {});
  }, []);

  function withBusy(id: string, on: boolean) {
    setBusy((b) => {
      const copy = new Set(b);
      if (on) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  async function approve(id: string) {
    withBusy(id, true);
    setNotice((n) => ({ ...n, [id]: "" }));
    const res = await fetch(`/api/drafts/${id}/send`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    withBusy(id, false);
    if (!res.ok) {
      setNotice((n) => ({ ...n, [id]: t(`err.${data.error ?? "default"}`) }));
      return;
    }
    setConfirmId(null);
    setDrafts((ds) => (ds ? ds.map((d) => (d.id === id ? data.draft : d)) : ds));
  }

  async function discard(id: string) {
    withBusy(id, true);
    const res = await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    withBusy(id, false);
    if (res.ok) {
      setDrafts((ds) => (ds ? ds.filter((d) => d.id !== id) : ds));
    }
  }

  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">{t("drafts.title")}</h1>
      <p className="mb-6 text-sm text-neutral-500">{t("drafts.desc")}</p>

      {error ? (
        <p className="text-red-600">{t("drafts.error")}</p>
      ) : !drafts ? (
        <p className="text-neutral-500">{t("drafts.loading")}</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          {t("drafts.empty.pre")} <code>netgram draft</code> {t("drafts.empty.or")}{" "}
          <code>netgram click</code>.
        </p>
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => {
            const title = titles[d.chatId] ?? d.chatId;
            const isBusy = busy.has(d.id);
            const sent = d.status === "sent";
            const isClick = d.kind === "click";
            return (
              <li key={d.id} className="rounded border border-neutral-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{title}</div>
                    <div className="text-xs text-neutral-400">
                      {isClick
                        ? `${t("draft.kind.click")}${d.messageId}`
                        : t("draft.kind.message")}{" "}
                      · {d.chatId}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      sent
                        ? "bg-green-100 text-green-700"
                        : isClick
                          ? "bg-violet-100 text-violet-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {sent
                      ? t("draft.badge.done")
                      : isClick
                        ? t("draft.badge.click")
                        : t("draft.badge.draft")}
                  </span>
                </div>

                {isClick ? (
                  <p className="text-sm text-neutral-800">
                    {t("draft.pressButton")}{" "}
                    <span className="inline-block rounded border border-neutral-300 bg-neutral-50 px-2 py-0.5 font-medium">
                      {d.buttonText}
                    </span>
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap text-sm text-neutral-800">
                    {d.text}
                  </p>
                )}

                {sent && d.clickResult ? (
                  <p className="mt-2 text-xs text-green-700">
                    {t("draft.botAnswer")} {d.clickResult}
                  </p>
                ) : null}

                {notice[d.id] && (
                  <p className="mt-2 text-xs text-red-600">{notice[d.id]}</p>
                )}

                {!sent &&
                  (confirmId === d.id ? (
                    // Two-step confirm. The prominent button is Cancel on purpose:
                    // an errant single click (human or automation) cancels rather
                    // than firing an irreversible Telegram action.
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-neutral-700">
                        {isClick
                          ? t("draft.confirm.click")
                          : t("draft.confirm.send")}{" "}
                        {t("draft.confirm.irreversible")}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={isBusy}
                          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {t("btn.cancel")}
                        </button>
                        <button
                          onClick={() => approve(d.id)}
                          disabled={isBusy}
                          className="rounded px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                        >
                          {isBusy
                            ? isClick
                              ? t("btn.clicking")
                              : t("btn.sending")
                            : t("btn.confirm")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setConfirmId(d.id)}
                        disabled={isBusy}
                        className="rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {isClick ? t("btn.press") : t("btn.send")}
                      </button>
                      <button
                        onClick={() => discard(d.id)}
                        disabled={isBusy}
                        className="rounded px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
                      >
                        {t("btn.delete")}
                      </button>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
