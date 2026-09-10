"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { integer, price as fmtPrice, rupees } from "@/lib/format";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Company, Event, Team } from "./play-screen";

export function TradeDrawer({ company, onClose, team, event, held, total, open, reason, onTraded }: {
  company: Company | null; onClose: () => void; team: Team; event: Event; held: number; total: number; open: boolean; reason: string | null; onTraded: () => void;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => { setQty(""); setSide(held > 0 ? "buy" : "buy"); }, [company?.id, held]);

  const price = Number(company?.current_price ?? 0);
  const feePct = Number(event.fee_pct);
  const cash = Number(team.cash);
  const shares = Math.max(0, Math.floor(Number(qty) || 0));
  const value = shares * price;
  const fee = Math.round(value * feePct) / 100;
  const maxBuy = price > 0 ? Math.floor(cash / (price * (1 + feePct / 100))) : 0;
  const maxSell = held;
  const max = side === "buy" ? maxBuy : maxSell;
  const cashAfter = side === "buy" ? cash - value - fee : cash + value - fee;
  const problem = useMemo(() => {
    if (!open) return reason;
    if (shares <= 0) return null;
    if (side === "buy" && value + fee > cash) return "Not enough cash for that many shares.";
    if (side === "sell" && shares > held && !event.allow_short) return `You only have ${integer(held)} share${held === 1 ? "" : "s"} to sell.`;
    if (side === "buy" && Number(event.max_position_pct) < 100 && (held + shares) * price > total * Number(event.max_position_pct) / 100) return `Max ${event.max_position_pct}% of your portfolio in one company.`;
    return null;
  }, [open, reason, shares, side, value, fee, cash, held, event, price, total]);

  const submit = () => start(async () => {
    if (!company) return;
    const { error } = await supabaseBrowser().rpc("execute_order", { p_company_id: company.id, p_side: side, p_shares: shares });
    if (error) { toast.error(friendlyError(error)); onTraded(); return; }
    toast.success(`${side === "buy" ? "Bought" : "Sold"} ${integer(shares)} ${company.ticker} for ${rupees(value)}`);
    onTraded();
    onClose();
  });

  return (
    <Drawer open={!!company} onOpenChange={(o) => { if (!o) onClose(); }} showSwipeHandle>
      <DrawerContent className="mx-auto max-h-[92dvh] max-w-lg overflow-y-auto">
        {company && (
          <div className="space-y-4 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <DrawerHeader className="px-0 text-left">
              <DrawerTitle className="flex items-baseline justify-between text-lg">
                <span>{company.name} <span className="font-mono text-sm text-muted-foreground">{company.ticker}</span></span>
                <span className="num font-mono">{fmtPrice(price)}</span>
              </DrawerTitle>
              <DrawerDescription>
                {held > 0 ? `You own ${integer(held)} shares worth ${rupees(held * price)}.` : "You don't own any shares yet."}
              </DrawerDescription>
            </DrawerHeader>

            <div className="grid grid-cols-2 rounded-lg bg-muted p-1 text-sm font-semibold">
              <button onClick={() => { setSide("buy"); setQty(""); }} className={cn("rounded-md py-2 transition", side === "buy" ? "bg-gain text-white shadow" : "text-muted-foreground")}>Buy</button>
              <button onClick={() => { setSide("sell"); setQty(""); }} className={cn("rounded-md py-2 transition", side === "sell" ? "bg-loss text-white shadow" : "text-muted-foreground")} disabled={held === 0 && !event.allow_short}>Sell</button>
            </div>
            <p className="text-xs text-muted-foreground">{side === "buy" ? "Buy if you think this headline will push the price up." : "Sell to lock in a gain or avoid a fall."}</p>

            <div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" aria-label="Fewer" onClick={() => setQty(String(Math.max(0, shares - 1)))}><Minus /></Button>
                <Input inputMode="numeric" pattern="[0-9]*" placeholder="0" className="h-12 flex-1 text-center font-mono text-2xl" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, ""))} />
                <Button variant="outline" size="icon" aria-label="More" onClick={() => setQty(String(Math.min(max, shares + 1)))}><Plus /></Button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map((p) => (
                  <Button key={p} variant="secondary" size="sm" onClick={() => setQty(String(Math.floor((max * p) / 100)))} disabled={max === 0}>{p === 100 ? (side === "buy" ? "Max" : "All") : `${p}%`}</Button>
                ))}
              </div>
              <p className="mt-1 text-center text-xs text-muted-foreground">{side === "buy" ? `You can afford up to ${integer(maxBuy)} shares` : `You can sell up to ${integer(maxSell)} shares`}</p>
            </div>

            <div className="space-y-1 rounded-lg bg-muted/60 p-3 text-sm">
              <Row label={`${integer(shares)} × ${fmtPrice(price)}`} value={rupees(value)} />
              {feePct > 0 && <Row label={`Fee (${feePct}%)`} value={rupees(fee)} />}
              <Row label={side === "buy" ? "You pay" : "You receive"} value={rupees(side === "buy" ? value + fee : value - fee)} bold />
              <Row label="Cash after" value={rupees(cashAfter)} muted />
            </div>

            {problem && <p className="rounded-lg bg-loss-soft px-3 py-2 text-sm font-medium text-loss">{problem}</p>}
            <Button size="lg" className={cn("h-14 w-full text-base", side === "buy" ? "bg-gain text-white hover:bg-gain/90" : "bg-loss text-white hover:bg-loss/90")} disabled={!open || pending || shares <= 0 || !!problem} onClick={submit}>
              {pending ? "Placing order…" : shares > 0 ? `Confirm: ${side === "buy" ? "buy" : "sell"} ${integer(shares)} ${company.ticker}` : `Enter how many to ${side}`}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return <div className={cn("flex justify-between", bold && "font-semibold", muted && "text-muted-foreground")}><span>{label}</span><span className="num font-mono">{value}</span></div>;
}
