"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  KanbanSquare,
  Users2,
  Workflow,
  Plug,
  Megaphone,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Workflow className="size-4" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Apptics</div>
          <div className="text-xs text-muted-foreground">Journey Platform</div>
        </div>
      </div>

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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            S
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-medium">Sobhi</div>
            <div className="truncate text-xs text-muted-foreground">
              Polaire Labs
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
