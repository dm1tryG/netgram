import { redirect } from "next/navigation";
import { isAuthorized } from "@/lib/telegram";
import { LocaleProvider } from "@/lib/i18n";
import Sidebar from "./Sidebar";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  if (!(await isAuthorized())) {
    redirect("/");
  }

  return (
    <LocaleProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </LocaleProvider>
  );
}
