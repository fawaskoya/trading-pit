-- Organiser-only notes per round (e.g. suggested price moves). Never visible to teams or the display.
create table public.round_notes (
  round_id        uuid primary key references public.rounds(id) on delete cascade,
  suggested_moves text,
  updated_at      timestamptz not null default now()
);
alter table public.round_notes enable row level security;
create policy "round_notes: admin only" on public.round_notes for all to authenticated
  using (exists (select 1 from public.rounds r where r.id = round_id and public.is_event_admin(r.event_id)))
  with check (exists (select 1 from public.rounds r where r.id = round_id and public.is_event_admin(r.event_id)));
