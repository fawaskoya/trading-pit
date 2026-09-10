import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-heading font-bold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 17l5-6 4 4 5-8 4 3" />
        </svg>
      </span>
      <span>Trading<span className="text-primary">Pit</span></span>
    </Link>
  );
}
