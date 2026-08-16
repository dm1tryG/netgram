"use client";

import { useEffect, useState } from "react";
import CredsForm from "./CredsForm";
import LoginForm from "./LoginForm";
import {
  LocaleProvider,
  useI18n,
  LOCALE_STORAGE_KEY,
  type Locale,
} from "@/lib/i18n";

// First-run flow: pick a language (persisted), then collect Telegram app
// credentials (if not set yet), then hand off to the login step (code / 2FA).
// Everything client-side after the initial server-provided `hasCreds` hint.

const LANGS: { code: Locale; label: string; hint: string }[] = [
  { code: "ru", label: "Русский", hint: "Продолжить на русском" },
  { code: "en", label: "English", hint: "Continue in English" },
];

function LangChoice({ onPick }: { onPick: (l: Locale) => void }) {
  return (
    <div className="w-full max-w-md space-y-6 text-center">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Язык · Language</h1>
        <p className="text-sm text-neutral-500">
          Выбери язык интерфейса · Choose the interface language
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {LANGS.map((l) => (
          <button
            key={l.code}
            onClick={() => onPick(l.code)}
            className="rounded-xl border border-neutral-200 bg-white px-4 py-6 text-lg font-medium shadow-sm transition-colors hover:border-sky-400 hover:bg-neutral-100"
          >
            {l.label}
            <span className="mt-1 block text-xs font-normal text-neutral-500">
              {l.hint}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Flow({ hasCreds }: { hasCreds: boolean }) {
  const { setLocale } = useI18n();
  // null = storage not read yet (avoids a language-screen flash on reload)
  const [langChosen, setLangChosen] = useState<boolean | null>(null);
  const [ready, setReady] = useState(hasCreds);

  useEffect(() => {
    setLangChosen(Boolean(localStorage.getItem(LOCALE_STORAGE_KEY)));
  }, []);

  if (langChosen === null) return null;
  if (!langChosen)
    return (
      <LangChoice
        onPick={(l) => {
          setLocale(l);
          setLangChosen(true);
        }}
      />
    );
  return ready ? <LoginForm /> : <CredsForm onSaved={() => setReady(true)} />;
}

export default function SetupWizard({ hasCreds }: { hasCreds: boolean }) {
  return (
    <LocaleProvider>
      <Flow hasCreds={hasCreds} />
    </LocaleProvider>
  );
}
