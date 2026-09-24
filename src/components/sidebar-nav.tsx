"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, LayoutGroup } from "motion/react";
import {
  LayoutDashboard,
  KanbanSquare,
  Users2,
  Plug,
  Megaphone,
  Bot,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AppticsLogo } from "@/components/apptics-logo";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/board", label: "Journey Board", icon: KanbanSquare },
  { href: "/customers", label: "Customers", icon: Users2 },
  { href: "/ads", label: "Facebook Ads", icon: Megaphone },
  { href: "/bots", label: "Bots", icon: Bot },
  { href: "/integrations", label: "Integrations", icon: Plug },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  // No chrome on the login screen.
  if (pathname === "/login") return null;

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/" className="flex items-center" aria-label="Apptics Journey Platform">
          <AppticsLogo className="h-6 w-auto text-foreground" />
        </Link>
      </div>

      <LayoutGroup>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg bg-sidebar-accent"
                    transition={{
                      type: "spring",
                      duration: 0.4,
                      bounce: 0.15,
                    }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <item.icon className="size-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </LayoutGroup>

      <div className="border-t p-3">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}
