create extension if not exists "pgcrypto";

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  crew_id uuid not null references public.crews(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null,
  emoji text not null default '🪩',
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  set_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, set_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  set_id text not null,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.flow_overrides (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  clashing_set_ids text[] not null,
  selected_set_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (crew_id, clashing_set_ids)
);

create table if not exists public.artist_cache (
  artist_name text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.crews enable row level security;
alter table public.users enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
alter table public.flow_overrides enable row level security;
alter table public.artist_cache enable row level security;

create policy "Users can read their crew" on public.crews
  for select using (
    exists (
      select 1 from public.users u
      where u.crew_id = crews.id and u.id = auth.uid()
    )
  );

create policy "Users can read crew members" on public.users
  for select using (
    crew_id in (select crew_id from public.users where id = auth.uid())
  );

create policy "Users can update themselves" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Crew can read votes" on public.votes
  for select using (
    exists (
      select 1
      from public.users vote_user
      join public.users viewer on viewer.crew_id = vote_user.crew_id
      where vote_user.id = votes.user_id and viewer.id = auth.uid()
    )
  );

create policy "Users can write their votes" on public.votes
  for insert with check (user_id = auth.uid());

create policy "Users can remove their votes" on public.votes
  for delete using (user_id = auth.uid());

create policy "Crew can read comments" on public.comments
  for select using (
    exists (
      select 1
      from public.users comment_user
      join public.users viewer on viewer.crew_id = comment_user.crew_id
      where comment_user.id = comments.user_id and viewer.id = auth.uid()
    )
  );

create policy "Users can write comments" on public.comments
  for insert with check (user_id = auth.uid());

create policy "Crew can read overrides" on public.flow_overrides
  for select using (
    crew_id in (select crew_id from public.users where id = auth.uid())
  );

create policy "Crew can upsert overrides" on public.flow_overrides
  for all using (
    crew_id in (select crew_id from public.users where id = auth.uid())
  ) with check (
    crew_id in (select crew_id from public.users where id = auth.uid())
  );

create policy "Authenticated users can read artist cache" on public.artist_cache
  for select using (auth.role() = 'authenticated');
