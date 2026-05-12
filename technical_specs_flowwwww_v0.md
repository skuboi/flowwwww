Here is a complete **Technical Specification Document** tailored specifically for your engineer. 

I’ve selected a tech stack that is the current industry standard for this exact type of project (Next.js + Supabase). It has massive amounts of documentation, an incredible ecosystem, and best of all: **hosting it will be 100% free and virtually zero-maintenance.**

You can copy and paste everything below this line directly into a Notion doc, Google Doc, or GitHub Readme for your engineer.

***

# Technical Specification: flowwwww (Phase 1)
**Prepared for Engineering Handoff**

## 1. Tech Stack & Hosting Strategy
To maximize build speed and keep hosting free and simple for a 3-person scale, use the following stack:
*   **Frontend Framework:** Next.js (App Router, React). Extremely standard, handles API routes and PWA configuration easily.
*   **Styling & Animation:** Tailwind CSS (for layout/styling) + Framer Motion (crucial for the spring-based swipe gestures and layout animations requested in the PRD).
*   **Backend & Auth:** Supabase. Provides out-of-the-box Magic Link Auth, a Postgres database for votes/comments, and instant real-time sync via WebSockets. 
*   **Hosting:** Vercel (Frontend) + Supabase Cloud (Backend). Both have generous free tiers that a 3-person app will never exceed.
*   **PWA Plugin:** `next-pwa` (or Serwist) for caching static assets and creating the installable iOS manifest.

---

## 2. The Static Lineup JSON Schema
As per the PRD, the lineup is a static file bundled with the app (`data/lineup.json`). It should not live in the database to allow for easy offline access and manual updates.

**Suggested JSON Structure:**
```json
{
  "stages": {
    "kinetic": { "name": "kineticFIELD", "color": "#FF3DCB" },
    "circuit": { "name": "circuitGROUNDS", "color": "#00FFDC" }
  },
  "sets": [
    {
      "id": "set_101",
      "artist_name": "Fred again..",
      "stage_id": "circuit",
      "night": "saturday", 
      "start_time": "2026-05-16T23:30:00Z",
      "end_time": "2026-05-17T01:00:00Z",
      "genres": ["House", "UK Garage"]
    }
  ]
}
```
*Note for Engineer: Date/times should be stored as full ISO strings. "Overnight" sets mathematically belong to the next calendar day, but the `night` string explicitly ties them to the festival day (e.g., a 2 AM Sunday calendar set is `night: "saturday"`).*

---

## 3. Database Schema (Supabase / Postgres)
Keep it incredibly flat. We only need to store dynamic user states.

**Table: `crews`**
*   `id` (uuid, PK)
*   `created_at` (timestamp)

**Table: `users`**
*   `id` (uuid, PK, linked to Supabase Auth)
*   `crew_id` (uuid, FK)
*   `name` (text)
*   `color` (text) - *Assigned on join (e.g., #FF3DCB)*

**Table: `votes`**
*   `id` (uuid, PK)
*   `user_id` (uuid, FK)
*   `set_id` (text) - *Maps directly to the JSON `set_id`*
*   `created_at` (timestamp)
*   *Index: Unique constraint on `(user_id, set_id)`*

**Table: `comments`**
*   `id` (uuid, PK)
*   `user_id` (uuid, FK)
*   `set_id` (text)
*   `content` (text)
*   `created_at` (timestamp)

**Table: `flow_overrides`**
*(Used to save state when the crew manually swaps an auto-resolved clash)*
*   `id` (uuid, PK)
*   `crew_id` (uuid, FK)
*   `clashing_set_ids` (text array) - *e.g., `["set_101", "set_102"]`*
*   `selected_set_id` (text) - *The winner chosen by the user*

---

## 4. API & External Data Strategy (Spotify / Last.fm)
Because external APIs have rate limits, we should not make client-side calls directly from the browser. 

**Flow:** Next.js Route Handler (`/api/artist-meta?name=Fred+again`) -> Checks Supabase Cache -> If miss, fetch from APIs -> Save to cache -> Return to client.

1.  **Spotify API (Image & Audio Preview):**
    *   Endpoint: `GET /search?q={artist}&type=artist` (Extract Image URL).
    *   Endpoint: `GET /artists/{id}/top-tracks` (Extract `preview_url` from the most popular track that has one).
2.  **Last.fm API (Sounds Like):**
    *   Endpoint: `?method=artist.getsimilar&artist={name}&api_key={key}`
    *   **Logic per PRD:** Cross-reference the resulting array of similar artists against the list of artists the *crew has already voted for*. If intersection > 0, return: `"Sounds like your [Match 1] and [Match 2] picks."` If 0, return: `"Sounds like [Top Last.fm Result]."`.
3.  **Caching Table (`artist_cache`):** Store API responses in Supabase so the APIs are only ever hit once per artist across the whole lifecycle of the app.

---

## 5. The Clash & Auto-Resolve Algorithm
*Engineer: This should be a utility function that runs dynamically on the frontend whenever votes change. It takes the array of `sets` and array of `votes` and returns the `flowwwww` timeline.*

**Algorithm Steps:**
1.  **Filter:** For the selected `night`, filter `sets` down to only those with `total_crew_votes > 0`.
2.  **Detect Clashes:** Sort by `start_time`. Iterate through to find overlaps (Set B `start_time` < Set A `end_time`). Group overlapping sets into `clash_groups`.
3.  **Resolve Clashes:** For each `clash_group`:
    *   *Check Overrides:* If a `flow_overrides` record exists for these exact clashing sets, output the `selected_set_id` as `Locked`.
    *   *Check Votes:* Find the set with the max votes. If there's a clear winner, output it as `Auto-picked` (can be overridden).
    *   *Tie-breaker 1:* If tied on votes, find the set with the earliest `vote.created_at`.
    *   *Tie-breaker 2:* If completely tied, pick the set with the earliest alphabetical `artist_name`. Mark as `Open` (requires user intervention).
4.  **Construct Timeline:** Return an ordered array of objects representing the final schedule, passing down states: `Locked`, `Auto-picked`, or `Open`.

---

## 6. Offline & UX Considerations
*   **Optimistic Updates:** When a user taps "Heart", the UI state must turn pink instantly. Send the Supabase mutation in the background. Do not await the database to change the UI.
*   **PWA Cache:** Configure `next-pwa` to aggressively cache `lineup.json` and all loaded Spotify artist images.
*   **Audio Previews:** iOS Safari requires a direct user interaction to play audio. In the expanded detail view, tapping the "Play" button initializes an `HTMLAudioElement`. Once initialized, subsequent swipes in the "Hype View" can theoretically swap the `.src` and auto-play without requiring a new tap per card.
*   **Realtime:** Use Supabase's `channel` subscriptions on the `votes` and `comments` tables. When Friend A votes, Friend B should see the dot appear on their screen without refreshing.

---
### *A Note from Product (You)*
*Hey! I wrote this PRD/Spec to handle as much of the thinking as possible so we can just focus on building. The golden rule is: if a feature feels like it's getting too complex, let's cut it. The goal is to make planning fun for the 3 of us, not to build a massive scalable startup.*