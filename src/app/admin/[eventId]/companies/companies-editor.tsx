"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { price as fmtPrice } from "@/lib/format";
import type { Database } from "@/lib/database.types";
import { bulkAddCompanies, deleteCompany, updateCompany } from "../../actions";

type Company = Database["public"]["Tables"]["companies"]["Row"];
const EXAMPLE = "Infosys, INFY, IT, 1560\nReliance Industries, RELIANCE, Energy, 2950\nHDFC Bank, HDFCBANK, Banking, 1650";

export function CompaniesEditor({ eventId, companies, locked }: { eventId: string; companies: Company[]; locked: boolean }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  const paste = () => start(async () => {
    const res = await bulkAddCompanies(eventId, text);
    if (!res.ok) { toast.error(res.error); return; }
    if (res.data?.errors.length) toast.warning(res.data.errors.join("\n"));
    if (res.data?.added) { toast.success(`${res.data.added} companies added`); setText(""); }
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold">{companies.length} companies</h2>
          <p className="text-xs text-muted-foreground">Click a cell to edit. {locked && "Prices are locked once the event is live."}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead><TableHead>Name</TableHead><TableHead>Sector</TableHead><TableHead className="text-right">Start price</TableHead><TableHead className="text-right">Now</TableHead><TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((c) => <Row key={c.id} c={c} locked={locked} />)}
            {!companies.length && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Paste your company list on the right to get started.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <Card className="h-fit p-5">
        <h2 className="font-semibold">Bulk add</h2>
        <p className="mt-1 text-sm text-muted-foreground">One company per line: <code className="rounded bg-muted px-1">name, ticker, sector, price</code>. Commas or tabs (paste straight from a spreadsheet).</p>
        <Textarea className="mt-3 min-h-44 font-mono text-xs" placeholder={EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
        <Button className="mt-3 w-full" disabled={pending || !text.trim() || locked} onClick={paste}>Add companies</Button>
        {locked && <Alert className="mt-3"><AlertDescription>The event has started, so the company list is frozen. Names, sectors and logos can still be edited.</AlertDescription></Alert>}
      </Card>
    </div>
  );
}

function Row({ c, locked }: { c: Company; locked: boolean }) {
  const [pending, start] = useTransition();
  const save = (field: "name" | "ticker" | "sector" | "price", value: string) => {
    const current = field === "price" ? String(c.starting_price) : (c[field] ?? "");
    if (value.trim() === String(current).trim()) return;
    start(async () => {
      const res = await updateCompany(c.id, { [field]: field === "price" ? value.replace(/[₹,\s]/g, "") : value });
      if (!res.ok) toast.error(res.error);
    });
  };
  return (
    <TableRow className={pending ? "opacity-60" : ""}>
      <TableCell><Cell value={c.ticker} onSave={(v) => save("ticker", v.toUpperCase())} className="font-mono font-semibold uppercase" disabled={locked} /></TableCell>
      <TableCell><Cell value={c.name} onSave={(v) => save("name", v)} /></TableCell>
      <TableCell><Cell value={c.sector ?? ""} onSave={(v) => save("sector", v)} className="text-muted-foreground" /></TableCell>
      <TableCell className="text-right"><Cell value={String(c.starting_price)} onSave={(v) => save("price", v)} className="num text-right font-mono" disabled={locked} /></TableCell>
      <TableCell className="num text-right font-mono text-muted-foreground">{fmtPrice(c.current_price)}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon-sm" aria-label="Remove" disabled={locked} onClick={() => start(async () => { const r = await deleteCompany(c.id); if (!r.ok) toast.error(r.error); })}><Trash2 className="size-4" /></Button>
      </TableCell>
    </TableRow>
  );
}

function Cell({ value, onSave, className, disabled }: { value: string; onSave: (v: string) => void; className?: string; disabled?: boolean }) {
  const [v, setV] = useState(value);
  return (
    <Input
      className={`h-8 border-transparent bg-transparent px-1 shadow-none hover:border-border focus:border-border ${className ?? ""}`}
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSave(v)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setV(value); }}
    />
  );
}
