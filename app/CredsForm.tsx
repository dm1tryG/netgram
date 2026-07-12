"use client";

import { useState } from "react";

export default function CredsForm({ onSaved }: { onSaved: () => void }) {
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiId, apiHash, phone }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(errorText(data.error));
      return;
    }
    onSaved();
  }

  return (
    <div className="w-full max-w-md space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">NetGram — настройка</h1>
        <p className="text-sm text-neutral-500">
          NetGram работает с твоим собственным Telegram-приложением. Это
          одноразовый шаг — данные сохранятся локально.
        </p>
      </div>

      <ol className="space-y-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700">
        <li>
          1. Открой{" "}
          <a
            href="https://my.telegram.org/apps"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-600 underline"
          >
            my.telegram.org/apps
          </a>{" "}
          и войди.
        </li>
        <li>2. Create application (любые название/платформа).</li>
        <li>
          3. Скопируй оттуда <b>App api_id</b> и <b>App api_hash</b> → вставь
          ниже.
        </li>
      </ol>

      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-neutral-500">api_id</span>
          <input
            inputMode="numeric"
            value={apiId}
            onChange={(e) => setApiId(e.target.value)}
            placeholder="12345678"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-neutral-500">api_hash</span>
          <input
            value={apiHash}
            onChange={(e) => setApiHash(e.target.value)}
            placeholder="0123456789abcdef0123456789abcdef"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 font-mono text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-neutral-500">
            Телефон (с кодом страны)
          </span>
          <input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+995555123456"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || !apiId || !apiHash || !phone}
          className="w-full rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 px-3 py-2 font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Сохраняю..." : "Продолжить → вход"}
        </button>
      </form>

      <p className="text-xs text-neutral-400">
        Данные хранятся только у тебя (<code>data/config.json</code>), в облако
        ничего не уходит.
      </p>
    </div>
  );
}

function errorText(code: unknown): string {
  switch (code) {
    case "bad_api_id":
      return "api_id — это число из my.telegram.org.";
    case "bad_api_hash":
      return "api_hash — это 32 символа (hex). Проверь, что скопировал целиком.";
    case "bad_phone":
      return "Телефон в формате +99955... (с кодом страны).";
    default:
      return "Не удалось сохранить. Проверь поля.";
  }
}
