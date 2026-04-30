import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, Pause, Play } from "lucide-react";
import { FormEvent, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup } from "@/lib/data";
import {
  formatSetTime,
  getSetVotes,
  getTimeBlock,
  getVoters,
  hasClash,
  stageFor,
  toggleVote
} from "@/lib/flow";
import type { AppState, FestivalSet, Night } from "@/lib/types";
import { DayTabs, FilterPill, Pill, ScreenTitle, spring } from "./ui";

const blocks = ["Early", "Peak", "After Hours"];
const waveHeights = [14, 28, 18, 42, 24, 52, 30, 46, 18, 34, 58, 26, 44, 20, 50, 32, 16, 40, 24, 54, 28, 36];

export function LineupScreen({
  activeNight,
  setActiveNight,
  appState,
  setAppState
}: {
  activeNight: Night;
  setActiveNight: (night: Night) => void;
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [stageFilter, setStageFilter] = useState("all");
  const [heartedOnly, setHeartedOnly] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [playingSetId, setPlayingSetId] = useState<string | null>(null);
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
      <ScreenTitle eyebrow="Voting surface" title="Lineup" copy="Tap rows for previews, comments, and sounds-like context. Hearts commit instantly." />
      <div className="sticky top-0 z-20 -mx-4 border-b border-white/10 bg-night/90 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <DayTabs activeNight={activeNight} setActiveNight={setActiveNight} />
        <div className="mt-3 flex gap-2 overflow-x-auto">
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
                <span className="text-xs uppercase tracking-[0.22em] text-white/42">{sets.length} sets</span>
              </div>
              <div className="grid gap-2">
                {sets.map((set) => {
                  const expanded = expandedSetId === set.id;
                  const playing = playingSetId === set.id;
                  return (
                    <LineupRow
                      key={set.id}
                      set={set}
                      expanded={expanded}
                      playing={playing}
                      appState={appState}
                      commentDraft={commentDraft}
                      setCommentDraft={setCommentDraft}
                      clashing={getSetVotes(set.id, appState.votes).length > 0 && hasClash(set, lineup.sets, appState.votes)}
                      onSubmitComment={(event) => submitComment(event, set.id)}
                      onToggle={() => {
                        setExpandedSetId(expanded ? null : set.id);
                        if (expanded && playing) setPlayingSetId(null);
                      }}
                      onToggleHeart={() => toggleHeart(set.id)}
                      onTogglePlay={() => setPlayingSetId(playing ? null : set.id)}
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
  expanded,
  playing,
  appState,
  commentDraft,
  setCommentDraft,
  clashing,
  onSubmitComment,
  onToggle,
  onToggleHeart,
  onTogglePlay
}: {
  set: FestivalSet;
  expanded: boolean;
  playing: boolean;
  appState: AppState;
  commentDraft: string;
  setCommentDraft: (value: string) => void;
  clashing: boolean;
  onSubmitComment: (event: FormEvent<HTMLFormElement>) => void;
  onToggle: () => void;
  onToggleHeart: () => void;
  onTogglePlay: () => void;
}) {
  const crew = useCrew();
  const stage = stageFor(set, lineup.stages);
  const voters = getVoters(set.id, appState.votes, crew);
  const isHearted = appState.votes.some((vote) => vote.user_id === appState.activeUserId && vote.set_id === set.id);
  const comments = appState.comments.filter((comment) => comment.set_id === set.id);

  return (
    <motion.article layout transition={spring} className="noise-card rounded-[1.45rem] border border-white/10 bg-white/[0.055] backdrop-blur-xl">
      <button className="relative z-10 grid w-full grid-cols-[4.8rem_1fr_auto] items-center gap-3 p-3 text-left sm:grid-cols-[6.5rem_1fr_auto]" onClick={onToggle}>
        <div>
          <p className="font-display text-lg font-bold text-cyan sm:text-xl">{formatSetTime(set).split("–")[0]}</p>
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.22em]" style={{ color: stage.color }}>
            {stage.short}
          </p>
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-bold tracking-tight text-white sm:text-2xl">{set.artist_name}</h3>
          <p className="truncate text-xs text-white/48">{stage.name} · {set.genres.join(" / ")}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-1">
            {voters.map((member) => (
              <span key={member.id} className="grid size-7 place-items-center rounded-full border bg-night text-sm" style={{ borderColor: member.color }}>
                {member.emoji}
              </span>
            ))}
          </div>
          {clashing && <span className="text-sm text-acid" title="Clashes with another hearted set">⚡</span>}
          {comments.length > 0 && <MessageCircle className="text-cyan" size={17} />}
          <button
            className={`grid size-11 place-items-center rounded-2xl border transition ${
              isHearted ? "border-pink bg-pink text-night shadow-glowPink" : "border-white/15 bg-white/5 text-white/70 hover:border-pink/60"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleHeart();
            }}
          >
            <Heart size={19} fill={isHearted ? "currentColor" : "none"} />
          </button>
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
                <div className="rounded-2xl border border-white/10 bg-night/60 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-white/42">Preview</p>
                      <p className="font-display text-lg font-bold">{set.preview_kind === "spotify" ? "Spotify clip" : "YouTube fallback"}</p>
                    </div>
                    <button
                      className={`grid size-12 place-items-center rounded-2xl ${
                        playing ? "bg-pink text-night shadow-glowPink" : "bg-cyan/12 text-cyan"
                      }`}
                      onClick={onTogglePlay}
                    >
                      {playing ? <Pause /> : <Play />}
                    </button>
                  </div>
                  <div className="waveform" data-playing={playing}>
                    {waveHeights.map((height, index) => (
                      <span key={height + index} style={{ "--h": `${height}px`, "--i": index } as React.CSSProperties} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {set.genres.map((genre) => (
                    <span key={genre} className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-white/70">
                      {genre}
                    </span>
                  ))}
                </div>

                <p className="rounded-2xl border border-cyan/20 bg-cyan/10 p-3 text-sm leading-6 text-cyan">{set.sounds_like}</p>

                <div className="grid gap-2">
                  {comments.map((comment) => {
                    const member = crew.find((item) => item.id === comment.user_id) ?? crew[0];
                    return (
                      <p key={comment.id} className="rounded-2xl bg-white/[0.055] px-3 py-2 text-sm text-white/72">
                        <span className="mr-1">{member.emoji}</span>
                        <strong className="text-white">{member.name}:</strong> {comment.content}
                      </p>
                    );
                  })}
                  <form className="flex gap-2" onSubmit={onSubmitComment}>
                    <input
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-night/70 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan"
                      placeholder="drop a note, group chat energy only"
                      value={commentDraft}
                      onChange={(event) => setCommentDraft(event.target.value)}
                    />
                    <button className="rounded-2xl bg-cyan px-4 py-3 text-sm font-black text-night">Send</button>
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
