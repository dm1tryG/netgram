import { redirect } from "next/navigation";
import { getEnvCreds, isAuthorized } from "@/lib/telegram";
import SetupWizard from "./SetupWizard";

export default async function Home() {
  if (await isAuthorized()) {
    redirect("/permissions");
  }

  const creds = getEnvCreds();

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <SetupWizard hasCreds={Boolean(creds)} />
    </main>
  );
}
