# flowwwww

A planning companion for **EDC Las Vegas 2026** — built so a 3-person crew can browse the lineup, vote on what they want to see, and converge on one shared night-by-night schedule together.

> The app is a tool the crew uses *alongside* their group chat, not a replacement for it. Anything texting already does well (threaded discussion, reactions-as-comms) is intentionally out of scope. The app does what texting can't: rendering 245+ sets across 9 stages over 3 nights as something you can actually scan, vote on, and resolve clashes for.

See [flowwwww_prd_v0.md](flowwwww_prd_v0.md) for the full PRD, [flowwwww_design_document.md](flowwwww_design_document.md) for the visual system, and [technical_specs_flowwwww_v0.md](technical_specs_flowwwww_v0.md) for the original tech spec.

---

## What it does

Three core surfaces, navigable from the bottom nav:

1. **Home** — countdown to gates open, crew roster, quick CTAs. During the festival window it auto-flips into a live **Now / Next** surface showing what the user is currently watching and what's up in the next slot.
2. **Lineup** — the voting surface. Two view modes share one heart store:
   - **List** — vertical, scrollable, grouped by time block (Early / Peak / After Hours). Best for *exploring* unfamiliar artists. Tap a row to expand for genres, sounds-like description, Spotify + YouTube links, and crew comments.
   - **Grid** — full stage-by-time calendar. Best for *spotting clashes* spatially when you already know your vibe. Tap a tile to open the same detail sheet.
3. **flowwwww** — the resolved shared schedule, in three modes:
   - **Grid** — the calendar with auto-resolved winners + ghost losers. Tap any tile to swap or trim attendance (arrive late / leave early in 15-min increments).
   - **Timeline** — vertical card stack with movement / gap interstitials and walk-time alerts.
   - **Wallpaper** — exportable card sized for iPhone 17 Pro / 9:16 / 1:1 square, with 5 palette presets. Adaptive density tiers ensure the whole schedule fits.

### Heart-and-resolve loop

1. Each crew member taps the ♥ on sets they want to see (in either Lineup view).
2. The shared schedule (`flowwwww`) auto-resolves overlaps using vote weight: most hearts wins; ties break on earliest heart; remaining ties surface as `Open` and need crew input.
3. Any clash decision can be manually swapped from the schedule. Any winner can be trimmed (arrive +15/30/45/60m, leave −15/30/45/60m) so two near-overlapping sets can both fit.
4. The schedule re-renders live across the crew via Supabase realtime.

See [src/lib/flow.ts](src/lib/flow.ts) for the algorithm — `resolveFlow()` is greedy chronological with override-promotion and attendance-trim-aware overlap detection.

---

## Stack

- **Framework** — Next.js 14 (App Router) + React 18 + TypeScript, deployed as a PWA.
- **Styling** — Tailwind CSS with a custom PLUR palette + three switchable themes (PLUR rave / HOLO holographic foil / MONO minimalist) implemented as `[data-theme="..."]` CSS layers in [src/app/globals.css](src/app/globals.css). Toggleable in the AppShell header.
- **Animation** — Framer Motion for screen transitions, layout animations, and shared-element selection states (e.g. the day-tabs / mode-switcher sliding pill).
- **State** — React state in [src/components/AppShell.tsx](src/components/AppShell.tsx). Vote / comment / override mutations sync to Supabase optimistically; realtime channel listens for crew updates and merges back without clobbering local optimistic state.
- **Backend** — Supabase (Postgres + anonymous auth + Realtime). Schema in [supabase/schema.sql](supabase/schema.sql). When env vars aren't set, the app drops into demo mode with a hardcoded crew + sample state from [src/lib/data.ts](src/lib/data.ts).
- **Lineup data** — static [data/lineup.json](data/lineup.json) generated from the official EDC schedule CSV via [scripts/build-lineup-from-csv.js](scripts/build-lineup-from-csv.js).

---

## Key implementation notes

### Data pipeline (lineup + annotations)

The official EDC LV 2026 schedule was published as two CSVs (mainstage list + pivot). [scripts/build-lineup-from-csv.js](scripts/build-lineup-from-csv.js) parses the row-per-set CSV, applies hand-curated annotations, and writes [data/lineup.json](data/lineup.json) with all 245 sets across 9 stages.

- Cross-checks the per-night counts against the pivot CSV's "Quick Counts" column. Build aborts if they diverge.
- Time conversion: PM hours → festival night's opening calendar day; AM hours → next day; +7h shift to UTC (PDT).
- Annotations live in [data/artist-annotations.json](data/artist-annotations.json) — one entry per artist with `genres`, `sounds_like`, optional `spotify_id`. Rebuild after editing:
  ```sh
  node scripts/build-lineup-from-csv.js
  ```

### Spotify integration

We don't use the Spotify Web API (deprecated Related Artists / Recommendations endpoints + OAuth complexity ruled it out for v1, see PRD §11.3). Instead:

- Each set links to Spotify via the [src/lib/flow.ts](src/lib/flow.ts) `spotifyArtistUrl()` helper.
- If the artist's annotation has a `spotify_id` (22 char ID from `open.spotify.com/artist/{ID}`), we link directly to the profile.
- Otherwise we fall back to the search-results URL filtered to artists.
- [SPOTIFY_IDS.md](SPOTIFY_IDS.md) is the working table for filling IDs incrementally; [scripts/import-spotify-ids.js](scripts/import-spotify-ids.js) merges filled rows back into the annotations file.

### Theme system

Three themes share one component tree — themes are pure CSS layers keyed on `<html data-theme="...">`. Switching at runtime requires zero re-render of components. State persists per user in `localStorage`. See [src/lib/theme.tsx](src/lib/theme.tsx).

### Walk-time matrix

Hand-estimated minutes between every stage pair (PRD §11.2), in [src/lib/flow.ts](src/lib/flow.ts) `WALK_MINUTES`. Surfaces in timeline movement alerts: "8-min walk to bassPOD — you'll be ~3 min late."

### Adaptive wallpaper layout

The wallpaper export view ([src/components/FlowScreen.tsx](src/components/FlowScreen.tsx) `WallpaperView` + `computeWallpaperDensity`) picks one of 5 density tiers based on item count + chosen aspect ratio. Square (1:1) gets aggressive scaling because vertical space is scarcest; iPhone 17 Pro (9:19.5-ish) can stay roomy until 20+ items.

---

## Local development

```sh
npm install

# Optional: copy env template (offline demo mode works without)
cp .env.local.example .env.local
# Edit .env.local with NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY

npm run dev          # http://localhost:3000
```

### Without Supabase

Skip `.env.local` entirely. The app boots into demo mode with a fake crew (`Koto / Alex / Mika`) and sample votes / comments. You can switch the active user via the avatars in the header and exercise every feature.

### With Supabase

Spin up a Supabase project (free tier is fine), enable **anonymous sign-ins** (Auth → Providers), then run [supabase/schema.sql](supabase/schema.sql) in the SQL editor. Drop the project URL + anon key into `.env.local`.

### Common scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server with HMR |
| `npm run build` | Production build (PWA assets generated) |
| `npm run lint` | Next lint |
| `npx tsc --noEmit` | Type-check everything without writing JS |
| `node scripts/build-lineup-from-csv.js` | Rebuild `data/lineup.json` from the CSVs + annotations |
| `node scripts/import-spotify-ids.js` | Merge filled-in IDs from `SPOTIFY_IDS.md` into annotations |

---

## File map

```
src/
  app/
    globals.css           # Tailwind + 3 theme CSS layers (PLUR / HOLO / MONO)
    layout.tsx            # ThemeProvider wrap
    page.tsx              # Mounts <AppShell />
  components/
    AppShell.tsx          # Top-level state, nav, header, theme toggle, undo toast
    HomeScreen.tsx        # Countdown + Now/Next + crew roster
    LineupTab.tsx         # Hosts List + Grid as switchable view modes
    LineupScreen.tsx      # List view (one row per set, expandable)
    PickScreen.tsx        # Grid view (calendar tile per set + detail sheet)
    FlowScreen.tsx        # Resolved schedule: Grid / Timeline / Wallpaper modes
    GridView.tsx          # The schedule grid with swap + trim controls
    OnboardingScreen.tsx  # Crew create / join flow
    ui.tsx                # Shared atoms: ScreenFrame, NavButton, DayTabs, Pill, etc.
  lib/
    flow.ts               # Algorithm: resolveFlow + clash + walk-times + interstitials
    data.ts               # Demo crew/state, night labels, lineup re-export
    types.ts              # All TS types
    storage.ts            # localStorage helpers (state cache + crew session)
    crew-context.ts       # React context for the crew array
    supabase.ts           # Browser client factory (returns null when unconfigured)
    supabase-sync.ts      # CRUD + realtime subscription
    theme.tsx             # Theme provider + persistence
data/
  lineup.json             # Built artifact — single source of truth at runtime
  artist-annotations.json # Hand-curated genres + sounds-like + spotify_id
scripts/
  build-lineup-from-csv.js   # CSV → lineup.json builder (with pivot cross-check)
  import-spotify-ids.js      # Markdown table → annotations merger
  sync-lineup.js             # Incremental updates to lineup.json (late additions)
supabase/
  schema.sql              # Postgres schema + RLS policies
public/
  manifest.webmanifest    # PWA manifest
  sw.js                   # Service worker (offline support)
EDC 2026 *.csv            # Source CSVs from the official schedule
SPOTIFY_IDS.md            # Working table — fill in IDs and run the import script
```

---

## What's deferred (PRD §13)

- **During-festival capture** — photo / voice note auto-tagging, self-reported location for crew coordination, gap-filling discovery surface, aggressive offline/battery discipline. Phase 2.
- **Memory & recap** — per-night and per-festival Wrapped-style recaps, HealthKit dance-miles. Phase 3.
- **Multi-itinerary support** — when crews grow beyond ~5 the "one shared schedule" model breaks. Requires real data-model changes; flagged in PRD §13.3.
- **Multi-festival generalization** — the rich-card design is portable, but lineup-import infra + per-venue stage geography is real work. PRD §13.4.
- **Spotify OAuth + preview audio** — out of scope for v1; we link out instead. PRD §11.3.

---

## License

Private prototype. All EDC / Insomniac trademarks belong to their owners; this project uses no official imagery.
