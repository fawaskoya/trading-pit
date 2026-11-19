import { Newspaper, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Round } from "./play-screen";
import { stripSuggested } from "./play-screen";

/**
 * Earlier headlines, newest first: each new round's headline lands on top of the card above and the
 * previous ones move down. An Act of God sits above its own round's headline. Teams can only read
 * rounds that have been released (RLS hides pending ones), so nothing here gives anything away.
 */
export function HeadlineFeed({ rounds, excludeId }: { rounds: Round[]; excludeId: string | null }) {
  const items = [...rounds]
    .filter((r) => r.state !== "pending" && r.id !== excludeId && (r.headline || r.shock_headline))
    .sort((a, b) => b.round_no - a.round_no);
  if (!items.length) return null;

  return (
    <Card className="p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Earlier headlines</p>
      <ol className="mt-3 space-y-4">
        {items.map((r) => (
          <li key={r.id} className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Round {r.round_no}</p>
            {r.shock_headline && (
              <div className="rounded-lg bg-loss-soft p-2.5 text-loss">
                <p className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-widest"><Zap className="size-3 fill-current" /> Breaking</p>
                <p className="mt-0.5 text-sm font-bold leading-snug text-foreground">{r.shock_headline}</p>
                {r.shock_detail && <p className="mt-0.5 text-xs text-muted-foreground">{r.shock_detail}</p>}
              </div>
            )}
            {r.headline && (
              <div className="flex gap-2.5">
                <Newspaper className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-semibold leading-snug">{r.headline}</p>
                  {r.headline_detail && <p className="mt-0.5 text-xs text-muted-foreground">{stripSuggested(r.headline_detail)}</p>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
