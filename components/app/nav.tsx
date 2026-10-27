"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Megaphone, Settings, Users, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/creators", label: "Creators", icon: Users },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/settings/brands", label: "Brands", icon: Building2 },
  { href: "/settings/team", label: "Team", icon: Settings },
];

export function Nav() {
  return <NavLinks pathname={usePathname()} />;
}

/** Rendered without the active highlight while the current path streams in. */
export function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = pathname !== null && (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
