"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  FileText,
  Settings2,
  Menu,
  X,
  LogOut,
  Table2,
  Map,
  Upload,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/lib/roles";
import { seesEverything } from "@/lib/roles";
import { Avatar } from "@/components/ui/badge";
import { ViacLogo } from "@/components/layout/viac-logo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  /** Also highlight for nested routes. */
  match?: (path: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    match: (p) => p === "/dashboard",
  },
  {
    href: "/sessions/new",
    label: "Log a session",
    icon: PlusCircle,
    match: (p) => p === "/sessions/new",
  },
  {
    href: "/sessions",
    label: "Session Records",
    icon: ClipboardList,
    match: (p) =>
      p === "/sessions" || (p.startsWith("/sessions/") && p !== "/sessions/new"),
  },
  {
    href: "/map",
    label: "Map Intelligence",
    icon: Map,
    match: (p) => p.startsWith("/map"),
  },
  {
    href: "/import",
    label: "Import & Ingestion",
    icon: Upload,
    match: (p) => p.startsWith("/import"),
  },
  {
    href: "/reports",
    label: "Report Studio",
    icon: FileText,
    match: (p) => p.startsWith("/reports"),
  },
  {
    href: "/data",
    label: "Data export",
    icon: Table2,
    match: (p) => p.startsWith("/data"),
  },
  {
    href: "/quality",
    label: "Quality & Audit",
    icon: ShieldAlert,
    match: (p) => p.startsWith("/quality"),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/settings",
    label: "Settings & RBAC",
    icon: Settings2,
    match: (p) => p.startsWith("/settings"),
  },
];

export function Sidebar({ user }: { user: SessionUser }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  const isAdmin = seesEverything(user);

  return (
    <>
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="-ml-1 rounded-control p-2 text-ink-600 transition-colors hover:bg-ink-100"
        >
          <Menu className="size-5" />
        </button>
        <ViacLogo height={32} priority />
      </div>

      {open && (
        <div
          className="animate-fade fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-ink-100 bg-white",
          "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          "lg:translate-x-0",
          open ? "translate-x-0 shadow-pop" : "-translate-x-full lg:shadow-none",
        )}
      >
        <div className="brand-wash flex items-center justify-between gap-2 px-5 pt-6 pb-5">
          <Link href="/dashboard" className="block min-w-0">
            <ViacLogo height={44} priority />
            <p className="mt-2.5 text-2xs font-medium tracking-[0.14em] text-ink-400 uppercase">
              Reporting Platform
            </p>
          </Link>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="rounded-control p-2 text-ink-500 transition-colors hover:bg-white/70 lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="scroll-slim flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}

          {isAdmin && (
            <>
              <p className="px-3 pt-6 pb-2 text-2xs font-semibold tracking-[0.12em] text-ink-400 uppercase">
                Administration
              </p>
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-ink-100 p-3">
          <div className="flex items-center gap-3 rounded-tile px-2 py-2">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink-900">
                {user.name}
              </p>
              <p className="truncate text-2xs text-ink-500">
                {user.designation ?? user.email}
              </p>
            </div>
            <form action="/api/auth/sign-out" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="rounded-control p-2 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              >
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.match ? item.match(pathname) : pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium",
        "transition-colors duration-150",
        active
          ? "bg-blue-50 text-blue-800"
          : "text-ink-600 hover:bg-ink-50 hover:text-ink-900",
      )}
    >
      {active && (
        <span
          className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gold-500"
          aria-hidden
        />
      )}
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active ? "text-blue-600" : "text-ink-400 group-hover:text-ink-600",
        )}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}
