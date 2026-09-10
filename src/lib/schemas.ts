import { z } from "zod";

export const eventSchema = z.object({
  name: z.string().trim().min(1, "Give the event a name").max(120),
  starting_capital: z.coerce.number().positive().max(1e12),
  total_rounds: z.coerce.number().int().min(1).max(30),
  round_duration_sec: z.coerce.number().int().min(10).max(3600),
  fee_pct: z.coerce.number().min(0).max(99.99),
  allow_short: z.coerce.boolean().default(false),
  max_position_pct: z.coerce.number().min(1).max(100),
});
export type EventInput = z.infer<typeof eventSchema>;

export const companySchema = z.object({
  name: z.string().trim().min(1).max(80),
  ticker: z.string().trim().toUpperCase().regex(/^[A-Z0-9&.-]{1,12}$/, "Ticker: letters/numbers, max 12"),
  sector: z.string().trim().max(40).optional().nullable(),
  logo_url: z.string().trim().url().optional().nullable().or(z.literal("")),
  price: z.coerce.number().positive().max(1e9),
});

export const headlineSchema = z.object({
  round_id: z.string().uuid(),
  headline: z.string().trim().max(200).nullable(),
  headline_detail: z.string().trim().max(2000).nullable(),
});

export const pricesSchema = z.array(z.object({
  company_id: z.string().uuid(),
  new_price: z.coerce.number().positive().max(1e9),
})).min(0);

export const teamsCreateSchema = z.object({
  event_id: z.string().uuid(),
  names: z.array(z.string().trim().max(40)).max(200),
  count: z.coerce.number().int().min(0).max(200).default(0),
});

export const orderSchema = z.object({
  company_id: z.string().uuid(),
  side: z.enum(["buy", "sell"]),
  shares: z.coerce.number().int().positive().max(1e9),
});

/** Parse "name, ticker, sector, price" lines (tabs or commas). Returns rows and per-line errors. */
export function parseCompanyPaste(text: string) {
  const rows: z.infer<typeof companySchema>[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
    const parts = line.split(/\t|,/).map((p) => p.trim());
    if (parts.length < 4) { errors.push(`Line ${i + 1}: expected "name, ticker, sector, price"`); return; }
    const [name, ticker, sector, price] = parts;
    const parsed = companySchema.safeParse({ name, ticker, sector, price: price.replace(/[₹,\s]/g, "") });
    if (!parsed.success) errors.push(`Line ${i + 1}: ${parsed.error.issues[0]?.message}`);
    else rows.push(parsed.data);
  });
  return { rows, errors };
}
