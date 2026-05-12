import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Heart, MessageCircle, Music2, Youtube } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup } from "@/lib/data";
import {
  formatSetTime,
  getArtistVibe,
  getSetVotes,
  getTimeBlock,
  getVoters,
  hasClash,
  spotifyArtistUrl,
  stageFor,
  toggleVote,
  youtubeSearchUrl,
} from "@/lib/flow";
import type { AppState, FestivalSet, Night } from "@/lib/types";
import { DayTabs, FilterPill, Pill, ScreenTitle, softSpring, spring, tap } from "./ui";

const blocks = ["Early", "Peak", "After Hours"];

export function LineupScreen({
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
  // When `embedded` is true, the parent (LineupTab) supplies the screen
  // title + view-mode toggle. We skip our own <ScreenTitle> so the page
  // header isn't doubled up.
  embedded?: boolean;
}) {
  const [stageFilter, setStageFilter] = useState("all");
  const [heartedOnly, setHeartedOnly] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");

  const crew = useCrew();

  const stageEntries = Object.entries(lineup.stages);
  const heartedSetIds = new Set(appState.votes.map((v) => v.set_id));
  const filteredSets = lineup.sets
    .filter((set) => set.night === activeNight && (stageFilter === "all" || set.stage_id === stageFilter))
    .filter((set) => !heartedOnly || heartedSetIds.has(set.id))
    .sort((a, b) => Date.parse(a.start_time) - Date.parse(b.start_time));

  const grouped = blocks.map((block) => ({
    block,
    sets: filteredSets.filter((set) => getTimeBlock(set) === block)
  }));

  function toggleHeart(setId: string) {
    setAppState((state) => ({
      ...state,
      votes: toggleVote(state.votes, state.activeUserId, setId)
    }));
  }

  function submitComment(event: FormEvent<HTMLFormElement>, setId: string) {
    event.preventDefault();
    const content = commentDraft.trim();
    if (!content) return;
    setAppState((state) => ({
      ...state,
      comments: [
        ...state.comments,
        {
          id: `${setId}-${Date.now()}`,
          user_id: state.activeUserId,
          set_id: setId,
          content,
          created_at: new Date().toISOString()
        }
      ]
    }));
    setCommentDraft("");
  }

  return (
    <div className="grid gap-4">
      {!embedded && (
        <ScreenTitle eyebrow="Voting surface" title="Lineup" copy="Tap rows for previews, comments, and sounds-like context. Hearts commit instantly." />
      )}
      <div className="sticky top-0 z-20 -mx-4 overflow-hidden border-b border-white/10 bg-night/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <DayTabs activeNight={activeNight} setActiveNight={setActiveNight} />
        {/* Edge-fade mask hints that the filter pill row scrolls horizontally
            without adding visual weight — see .edge-fade-x in globals.css. */}
        <div className="edge-fade-x -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <FilterPill active={stageFilter === "all" && !heartedOnly} color="#FFFFFF" label="All stages" onClick={() => { setStageFilter("all"); setHeartedOnly(false); }} />
          <FilterPill active={heartedOnly} color="#FF3DCB" label="❤️ Hearted" onClick={() => { setHeartedOnly(!heartedOnly); if (!heartedOnly) setStageFilter("all"); }} />
          {stageEntries.map(([id, stage]) => (
            <FilterPill
              key={id}
              active={stageFilter === id}
              color={stage.color}
              label={stage.name}
              onClick={() => { setStageFilter(id); setHeartedOnly(false); }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-5">
        {grouped.map(({ block, sets }) =>
          sets.length > 0 ? (
            <section key={block} className="grid gap-2">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold text-white">{block}</h2>
                <span className="h-px flex-1 bg-gradient-to-r from-pink/50 to-transparent" />
                <span className="text-xs uppercase tracking-[0.22em] text-white/55">{sets.length} sets</span>
              </div>
              <div className="grid gap-2">
                {sets.map((set, index) => {
                  const expanded = expandedSetId === set.id;
                  return (
                    <LineupRow
                      key={set.id}
                      index={index}
                      set={set}
                      expanded={expanded}
                      appState={appState}
                      commentDraft={commentDraft}
                      setCommentDraft={setCommentDraft}
                      clashing={getSetVotes(set.id, appState.votes).length > 0 && hasClash(set, lineup.sets, appState.votes, appState.attendOverrides)}
                      onSubmitComment={(event) => submitComment(event, set.id)}
                      onToggle={() => setExpandedSetId(expanded ? null : set.id)}
                      onToggleHeart={() => toggleHeart(set.id)}
                    />
                  );
                })}
              </div>
            </section>
          ) : null
        )}
      </div>
    </div>
  );
}

function LineupRow({
  set,
  index,
  expanded,
  appState,
  commentDraft,
  setCommentDraft,
  clashing,
  onSubmitComment,
  onToggle,
  onToggleHeart,
}: {
  set: FestivalSet;
  index: number;
  expanded: boolean;
  appState: AppState;
  commentDraft: string;
  setCommentDraft: (value: string) => void;
  clashing: boolean;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  onToggle: () => void;
  onToggleHeart: () => void;
}) {
  const crew = useCrew();
  const stage = stageFor(set, lineup.stages);
  const voters = getVoters(set.id, appState.votes, crew);
  const isHearted = appState.votes.some((vote) => vote.user_id === appState.activeUserId && vote.set_id === set.id);
  const comments = appState.comments.filter((comment) => comment.set_id === set.id);

  // Heart-burst lifecycle: a CSS-keyframed expanding ring (see .heart-burst in
  // globals.css). State is bumped each tap so React can re-mount the wrapper
  // and replay the animation without unmounting the row.
  const [burstKey, setBurstKey] = useState(0);
  function handleHeart(event: React.MouseEvent) {
    event.stopPropagation();
    if (!isHearted) setBurstKey((k) => k + 1);
    onToggleHeart();
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Stagger uses index modulo so very long lists don't accumulate visible delay.
      transition={{ ...spring, delay: Math.min(index, 8) * 0.025 }}
      className={`noise-card relative rounded-[1.45rem] border bg-white/[0.055] backdrop-blur-xl ${
        isHearted ? "border-pink/50 shadow-[0_0_18px_rgba(255,61,203,0.18)]" : "border-white/10"
      }`}
    >
      <button className="relative z-10 grid w-full grid-cols-[4.8rem_1fr_auto] items-center gap-3 p-3 text-left sm:grid-cols-[6.5rem_1fr_auto]" onClick={onToggle}>
        <div>
          <p className="font-display text-lg font-bold text-cyan sm:text-xl">{formatSetTime(set).split("–")[0]}</p>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: stage.color }}>
            {stage.short}
          </p>
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-bold tracking-tight text-white sm:text-2xl">{set.artist_name}</h3>
          <p className="truncate text-xs text-white/60">{stage.name} · {set.genres.join(" / ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Voter avatars: tightened from -space-x-1 (heavy overlap) to -space-x-1.5
              with a thicker night-coloured border so emojis read distinctly. */}
          <div className="flex items-center -space-x-1.5">
            {voters.map((member) => (
              <span
                key={member.id}
                className="grid size-7 place-items-center rounded-full border-2 bg-night text-sm"
                style={{ borderColor: member.color }}
              >
                {member.emoji}
              </span>
            ))}
          </div>
          {clashing && <span className="text-sm text-acid" title="Clashes with another hearted set">⚡</span>}
          {comments.length > 0 && <MessageCircle className="text-cyan" size={17} />}
          <motion.button
            whileTap={{ scale: 0.82 }}
            whileHover={isHearted ? undefined : { scale: 1.06 }}
            transition={softSpring}
            className={`relative grid size-11 place-items-center rounded-2xl border ${
              isHearted
                ? "border-pink bg-pink text-night shadow-glowPink"
                : "border-white/15 bg-white/5 text-white/75 hover:border-pink/60"
            }`}
            onClick={handleHeart}
          >
            <Heart size={19} fill={isHearted ? "currentColor" : "none"} />
            {/* Confetti ring: keyed so each tap remounts and replays. */}
            {burstKey > 0 && <BurstOnce key={burstKey} />}
          </motion.button>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="relative z-10 overflow-hidden"
          >
            <div className="grid gap-4 border-t border-white/10 p-4 sm:grid-cols-[10rem_1fr]">
              <div className="grid aspect-square place-items-center rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-pink/30 via-violet to-cyan/20">
                <span className="font-display text-5xl font-black text-white/90">{set.artist_name.slice(0, 2).toUpperCase()}</span>
              </div>
              <div className="grid gap-3">
                {/* Vibe block — replaces the broken Spotify preview player.
                    Combines genre tags + sounds-like + stage/night context
                    into one single source of "what is this artist." See
                    getArtistVibe() in src/lib/flow.ts. */}
                <VibeCard set={set} />

                {/* Listen-elsewhere CTAs. We don't host previews ourselves
                    (PRD §11.3 deferred); these deep-link out to Spotify
                    (primary) and YouTube (universal fallback). Spotify URL
                    opens the artist's profile when the app is installed
                    and the search results page on web. */}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={spotifyArtistUrl(set.artist_name, set.spotify_id)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#1DB954] px-4 py-2.5 text-sm font-black text-white shadow-[0_0_20px_rgba(29,185,84,0.35)] transition hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(29,185,84,0.55)]"
                  >
                    <Music2 size={16} /> Listen on Spotify
                    <ExternalLink size={12} className="opacity-70" />
                  </a>
                  <a
                    href={youtubeSearchUrl(set.artist_name)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/85 transition hover:border-white/40 hover:bg-white/10"
                  >
                    <Youtube size={16} /> YouTube
                    <ExternalLink size={12} className="opacity-60" />
                  </a>
                </div>

                <div className="grid gap-2">
                  {comments.map((comment) => {
                    const member = crew.find((item) => item.id === comment.user_id) ?? crew[0];
                    return (
                      <p key={comment.id} className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-sm leading-6 text-white/90">
                        <span className="mr-1">{member.emoji}</span>
                        <strong className="text-white">{member.name}:</strong> {comment.content}
                      </p>
                    );
                  })}
                  <form className="flex gap-2" onSubmit={onSubmitComment}>
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-night/70 px-4 py-3 text-sm text-white outline-none transition-colors duration-200 placeholder:text-white/45 focus:border-cyan focus:shadow-glowCyan"
                      placeholder="drop a note, group chat energy only"
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                    />
                    <motion.button whileTap={tap} transition={softSpring} className="rounded-2xl bg-cyan px-4 py-3 text-sm font-black text-night shadow-glowCyan">
                      Send
                    </motion.button>
                  </form>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/**
 * Confetti-ring burst that auto-unmounts after the keyframe completes.
 * Sits absolutely inside the heart button. Pure CSS animation — Framer is
 * intentionally not used here so React isn't asked to manage 100+ instances
 * of MotionValue subscriptions when the user spam-taps hearts down a list.
 */
function BurstOnce() {
  const [alive, setAlive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAlive(false), 700);
    return () => clearTimeout(t);
  }, []);
  if (!alive) return null;
  return <span className="heart-burst" />;
}

/**
 * VibeCard — single rich "what is this artist" panel.
 *
 * Replaces the old separated "Genres pills + Sounds-like cyan box + broken
 * Spotify preview" stack. Pulls everything from getArtistVibe() in flow.ts
 * which combines the curated annotations (genres + sounds_like) with the
 * stage/night context for a more substantive description.
 */
function VibeCard({ set }: { set: FestivalSet }) {
  const vibe = getArtistVibe(set, lineup.stages);
  return (
    <div className="rounded-2xl border border-cyan/35 bg-night/60 p-4 shadow-[inset_0_0_28px_rgba(0,255,220,0.08)]">
      {vibe.genres && (
        <p className="mb-2 text-[0.65rem] font-black uppercase tracking-[0.22em] text-cyan/85">
          {vibe.genres}
        </p>
      )}
      <p className="text-base font-bold leading-7 text-white/95">{vibe.soundsLike}</p>
      <p className="mt-2 text-sm leading-6 text-white/65">{vibe.context}</p>
    </div>
  );
}
