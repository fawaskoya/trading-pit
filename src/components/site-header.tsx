import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          {children}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
