-- flowwwww EDC LV 2026 — Supabase schema
-- Requires: anonymous auth enabled in Supabase dashboard

-- Crews identified by UUID; first 6 chars serve as the join code
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

-- Users linked to anon auth, belong to a crew
create table if not exists public.crew_members (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null,  -- from auth.uid(), NOT a FK since anon users
  crew_id uuid not null references public.crews(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text not null default '🪩',
  color text not null default '#FF3DCB',
  created_at timestamptz not null default now(),
  unique (auth_id, crew_id)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  member_id uuid not null references public.crew_members(id) on delete cascade,
  set_id text not null,
  created_at timestamptz not null default now(),
  unique (member_id, set_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  member_id uuid not null references public.crew_members(id) on delete cascade,
  set_id text not null,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.flow_overrides (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  selected_set_id text not null,
  clashing_set_ids text[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.flow_overrides enable row level security;

-- Policies: anyone authenticated (including anon) can read/write if they're in the crew
create policy "Anyone can create crews" on public.crews for insert with check (true);
create policy "Crew members can read their crew" on public.crews for select using (
  exists (select 1 from public.crew_members where crew_id = crews.id and auth_id = auth.uid())
);

create policy "Anyone can join" on public.crew_members for insert with check (auth_id = auth.uid());
create policy "Members can read crew" on public.crew_members for select using (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);
create policy "Members can update self" on public.crew_members for update using (auth_id = auth.uid());

create policy "Crew can read votes" on public.votes for select using (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);
create policy "Members can insert votes" on public.votes for insert with check (
  member_id in (select id from public.crew_members where auth_id = auth.uid())
);
create policy "Members can delete own votes" on public.votes for delete using (
  member_id in (select id from public.crew_members where auth_id = auth.uid())
);

create policy "Crew can read comments" on public.comments for select using (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);
create policy "Members can insert comments" on public.comments for insert with check (
  member_id in (select id from public.crew_members where auth_id = auth.uid())
);

create policy "Crew can read overrides" on public.flow_overrides for select using (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);
create policy "Crew can manage overrides" on public.flow_overrides for insert with check (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);
create policy "Crew can update overrides" on public.flow_overrides for update using (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);
create policy "Crew can delete overrides" on public.flow_overrides for delete using (
  crew_id in (select crew_id from public.crew_members where auth_id = auth.uid())
);

-- Enable realtime on tables that need live updates
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.comments;
alter publication supabase_realtime add table public.flow_overrides;
alter publication supabase_realtime add table public.crew_members;
