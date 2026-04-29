import { motion } from "framer-motion";
import { nights, nightLabels, shortNightLabels } from "@/lib/data";
import type { Night } from "@/lib/types";

export const spring = { type: "spring", stiffness: 420, damping: 31, mass: 0.8 };

export function ScreenFrame({ children }: { children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.985 }}
      transition={spring}
    >
      {children}
    </motion.section>
  );
}

export function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] transition ${
        active ? "bg-pink text-night shadow-glowPink" : "text-white/62 hover:bg-white/10 hover:text-white"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function DayTabs({
  activeNight,
  setActiveNight,
  compact = false
}: {
  activeNight: Night;
  setActiveNight: (night: Night) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-3 rounded-[1.4rem] border border-white/10 bg-white/5 p-1"}`}>
      {nights.map((night) => (
        <button
          key={night}
          className={`rounded-2xl px-4 py-3 font-display text-sm font-bold transition sm:text-base ${
            activeNight === night ? "bg-cyan text-night shadow-glowCyan" : "text-white/55 hover:bg-white/8 hover:text-white"
          }`}
          onClick={() => setActiveNight(night)}
        >
          {compact ? shortNightLabels[night] : nightLabels[night]}
        </button>
      ))}
    </div>
  );
}

export function ScreenTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.35em] text-pink">{eyebrow}</p>
      <h1 className="font-display text-5xl font-black tracking-[-0.075em] sm:text-7xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58 sm:text-base">{copy}</p>
    </div>
  );
}

export function FilterPill({ active, color, label, onClick }: { active: boolean; color: string; label: string; onClick: () => void }) {
  return (
    <button
      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] transition ${
        active ? "bg-white text-night" : "bg-white/5 text-white/62 hover:bg-white/10"
      }`}
      style={{ borderColor: color }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function Pill({ children, tone }: { children: React.ReactNode; tone: "pink" | "cyan" | "acid" }) {
  const tones = {
    pink: "border-pink/40 bg-pink/12 text-pink",
    cyan: "border-cyan/40 bg-cyan/12 text-cyan",
    acid: "border-acid/45 bg-acid/12 text-acid"
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${tones[tone]}`}>{children}</span>;
}
