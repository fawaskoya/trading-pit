/** The organiser's private notes for a round: price hints and an optional Act of God draft. */
export type ShockDraft = { headline: string; detail: string; moves: string; extend_sec: number };
export type RoundNotes = { suggested_moves: string | null; draft: ShockDraft | null };

type NotesRow = {
  suggested_moves: string | null;
  shock_headline: string | null;
  shock_detail: string | null;
  shock_moves: string | null;
  shock_extend_sec: number | null;
};

/** Supabase returns the one-to-one `round_notes` join as an object or a one-element array. */
export function flattenRoundNotes<R extends { round_notes: NotesRow | NotesRow[] | null }>(r: R): Omit<R, "round_notes"> & RoundNotes {
  const { round_notes, ...round } = r;
  const n = Array.isArray(round_notes) ? round_notes[0] : round_notes;
  const draft = n && (n.shock_headline || n.shock_moves)
    ? { headline: n.shock_headline ?? "", detail: n.shock_detail ?? "", moves: n.shock_moves ?? "", extend_sec: n.shock_extend_sec ?? 60 }
    : null;
  return { ...round, suggested_moves: n?.suggested_moves ?? null, draft };
}
