# Design Document: flowwwww (Phase 1)
**EDC LV 2026 Companion App as v0**

## 1. Design System & Vibe
**Theme:** *Retro Warehouse Rave.* Lightweight, high-contrast, performant, and battery-friendly.

### 1.1 Color Palette
*   **Base Canvas:** Midnight Scanline. Pure pure dark gradient (`#0A0420` to `#1A0638`) overlaid with a fixed, 5% opacity repeating SVG noise texture. No heavy image backgrounds.
*   **Primary Accent (Action/Heart):** Hot Pink (`#FF3DCB`). 
*   **Secondary Accent (Info/Stages):** Electric Cyan (`#00FFDC`).
*   **Warning/Clash:** Acid Yellow (`#FFE600`).
*   **Glow Rule:** Apply CSS `box-shadow` glows *only* to active states (e.g., a tapped heart, the currently playing audio preview, a locked-in clash).

### 1.2 Typography
*   **Display / Headers / Numbers:** `Space Grotesk`. Chunky, retro-futuristic. Used for countdowns, stage names, and artist names on the swipe cards.
*   **Body / Data:** `Inter`. Clean and maximally legible. Used for times, comments, and the "Sounds like" text.

### 1.3 Crew Identity System
*   No profile pictures. No assigned colors. 
*   **The Emoji System:** Users select a "Rave Identity" emoji during onboarding (e.g., 👽, 🤠, 🍄, 🧚‍♀️, 😈, 🫠, 🪩).
*   Crew presence on the lineup is represented purely by these emojis resting on the right side of an artist row (e.g., `[ 👽 🤠 ]`).

### 1.4 Global Motion & Loaders
*   **Motion:** Spring-based animations using Framer Motion. Elements should have a slight, natural bounce, not a rigid linear snap.
*   **Loader:** "The DVD Daisy." A minimalist neon daisy SVG that bounces off the edges of the screen during initial app load. No standard spinning wheels.

---

## 2. Key User Flows

### Flow A: Crew Assembly (Onboarding)
1.  **User 1 (Creator)** opens the app via magic link. 
2.  Prompted: *"Pick your vibe"* (Selects 👽 emoji + types name).
3.  Lands on **Home**. Taps "Invite Crew."
4.  Native iOS share sheet opens. Sends URL to group chat.
5.  **User 2 & 3** click link, authenticate via magic link, pick their emojis (🤠, 🍄), and are instantly dropped into the shared crew.

### Flow B: Evaluating and Voting (The Core Loop)
1.  User opens the **Lineup** tab (Friday).
2.  Scrolls down. Sees an unfamiliar name: *"Odd Mob"*.
3.  Taps row. Row expands smoothly downwards (Accordion style).
4.  Reads: *"Sounds like your Dom Dolla and Chris Lake picks."*
5.  Taps "Play." A 15-second drop plays. The waveform animates in neon pink.
6.  User loves it. Taps the **Heart**.
7.  *Micro-interaction:* Heart fills pink, phone gives a haptic 'thud', and 3 tiny vector smileys/stars burst out and fade.
8.  User taps another row; the "Odd Mob" row collapses automatically.

### Flow C: Resolving a Clash
1.  User opens the **flowwwww** (Timeline View).
2.  Scrolls to 1:00 AM. Sees the timeline line split/fork.
3.  Sees a "Stacked Deck" of two cards with an Acid Yellow border: `[ ! ] CLASH ALERT · PICK ONE`.
4.  User taps the stack. It expands vertically into a list.
5.  User drags their preferred artist to the top position.
6.  Upon releasing the drag, the stack collapses into a single Locked card. The choice is synced to the crew.

---

## 3. Screen-by-Screen Breakdown

### Screen 1: Home
*Minimal landing pad. Gets you into the action immediately.*
*   **Header:** Huge `Space Grotesk` countdown: *"42 DAYS UNTIL EDC"*.
*   **Crew Roster:** A visual pill showing the 3 crew emojis pulsing slightly. Tapping it shows the invite link if < 3 users.
*   **Primary CTAs:** Two massive, chunky buttons spanning the screen width.
    *   `[ Vote on Lineup ]` (Pink accents)
    *   `[ View the flowwwww ]` (Cyan accents)

### Screen 2: Lineup (The Planner)
*High information density. Scannable.*
*   **Top Nav:** Sticky headers for Day (Fri / Sat / Sun). 
*   **Sub-Nav:** Stage filter pills that scroll horizontally.
*   **Collapsed Row:** 
    *   Left: Time (e.g., `11:30P`) + Stage shorthand.
    *   Middle: Artist Name (`Space Grotesk`).
    *   Right: Crew emojis (if any voted) + Hollow Heart outline.
*   **Expanded Row (Accordion):**
    *   Pushes rows below it down.
    *   Shows Artist Spotify Image (left-aligned, square).
    *   **Audio Player:** Neon waveform with a Play button.
    *   **Data Line:** *"Sounds like your [A] and [B] picks."*
    *   **Action Bar:** Large Heart button + Comment icon `💬`.

### Screen 3: The flowwwww (Two Modes)
*A toggle at the top switches between Timeline (Planning) and Swipe (Hype).*

**Mode A: Timeline View**
*   A vertical line runs down the left edge, connecting sets chronologically (Sunset to Sunrise).
*   Cards show confirmed sets. Time, Stage, Artist, and the emojis of who voted for it.
*   If a clash exists, it renders as the Acid Yellow "Stacked Deck" (see Flow C).

**Mode B: Swipe/Hype View**
*   Full-screen, immersive Instagram-Stories style cards.
*   **Progress Bar:** Segmented lines at the top showing chronological progress through the night.
*   **Background:** "Stage Worlds" effect. A massive, soft CSS radial gradient that crossfades to match the stage color of the current card (e.g., Pink for kineticFIELD, Cyan for circuitGROUNDS).
*   **Content:** Huge artist imagery, sounds-like text, and the crew emojis hovering at the bottom.
*   **Interaction:** Tap right to advance, tap left to go back. Audio preview (if previously granted permission) automatically triggers upon landing on the card.

### 4. Section 4 no longer needed! Skip to 5.


## 5. Edge Cases & Polish (Final Addendum)

### 5.1 Identity & Comments (Names + Emojis)
*   **Onboarding:** Users will input *both* a Name ("Koto") and select an Emoji (👽).
*   **Usage Context:** 
    *   *Lineup List (High Density):* Uses **Emojis only** to save space. (e.g., `[ 👽 🍄 ]` on the right edge).
    *   *Home Roster & Comments (Low Density):* Uses **Emoji + Name** for clarity. When reading the comment section on a set, it will look like a group chat:
        *   👽 **Koto:** *meet at the daisy tower before this*
        *   🍄 **Alex:** *im so down*

### 5.2 Empty States ("The Sad Owl")
*   **Trigger:** User navigates to Friday's `flowwwww` (Timeline or Swipe view) but the crew has 0 combined votes for Friday.
*   **Visual:** A minimalist, vector graphic of a sad/sleepy stylized owl (Space Grotesk typography below it).
*   **Copy:** *"No vibes detected yet."*
*   **Action:** A massive, glowing Hot Pink button: `[ Explore Friday's Lineup ]` that redirects them back to the voting screen. 

### 5.3 The "HEADLINER" Badge Logic
*   **Rule:** The set on a given night with the most crew votes gets the "HEADLINER" visual treatment in the Swipe/Hype view (a glowing crown/badge overlay and bolder typography).
*   **Tie-Breaker Logic (The "Late Night" Rule):** Because EDC scales its biggest acts into the early morning hours, if multiple sets tie for the most votes (e.g., three different sets all have 3 crew votes), the app will award the HEADLINER badge to the set with the **latest start time** (e.g., a 2:30 AM set beats a 11:00 PM set). 
*   **Engineer Translation:** `sets.sort((a, b) => b.votes - a.votes || new Date(b.start_time) - new Date(a.start_time))[0]`
