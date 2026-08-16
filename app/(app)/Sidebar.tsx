"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  MessageSquare,
  Plug,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Me = {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  phone: string | null;
};

const NAV = [
  { href: "/permissions", key: "nav.permissions", Icon: Users },
  { href: "/drafts", key: "nav.drafts", Icon: MessageSquare },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [me, setMe] = useState<Me | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => setMe(data.me ?? null))
      .catch(() => setMe(null));
    if (localStorage.getItem("netgram_sidebar") === "1") setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("netgram_sidebar", next ? "1" : "0");
      } catch {
        // ignore storage failures
      }
      return next;
    });
  }

  const fullName = me
    ? [me.firstName, me.lastName].filter(Boolean).join(" ") || "Telegram"
    : "";
  const initials =
    me &&
    [me.firstName, me.lastName]
      .filter(Boolean)
      .map((s) => s[0]?.toUpperCase())
      .join("")
      .slice(0, 2);

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div
        className={`flex items-center border-b border-neutral-200 py-4 ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        {!collapsed && <div className="text-sm font-semibold">NetGram</div>}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          className="rounded p-1.5 text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-800"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? t(item.key) : undefined}
              className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                active
                  ? "bg-neutral-200 font-medium text-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <item.Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{t(item.key)}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Setup lives at the bottom, away from the day-to-day nav: you connect
          an agent once and then never touch this again. */}
      <div className="mt-auto p-2">
        <Link
          href="/connect"
          title={collapsed ? t("nav.connect") : undefined}
          className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
            collapsed ? "justify-center" : ""
          } ${
            pathname === "/connect"
              ? "bg-neutral-200 font-medium text-neutral-900"
              : "text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          <Plug className="h-5 w-5 shrink-0" />
          {!collapsed && <span className="truncate">{t("nav.connect")}</span>}
        </Link>
      </div>

      {/* User pinned to the bottom. */}
      <div className="border-t border-neutral-200 p-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div
              title={fullName}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-white"
            >
              {initials || "··"}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-white">
                {initials || "··"}
              </div>
              <div className="min-w-0">
                {me ? (
                  <>
                    <div className="truncate text-sm font-medium">
                      {fullName}
                    </div>
                    <div className="truncate text-xs text-neutral-500">
                      {me.username ? `@${me.username}` : me.phone ?? me.id}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-neutral-400">
                    {t("user.loading")}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
