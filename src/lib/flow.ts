/**
 * Flow resolution + presentation helpers for flowwwww.
 *
 * This module is the single source of truth for:
 *   1. Time formatting (PT display from UTC ISO strings).
 *   2. Vote queries (who hearted a given set).
 *   3. Clash detection + flow resolution (PRD §6).
 *   4. Timeline interstitials (gap / movement alerts + gap-fill suggestions).
 *
 * Imported by AppShell, LineupScreen, FlowScreen, and GridView.
 */

import type {
  AppState,
  AttendOverride,
  CrewMember,
  FestivalSet,
  FlowItem,
  FlowOverride,
  FlowState,
  Night,
  Stage,
  Vote,
} from "./types";

// ---------- Time helpers --------------------------------------------------

const PT_TZ = "America/Los_Angeles";

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: PT_TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** "10:07 PM" — single-clock-time display in PT for any ISO UTC string. */
export function formatTime(iso: string): string {
  // Intl returns "10:07 PM" with a NBSP between minute and AM/PM on some
  // engines. Normalise to a regular space so downstream layout stays stable.
  return timeFmt.format(new Date(iso)).replace(/\u202F| /g, " ");
}

/**
 * "10:07–11:19 PM" or "11:19 PM–12:32 AM" — combined display when both
 * endpoints share the same AM/PM marker, omits the redundant first marker.
 */
export function formatSetTime(set: FestivalSet): string {
  const start = formatTime(set.start_time);
  const end = formatTime(set.end_time);
  // Strip trailing " AM"/" PM" off the start when both endpoints match,
  // matching the EDC schedule shorthand ("10:07–11:19 PM").
  const startMarker = start.endsWith("AM") ? "AM" : "PM";
  const endMarker = end.endsWith("AM") ? "AM" : "PM";
  if (startMarker === endMarker) {
    const startNoMarker = start.replace(/\s?(AM|PM)$/, "");
    return `${startNoMarker}–${end}`;
  }
  return `${start}–${end}`;
}

/**
 * Same as formatSetTime, but uses the crew's "arrive late / leave early"
 * trims so the timeline / wallpaper reflects the *actual* attendance window
 * the crew committed to — not the artist's full set length.
 *
 * Example: a 1:00–2:00 AM set with arrive_offset=15 and depart_offset=10
 * formats as "1:15–1:50 AM" instead of "1:00–2:00 AM".
 */
export function formatAttendTime(
  set: FestivalSet,
  attendOverrides: AttendOverride[] = []
): string {
  const o = attendOverrides.find((a) => a.set_id === set.id);
  if (!o || (o.arrive_offset === 0 && o.depart_offset === 0)) {
    return formatSetTime(set);
  }
  const startIso = new Date(Date.parse(set.start_time) + o.arrive_offset * 60000).toISOString();
  const endIso = new Date(Date.parse(set.end_time) - o.depart_offset * 60000).toISOString();
  // Reuse the same merging logic by routing through formatTime + the AM/PM
  // collapse rule from formatSetTime.
  const start = formatTime(startIso);
  const end = formatTime(endIso);
  const startMarker = start.endsWith("AM") ? "AM" : "PM";
  const endMarker = end.endsWith("AM") ? "AM" : "PM";
  if (startMarker === endMarker) {
    const startNoMarker = start.replace(/\s?(AM|PM)$/, "");
    return `${startNoMarker}–${end}`;
  }
  return `${start}–${end}`;
}

/** Returns true if the user has a partial-attendance trim on this set. */
export function hasAttendTrim(
  set: FestivalSet,
  attendOverrides: AttendOverride[] = []
): boolean {
  const o = attendOverrides.find((a) => a.set_id === set.id);
  return !!o && (o.arrive_offset > 0 || o.depart_offset > 0);
}

/** ISO-formatted effective start for sorting / display ("attending from" time). */
export function attendStartIso(
  set: FestivalSet,
  attendOverrides: AttendOverride[] = []
): string {
  const o = attendOverrides.find((a) => a.set_id === set.id);
  return new Date(Date.parse(set.start_time) + (o?.arrive_offset ?? 0) * 60000).toISOString();
}

/** ISO-formatted effective end for sorting / display ("attending until" time). */
export function attendEndIso(
  set: FestivalSet,
  attendOverrides: AttendOverride[] = []
): string {
  const o = attendOverrides.find((a) => a.set_id === set.id);
  return new Date(Date.parse(set.end_time) - (o?.depart_offset ?? 0) * 60000).toISOString();
}

/** PT hour (0-23) for an ISO UTC string. */
function ptHour(iso: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: PT_TZ,
    hour: "numeric",
    hour12: false,
  }).format(new Date(iso));
  // Intl's hour with hour12:false returns "0".."23" (or "24" on some engines for midnight).
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

/**
 * Time block grouping for the Lineup screen (PRD §5.2).
 *   Early       — gates open through ~10pm PT (PT 19:00–22:00)
 *   Peak        — 10pm through ~2am PT
 *   After Hours — 2am through close + any other AM/afternoon hour
 *
 * Boundaries are strictly *evening* (PT ≥ 19) for "Early" so that an
 * accidental AM-side time can never sort into the opening block. EDC has no
 * pre-7pm sets, so this is purely defensive against future data quirks.
 */
export function getTimeBlock(set: FestivalSet): "Early" | "Peak" | "After Hours" {
  const h = ptHour(set.start_time);
  if (h >= 19 && h < 22) return "Early";
  if (h >= 22 || h < 2) return "Peak";
  return "After Hours";
}

// ---------- Stage / vote / voter lookups ---------------------------------

/** Resolve a set's stage definition. Falls back to a placeholder stage
 *  rather than throwing — keeps the UI robust if the lineup is mid-edit. */
export function stageFor(set: FestivalSet, stages: Record<string, Stage>): Stage {
  return (
    stages[set.stage_id] ?? {
      name: set.stage_id,
      short: set.stage_id.slice(0, 3).toUpperCase(),
      color: "#FFFFFF",
    }
  );
}

export function getSetVotes(setId: string, votes: Vote[]): Vote[] {
  return votes.filter((v) => v.set_id === setId);
}

export function getVoters(setId: string, votes: Vote[], crew: CrewMember[]): CrewMember[] {
  const ids = new Set(getSetVotes(setId, votes).map((v) => v.user_id));
  return crew.filter((m) => ids.has(m.id));
}

/** Toggle a vote — if (userId, setId) exists, remove; otherwise append. */
export function toggleVote(votes: Vote[], userId: string, setId: string): Vote[] {
  const existing = votes.find((v) => v.user_id === userId && v.set_id === setId);
  if (existing) return votes.filter((v) => v !== existing);
  return [...votes, { user_id: userId, set_id: setId, created_at: new Date().toISOString() }];
}

// ---------- Clash detection ----------------------------------------------

/**
 * Effective start/end times for a set, accounting for the crew's attendance
 * trim (arrive late / leave early). Used by clash detection so that a 5-min
 * tail trim can resolve an otherwise-overlapping conflict — letting the crew
 * "squeeze" more sets into a night.
 */
function effectiveTimes(
  set: FestivalSet,
  attendOverrides: AttendOverride[]
): { start: number; end: number } {
  const o = attendOverrides.find((a) => a.set_id === set.id);
  const start = Date.parse(set.start_time) + (o?.arrive_offset ?? 0) * 60000;
  const end = Date.parse(set.end_time) - (o?.depart_offset ?? 0) * 60000;
  return { start, end };
}

function overlaps(
  a: FestivalSet,
  b: FestivalSet,
  attendOverrides: AttendOverride[] = []
): boolean {
  if (a.id === b.id) return false;
  const ea = effectiveTimes(a, attendOverrides);
  const eb = effectiveTimes(b, attendOverrides);
  return ea.start < eb.end && eb.start < ea.end;
}

/** True if `set` overlaps any other hearted set, after attendance trims. */
export function hasClash(
  set: FestivalSet,
  allSets: FestivalSet[],
  votes: Vote[],
  attendOverrides: AttendOverride[] = []
): boolean {
  const heartedIds = new Set(votes.map((v) => v.set_id));
  if (!heartedIds.has(set.id)) return false;
  for (const other of allSets) {
    if (other.id === set.id) continue;
    if (!heartedIds.has(other.id)) continue;
    if (overlaps(set, other, attendOverrides)) return true;
  }
  return false;
}

// ---------- Flow resolution (PRD §6) -------------------------------------

function compareByPriority(
  a: FestivalSet,
  b: FestivalSet,
  votes: Vote[]
): number {
  // 1. More hearts wins.
  const va = getSetVotes(a.id, votes).length;
  const vb = getSetVotes(b.id, votes).length;
  if (va !== vb) return vb - va;
  // 2. Earliest heart wins (PRD §6 tiebreak #1).
  const earliestA = Math.min(
    ...getSetVotes(a.id, votes).map((v) => Date.parse(v.created_at)),
    Infinity
  );
  const earliestB = Math.min(
    ...getSetVotes(b.id, votes).map((v) => Date.parse(v.created_at)),
    Infinity
  );
  if (earliestA !== earliestB) return earliestA - earliestB;
  // 3. Earlier start time, then id (deterministic fallback — flagged Open below).
  const sa = Date.parse(a.start_time);
  const sb = Date.parse(b.start_time);
  if (sa !== sb) return sa - sb;
  return a.id.localeCompare(b.id);
}

/**
 * Build the night's flow timeline.
 *
 * Algorithm — greedy schedule construction:
 *   1. Rank hearted sets by priority (votes desc → earliest heart → start time).
 *   2. "Override winners" (sets the crew manually swapped in) are promoted to
 *      the top of the ranking so they're locked before their original rivals.
 *   3. Walk the ranking. For each set, if it overlaps any already-locked
 *      winner (after attendance trims), it's a ghost of that winner. Otherwise
 *      it becomes a new locked winner.
 *
 * Why greedy / pairwise (not "clash groups"):
 *   The previous BFS-cluster algorithm lumped transitively-connected sets
 *   into one group, so A overlapping B and B overlapping C made A and C share
 *   a "clash" even when their times didn't touch. Worse, the follow-up
 *   "direct overlaps only" pass dropped non-conflicting sets like C entirely.
 *   Greedy preserves any hearted set that *individually* doesn't conflict
 *   with a higher-priority winner — which is exactly what the user wants.
 *
 * @param allSets         the full lineup
 * @param votes           every crew member's hearts
 * @param overrides       manual swap overrides
 * @param night           the night to filter to
 * @param attendOverrides arrive-late / leave-early offsets, applied to
 *                        clash detection so trims can resolve overlaps.
 */
export function resolveFlow(
  allSets: FestivalSet[],
  votes: Vote[],
  overrides: FlowOverride[],
  night: Night,
  attendOverrides: AttendOverride[]
): FlowItem[] {
  const heartedIds = new Set(votes.map((v) => v.set_id));
  const hearted = allSets.filter((s) => s.night === night && heartedIds.has(s.id));

  // Sets the crew manually picked in a swap. We promote these to the top of
  // the priority ranking so they're locked first; their original conflict
  // rivals then become their ghosts.
  const overrideWinners = new Set(
    overrides
      .filter((o) => heartedIds.has(o.selected_set_id))
      .map((o) => o.selected_set_id)
  );

  // Sort by override-promotion first, then natural priority.
  const ranked = [...hearted].sort((a, b) => {
    const aPromoted = overrideWinners.has(a.id) ? 0 : 1;
    const bPromoted = overrideWinners.has(b.id) ? 0 : 1;
    if (aPromoted !== bPromoted) return aPromoted - bPromoted;
    return compareByPriority(a, b, votes);
  });

  // Greedy: for each set in priority order, attach to a colliding locked
  // winner (becomes ghost) or lock it as its own item.
  type Slot = { winner: FestivalSet; losers: FestivalSet[] };
  const slots: Slot[] = [];

  for (const s of ranked) {
    const conflictSlot = slots.find((slot) => overlaps(s, slot.winner, attendOverrides));
    if (conflictSlot) {
      conflictSlot.losers.push(s);
    } else {
      slots.push({ winner: s, losers: [] });
    }
  }

  // Convert to FlowItems with a state + reason.
  const items: FlowItem[] = slots.map(({ winner, losers }) => {
    let state: FlowState = "Locked";
    let reason = "No conflict.";

    if (losers.length > 0) {
      if (overrideWinners.has(winner.id)) {
        state = "Auto-picked";
        reason = "Manually swapped by the crew.";
      } else {
        const winnerVotes = getSetVotes(winner.id, votes).length;
        // Did any loser tie this winner on votes AND on earliest-heart?
        const winnerEarliest = Math.min(
          ...getSetVotes(winner.id, votes).map((v) => Date.parse(v.created_at)),
          Infinity
        );
        const truelyTied = losers.some((l) => {
          const lv = getSetVotes(l.id, votes).length;
          if (lv !== winnerVotes) return false;
          const le = Math.min(
            ...getSetVotes(l.id, votes).map((v) => Date.parse(v.created_at)),
            Infinity
          );
          return le === winnerEarliest;
        });
        if (truelyTied) {
          state = "Open";
          reason = "Even split — crew needs to pick.";
        } else {
          state = "Auto-picked";
          reason = `Most hearts (${winnerVotes}) in this conflict.`;
        }
      }
    }

    return {
      set: winner,
      state,
      clashingSets: losers,
      loserSets: losers,
      reason,
    };
  });

  // Chronological timeline order for display.
  items.sort((a, b) => Date.parse(a.set.start_time) - Date.parse(b.set.start_time));

  return items;
}

// ---------- Headliner ----------------------------------------------------

/** Set with the highest vote count in the timeline; undefined if empty. */
export function getHeadliner(items: FlowItem[], votes: Vote[]): string | undefined {
  if (items.length === 0) return undefined;
  let best: { id: string; count: number } | null = null;
  for (const item of items) {
    const count = getSetVotes(item.set.id, votes).length;
    if (!best || count > best.count) best = { id: item.set.id, count };
  }
  return best?.id;
}

// ---------- External links ----------------------------------------------

/**
 * Deep link to an artist's Spotify page.
 *
 * If the artist has a known Spotify ID (curated in data/artist-annotations.json
 * via an optional `spotify_id` field), we link directly to /artist/{id} which
 * opens the actual artist profile in the Spotify app or web player.
 *
 * For artists without a curated ID (the long tail), we fall back to the
 * search-filtered-to-artists URL. This still works universally — Spotify
 * routes the search to the artist tab — but it shows a results page rather
 * than landing directly on the profile. Adding more IDs to annotations
 * incrementally upgrades coverage without code changes.
 *
 * Why we don't auto-resolve IDs: Spotify's resolution endpoints require
 * OAuth (PRD §11.3 — deferred), so static curation is the no-API path.
 */
export function spotifyArtistUrl(artistName: string, spotifyId?: string): string {
  if (spotifyId && /^[A-Za-z0-9]{22}$/.test(spotifyId)) {
    return `https://open.spotify.com/artist/${spotifyId}`;
  }
  // Strip set-context suffixes that confuse Spotify search:
  //   "Above & Beyond (Sunrise Set)" → "Above & Beyond"
  //   "Porter Robinson (DJ Set)"     → "Porter Robinson"
  //   "BUNT. (In The Round)"         → "BUNT."
  // B2B artists are kept as-is; Spotify will land on the first artist's profile.
  const cleaned = artistName.replace(/\s*\([^)]+\)\s*$/, "").trim();
  return `https://open.spotify.com/search/${encodeURIComponent(cleaned)}/artists`;
}

/** YouTube search fallback — useful for artists Spotify doesn't have. */
export function youtubeSearchUrl(artistName: string): string {
  const cleaned = artistName.replace(/\s*\([^)]+\)\s*$/, "").trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(cleaned)}`;
}

/**
 * Build a richer single-paragraph "vibe" description from the static
 * lineup data. Combines (in order): genres → sounds-like line → stage +
 * night context. Every clause is optional so this works even for the
 * deepest long tail where sounds_like is just a placeholder.
 *
 *   "Tech House · House — Sounds like Chris Lake at a pool party.
 *    Playing kineticFIELD, Friday night."
 *
 * Used by the Lineup expanded-row "Vibe" card (replaced the broken Spotify
 * preview block — see PRD §7 Tier 2 fallback).
 */
export function getArtistVibe(
  set: FestivalSet,
  stages: Record<string, Stage>
): { genres: string; soundsLike: string; context: string } {
  const stage = stageFor(set, stages);
  const nightLabel = set.night.charAt(0).toUpperCase() + set.night.slice(1);
  return {
    genres: set.genres.length > 0 ? set.genres.join(" · ") : "",
    soundsLike: set.sounds_like,
    context: `Playing ${stage.name}, ${nightLabel} night${set.night === "saturday" ? "" : ""} from ${formatTime(set.start_time)}.`,
  };
}

/**
 * Approximate walk time in minutes between any two stages at the Las Vegas
 * Motor Speedway (PRD §11.2). Hand-estimated from the festival map; symmetric.
 * If a pair isn't listed, falls back to 8 min (typical mid-distance).
 *
 * Stage adjacency on the EDC LV speedway, roughly:
 *   kineticFIELD (mainstage center)  ↔  circuitGROUNDS (left)  ↔  bassPOD (far left)
 *   kineticFIELD                     ↔  cosmicMEADOW (right)   ↔  neonGARDEN (far right)
 *   wasteland (back)                                            ↔  quantumVALLEY (back)
 *   stereoBLOOM, bionicJUNGLE (perimeter)
 */
const WALK_MINUTES: Record<string, Record<string, number>> = {
  kinetic:   { circuit: 6,  cosmic: 6,  neon: 12, basspod: 11, wasteland: 14, quantum: 16, stereo: 9,  bionic: 10 },
  circuit:   { kinetic: 6,  cosmic: 11, neon: 15, basspod: 6,  wasteland: 12, quantum: 18, stereo: 11, bionic: 12 },
  cosmic:    { kinetic: 6,  circuit: 11, neon: 7,  basspod: 13, wasteland: 16, quantum: 14, stereo: 9,  bionic: 8 },
  neon:      { kinetic: 12, circuit: 15, cosmic: 7,  basspod: 18, wasteland: 19, quantum: 11, stereo: 12, bionic: 9 },
  basspod:   { kinetic: 11, circuit: 6,  cosmic: 13, neon: 18,    wasteland: 9,  quantum: 17, stereo: 14, bionic: 13 },
  wasteland: { kinetic: 14, circuit: 12, cosmic: 16, neon: 19,    basspod: 9,    quantum: 8,  stereo: 17, bionic: 15 },
  quantum:   { kinetic: 16, circuit: 18, cosmic: 14, neon: 11,    basspod: 17,   wasteland: 8, stereo: 13, bionic: 11 },
  stereo:    { kinetic: 9,  circuit: 11, cosmic: 9,  neon: 12,    basspod: 14,   wasteland: 17, quantum: 13, bionic: 7 },
  bionic:    { kinetic: 10, circuit: 12, cosmic: 8,  neon: 9,     basspod: 13,   wasteland: 15, quantum: 11, stereo: 7 },
};

const WALK_FALLBACK_MIN = 8;

/** Minutes to walk from stage A → stage B. Symmetric, with sensible fallback. */
export function walkMinutes(fromStageId: string, toStageId: string): number {
  if (fromStageId === toStageId) return 0;
  return (
    WALK_MINUTES[fromStageId]?.[toStageId] ??
    WALK_MINUTES[toStageId]?.[fromStageId] ??
    WALK_FALLBACK_MIN
  );
}

export type GapSuggestion = {
  set: FestivalSet;
  reason: string;
};

export type Interstitial =
  | { kind: "gap"; afterSetId: string; message: string; suggestions?: GapSuggestion[] }
  | { kind: "movement"; afterSetId: string; message: string };

const GAP_THRESHOLD_MIN = 30;

/**
 * Build alerts that sit between consecutive flow items:
 *   - "gap"      — empty space > 30 min between two sets, with up to 3
 *                   suggestions for filling it from the broader lineup
 *                   (other artists playing during the gap window).
 *   - "movement" — back-to-back sets at different stages (heads-up that
 *                   the crew has to walk; PRD §11.2 walk-time matrix is
 *                   not yet wired in but the reminder still helps).
 */
export function getTimelineInterstitials(
  items: FlowItem[],
  lineupStages: Record<string, Stage>,
  allSets: FestivalSet[],
  votes: Vote[],
  night: Night
): Interstitial[] {
  const out: Interstitial[] = [];
  const heartedIds = new Set(votes.map((v) => v.set_id));

  for (let i = 0; i < items.length - 1; i++) {
    const cur = items[i];
    const next = items[i + 1];
    const curEnd = Date.parse(cur.set.end_time);
    const nextStart = Date.parse(next.set.start_time);
    const gapMin = (nextStart - curEnd) / 60000;

    if (gapMin >= GAP_THRESHOLD_MIN) {
      // Find candidate gap-fill sets: same night, not already hearted, and
      // their start time falls inside the gap window (so the crew can catch
      // at least the start of the suggestion).
      const candidates = allSets
        .filter(
          (s) =>
            s.night === night &&
            !heartedIds.has(s.id) &&
            Date.parse(s.start_time) >= curEnd &&
            Date.parse(s.start_time) < nextStart
        )
        // Prefer suggestions that won't make the crew sprint to the next set.
        .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time))
        .slice(0, 3)
        .map<GapSuggestion>((s) => ({
          set: s,
          reason: `Plays during your ${Math.round(gapMin)}-min gap.`,
        }));

      out.push({
        kind: "gap",
        afterSetId: cur.set.id,
        message: `${Math.round(gapMin)}-min gap before ${next.set.artist_name}.`,
        suggestions: candidates.length > 0 ? candidates : undefined,
      });
    } else if (cur.set.stage_id !== next.set.stage_id) {
      const walk = walkMinutes(cur.set.stage_id, next.set.stage_id);
      // gap is < 30 min here. The "tight" flag fires when there's no buffer
      // after walking — e.g. cur ends at 9:00, walk = 8 min, next starts 9:05
      // means you're 3 min late. UI uses this to escalate to acid colour.
      const buffer = Math.round(gapMin) - walk;
      const stageName = lineupStages?.[next.set.stage_id]?.name ?? next.set.stage_id;
      out.push({
        kind: "movement",
        afterSetId: cur.set.id,
        message:
          buffer < 0
            ? `${walk}-min walk to ${stageName} — you'll be ~${Math.abs(buffer)} min late.`
            : `${walk}-min walk to ${stageName}${buffer < 5 ? " — tight, head out at the last drop." : `, ${buffer} min buffer.`}`,
      });
    }
  }

  return out;
}

// Export a generic AppState marker for callers that only want to import the
// type alongside flow helpers.
export type { AppState };
