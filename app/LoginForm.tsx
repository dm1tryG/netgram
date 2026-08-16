"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

type Step = "sending" | "code" | "2fa" | "done" | "error";

export default function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    setStep("sending");
    setError(null);
    const res = await fetch("/api/auth/send-code", { method: "POST" });
    if (res.ok) {
      setStep("code");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? t("login.err.sendCode"));
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
      setError(data.error ?? t("login.err.badCode"));
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
      setError(data.error ?? t("login.err.badPassword"));
      return;
    }
    setStep("done");
    router.push("/permissions");
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">{t("login.title")}</h1>

      {step === "sending" && (
        <p className="text-neutral-500">{t("login.sending")}</p>
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
            {t("login.retry")}
          </button>
        </div>
      )}

      {step === "code" && (
        <form onSubmit={submitCode} className="space-y-3">
          <p className="text-neutral-500">{t("login.codeSent")}</p>
          <input
            autoFocus
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("login.codePlaceholder")}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !code}
            className="w-full rounded bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? t("login.checking") : t("login.signin")}
          </button>
        </form>
      )}

      {step === "2fa" && (
        <form onSubmit={submit2FA} className="space-y-3">
          <p className="text-neutral-500">{t("login.twofaHint")}</p>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("login.twofaPlaceholder")}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !password}
            className="w-full rounded bg-blue-600 px-3 py-2 font-medium text-white disabled:opacity-50"
          >
            {busy ? t("login.checking") : t("login.confirm")}
          </button>
        </form>
      )}

      {step === "done" && <p className="text-neutral-500">{t("login.done")}</p>}
    </div>
  );
}
