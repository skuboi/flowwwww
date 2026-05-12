"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, Heart, Music2, X, Youtube } from "lucide-react";
import { useMemo, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup } from "@/lib/data";
import {
  formatSetTime,
  formatTime,
  getArtistVibe,
  getSetVotes,
  getVoters,
  spotifyArtistUrl,
  stageFor,
  toggleVote,
  youtubeSearchUrl,
} from "@/lib/flow";
import type { AppState, FestivalSet, Night } from "@/lib/types";
import { DayTabs, FilterPill, ScreenTitle, softSpring, spring, tap } from "./ui";

/**
 * PickScreen — full-night calendar grid for direct selection.
 *
 * Layout mirrors the FlowScreen GridView (one column per stage, time runs
 * top-to-bottom) but shows EVERY set on the night, not just hearted ones.
 * Tapping a tile toggles its heart. Conflicts are visible immediately as
 * tiles at the same vertical position across columns.
 *
 * Trade-offs vs the Lineup screen:
 *   - Lineup: vertical scrollable list grouped by time block. Best for
 *     *exploring* unfamiliar artists with previews + comments.
 *   - Pick:   spatial calendar. Best when you already know your vibe and
 *     want to see overlaps the moment they exist.
 */

// Vertical density. Slightly less dense than the Flow grid because every
// tile here is interactive — tap targets need breathing room.
const PX_PER_MIN_COMPACT = 2.6;
const PX_PER_MIN_DETAIL = 5.0;

export function PickScreen({
  activeNight,
  setActiveNight,
  appState,
  setAppState,
  embedded = false,
}: {
  activeNight: Night;
  setActiveNight: (night: Night) => void;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  // See LineupScreen.embedded — same contract.
  embedded?: boolean;
}) {
  const crew = useCrew();
  const [zoomed, setZoomed] = useState(false);
  const [stageFilter, setStageFilter] = useState<string>("all");
  // Selected tile → opens a bottom sheet with vibe + Spotify/YouTube + heart
  // toggle. Single source of "show me details" since the grid tiles are too
  // small to surface previews / sounds-like inline.
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const pxPerMin = zoomed ? PX_PER_MIN_DETAIL : PX_PER_MIN_COMPACT;

  const stageEntries = Object.entries(lineup.stages);
  const heartedIds = useMemo(
    () => new Set(appState.votes.map((v) => v.set_id)),
    [appState.votes]
  );

  // Sets for the active night.
  const nightSets = useMemo(
    () => lineup.sets.filter((s) => s.night === activeNight),
    [activeNight]
  );

  // Active stages = those with any sets on this night, optionally narrowed.
  const activeStages = useMemo(() => {
    const stageIds = Array.from(new Set(nightSets.map((s) => s.stage_id)));
    const order = Object.keys(lineup.stages);
    const filtered = stageFilter === "all" ? stageIds : stageIds.filter((id) => id === stageFilter);
    return filtered
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((id) => ({ id, ...lineup.stages[id] }));
  }, [nightSets, stageFilter]);

  // Compute the night's time bounds, snapped to 30-min slots.
  const { nightStart, totalMinutes } = useMemo(() => {
    if (nightSets.length === 0) return { nightStart: 0, totalMinutes: 0 };
    const starts = nightSets.map((s) => Date.parse(s.start_time));
    const ends = nightSets.map((s) => Date.parse(s.end_time));
    const slot = 30 * 60 * 1000;
    const start30 = Math.floor(Math.min(...starts) / slot) * slot;
    const end30 = Math.ceil(Math.max(...ends) / slot) * slot;
    return { nightStart: start30, totalMinutes: (end30 - start30) / 60000 };
  }, [nightSets]);

  const totalHeight = totalMinutes * pxPerMin;

  const timeLabels = useMemo(() => {
    const labels: { ms: number; label: string; top: number }[] = [];
    const slot = 30 * 60 * 1000;
    for (let t = nightStart; t < nightStart + totalMinutes * 60000; t += slot) {
      labels.push({
        ms: t,
        label: formatTime(new Date(t).toISOString()),
        top: ((t - nightStart) / 60000) * pxPerMin,
      });
    }
    return labels;
  }, [nightStart, totalMinutes, pxPerMin]);

  function toggleHeart(setId: string) {
    setAppState((state) => ({
      ...state,
      votes: toggleVote(state.votes, state.activeUserId, setId),
    }));
  }

  const heartedCount = nightSets.filter((s) => heartedIds.has(s.id)).length;

  return (
    <div className="grid gap-4">
      {!embedded && (
        <ScreenTitle
          eyebrow="Direct selection"
          title="pick"
          copy="Every set as a tile, laid out on a stage-by-time grid. Tap to heart. Overlapping tiles across columns are your conflicts — visible at a glance."
        />
      )}
      {/* Sticky filters */}
      <div className="sticky top-0 z-20 -mx-4 overflow-hidden border-b border-white/10 bg-night/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <DayTabs activeNight={activeNight} setActiveNight={setActiveNight} />
        <div className="edge-fade-x -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <FilterPill active={stageFilter === "all"} color="#FFFFFF" label="All stages" onClick={() => setStageFilter("all")} />
          {stageEntries.map(([id, stage]) => (
            <FilterPill
              key={id}
              active={stageFilter === id}
              color={stage.color}
              label={stage.name}
              onClick={() => setStageFilter(stageFilter === id ? "all" : id)}
            />
          ))}
        </div>
      </div>

      {/* Counter + zoom toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.2em] text-white/65">
        <span>
          <span className="font-bold text-pink">{heartedCount}</span> / {nightSets.length} sets hearted
        </span>
        <motion.button
          whileTap={tap}
          transition={softSpring}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
            zoomed ? "bg-cyan text-night shadow-glowCyan" : "bg-white/10 text-white/70 hover:bg-white/15"
          }`}
          onClick={() => setZoomed((v) => !v)}
        >
          {zoomed ? "− compact" : "+ zoom in"}
        </motion.button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-night/60">
        <div
          style={{
            display: "grid",
            // Slightly wider columns than Flow's GridView since tiles need
            // room for artist name + heart state.
            gridTemplateColumns: `2.75rem repeat(${activeStages.length}, minmax(${zoomed ? "7.5rem" : "5.5rem"}, 1fr))`,
            minWidth: `${2.75 + activeStages.length * (zoomed ? 7.5 : 5.5)}rem`,
          }}
        >
          {/* Stage headers */}
          <div className="sticky top-0 z-20 border-b border-white/10 bg-night/95 p-1" />
          {activeStages.map((stage) => (
            <div key={stage.id} className="sticky top-0 z-20 border-b border-l border-white/10 bg-night/95 px-1 py-2 text-center">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em]" style={{ color: stage.color }}>
                {stage.short}
              </p>
            </div>
          ))}

          {/* Time labels column */}
          <div className="relative" style={{ height: totalHeight }}>
            {timeLabels.map(({ ms, label, top }) => (
              <div key={ms} className="absolute right-1 text-[0.7rem] font-bold leading-none text-white/60" style={{ top }}>
                {label}
              </div>
            ))}
          </div>

          {/* Stage columns */}
          {activeStages.map((stage) => {
            const stageSets = nightSets.filter((s) => s.stage_id === stage.id);
            return (
              <div key={stage.id} className="relative border-l border-white/[0.06]" style={{ height: totalHeight }}>
                {/* Half-hour gridlines */}
                {timeLabels.map(({ ms, top }) => (
                  <div key={ms} className="absolute inset-x-0 border-t border-white/[0.04]" style={{ top }} />
                ))}
                {stageSets.map((set) => (
                  <PickTile
                    key={set.id}
                    set={set}
                    nightStart={nightStart}
                    pxPerMin={pxPerMin}
                    stageColor={stage.color}
                    isHearted={heartedIds.has(set.id)}
                    voters={getVoters(set.id, appState.votes, crew)}
                    onTap={() => setSelectedSetId(set.id)}
                    onQuickHeart={() => toggleHeart(set.id)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail bottom sheet — opens on tile tap. Houses the heart toggle +
          full vibe block + Spotify/YouTube links so the calendar grid stays
          visually clean while still surfacing per-set information. */}
      <AnimatePresence>
        {selectedSetId && (
          <PickDetailSheet
            set={lineup.sets.find((s) => s.id === selectedSetId)!}
            appState={appState}
            isHearted={heartedIds.has(selectedSetId)}
            onToggleHeart={() => toggleHeart(selectedSetId)}
            onClose={() => setSelectedSetId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A single time-positioned tile.
 *
 * UX:
 *   - Tap the tile body → opens the detail bottom sheet (vibe + Spotify links
 *     + heart toggle). Same pattern as the Lineup row.
 *   - Tap the small heart corner badge → toggles heart directly without
 *     opening the sheet (one-tap quick add for veterans who know the artist).
 *
 * Visual states (deliberately stripped down — see PickScreen header comment):
 *   HEARTED   — solid stage-colored fill at full saturation + thick white
 *               inset ring. Reads "stamped" on the calendar.
 *   AVAILABLE — dim stage-colored bar (12% opacity tint), bright on hover.
 *               No more "would clash" ring or ⚡ icon — conflicts are visible
 *               spatially (same row across columns) and the noise was
 *               dominating the grid.
 */
function PickTile({
  set,
  nightStart,
  pxPerMin,
  stageColor,
  isHearted,
  voters,
  onTap,
  onQuickHeart,
}: {
  set: FestivalSet;
  nightStart: number;
  pxPerMin: number;
  stageColor: string;
  isHearted: boolean;
  voters: { id: string; emoji: string; color: string }[];
  onTap: () => void;
  onQuickHeart: () => void;
}) {
  const startMs = Date.parse(set.start_time);
  const endMs = Date.parse(set.end_time);
  const top = ((startMs - nightStart) / 60000) * pxPerMin;
  const height = ((endMs - startMs) / 60000) * pxPerMin;
  const showTime = height > 38;
  const showVoters = height > 56 && voters.length > 0;

  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={spring}
      // The tile container is the tap-to-open-detail surface. The corner
      // heart badge is its own button that stops propagation.
      role="button"
      tabIndex={0}
      onClick={onTap}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onTap(); }}
      className={`absolute left-0.5 right-0.5 cursor-pointer overflow-hidden rounded-md p-1 text-left transition-all ${
        isHearted
          ? "shadow-glowPink ring-2 ring-white/90 ring-inset z-10"
          : "border-l-[3px] hover:brightness-150 opacity-90 hover:opacity-100"
      }`}
      style={{
        top,
        height: Math.max(height, 22),
        backgroundColor: isHearted ? stageColor : stageColor + "1A",
        borderLeftColor: isHearted ? undefined : stageColor,
      }}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-1">
          <p
            className={`min-w-0 flex-1 font-bold leading-tight ${
              height > 60 ? "text-[0.78rem]" : "text-[0.7rem]"
            } ${isHearted ? "text-night drop-shadow-[0_1px_0_rgba(255,255,255,0.4)]" : "text-white"}`}
            // line-clamp-2 lets long artist names wrap to a second line so
            // they're not cut off — the previous `truncate` chopped names
            // like "Doctor P B2B Flux Pavilion B2B FuntCase" mid-word.
            style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {set.artist_name}
          </p>
          {/* Quick-heart corner badge. Stops propagation so the tile's
              detail-open handler doesn't also fire. Always visible so it's
              discoverable (not just hover, which doesn't exist on touch). */}
          <button
            onClick={(e) => { e.stopPropagation(); onQuickHeart(); }}
            aria-label={isHearted ? "Remove from flow" : "Add to flow"}
            className={`grid size-5 shrink-0 place-items-center rounded-full transition ${
              isHearted
                ? "bg-pink shadow-glowPink"
                : "border border-white/30 bg-white/10 hover:border-pink hover:bg-pink/20"
            }`}
          >
            {isHearted ? <Check size={11} strokeWidth={3.5} className="text-night" /> : <Heart size={10} className="text-white/85" />}
          </button>
        </div>
        {showTime && (
          <p
            className={`mt-0.5 truncate text-[0.6rem] font-bold leading-tight ${
              isHearted ? "text-night/80" : "text-white/65"
            }`}
          >
            {formatSetTime(set)}
          </p>
        )}
        {showVoters && (
          <div className="flex gap-0.5">
            {voters.map((m) => (
              <span key={m.id} className="text-[0.7rem]">{m.emoji}</span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Bottom-sheet detail panel for the Pick grid. Shows the vibe block,
 * Spotify/YouTube links, and a primary heart toggle. Same pattern as the
 * Flow GridView's SetDetailPanel — scrim + spring slide-up + click-outside
 * dismiss — so the interaction feels familiar.
 */
function PickDetailSheet({
  set,
  appState,
  isHearted,
  onToggleHeart,
  onClose,
}: {
  set: FestivalSet;
  appState: AppState;
  isHearted: boolean;
  onToggleHeart: () => void;
  onClose: () => void;
}) {
  const crew = useCrew();
  const stage = stageFor(set, lineup.stages);
  const voters = getVoters(set.id, appState.votes, crew);
  const vibe = getArtistVibe(set, lineup.stages);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={spring}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-lg rounded-t-[2rem] border-t border-white/15 bg-night/95 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4 backdrop-blur-2xl"
      >
        {/* Drag-handle visual cue */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: stage.color }}>
              {stage.name} · {formatSetTime(set)}
            </p>
            <h3 className="mt-1 font-display text-2xl font-black leading-tight tracking-tight text-white">
              {set.artist_name}
            </h3>
            {voters.length > 0 && (
              <div className="mt-2 flex -space-x-1.5">
                {voters.map((m) => (
                  <span key={m.id} className="grid size-7 place-items-center rounded-full border-2 bg-night text-sm" style={{ borderColor: m.color }}>
                    {m.emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-white/70 transition hover:border-white/30 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Vibe block */}
        <div className="mt-3 rounded-2xl border border-cyan/35 bg-night/60 p-3 shadow-[inset_0_0_28px_rgba(0,255,220,0.08)]">
          {vibe.genres && (
            <p className="mb-1 text-[0.65rem] font-black uppercase tracking-[0.22em] text-cyan/85">
              {vibe.genres}
            </p>
          )}
          <p className="text-sm font-bold leading-6 text-white/95">{vibe.soundsLike}</p>
        </div>

        {/* Heart toggle — primary action */}
        <motion.button
          whileTap={tap}
          transition={softSpring}
          onClick={() => { onToggleHeart(); onClose(); }}
          className={`mt-3 w-full rounded-2xl px-4 py-3 font-display text-base font-black ${
            isHearted
              ? "border border-white/20 bg-white/10 text-white/85"
              : "bg-pink text-night shadow-glowPink"
          }`}
        >
          {isHearted ? "✕ Remove from flow" : "♥ Add to flow"}
        </motion.button>

        {/* Listen-elsewhere CTAs */}
        <div className="mt-3 flex gap-2">
          <a
            href={spotifyArtistUrl(set.artist_name, set.spotify_id)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#1DB954] px-4 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(29,185,84,0.35)] transition hover:scale-[1.02]"
          >
            <Music2 size={16} /> Spotify
            <ExternalLink size={12} className="opacity-70" />
          </a>
          <a
            href={youtubeSearchUrl(set.artist_name)}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40 hover:bg-white/10"
          >
            <Youtube size={16} /> YouTube
            <ExternalLink size={12} className="opacity-60" />
          </a>
        </div>
      </motion.div>
    </>
  );
}
