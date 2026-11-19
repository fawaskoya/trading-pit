import { notFound } from "next/navigation";
import { compactRupees } from "@/lib/format";
import { loadScoreData } from "@/lib/score-data";
import { ADJUST_LIMIT, SECTION_MAX, SECTIONS, scoreEvent, type TeamScore } from "@/lib/scoring";
import { supabaseServer } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scoring sheets" };

const fmt = (n: number) => n.toFixed(1).replace(/\.0$/, "");
const SPARES = 2;

/**
 * A4 scoring sheets for the judges: a cover with the marking scheme, a ranked summary, and one page per team
 * with the app's marks next to empty boxes for the judges' own marks and signatures.
 * `?blank=1` leaves every mark empty (for marking entirely by hand) and adds spare pages for late registrations.
 */
export default async function ScoringSheets({ params, searchParams }: { params: Promise<{ eventId: string }>; searchParams: Promise<{ blank?: string }> }) {
  const { eventId } = await params;
  const blank = (await searchParams).blank === "1";
  const data = await loadScoreData(await supabaseServer(), eventId);
  if (!data) notFound();
  const scores = blank ? [] : scoreEvent(data.input);
  const byTeam = Object.fromEntries(scores.map((s) => [s.team_id, s]));
  const teams = blank
    ? [...data.teams.map((t) => ({ id: t.id, name: t.name ?? `Team ${t.join_code}`, college: t.college, captain: t.member_names?.[0] ?? null })),
       ...Array.from({ length: SPARES }, (_, i) => ({ id: `spare-${i}`, name: "", college: null, captain: null }))]
    : scores.map((s) => { const t = data.teams.find((x) => x.id === s.team_id)!; return { id: s.team_id, name: s.name, college: s.college, captain: t?.member_names?.[0] ?? null }; });
  const status = data.event.status === "finished" ? "Final" : "Provisional";
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="sheets bg-neutral-200 py-6 text-black print:bg-white print:py-0">
      <style>{`
        @page { size: A4; margin: 12mm; }
        @media print { html, body { background: #fff !important; } }
        .sheet { width: 210mm; min-height: 297mm; padding: 14mm; margin: 0 auto 8mm; background: white; box-shadow: 0 1px 6px rgba(0,0,0,.15); }
        @media print { .sheet { width: auto; min-height: 0; padding: 0; margin: 0; box-shadow: none; break-after: page; } .sheet:last-child { break-after: auto; } }
        .sheets table { border-collapse: collapse; width: 100%; }
        .sheets th, .sheets td { border: 1px solid #000; padding: 5px 7px; vertical-align: top; }
        .sheets th { background: #f2f2f2; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
        .box { height: 34px; }
      `}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between print:hidden">
        <p className="text-sm text-neutral-600">{blank ? "Blank sheets for marking by hand." : `${status} scores.`} In the print dialog choose “Save as PDF” to keep a file.</p>
        <PrintButton />
      </div>

      {/* Cover: the marking scheme */}
      <section className="sheet text-[13px] leading-snug">
        <p className="text-xs uppercase tracking-[0.25em] text-neutral-600">Trading Pit · Judges&apos; scoring sheet</p>
        <h1 className="mt-1 text-3xl font-bold">{data.event.name}</h1>
        <p className="mt-1 text-sm">{blank ? "Blank sheets" : `${status} scores, printed ${today}`} · {data.teams.length} teams · {data.event.total_rounds} rounds</p>
        <h2 className="mt-6 text-lg font-bold">Marking scheme — out of 20</h2>
        <p className="mt-1">The winner is the team with the highest total, not necessarily the one with the most money. Each section is out of {SECTION_MAX} and is
          scored from every trade the team made, compared with the other teams. Judges may raise or lower any section by up to {ADJUST_LIMIT} marks with a written reason; a section never goes below 0 or above {SECTION_MAX}.</p>
        <table className="mt-3">
          <thead><tr><th className="w-10">§</th><th>Section and how it is marked</th><th className="w-14 text-center">Max</th></tr></thead>
          <tbody>
            {SECTIONS.map((s) => (
              <tr key={s.key}>
                <td className="text-center text-lg font-bold">{s.key}</td>
                <td><p className="font-bold">{s.title}</p><ul className="mt-1 list-disc pl-4">{s.criteria.map((c, i) => <li key={i}>{c}</li>)}</ul></td>
                <td className="text-center text-lg font-bold">{SECTION_MAX}</td>
              </tr>
            ))}
            <tr><td /><td className="text-right font-bold">Total</td><td className="text-center text-lg font-bold">20</td></tr>
          </tbody>
        </table>
        <p className="mt-4 text-xs text-neutral-700">High-impact round: a round in which an Act of God was fired, or any script moved 8% or more. Cash round: a round spent from start to finish with 80% or more of the portfolio in cash (selling out during a round is a decision, not sitting out). Drawdown, sizing and outcome marks count only for the share of the game a team was invested.
          Equity figures are confidential to the organisers and judges.</p>
      </section>

      {/* Summary (not on blank sheets) */}
      {!blank && (
        <section className="sheet text-[13px]">
          <h2 className="text-xl font-bold">Summary — {data.event.name}</h2>
          <p className="text-sm">{status} · printed {today}</p>
          <table className="mt-3">
            <thead><tr><th className="w-10">Rank</th><th>Team</th>{SECTIONS.map((s) => <th key={s.key} className="w-12 text-center">{s.key}</th>)}<th className="w-16 text-center">Total</th><th className="w-20 text-right">Value</th></tr></thead>
            <tbody>
              {scores.map((t) => (
                <tr key={t.team_id}>
                  <td className="text-center font-bold">{t.rank}</td>
                  <td><span className="font-bold">{t.name}</span>{t.college && <span className="block text-[11px]">{t.college}</span>}</td>
                  {SECTIONS.map((s) => <td key={s.key} className="text-center">{fmt(t.sections[s.key].final)}</td>)}
                  <td className="text-center font-bold">{fmt(t.total)}</td>
                  <td className="text-right text-[11px]">{compactRupees(t.finalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Signatures />
        </section>
      )}

      {/* One page per team */}
      {teams.map((t) => <TeamSheet key={t.id} team={t} score={byTeam[t.id]} eventName={data.event.name} />)}
    </div>
  );
}

function TeamSheet({ team, score, eventName }: { team: { name: string; college: string | null; captain: string | null }; score?: TeamScore; eventName: string }) {
  return (
    <section className="sheet text-[13px]">
      <div className="flex items-start justify-between border-b-2 border-black pb-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-600">{eventName} · Scoring sheet</p>
          <p className="mt-1 text-2xl font-bold">Chest no. {team.name || <span className="inline-block w-40 border-b border-black align-bottom">&nbsp;</span>}</p>
        </div>
        {score && <p className="text-right text-sm">App rank <span className="text-2xl font-bold">#{score.rank}</span></p>}
      </div>
      <p className="mt-2">College: {team.college ?? <span className="inline-block w-80 border-b border-black align-bottom">&nbsp;</span>}</p>
      <p className="mt-1">Captain: {team.captain ?? <span className="inline-block w-80 border-b border-black align-bottom">&nbsp;</span>}</p>

      <table className="mt-4">
        <thead>
          <tr><th className="w-8">§</th><th>Section</th><th className="w-12 text-center">Max</th><th className="w-14 text-center">App</th><th className="w-20 text-center">Judge mark</th><th className="w-44">Remarks</th></tr>
        </thead>
        <tbody>
          {SECTIONS.map((s) => {
            const x = score?.sections[s.key];
            return (
              <tr key={s.key}>
                <td className="text-center text-lg font-bold">{s.key}</td>
                <td>
                  <p className="font-bold">{s.title}</p>
                  {x ? (
                    <ul className="mt-1 list-disc pl-4 text-[10.5px] leading-tight">{x.reasons.slice(0, 4).map((r, i) => <li key={i}>{r}</li>)}</ul>
                  ) : (
                    <p className="mt-1 text-[10.5px] leading-tight text-neutral-700">{s.blurb}</p>
                  )}
                </td>
                <td className="text-center">{SECTION_MAX}</td>
                <td className="text-center font-bold">{x ? <>{fmt(x.auto)}{x.adjust !== 0 && <span className="block text-[10px] font-normal">judge {x.adjust > 0 ? "+" : ""}{fmt(x.adjust)} → {fmt(x.final)}</span>}</> : ""}</td>
                <td className="box" />
                <td className="text-[10.5px]">{x?.note ?? ""}</td>
              </tr>
            );
          })}
          <tr>
            <td /><td className="text-right font-bold">Total</td><td className="text-center font-bold">20</td>
            <td className="text-center text-lg font-bold">{score ? fmt(score.total) : ""}</td><td className="box" /><td />
          </tr>
        </tbody>
      </table>

      <p className="mt-4 font-bold">Judges&apos; remarks</p>
      <div className="mt-1 space-y-5">{[0, 1, 2].map((i) => <div key={i} className="border-b border-black">&nbsp;</div>)}</div>
      <Signatures />
    </section>
  );
}

function Signatures() {
  return (
    <div className="mt-8 grid grid-cols-3 gap-6 text-sm">
      {["Judge 1", "Judge 2", "Date"].map((l) => (
        <div key={l}><div className="h-10 border-b border-black" /><p className="mt-1">{l === "Date" ? "Date" : `${l} — name & signature`}</p></div>
      ))}
    </div>
  );
}
