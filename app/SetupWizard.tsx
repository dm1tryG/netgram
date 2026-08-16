"use client";

import { useState } from "react";
import CredsForm from "./CredsForm";
import LoginForm from "./LoginForm";
import { LocaleProvider } from "@/lib/i18n";

// First-run flow: collect Telegram app credentials (if not set yet), then hand
// off to the login step (code / 2FA). Everything client-side after the initial
// server-provided `hasCreds` hint.

function Flow({ hasCreds }: { hasCreds: boolean }) {
  const [ready, setReady] = useState(hasCreds);

  return ready ? <LoginForm /> : <CredsForm onSaved={() => setReady(true)} />;
}

export default function SetupWizard({ hasCreds }: { hasCreds: boolean }) {
  return (
    <LocaleProvider>
      <Flow hasCreds={hasCreds} />
    </LocaleProvider>
  );
}
