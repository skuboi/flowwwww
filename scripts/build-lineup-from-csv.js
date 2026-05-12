#!/usr/bin/env node
/**
 * build-lineup-from-csv.js — One-shot builder for data/lineup.json from the
 * official EDC LV 2026 CSV exports (Mainstage Data sheet).
 *
 * This is a fresh build (not a merge): it discards any prior set IDs and
 * rebuilds lineup.json from scratch using the row-per-set CSV as the source
 * of truth. The "Artists by Day & Stage" pivot CSV is used for cross-checks
 * (set-count totals per day) but not as data input.
 *
 * Usage:
 *   node scripts/build-lineup-from-csv.js
 *
 * Inputs (relative to repo root):
 *   - "EDC 2026 Set List + Filterable Times V2.xlsm - Mainstage Data.csv"
 *   - "EDC 2026 Set List + Filterable Times V2.xlsm - Artists by Day & Stage.csv"
 *
 * Output:
 *   - data/lineup.json (overwritten)
 *
 * Time handling:
 *   EDC LV 2026 runs Fri May 15 — Sun May 17 (gates ~7pm) with sets running
 *   into the next morning. We treat each "night" as one festival night that
 *   may cross midnight PT. PT in May is PDT (UTC-7).
 *
 *     Friday night   = May 15 evening → May 16 morning PT
 *     Saturday night = May 16 evening → May 17 morning PT
 *     Sunday night   = May 17 evening → May 18 morning PT
 *
 *   For each set, the CSV gives a clock time + AM/PM. We assume any hour in
 *   the PM (12:00 PM – 11:59 PM) belongs to the festival night's *opening*
 *   calendar day, and any hour in the AM (12:00 AM – 11:59 AM) belongs to
 *   the *next* calendar day. Then we shift +7h to UTC.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MAINSTAGE_CSV = path.join(
  ROOT,
  "EDC 2026 Set List + Filterable Times V2.xlsm - Mainstage Data.csv"
);
const PIVOT_CSV = path.join(
  ROOT,
  "EDC 2026 Set List + Filterable Times V2.xlsm - Artists by Day & Stage.csv"
);
const OUT_PATH = path.join(ROOT, "data/lineup.json");
const ANNOTATIONS_PATH = path.join(ROOT, "data/artist-annotations.json");

// PT opening calendar dates per festival night (sets at PM hours land here,
// AM hours land on the next calendar day).
const NIGHT_OPENING_DATE_PT = {
  friday: "2026-05-15",
  saturday: "2026-05-16",
  sunday: "2026-05-17",
};

// Stage definitions. Short codes + colors are designed to fit the existing
// PLUR palette (see flowwwww_design_document / PRD §10.2). Three new stages
// (Quantum Valley, Stereo Bloom, Bionic Jungle) are introduced for 2026.
const STAGES = {
  kinetic:   { csvName: "Kinetic Field",   name: "kineticFIELD",    short: "KIN", color: "#B94FFF" },
  circuit:   { csvName: "Circuit Grounds", name: "circuitGROUNDS",  short: "CIR", color: "#00FFDC" },
  cosmic:    { csvName: "Cosmic Meadow",   name: "cosmicMEADOW",    short: "COS", color: "#FFE600" },
  neon:      { csvName: "Neon Garden",     name: "neonGARDEN",      short: "NEO", color: "#B94FFF" },
  basspod:   { csvName: "Basspod",         name: "bassPOD",         short: "BAS", color: "#FF7A3D" },
  wasteland: { csvName: "Wasteland",       name: "wasteland",       short: "WST", color: "#8CFF6A" },
  quantum:   { csvName: "Quantum Valley",  name: "quantumVALLEY",   short: "QTM", color: "#5AC8FA" },
  stereo:    { csvName: "Stereo Bloom",    name: "stereoBLOOM",     short: "STR", color: "#FF8AB4" },
  bionic:    { csvName: "Bionic Jungle",   name: "bionicJUNGLE",    short: "BIO", color: "#C9FF4D" },
};

const CSV_TO_STAGE_ID = Object.fromEntries(
  Object.entries(STAGES).map(([id, s]) => [s.csvName.toLowerCase(), id])
);

const NIGHT_FROM_CSV = {
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
};

// ---------- CSV parsing ---------------------------------------------------

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  // Support quoted fields with embedded newlines.
  const rows = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') { cur += ch; inQ = !inQ; continue; }
    if ((ch === "\n" || ch === "\r") && !inQ) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      rows.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur) rows.push(cur);
  return rows.filter((r) => r.length > 0).map(parseCSVLine);
}

// ---------- Time conversion ----------------------------------------------

function timeToISO(timeStr, nightKey) {
  const openingDate = NIGHT_OPENING_DATE_PT[nightKey];
  if (!openingDate) throw new Error(`Unknown night: ${nightKey}`);

  const m = timeStr.trim().toUpperCase().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (!m) throw new Error(`Cannot parse time "${timeStr}"`);

  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3];

  // 12h → 24h (PT)
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  // PM → opening day; AM → next day.
  let dateStr = openingDate;
  if (hour < 12) {
    const d = new Date(`${openingDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    dateStr = d.toISOString().slice(0, 10);
  }

  // PT (PDT, UTC-7) → UTC by adding 7h.
  const utcHour = hour + 7;
  const dt = new Date(`${dateStr}T00:00:00Z`);
  dt.setUTCHours(utcHour, min, 0, 0);
  return dt.toISOString().replace(".000Z", "Z");
}

// ---------- Slug / id ----------------------------------------------------

function slugify(name, night) {
  const slug = name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${night.slice(0, 3)}_${slug}`;
}

// ---------- Main ---------------------------------------------------------

function loadAnnotations() {
  // Annotations are hand-curated (no APIs) — see data/artist-annotations.json.
  // Keys are exact artist_name strings. Values: { genres: string[], sounds_like: string }.
  if (!fs.existsSync(ANNOTATIONS_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, "utf-8"));
  // Strip _meta key.
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("_")) continue;
    out[k] = v;
  }
  return out;
}

function main() {
  const annotations = loadAnnotations();
  const csvText = fs.readFileSync(MAINSTAGE_CSV, "utf-8");
  const rows = parseCSV(csvText);
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const idx = {
    day: header.indexOf("day"),
    stage: header.indexOf("stage"),
    artist: header.indexOf("artist"),
    start: header.indexOf("start"),
    end: header.indexOf("end"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`Missing required column: ${k}`);
  }

  const sets = [];
  const idsSeen = new Set();
  const perNightCount = { friday: 0, saturday: 0, sunday: 0 };

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[idx.artist] || !row[idx.artist].trim()) continue;

    const dayRaw = row[idx.day].trim().toLowerCase();
    const night = NIGHT_FROM_CSV[dayRaw];
    if (!night) throw new Error(`Row ${r + 1}: unknown day "${row[idx.day]}"`);

    const stageId = CSV_TO_STAGE_ID[row[idx.stage].trim().toLowerCase()];
    if (!stageId) throw new Error(`Row ${r + 1}: unknown stage "${row[idx.stage]}"`);

    const artist = row[idx.artist].trim();
    const start = timeToISO(row[idx.start], night);
    const end = timeToISO(row[idx.end], night);

    let id = slugify(artist, night);
    // Disambiguate the (extremely unlikely) collision case so we never lose a set.
    let suffix = 2;
    while (idsSeen.has(id)) id = `${slugify(artist, night)}_${suffix++}`;
    idsSeen.add(id);

    const ann = annotations[artist];
    sets.push({
      id,
      artist_name: artist,
      stage_id: stageId,
      night,
      start_time: start,
      end_time: end,
      genres: ann?.genres ?? [],
      sounds_like: ann?.sounds_like ?? `Sounds like ${artist}.`,
      preview_kind: "spotify",
      // Optional Spotify artist ID — when set on the annotation, enables direct
      // /artist/{id} deep links. Otherwise the app falls back to a search URL.
      ...(ann?.spotify_id ? { spotify_id: ann.spotify_id } : {}),
    });
    perNightCount[night]++;
  }

  // Sort: night, then start_time, then stage for stable output.
  const nightOrder = { friday: 0, saturday: 1, sunday: 2 };
  sets.sort((a, b) => {
    const n = nightOrder[a.night] - nightOrder[b.night];
    if (n) return n;
    const t = Date.parse(a.start_time) - Date.parse(b.start_time);
    if (t) return t;
    return a.stage_id.localeCompare(b.stage_id);
  });

  // Build stages object preserving the canonical order defined above.
  const stages = {};
  for (const [id, s] of Object.entries(STAGES)) {
    stages[id] = { name: s.name, short: s.short, color: s.color };
  }

  // Annotation coverage report — flag any artist missing from artist-annotations.json
  // so they don't quietly ship with the placeholder "Sounds like {name}." line.
  const uniqueArtists = [...new Set(sets.map((s) => s.artist_name))];
  const missing = uniqueArtists.filter((a) => !annotations[a]);
  if (missing.length > 0) {
    console.warn(`\n⚠ Missing annotations for ${missing.length} artist(s):`);
    for (const a of missing) console.warn(`   - ${a}`);
    console.warn(`   Add entries to data/artist-annotations.json and rebuild.\n`);
  } else {
    console.log(`\n🎨 Annotations: ${uniqueArtists.length}/${uniqueArtists.length} artists covered.`);
  }

  const lineup = { stages, sets };
  fs.writeFileSync(OUT_PATH, JSON.stringify(lineup, null, 2) + "\n");

  // Cross-check against pivot CSV "Quick Counts" column (Friday/Saturday/Sunday totals).
  const pivot = parseCSV(fs.readFileSync(PIVOT_CSV, "utf-8"));
  const expected = { friday: null, saturday: null, sunday: null };
  for (const row of pivot) {
    for (let c = 0; c < row.length; c++) {
      const cell = (row[c] || "").trim().toLowerCase();
      if ((cell === "friday" || cell === "saturday" || cell === "sunday") && row[c + 1]) {
        const n = parseInt(row[c + 1], 10);
        if (!Number.isNaN(n) && expected[cell] == null) expected[cell] = n;
      }
    }
  }

  console.log(`✅ Wrote ${sets.length} sets across ${Object.keys(stages).length} stages → ${path.relative(ROOT, OUT_PATH)}`);
  console.log("   Per-night counts (built / pivot / match):");
  let allMatch = true;
  for (const n of ["friday", "saturday", "sunday"]) {
    const ok = expected[n] == null ? "?" : (expected[n] === perNightCount[n] ? "✓" : "✗");
    if (expected[n] != null && expected[n] !== perNightCount[n]) allMatch = false;
    console.log(`     ${n.padEnd(8)}  ${String(perNightCount[n]).padStart(3)}  /  ${expected[n] ?? "?"}  ${ok}`);
  }
  if (!allMatch) {
    console.error("\n⚠ Pivot cross-check failed — counts diverge. Inspect the CSV before shipping.");
    process.exit(1);
  }
}

main();
