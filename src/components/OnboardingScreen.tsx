"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Copy, LogIn, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { CrewMember } from "@/lib/types";
import {
  createCrew,
  initSession,
  joinCrew,
  loadCrewState,
  pickCrewColor,
  registerMember,
} from "@/lib/supabase-sync";
import { spring, tap } from "./ui";

const EMOJI_OPTIONS = ["👽", "🤠", "🍄", "🧚‍♀️", "😈", "🫠", "🪩", "🦉", "🔮", "🎭", "🌈", "🎪"];

type Phase = "identity" | "choose" | "created" | "join";

export function OnboardingScreen({
  onComplete,
}: {
  onComplete: (crewId: string, memberId: string, members: CrewMember[]) => void;
}) {
  const [phase, setPhase] = useState<Phase>("identity");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("🪩");
  const [crewCode, setCrewCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const pendingRef = useRef<{ crewId: string; memberId: string; members: CrewMember[] } | null>(null);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) { setError("pick a name first"); return; }
    setLoading(true);
    setError("");
    try {
      await initSession();
      const crewId = await createCrew();
      if (!crewId) { setError("couldn't create crew — check Supabase config"); return; }
      const color = pickCrewColor(0);
      const member = await registerMember(crewId, name.trim(), emoji, color);
      if (!member) { setError("couldn't register — try again"); return; }
      setCrewCode(crewId.slice(0, 6));
      setPhase("created");
      pendingRef.current = { crewId, memberId: member.id, members: [member] };
    } catch {
      setError("something broke, try again");
    } finally {
      setLoading(false);
    }
  }, [name, emoji]);

  const handleJoin = useCallback(async () => {
    if (!name.trim()) { setError("pick a name first"); return; }
    if (joinCode.trim().length < 6) { setError("code must be 6 characters"); return; }
    setLoading(true);
    setError("");
    try {
      await initSession();
      const crewId = await joinCrew(joinCode.trim());
      if (!crewId) { setError("crew not found — check the code"); setLoading(false); return; }

      // Load existing members to pick a unique color
      const existing = await loadCrewState(crewId);
      const color = pickCrewColor(existing?.members.length ?? 0);
      const member = await registerMember(crewId, name.trim(), emoji, color);
      if (!member) { setError("couldn't join — maybe already a member?"); setLoading(false); return; }

      const members = existing ? [...existing.members, member] : [member];
      onComplete(crewId, member.id, members);
    } catch {
      setError("something broke, try again");
    } finally {
      setLoading(false);
    }
  }, [name, emoji, joinCode, onComplete]);

  const finishCreate = useCallback(() => {
    const pending = pendingRef.current;
    if (pending) {
      pendingRef.current = null;
      onComplete(pending.crewId, pending.memberId, pending.members);
    }
  }, [onComplete]);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(crewCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [crewCode]);

  return (
    <main className="grid min-h-screen place-items-center bg-rave-radial p-4 text-white">
      <div className="w-full max-w-md space-y-6">
        {/* Branding — owl breathes via the kick-pulse keyframe (see globals.css). */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="text-center"
        >
          <span className="kick-pulse mx-auto mb-3 grid size-16 place-items-center rounded-3xl bg-pink/15 text-4xl shadow-glowPink">
            🦉
          </span>
          <h1 className="font-display text-4xl font-black tracking-tight">flowwwww</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan/80">EDC LV 2026</p>
        </motion.div>

        {/* Identity phase */}
        {(phase === "identity" || phase === "choose") && (
          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-xl">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                Your name
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-night/70 px-4 py-3 text-lg font-bold text-white outline-none transition-colors duration-200 placeholder:text-white/45 focus:border-cyan focus:shadow-glowCyan"
                placeholder="e.g. Koto"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                Pick your emoji
              </label>
              <div className="grid grid-cols-6 gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <motion.button
                    key={e}
                    whileTap={tap}
                    whileHover={emoji === e ? undefined : { y: -2 }}
                    transition={spring}
                    className={`grid size-12 place-items-center rounded-xl border text-2xl ${
                      emoji === e
                        ? "scale-110 border-cyan bg-cyan/15 shadow-glowCyan"
                        : "border-white/10 bg-white/5 hover:border-white/30"
                    }`}
                    onClick={() => setEmoji(e)}
                  >
                    {e}
                  </motion.button>
                ))}
              </div>
            </div>

            {phase === "identity" && (
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <motion.button
                  whileTap={tap}
                  whileHover={{ y: -2 }}
                  transition={spring}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-pink p-4 font-display text-lg font-black text-night shadow-glowPink disabled:opacity-50"
                  disabled={loading || !name.trim()}
                  onClick={handleCreate}
                >
                  <Plus size={20} /> Create a crew
                </motion.button>
                <motion.button
                  whileTap={tap}
                  whileHover={{ y: -2 }}
                  transition={spring}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-cyan/40 bg-cyan/10 p-4 font-display text-lg font-bold text-cyan hover:bg-cyan/15"
                  onClick={() => { if (!name.trim()) { setError("pick a name first"); return; } setPhase("join"); }}
                >
                  <LogIn size={20} /> Join crew
                </motion.button>
              </div>
            )}
          </div>
        )}

        {/* Created — show crew code */}
        {phase === "created" && (
          <div className="space-y-4 rounded-[2rem] border border-pink/30 bg-white/[0.06] p-6 text-center backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-pink">Your crew code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-display text-5xl font-black tracking-[0.15em] text-white">{crewCode}</span>
              <button
                className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/5 text-white/60 transition hover:border-cyan hover:text-cyan"
                onClick={copyCode}
                title="Copy code"
              >
                <Copy size={18} />
              </button>
            </div>
            {copied && <p className="text-sm text-cyan">copied!</p>}
            <p className="text-sm text-white/50">Share this code with your crew so they can join</p>
            <button
              className="w-full rounded-2xl bg-cyan p-4 font-display text-lg font-bold text-night transition hover:-translate-y-0.5"
              onClick={finishCreate}
            >
              Let&apos;s go →
            </button>
          </div>
        )}

        {/* Join — enter code */}
        {phase === "join" && (
          <div className="space-y-4 rounded-[2rem] border border-cyan/30 bg-white/[0.06] p-6 backdrop-blur-xl">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                Crew code
              </label>
              <input
                className="w-full rounded-xl border border-white/10 bg-night/70 px-4 py-3 text-center font-display text-2xl font-black tracking-[0.15em] text-white outline-none transition-colors duration-200 placeholder:text-white/35 focus:border-cyan focus:shadow-glowCyan"
                placeholder="abc123"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toLowerCase())}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                className="rounded-2xl border border-white/15 bg-white/5 p-3 text-sm font-bold text-white/60 transition hover:border-white/30"
                onClick={() => setPhase("identity")}
              >
                ← Back
              </button>
              <button
                className="rounded-2xl bg-cyan p-3 font-display text-lg font-bold text-night transition hover:-translate-y-0.5 disabled:opacity-50"
                disabled={loading || joinCode.trim().length < 6}
                onClick={handleJoin}
              >
                {loading ? "joining…" : "Join"}
              </button>
            </div>
          </div>
        )}

        {/* Error display — text bumped from pink-on-pink (~3:1) to white for AA. */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={spring}
              className="rounded-xl border border-pink/55 bg-pink/15 px-4 py-2 text-center text-sm font-bold text-white shadow-glowPink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {loading && phase !== "created" && (
          <p className="text-center text-sm text-white/40">connecting…</p>
        )}
      </div>
    </main>
  );
}
