-- POLYVO progress event ledger. Safe to run more than once.
create table if not exists public.progress_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null check (length(event_id) between 1 and 128),
  event_type text not null check (event_type in ('migration', 'answer', 'session', 'profile')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
create index if not exists progress_events_user_created_idx on public.progress_events (user_id, created_at, event_id);
alter table public.progress_events enable row level security;
revoke all on table public.progress_events from anon, public;
grant select, insert on table public.progress_events to authenticated;
drop policy if exists "learners read own progress events" on public.progress_events;
create policy "learners read own progress events" on public.progress_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "learners add own progress events" on public.progress_events;
create policy "learners add own progress events" on public.progress_events for insert to authenticated with check ((select auth.uid()) = user_id);
