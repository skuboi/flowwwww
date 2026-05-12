"use client";
import { motion } from "framer-motion";
import { nights, nightLabels, shortNightLabels } from "@/lib/data";
import type { Night } from "@/lib/types";

/**
 * Shared UI atoms for flowwwww.
 *
 * Design intent (PRD §10):
 *   - Spring-based motion with slight overshoot — never linear.
 *   - Glow only means "active / live" — never decoration.
 *   - PLUR palette: pink (action/identity), cyan (info/crew), acid (warning/clash),
 *     grape (alt-tone for shared schedule chrome).
 *   - All buttons must feel tactile: micro press (whileTap scale 0.94 ish),
 *     micro lift on hover (translateY -1 to -2).
 */

export const spring = { type: "spring", stiffness: 420, damping: 31, mass: 0.8 } as const;
export const softSpring = { type: "spring", stiffness: 320, damping: 28, mass: 0.9 } as const;

// Standard tactile press behaviour applied to most buttons.
export const tap = { scale: 0.94 } as const;
export const liftHover = { y: -2 } as const;

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

export function NavButton({
  active,
  label,
  icon,
  onClick
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={tap}
      whileHover={active ? undefined : { y: -1 }}
      transition={softSpring}
      className={`relative flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-xs font-bold uppercase tracking-[0.18em] ${
        active
          ? "bg-pink text-night shadow-glowPink ring-pulse-pink"
          : "text-white/65 hover:bg-white/10 hover:text-white"
      }`}
      onClick={onClick}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </motion.button>
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
  // Animated active indicator: a single shared pill slides between the three
  // day buttons via Framer's layoutId, instead of each button toggling its own
  // background. Feels like the active state physically moves with the user.
  return (
    <div
      className={`relative grid gap-2 ${
        compact ? "grid-cols-3" : "grid-cols-3 rounded-[1.4rem] border border-white/10 bg-white/5 p-1"
      }`}
    >
      {nights.map((night) => {
        const active = activeNight === night;
        return (
          <motion.button
            key={night}
            whileTap={tap}
            transition={softSpring}
            className={`relative rounded-2xl px-4 py-3 font-display text-sm font-bold sm:text-base ${
              active ? "text-night" : "text-white/60 hover:text-white"
            }`}
            onClick={() => setActiveNight(night)}
          >
            {active && (
              <motion.span
                layoutId={`day-tabs-active-${compact ? "compact" : "full"}`}
                className="absolute inset-0 rounded-2xl bg-cyan shadow-glowCyan"
                transition={spring}
              />
            )}
            <span className="relative">
              {compact ? shortNightLabels[night] : nightLabels[night]}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function ScreenTitle({
  eyebrow,
  title,
  copy
}: {
  eyebrow: string;
  title: string;
  copy: string;
}) {
  return (
    <div>
      <motion.p
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ ...softSpring, delay: 0.05 }}
        className="text-xs font-bold uppercase tracking-[0.35em] text-pink"
      >
        {eyebrow}
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.08 }}
        className="font-display text-5xl font-black tracking-[-0.075em] sm:text-7xl"
      >
        {title}
      </motion.h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65 sm:text-base">{copy}</p>
    </div>
  );
}

export function FilterPill({
  active,
  color,
  label,
  onClick
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={tap}
      whileHover={{ y: -1 }}
      transition={softSpring}
      className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] ${
        active
          ? "bg-white text-night shadow-glowCyan"
          : "bg-white/5 text-white/65 hover:bg-white/10"
      }`}
      // Border colour comes from the dataset so each stage's pill is identifiable
      // even when inactive — the colour is the stage's PLUR identity.
      style={{ borderColor: color }}
      onClick={onClick}
    >
      {label}
    </motion.button>
  );
}

export function Pill({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: "pink" | "cyan" | "acid" | "grape";
}) {
  // Bumped bg from /12 → /18 (and grape /20) for WCAG-friendlier contrast on
  // text-on-tone — the previous /12 was right at the edge of AA on small caps.
  const tones = {
    pink:  "border-pink/50  bg-pink/18  text-pink",
    cyan:  "border-cyan/50  bg-cyan/18  text-cyan",
    acid:  "border-acid/55  bg-acid/18  text-acid",
    grape: "border-grape/55 bg-grape/20 text-grape"
  };
  return (
    <span
      className={`rounded-full border px-3 py-1 text-[0.65rem] font-black uppercase tracking-[0.18em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
