import { redirect } from "next/navigation";
import { getEnvCreds, isAuthorized } from "@/lib/telegram";
import SetupWizard from "./SetupWizard";

// Never prerender: the auth check must run per-request, otherwise the build
// machine's session state gets baked into static HTML (a fresh install would
// skip the setup wizard and land on /permissions with no credentials).
export const dynamic = "force-dynamic";

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
