#!/usr/bin/env node
/**
 * sync-lineup.js — Sync official EDC LV 2026 set times into lineup.json
 *
 * Accepts CSV or JSON via stdin or file argument.
 * Matches existing artists by name (fuzzy-normalised).
 * Adds new artists, flags removed ones, updates times/stages.
 *
 * Usage:
 *   node scripts/sync-lineup.js input.csv
 *   node scripts/sync-lineup.js input.json
 *   cat times.csv | node scripts/sync-lineup.js
 *
 * CSV columns: artist, stage, night, start_time, end_time
 *   - night: "friday" | "saturday" | "sunday"
 *   - start_time / end_time: ISO-8601 string (e.g. 2026-05-16T01:30:00Z)
 *     OR shorthand like "6:30P" / "1:00A" (converted to PT → UTC internally)
 *
 * JSON: array of { artist, stage, night, start_time, end_time }
 *
 * Optional CSV/JSON fields: genres (comma-sep or array), sounds_like, preview_kind
 */

const fs = require("fs");
const path = require("path");

const LINEUP_PATH = path.resolve(__dirname, "../data/lineup.json");

// EDC LV 2026 dates — gates open at dusk, sets run until sunrise next day
// Friday night = May 15 evening → May 16 morning (UTC: May 16)
// Saturday night = May 16 evening → May 17 morning (UTC: May 17)
// Sunday night = May 17 evening → May 18 morning (UTC: May 18)
const NIGHT_BASE_DATES = {
  friday: "2026-05-16",
  saturday: "2026-05-17",
  sunday: "2026-05-18",
};

const STAGE_ALIASES = {
  kineticfield: "kinetic",
  kinetic: "kinetic",
  kin: "kinetic",
  circuitgrounds: "circuit",
  circuit: "circuit",
  cir: "circuit",
  cosmicmeadow: "cosmic",
  cosmic: "cosmic",
  cos: "cosmic",
  neongarden: "neon",
  neon: "neon",
  neo: "neon",
  basspod: "basspod",
  bas: "basspod",
  wasteland: "wasteland",
  wst: "wasteland",
  quantumvalley: "quantum",
  quantum: "quantum",
  stereobloom: "stereo",
  stereo: "stereo",
};

function normalise(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function slugify(artist, night) {
  const slug = artist
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const prefix = night.slice(0, 3);
  return `${prefix}_${slug}`;
}

/**
 * Convert shorthand time like "6:30P" or "1:00A" to an ISO-8601 UTC string
 * for a given night. EDC set times span from ~7PM to ~6AM next day (PT).
 * PT = UTC-7 in May (PDT).
 */
function shorthandToISO(shorthand, nightKey) {
  const baseDate = NIGHT_BASE_DATES[nightKey];
  if (!baseDate) throw new Error(`Unknown night: ${nightKey}`);

  // Already ISO?
  if (/^\d{4}-\d{2}-\d{2}T/.test(shorthand)) return shorthand;

  const match = shorthand
    .trim()
    .toUpperCase()
    .match(/^(\d{1,2}):(\d{2})\s*(A|P|AM|PM)?$/);

  if (!match) throw new Error(`Cannot parse time "${shorthand}"`);

  let hour = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  const ampm = (match[3] || "").charAt(0);

  // Convert 12h → 24h
  if (ampm === "P" && hour !== 12) hour += 12;
  if (ampm === "A" && hour === 12) hour = 0;

  // EDC logic: hours 0–11 (midnight-11am) are the next calendar day
  // Hours 12–23 (noon-11pm) are the base date minus one day (evening before)
  // Base date is already the "next morning" date.
  // e.g. friday night's baseDate is 2026-05-16 (Sat), and 7PM PT Friday = May 15 19:00 PT
  //
  // PT offset in May = UTC-7. So 7PM PT = 2AM UTC next day.
  //
  // Simpler approach: treat all times as PT on the base date.
  // Hours 0-11 → same baseDate (early morning hours)
  // Hours 12-23 → previous calendar day (evening hours, opening of festival night)

  let calendarDate = baseDate; // already the "morning of" date (Sat for Friday night)

  if (hour >= 12) {
    // Evening hours belong to the previous calendar day
    const d = new Date(baseDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    calendarDate = d.toISOString().slice(0, 10);
  }

  // Build PT time, then convert to UTC by adding 7 hours (PDT offset)
  const ptHour = hour;
  const utcHour = ptHour + 7;

  const dt = new Date(`${calendarDate}T00:00:00Z`);
  dt.setUTCHours(utcHour, min, 0, 0);

  return dt.toISOString().replace(".000Z", "Z");
}

function resolveStage(raw) {
  const key = normalise(raw);
  return STAGE_ALIASES[key] || key;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV needs a header row + at least one data row");

  const headerRaw = lines[0].toLowerCase();
  const headers = headerRaw.split(",").map((h) => h.trim());

  const artistIdx = headers.findIndex((h) => h === "artist" || h === "artist_name");
  const stageIdx = headers.findIndex((h) => h === "stage" || h === "stage_id");
  const nightIdx = headers.findIndex((h) => h === "night" || h === "day");
  const startIdx = headers.findIndex((h) => h === "start_time" || h === "start");
  const endIdx = headers.findIndex((h) => h === "end_time" || h === "end");
  const genresIdx = headers.findIndex((h) => h === "genres");
  const soundsIdx = headers.findIndex((h) => h === "sounds_like");
  const previewIdx = headers.findIndex((h) => h === "preview_kind" || h === "preview");

  if (artistIdx === -1 || stageIdx === -1 || nightIdx === -1 || startIdx === -1 || endIdx === -1) {
    throw new Error(
      `CSV header must contain: artist, stage, night, start_time, end_time\nGot: ${headers.join(", ")}`
    );
  }

  return lines.slice(1).filter(Boolean).map((line) => {
    // Simple CSV parse (handles quoted commas)
    const cols = parseCSVLine(line);
    const night = normalise(cols[nightIdx]);
    return {
      artist: cols[artistIdx].trim(),
      stage: cols[stageIdx].trim(),
      night,
      start_time: cols[startIdx].trim(),
      end_time: cols[endIdx].trim(),
      genres: genresIdx !== -1 && cols[genresIdx] ? cols[genresIdx].split(";").map((g) => g.trim()).filter(Boolean) : undefined,
      sounds_like: soundsIdx !== -1 ? cols[soundsIdx]?.trim() || undefined : undefined,
      preview_kind: previewIdx !== -1 ? cols[previewIdx]?.trim() || undefined : undefined,
    };
  });
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseJSON(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.sets || data.lineup || [];
  return arr.map((item) => ({
    artist: item.artist || item.artist_name,
    stage: item.stage || item.stage_id,
    night: normalise(item.night || item.day),
    start_time: item.start_time || item.start,
    end_time: item.end_time || item.end,
    genres: item.genres,
    sounds_like: item.sounds_like,
    preview_kind: item.preview_kind,
  }));
}

function detectAndParse(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJSON(trimmed);
  }
  return parseCSV(trimmed);
}

function run() {
  // Read input
  const inputFile = process.argv[2];
  let inputText;

  if (inputFile) {
    if (!fs.existsSync(inputFile)) {
      console.error(`File not found: ${inputFile}`);
      process.exit(1);
    }
    inputText = fs.readFileSync(inputFile, "utf-8");
  } else if (!process.stdin.isTTY) {
    inputText = fs.readFileSync(0, "utf-8");
  } else {
    console.log(`
┌────────────────────────────────────────────────┐
│  sync-lineup — Update EDC lineup times         │
├────────────────────────────────────────────────┤
│                                                │
│  Usage:                                        │
│    node scripts/sync-lineup.js times.csv       │
│    node scripts/sync-lineup.js times.json      │
│    cat times.csv | node scripts/sync-lineup.js │
│                                                │
│  CSV columns:                                  │
│    artist, stage, night, start_time, end_time   │
│                                                │
│  Times: ISO-8601 or shorthand (e.g. "1:30A")  │
│  Night: friday / saturday / sunday             │
│  Stage: kineticFIELD, circuitGROUNDS, etc.     │
│         (or short: kinetic, circuit, kin, cir) │
│                                                │
│  Optional cols: genres, sounds_like,           │
│                 preview_kind                   │
└────────────────────────────────────────────────┘
`);
    process.exit(0);
  }

  // Parse incoming data
  const incoming = detectAndParse(inputText);
  console.log(`\n🎧  Parsed ${incoming.length} sets from input\n`);

  // Load existing lineup
  const lineup = JSON.parse(fs.readFileSync(LINEUP_PATH, "utf-8"));
  const existingSets = lineup.sets;

  // Build lookup by normalised artist name
  const existingByName = new Map();
  for (const set of existingSets) {
    existingByName.set(normalise(set.artist_name), set);
  }

  // Track what we've touched
  const updated = [];
  const added = [];
  const touched = new Set();

  for (const item of incoming) {
    if (!item.artist) {
      console.warn("  ⚠ Skipping row with no artist name");
      continue;
    }

    const key = normalise(item.artist);
    const stageId = resolveStage(item.stage);
    const night = item.night;

    // Validate night
    if (!NIGHT_BASE_DATES[night]) {
      console.warn(`  ⚠ Unknown night "${night}" for ${item.artist}, skipping`);
      continue;
    }

    // Check if stage exists, add if not
    if (!lineup.stages[stageId]) {
      lineup.stages[stageId] = {
        name: item.stage,
        short: stageId.slice(0, 3).toUpperCase(),
        color: "#FFFFFF",
      };
      console.log(`  📍 New stage added: ${stageId} → "${item.stage}" (set color in lineup.json)`);
    }

    const startTime = shorthandToISO(item.start_time, night);
    const endTime = shorthandToISO(item.end_time, night);

    const existing = existingByName.get(key);

    if (existing) {
      // Update existing set
      const changes = [];
      if (existing.stage_id !== stageId) changes.push(`stage: ${existing.stage_id} → ${stageId}`);
      if (existing.night !== night) changes.push(`night: ${existing.night} → ${night}`);
      if (existing.start_time !== startTime) changes.push(`start: ${existing.start_time} → ${startTime}`);
      if (existing.end_time !== endTime) changes.push(`end: ${existing.end_time} → ${endTime}`);

      if (item.genres) existing.genres = item.genres;
      if (item.sounds_like) existing.sounds_like = item.sounds_like;
      if (item.preview_kind) existing.preview_kind = item.preview_kind;

      existing.stage_id = stageId;
      existing.night = night;
      existing.start_time = startTime;
      existing.end_time = endTime;

      if (changes.length > 0) {
        updated.push({ artist: existing.artist_name, changes });
      }
      touched.add(key);
    } else {
      // New artist
      const newSet = {
        id: slugify(item.artist, night),
        artist_name: item.artist,
        stage_id: stageId,
        night,
        start_time: startTime,
        end_time: endTime,
        genres: item.genres || [],
        sounds_like: item.sounds_like || `Sounds like ${item.artist}.`,
        preview_kind: item.preview_kind || "spotify",
      };
      lineup.sets.push(newSet);
      added.push(item.artist);
      touched.add(key);
    }
  }

  // Find removed artists (in old lineup but not in new input)
  const removed = existingSets.filter((set) => !touched.has(normalise(set.artist_name)));

  // Remove dropped artists
  if (removed.length > 0) {
    lineup.sets = lineup.sets.filter((set) => touched.has(normalise(set.artist_name)));
  }

  // Sort sets by night order then start time
  const nightOrder = { friday: 0, saturday: 1, sunday: 2 };
  lineup.sets.sort((a, b) => {
    const nightDiff = (nightOrder[a.night] ?? 9) - (nightOrder[b.night] ?? 9);
    if (nightDiff !== 0) return nightDiff;
    return Date.parse(a.start_time) - Date.parse(b.start_time);
  });

  // Write back
  fs.writeFileSync(LINEUP_PATH, JSON.stringify(lineup, null, 2) + "\n");

  // Report
  console.log("─── Sync Report ───────────────────────────────\n");

  if (updated.length > 0) {
    console.log(`✏️  Updated (${updated.length}):`);
    for (const u of updated) {
      console.log(`   ${u.artist}: ${u.changes.join(", ")}`);
    }
    console.log();
  }

  if (added.length > 0) {
    console.log(`🆕 Added (${added.length}):`);
    for (const a of added) {
      console.log(`   ${a}`);
    }
    console.log("   ℹ  Fill in genres/sounds_like in data/lineup.json for new artists\n");
  }

  if (removed.length > 0) {
    console.log(`🗑  Removed (${removed.length}):`);
    for (const r of removed) {
      console.log(`   ${r.artist_name} (${r.id})`);
    }
    console.log("   ⚠  Votes referencing removed set IDs will be orphaned\n");
  }

  if (updated.length === 0 && added.length === 0 && removed.length === 0) {
    console.log("   No changes detected — lineup is already in sync.\n");
  }

  console.log(`📄 Written to ${path.relative(process.cwd(), LINEUP_PATH)}`);
  console.log(`   ${lineup.sets.length} total sets across ${Object.keys(lineup.stages).length} stages\n`);
}

run();
