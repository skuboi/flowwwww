import { Heart, Share2, Zap } from "lucide-react";
import { crew, nights, shortNightLabels } from "@/lib/data";
import type { Night } from "@/lib/types";
import { Pill } from "./ui";

export type Screen = "home" | "lineup" | "flow";

function GlowButton({ label, helper, icon, onClick }: { label: string; helper: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button className="rounded-[1.5rem] bg-pink p-5 text-left text-night shadow-glowPink transition hover:-translate-y-0.5" onClick={onClick}>
      <span className="flex items-center gap-2 font-display text-2xl font-black">
        {icon} {label}
      </span>
      <span className="mt-1 block text-sm font-bold text-night/70">{helper}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-night/50 p-4">
      <p className="font-display text-4xl font-black text-white">{value}</p>
      <p className="text-xs uppercase tracking-[0.24em] text-white/42">{label}</p>
    </div>
  );
}

export function HomeScreen({
  activeUserName,
  setScreen,
  setActiveNight,
  votes,
  flowCount
}: {
  activeUserName: string;
  setScreen: (screen: Screen) => void;
  setActiveNight: (night: Night) => void;
  votes: number;
  flowCount: number;
}) {
  const daysToEdc = Math.max(
    0,
    Math.ceil((new Date("2026-05-15T19:00:00-07:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="noise-card rounded-[2rem] border border-pink/25 bg-white/[0.065] p-6 shadow-glowPink backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <Pill tone="pink">Phase 1 prototype</Pill>
          <Pill tone="cyan">offline-ready</Pill>
          <Pill tone="acid">crew cap: 3</Pill>
        </div>
        <p className="mb-3 text-sm uppercase tracking-[0.35em] text-cyan">Hey {activeUserName}, the gates open in</p>
        <h1 className="font-display text-6xl font-black leading-none tracking-[-0.08em] text-white sm:text-8xl">
          {daysToEdc}
          <span className="block text-3xl tracking-[-0.05em] text-pink sm:text-5xl">days until EDC</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
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
          <button
            className="rounded-[1.5rem] border border-cyan/40 bg-cyan/10 p-5 text-left transition hover:-translate-y-0.5 hover:bg-cyan/15 hover:shadow-glowCyan"
            onClick={() => setScreen("flow")}
          >
            <span className="flex items-center gap-2 font-display text-2xl font-bold text-cyan">
              <Zap /> See the flowwwww
            </span>
            <span className="mt-1 block text-sm text-white/58">timeline + stories view</span>
          </button>
        </div>
      </section>

      <aside className="grid gap-4">
        <section className="rounded-[2rem] border border-white/10 bg-night/58 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">Crew roster</h2>
            <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-white/60">3 / 3 locked</span>
          </div>
          <div className="grid gap-3">
            {crew.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                <span className="grid size-12 place-items-center rounded-2xl border text-2xl" style={{ borderColor: member.color }}>
                  {member.emoji}
                </span>
                <div>
                  <p className="font-display text-lg font-bold">{member.name}</p>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/45">vibe synced</p>
                </div>
              </div>
            ))}
          </div>
          <button className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-cyan/45 bg-cyan/10 px-4 py-3 text-sm font-bold text-cyan">
            <Share2 size={17} /> Invite link copied for group chat
          </button>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="crew hearts" value={votes} />
            <Metric label="sets in flow" value={flowCount} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {nights.map((night) => (
              <button
                key={night}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-white/70 transition hover:border-pink/40 hover:text-white"
                onClick={() => {
                  setActiveNight(night);
                  setScreen("lineup");
                }}
              >
                {shortNightLabels[night]}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
