import { motion } from "framer-motion";
import { Heart, Share2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useCrew } from "@/lib/crew-context";
import { lineup, nights, shortNightLabels } from "@/lib/data";
import { attendStartIso, attendEndIso, formatTime, stageFor } from "@/lib/flow";
import type { AppState, Night } from "@/lib/types";
import { Pill, spring, tap } from "./ui";

export type Screen = "home" | "lineup" | "flow";

function GlowButton({ label, helper, icon, onClick }: { label: string; helper: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <motion.button
      whileTap={tap}
      whileHover={{ y: -3 }}
      transition={spring}
      className="rounded-[1.5rem] bg-pink p-5 text-left text-night shadow-glowPink"
      onClick={onClick}
    >
      <span className="flex items-center gap-2 font-display text-2xl font-black">
        {icon} {label}
      </span>
      <span className="mt-1 block text-sm font-bold text-night/75">{helper}</span>
    </motion.button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night/50 p-4">
      <p className="font-display text-4xl font-black text-white">{value}</p>
      <p className="text-xs uppercase tracking-[0.24em] text-white/55">{label}</p>
    </div>
  );
}

export function HomeScreen({
  activeUserName,
  setScreen,
  setActiveNight,
  appState,
  flowCount
}: {
  activeUserName: string;
  setScreen: (screen: Screen) => void;
  setActiveNight: (night: Night) => void;
  appState: AppState;
  flowCount: number;
}) {
  const crew = useCrew();
  const votes = appState.votes.length;

  // Re-tick every 60s so the live "Now / Next" surface stays fresh without
  // hammering React. The countdown number doesn't need this since it changes
  // at most once a day.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const daysToEdc = Math.max(
    0,
    Math.ceil((new Date("2026-05-15T19:00:00-07:00").getTime() - now) / (1000 * 60 * 60 * 24))
  );
  const edcStartMs = new Date("2026-05-15T19:00:00-07:00").getTime();
  const edcEndMs = new Date("2026-05-18T08:00:00-07:00").getTime();
  const isFestivalLive = now >= edcStartMs - 60 * 60 * 1000 && now <= edcEndMs;

  // Live "Now / Next" — only computed during festival window. Filters to
  // the active user's hearted sets so the surface is *their* schedule.
  const heartedIds = new Set(appState.votes.filter((v) => v.user_id === appState.activeUserId).map((v) => v.set_id));
  const myHearted = lineup.sets.filter((s) => heartedIds.has(s.id));
  const nowSet = isFestivalLive
    ? myHearted.find((s) => {
        const start = Date.parse(attendStartIso(s, appState.attendOverrides));
        const end = Date.parse(attendEndIso(s, appState.attendOverrides));
        return start <= now && now < end;
      })
    : undefined;
  const nextSet = isFestivalLive
    ? myHearted
        .filter((s) => Date.parse(attendStartIso(s, appState.attendOverrides)) > now)
        .sort(
          (a, b) =>
            Date.parse(attendStartIso(a, appState.attendOverrides)) -
            Date.parse(attendStartIso(b, appState.attendOverrides))
        )[0]
    : undefined;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="noise-card rounded-[2rem] border border-pink/25 bg-white/[0.065] p-6 shadow-glowPink backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Pill tone="pink">Phase 1 prototype</Pill>
          <Pill tone="cyan">offline-ready</Pill>
          <Pill tone="grape">crew cap: 3</Pill>
        </div>

        {/* Now / Next — only shown during the festival window. Bumps the
            countdown out of focus when there's something more useful to surface
            (the next set the user is going to). */}
        {isFestivalLive && (nowSet || nextSet) ? (
          <NowNextCard
            now={now}
            nowSet={nowSet}
            nextSet={nextSet}
            attendOverrides={appState.attendOverrides}
            onJump={() => setScreen("flow")}
          />
        ) : (
          <>
            <p className="mb-3 text-sm uppercase tracking-[0.35em] text-cyan">Hey {activeUserName}, the gates open in</p>
            <h1 className="font-display text-6xl font-black leading-[0.92] tracking-[-0.08em] text-white sm:text-8xl">
              <motion.span
                key={daysToEdc}
                initial={{ opacity: 0, y: 12, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={spring}
                className="inline-block"
              >
                {daysToEdc}
              </motion.span>
              <span className="mt-1 block text-2xl tracking-[-0.05em] text-pink sm:text-4xl">days until EDC</span>
            </h1>
          </>
        )}
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80">
          Dense lineup scans, instant hearts, clash alerts, and a shared night plan that feels like opening the group chat
          and seeing everyone type <span className="text-acid">&ldquo;wait this is actually perfect.&rdquo;</span>
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <GlowButton
            label="Explore Lineup"
            helper="vote fast, expand inline"
            icon={<Heart />}
            onClick={() => setScreen("lineup")}
          />
          <motion.button
            whileTap={tap}
            whileHover={{ y: -3 }}
            transition={spring}
            className="rounded-[1.5rem] border border-cyan/45 bg-cyan/10 p-5 text-left hover:bg-cyan/15 hover:shadow-glowCyan"
            onClick={() => setScreen("flow")}
          >
            <span className="flex items-center gap-2 font-display text-2xl font-bold text-cyan">
              <Zap /> See the flowwwww
            </span>
            <span className="mt-1 block text-sm text-white/65">timeline + stories view</span>
          </motion.button>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-[2rem] border border-white/10 bg-night/58 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Crew roster</h2>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-bold text-white/70">3 / 3 locked</span>
          </div>
          <div className="grid gap-3">
            {crew.map((member, index) => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...spring, delay: 0.05 + index * 0.06 }}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3"
              >
                <span className="grid size-12 place-items-center rounded-2xl border-2 text-2xl" style={{ borderColor: member.color, boxShadow: `0 0 14px ${member.color}33` }}>
                  {member.emoji}
                </span>
                <div>
                  <p className="font-display text-lg font-bold">{member.name}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/55">vibe synced</p>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.button
            whileTap={tap}
            whileHover={{ y: -1 }}
            transition={spring}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan/45 bg-cyan/10 px-4 py-3 text-sm font-bold text-cyan hover:bg-cyan/15"
          >
            <Share2 size={17} /> Invite link copied for group chat
          </motion.button>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="crew hearts" value={votes} />
            <Metric label="sets in flow" value={flowCount} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {nights.map((night) => (
              <motion.button
                key={night}
                whileTap={tap}
                whileHover={{ y: -2 }}
                transition={spring}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-white/75 hover:border-pink/40 hover:text-white"
                onClick={() => {
                  setActiveNight(night);
                  setScreen("lineup");
                }}
              >
                {shortNightLabels[night]}
              </motion.button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

/**
 * Live "Now / Next" surface — only rendered during the EDC LV festival window
 * (May 15 ~7pm PT through May 18 ~8am PT). Replaces the static countdown
 * because once you're at the festival, "what's next" matters more than
 * "how many days until."
 *
 * Pulls from the active user's hearted sets only (not the resolved flow) so
 * the surface is "your" schedule. Trims via attendOverrides are respected.
 */
function NowNextCard({
  now,
  nowSet,
  nextSet,
  attendOverrides,
  onJump,
}: {
  now: number;
  nowSet?: import("@/lib/types").FestivalSet;
  nextSet?: import("@/lib/types").FestivalSet;
  attendOverrides: import("@/lib/types").AttendOverride[];
  onJump: () => void;
}) {
  const nextStartMs = nextSet ? Date.parse(attendStartIso(nextSet, attendOverrides)) : 0;
  const minsToNext = nextSet ? Math.max(0, Math.round((nextStartMs - now) / 60000)) : 0;

  return (
    <div className="grid gap-3">
      <p className="text-sm font-bold uppercase tracking-[0.35em] text-acid">Live · EDC is happening</p>
      {nowSet && (
        <button
          onClick={onJump}
          className="rounded-2xl border border-pink/45 bg-pink/15 p-4 text-left shadow-glowPink transition hover:bg-pink/20"
        >
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-pink">▶ Now playing</p>
          <p className="mt-1 font-display text-3xl font-black tracking-tight text-white">{nowSet.artist_name}</p>
          <p className="mt-1 text-sm text-white/70">
            {stageFor(nowSet, lineup.stages).name} · until {formatTime(attendEndIso(nowSet, attendOverrides))}
          </p>
        </button>
      )}
      {nextSet && (
        <button
          onClick={onJump}
          className="rounded-2xl border border-cyan/45 bg-cyan/10 p-4 text-left transition hover:bg-cyan/15 hover:shadow-glowCyan"
        >
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan">→ Up next · in {minsToNext} min</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-white">{nextSet.artist_name}</p>
          <p className="mt-1 text-sm text-white/70">
            {stageFor(nextSet, lineup.stages).name} · {formatTime(attendStartIso(nextSet, attendOverrides))}
          </p>
        </button>
      )}
      {!nowSet && !nextSet && (
        <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65">
          No more sets in your flowwwww tonight. Get some sleep, hero.
        </p>
      )}
    </div>
  );
}
