"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  ["", "Control room"],
  ["/companies", "Companies"],
  ["/headlines", "Headlines"],
  ["/teams", "Teams"],
  ["/settings", "Settings"],
] as const;

export function AdminNav({ eventId }: { eventId: string }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 text-sm">
      {TABS.map(([suffix, label]) => {
        const href = `/admin/${eventId}${suffix}`;
        const active = suffix === "" ? path === href : path.startsWith(href);
        return (
          <Link key={href} href={href} className={cn("whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition", active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
