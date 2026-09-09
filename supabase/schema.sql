-- ============================================================================
-- Waveora — Supabase schema (Postgres)
-- Run this file in the Supabase SQL editor (or `supabase db push` with CLI).
--
-- IMPORTANT AUTH SETTING (Supabase Dashboard → Authentication → Providers → Email):
--   Turn OFF "Confirm email" so signup logs users in immediately with no
--   email verification, per product requirements.
-- ============================================================================

-- Extensions -----------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Tables ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text,
  album text,
  genre text,
  description text,
  cover_url text,
  audio_url text not null,
  duration integer check (duration is null or duration >= 0),
  release_year integer check (release_year is null or (release_year between 1900 and 2100)),
  featured boolean not null default false,
  play_count integer not null default 0 check (play_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.liked_songs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, song_id)
);

create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  position integer,
  added_at timestamptz not null default now(),
  unique (playlist_id, song_id)
);

create table if not exists public.recently_played (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  song_id uuid not null references public.songs(id) on delete cascade,
  played_at timestamptz not null default now()
);

-- Indexes --------------------------------------------------------------------
create index if not exists idx_songs_featured on public.songs(featured);
create index if not exists idx_songs_play_count on public.songs(play_count desc);
create index if not exists idx_songs_created on public.songs(created_at desc);
create index if not exists idx_songs_search on public.songs using gin (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(artist,'') || ' ' || coalesce(album,'') || ' ' || coalesce(genre,''))
);
create index if not exists idx_liked_user on public.liked_songs(user_id);
create index if not exists idx_liked_song on public.liked_songs(song_id);
create index if not exists idx_playlists_user on public.playlists(user_id);
create index if not exists idx_playlist_songs_playlist on public.playlist_songs(playlist_id);
create index if not exists idx_playlist_songs_song on public.playlist_songs(song_id);
create index if not exists idx_recently_user on public.recently_played(user_id, played_at desc);

-- updated_at trigger ----------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_songs_touch on public.songs;
create trigger trg_songs_touch before update on public.songs
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_playlists_touch on public.playlists;
create trigger trg_playlists_touch before update on public.playlists
  for each row execute function public.touch_updated_at();

-- Auto-create profile on signup ----------------------------------------------
-- New auth users get a `user` profile immediately. Role can only be
-- elevated to admin by an existing admin via SQL/dashboard.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from changing their own role ----------------------------------
create or replace function public.prevent_role_escalation()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    -- Allow only admins (checked via JWT-less lookup of the actor's profile)
    -- to change roles. Actor = auth.uid().
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only admins can change roles.';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_profiles_role_guard on public.profiles;
create trigger trg_profiles_role_guard before update of role on public.profiles
  for each row execute function public.prevent_role_escalation();

-- Row Level Security ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.liked_songs enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_songs enable row level security;
alter table public.recently_played enable row level security;

-- Helper: is the requesting user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

-- profiles policies
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- songs policies: everyone authenticated can read; only admins write
drop policy if exists "songs_select_all" on public.songs;
create policy "songs_select_all" on public.songs
  for select to authenticated using (true);

drop policy if exists "songs_insert_admin" on public.songs;
create policy "songs_insert_admin" on public.songs
  for insert to authenticated with check (public.is_admin());

drop policy if exists "songs_update_admin" on public.songs;
create policy "songs_update_admin" on public.songs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "songs_delete_admin" on public.songs;
create policy "songs_delete_admin" on public.songs
  for delete to authenticated using (public.is_admin());

-- Allow anonymous (logged-out) reads too so the landing/marketing pages can
-- preview the catalog if desired. Comment these out to lock down fully.
drop policy if exists "songs_select_anon" on public.songs;
create policy "songs_select_anon" on public.songs
  for select to anon using (true);

-- liked_songs: users only see/touch their own
drop policy if exists "liked_select_own" on public.liked_songs;
create policy "liked_select_own" on public.liked_songs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "liked_insert_own" on public.liked_songs;
create policy "liked_insert_own" on public.liked_songs
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "liked_delete_own" on public.liked_songs;
create policy "liked_delete_own" on public.liked_songs
  for delete to authenticated using (user_id = auth.uid());

-- playlists: users only see/touch their own (admins can view all for stats)
drop policy if exists "playlists_select_own" on public.playlists;
create policy "playlists_select_own" on public.playlists
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "playlists_insert_own" on public.playlists;
create policy "playlists_insert_own" on public.playlists
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "playlists_update_own" on public.playlists;
create policy "playlists_update_own" on public.playlists
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "playlists_delete_own" on public.playlists;
create policy "playlists_delete_own" on public.playlists
  for delete to authenticated using (user_id = auth.uid());

-- playlist_songs: only via playlists the user owns (admins read all)
drop policy if exists "psongs_select_owner" on public.playlist_songs;
create policy "psongs_select_owner" on public.playlist_songs
  for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

drop policy if exists "psongs_insert_owner" on public.playlist_songs;
create policy "psongs_insert_owner" on public.playlist_songs
  for insert to authenticated with check (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
  );

drop policy if exists "psongs_delete_owner" on public.playlist_songs;
create policy "psongs_delete_owner" on public.playlist_songs
  for delete to authenticated using (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = auth.uid())
  );

-- recently_played: users only see/touch their own
drop policy if exists "recent_select_own" on public.recently_played;
create policy "recent_select_own" on public.recently_played
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "recent_insert_own" on public.recently_played;
create policy "recent_insert_own" on public.recently_played
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "recent_delete_own" on public.recently_played;
create policy "recent_delete_own" on public.recently_played
  for delete to authenticated using (user_id = auth.uid());

-- Seed demo (optional): a few openly-licensed sample tracks --------------------
-- These use public sample MP3s for local development only. Replace with your
-- own licensed catalog in production.
insert into public.songs (title, artist, album, genre, description, cover_url, audio_url, duration, release_year, featured, play_count)
values
  ('SoundHelix Sample 1', 'SoundHelix', 'Samples', 'Electronic', 'Demo track for development.', 'https://picsum.photos/seed/waveora1/600/600', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 372, 2024, true, 1280),
  ('SoundHelix Sample 2', 'SoundHelix', 'Samples', 'Electronic', 'Demo track for development.', 'https://picsum.photos/seed/waveora2/600/600', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 425, 2024, true, 980),
  ('SoundHelix Sample 3', 'SoundHelix', 'Samples', 'Ambient', 'Demo track for development.', 'https://picsum.photos/seed/waveora3/600/600', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 313, 2023, false, 640)
on conflict do nothing;
