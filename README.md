# Waveora — Ride Your Sound Wave

An original, production-ready music streaming web app inspired by modern platforms — with **100% original branding, colors, logo, and UI** (no Spotify assets or clones).

**Stack:** React + Vite + TypeScript + Tailwind CSS + React Router + Supabase (Auth + Postgres + RLS) + HTML5 Audio. Deploys to **Vercel** with no custom backend server.

## Features

**Listeners**
- Signup (no email confirmation), login, logout, password reset
- Home: featured albums only, 10 per page with pagination (open an album to play every song)
- Album pages (`/album?name=…&artist=…`): songs imported from one folder share an album and appear as a single album card — click to see and play every song
- Server-side search (title, artist, album, genre) — never downloads the whole table
- Persistent bottom player: play/pause, next/prev, seek, volume, mute, shuffle, repeat (off/all/one), queue
- Like/unlike songs, playlists (create/rename/delete, add/remove, play, shuffle), profile editing
- Playback error handling: *“Playback could not be started. This audio source may not support browser streaming…”*

**Admins (separate `/admin/login`, Supabase Auth + `profiles.role`, RLS-enforced)**
- Dashboard: total users/songs/playlists/plays, most-played bars, recently added, recent users
- Song management: search/filter/sort, add, edit, delete (with confirm)
- **MEGA folder → album import** (`/admin/songs/import`): paste a `mega.nz/folder/…#key…` link, every audio file inside becomes a song sharing one album name + cover image (each track streams individually via its own `…/file/<id>` link)
- **MEGA link diagnostics** (`/admin/songs/check`): runs any link through every playback stage (format → metadata → download URL → range fetch → decrypt → duration → playback mode) and pinpoints the exact failing step
- Users list (no passwords ever exposed)

## Technology stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS 3, React Router 6, Lucide icons, react-hot-toast |
| Backend | Supabase Auth, Postgres, Row Level Security |
| Audio | HTML5 `<audio>` via swappable `audioService` (`HtmlAudioProvider`) |
| Deploy | Vercel (static) + Supabase (managed) |

## Supabase setup

1. Create a project at https://supabase.com → copy **Project URL** and **anon public key**.
2. **Disable email confirmation:** Dashboard → Authentication → Providers → Email → turn OFF *Confirm email*.
3. **Run the schema:** Dashboard → SQL Editor → paste `supabase/schema.sql` → Run. This creates tables, indexes, triggers, RLS + policies, and optional demo tracks.
4. **Auth redirect URLs:** Dashboard → Authentication → URL Configuration:
   - Site URL: `http://localhost:5173` (dev) and your Vercel URL (prod)
   - Redirect URLs: add `http://localhost:5173/reset-password` and `https://<your-app>.vercel.app/reset-password`

## Database setup

All in `supabase/schema.sql`: `profiles`, `songs`, `liked_songs` (unique `user_id, song_id`), `playlists`, `playlist_songs` (unique `playlist_id, song_id`), `recently_played`, FKs, cascading deletes, indexes, `updated_at` triggers, auto-profile trigger on signup, role-escalation guard, and RLS policies (users own-data-only; songs readable by all authed, writable by admins only).

## Creating the first admin

No credentials in code — ever.

1. Sign up normally at `/signup` (or create the user in Supabase Auth).
2. In Supabase SQL Editor, run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Log in at `/admin/login`. Only `role = 'admin'` accounts pass; everyone else is bounced to `/home`.

To promote further admins, an existing admin runs the same SQL (regular users are blocked from changing `role` by trigger + RLS).

> If you deployed the schema before this fix and get `Only admins can change roles` in the SQL editor itself, re-run just the `prevent_role_escalation()` function block from `supabase/schema.sql`, then retry the `UPDATE`.

## Environment variables

```bash
cp .env.example .env
```

`.env.example`:
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Fill with your project values. Never commit `.env` (already in `.gitignore`). Never expose the **service-role** key in frontend code.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run preview  # preview dist/
```

## Vercel deployment

1. Push to GitHub.
2. Vercel → New Project → Import repository (framework preset: Vite).
3. Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Deploy. (`vercel.json` rewrites all routes to `index.html` for React Router.)
5. Add the production domain to Supabase redirect URLs (see above) and test auth on prod.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank song lists / RLS errors | Did `schema.sql` run fully? Is `.env` correct? Check browser console + Supabase logs. |
| “Email not confirmed” on login | Disable **Confirm email** in Supabase Auth settings. |
| Password reset link goes nowhere | Add `/reset-password` to Supabase redirect URLs (dev + prod). |
| Admin bounced to `/home` | `profiles.role` must be `'admin'` for that user; log out/in after changing. |
| No audio | See below. |

## Audio URL requirements

Two kinds of sources are supported:

1. **Direct audio files** (e.g. `https://cdn.example.com/song.mp3`) served with browser-friendly headers — these play instantly.
2. **MEGA share links** (`https://mega.nz/file/…#key…`, legacy `/#!…` links, and folder links). A MEGA link is not an audio file — it is an encrypted file ID + key — so Waveora resolves it **entirely in the listener's browser** (`src/services/megaService.ts`, via the fetch-based `megajs` SDK loaded on demand):
   - fetches file metadata from MEGA's public API,
   - sniffs the true length from headers first (MP3 Xing/TLEN/bitrate, WAV, FLAC, MP4 `mvhd`, OGG Vorbis/Opus) so the duration shows immediately, even mid-stream,
   - downloads the ciphertext in 1MB range requests with a fetch indicator sweeping inside the seek bar (dim layer = fetched, bright layer = playhead),
   - decrypts it client-side with native WebCrypto (AES-128-CTR construction verified byte-for-byte against the SDK codec) and **plays while fetching** like YouTube: mp3/m4a streams progressively into the audio element via Media Source Extensions (no waiting for the full file); other formats and older browsers fall back to download-then-play automatically,
   - **seeking works mid-stream**: inside downloaded audio it seeks natively; ahead of it, the fetch restarts at the seek point (exact frame-aligned offsets for MP3 via an incremental frame index, estimated otherwise),
   - completed streams become replay-instant memory-cache entries; per-song `…/file/<id>` links make every folder track individually streamable.
   - Folder links play the embedded/first audio file found (mp3, m4a, ogg, wav, flac, opus, webm…).
   - The link **must include the key** (the part after `#`); keyless links are rejected with a friendly message, as are deleted/private/rate-limited files.

- Never bypass DRM/auth/paywalls or auto-download from third parties. Only stream URLs you have the legal right to use, and make sure you agree with MEGA's Terms of Service.
- Troubleshooting MEGA playback: ad-blockers or strict tracking prevention can block `g.api.mega.co.nz` — whitelist the site; MEGA also rate-limits anonymous bandwidth, so very popular files may intermittently fail with "try again in a bit".

## Project structure

```
src/
  components/ (Sidebar, MobileNavigation, SongCard, SongRow, PlaylistCard,
    SearchBar, AudioPlayer/, ProtectedRoute, AppLayout, AuthShell, Loading, …)
  pages/ (Home, Login, Signup, ForgotPassword, ResetPassword, Search, Library,
    LikedSongs, Playlists, PlaylistDetails, Profile, admin/*)
  contexts/ (AuthContext, MusicPlayerContext)
  hooks/ services/ (auth, song, playlist, audio) types/ utils/
supabase/schema.sql  .env.example  vercel.json
```
