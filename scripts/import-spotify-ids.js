#!/usr/bin/env node
/**
 * import-spotify-ids.js — Read SPOTIFY_IDS.md and merge any non-empty
 * Spotify IDs into data/artist-annotations.json.
 *
 * Workflow:
 *   1. Open SPOTIFY_IDS.md (markdown table at the repo root).
 *   2. For each artist you've verified, paste the 22-char ID into the
 *      "Spotify ID" cell. (Get it from open.spotify.com/artist/{ID} —
 *      the 22 characters after /artist/.)
 *   3. Run: node scripts/import-spotify-ids.js
 *   4. Run: node scripts/build-lineup-from-csv.js
 *
 * The script is non-destructive: rows with empty IDs are skipped, existing
 * IDs in artist-annotations.json are preserved unless overwritten by a
 * non-empty cell. Logs every change for review.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TABLE_PATH = path.join(ROOT, "SPOTIFY_IDS.md");
const ANNOTATIONS_PATH = path.join(ROOT, "data/artist-annotations.json");

const SPOTIFY_ID_PATTERN = /^[A-Za-z0-9]{22}$/;

function main() {
  if (!fs.existsSync(TABLE_PATH)) {
    console.error(`SPOTIFY_IDS.md not found at ${TABLE_PATH}`);
    process.exit(1);
  }
  const md = fs.readFileSync(TABLE_PATH, "utf-8");
  const annotations = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, "utf-8"));

  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const line of md.split(/\r?\n/)) {
    // Match "| Artist | Stage | ID |" rows (skip header + separator).
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.toLowerCase().includes("| artist |")) continue;

    const cols = line.split("|").map((c) => c.trim());
    // ["", "Artist", "Stage", "ID", ""]
    if (cols.length < 5) continue;
    const artist = cols[1];
    const id = cols[3];
    if (!artist) continue;
    if (!id) { skipped++; continue; }

    if (!SPOTIFY_ID_PATTERN.test(id)) {
      console.warn(`  ⚠ "${artist}": invalid Spotify ID "${id}" — must be 22 alphanumeric chars`);
      invalid++;
      continue;
    }

    if (!annotations[artist]) {
      console.warn(`  ⚠ "${artist}" not in artist-annotations.json (typo? new artist?)`);
      invalid++;
      continue;
    }

    if (annotations[artist].spotify_id === id) continue; // no change

    annotations[artist].spotify_id = id;
    console.log(`  ✏  ${artist} → ${id}`);
    updated++;
  }

  fs.writeFileSync(ANNOTATIONS_PATH, JSON.stringify(annotations, null, 2) + "\n");

  console.log(`\nDone. ${updated} updated, ${skipped} blank rows skipped, ${invalid} invalid.`);
  console.log(`\nNext: node scripts/build-lineup-from-csv.js`);
}

main();
