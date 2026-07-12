"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Step = "sending" | "code" | "2fa" | "done" | "error";

export default function LoginForm() {
  const router = useRouter();
  const sentOnce = useRef(false);
  const [step, setStep] = useState<Step>("sending");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    sendCode();
  }, []);

  async function sendCode() {
    setStep("sending");
    setError(null);
    const res = await fetch("/api/auth/send-code", { method: "POST" });
    if (res.ok) {
      setStep("code");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Не удалось отправить код");
      setStep("error");
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Неверный код");
      return;
    }
    if (data.need2FA) {
      setStep("2fa");
      return;
    }
    setStep("done");
    router.push("/permissions");
  }

  async function submit2FA(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/twofa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Неверный пароль");
      return;
    }
    setStep("done");
    router.push("/permissions");
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">NetGram — вход</h1>

      {step === "sending" && (
        <p className="text-neutral-500">Отправляю код в Telegram...</p>
      )}

      {step === "error" && (
        <div className="space-y-3">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => {
              sentOnce.current = true;
              sendCode();
            }}
            className="rounded bg-neutral-100 px-3 py-1.5 text-sm text-neutral-900 hover:bg-neutral-200"
          >
            Повторить отправку кода
          </button>
        </div>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="space-y-3">
          <p className="text-neutral-500">Код отправлен в Telegram.</p>
          <input
            autoFocus
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код из Telegram"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !code}
            className="w-full rounded bg-blue-600 px-3 py-2 font-medium disabled:opacity-50"
          >
            {busy ? "Проверяю..." : "Войти"}
          </button>
        </form>
      )}

      {step === "2fa" && (
        <form onSubmit={submit2FA} className="space-y-3">
          <p className="text-neutral-500">Включена 2FA — введи пароль.</p>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="2FA пароль"
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded bg-blue-600 px-3 py-2 font-medium disabled:opacity-50"
          >
            {busy ? "Проверяю..." : "Подтвердить"}
          </button>
        </form>
      )}

      {step === "done" && <p className="text-neutral-500">Готово, переходим...</p>}
    </div>
  );
}
