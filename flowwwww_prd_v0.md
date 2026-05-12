**flowwwww**

A planning companion for EDC Las Vegas 2026

**Product Requirements Document**

Phase 1 - Pre-festival planning

Version 0.1 · April 2026

# 1\. One-liner and context

flowwwww is a web app that helps a small group of friends plan, agree on, and get hyped for a multi-night festival together. Phase 1 is built specifically for EDC Las Vegas 2026 with a crew of 3 people.

The crew votes on which sets they want to see, the app collapses those votes into a single shared schedule (auto-resolving clashes by vote weight), and each night's plan can be experienced two ways: as a scannable timeline for planning, and as a swipeable stories-style walkthrough for hype.

**Guiding principle:** the app is a tool the crew uses _alongside_ their group chat, not a replacement for it. Any feature that duplicates what texting already does well gets cut. The app does what texting can't - pulling up the lineup, rendering the plan visually, previewing unknown artists, letting everyone see the same thing at the same time.

# 2\. Target user, goals, non-goals

## Primary user

Koto and two friends attending EDC Las Vegas 2026 together. iPhone users. Active group chat. Mix of rave experience - some know the big artists well, others are coming for the vibe and will discover most of the lineup through this app.

## Jobs to be done, in priority order

- **Explore the lineup together.** Make sense of 170+ artists across 8+ stages and 3 nights without anyone getting overwhelmed.
- **Agree on a shared plan.** Converge on one schedule per night that everyone's on board with, surfacing and resolving conflicts.
- **Get hyped.** Make the weeks leading up to EDC feel like a building anticipation, not a spreadsheet.
- **Discover new artists.** Give the crew a low-friction way to preview artists they haven't heard of, so the long tail of the lineup isn't scary.

## Explicit non-goals for Phase 1

- Supporting festivals other than EDC LV 2026.
- Supporting multiple itineraries within a single crew (split-up planning). Everyone's on one shared schedule.
- Real-time location sharing or 'where is Sam right now' mechanics.
- Notification system, status banners, or 'X hasn't seen the plan' indicators - group chat handles this.
- During-festival capture, memory, and recap (Phase 2+).
- Native iOS app - web/PWA only for v1.
- Account/auth infrastructure beyond the minimum needed to identify crew members.
- Public or global voting signal, strangers, discovery of other crews.
- Ticketing, artist social, or label integrations.

## Success criteria

Phase 1 is successful if all three crew members install the PWA, vote on the lineup, and arrive at EDC with a shared plan they actually reference during the festival. No analytics infrastructure is required - this is a direct, observable success condition.

# 3\. Core concepts and vocabulary

These terms are used throughout the product and the rest of this document. Getting the model right up front avoids drift later.

## The crew

The group of users planning together. For EDC 2026, size is 3. The crew is the only social unit in the product - there's no concept of 'other crews,' 'followers,' or public users. A user belongs to exactly one crew at a time in Phase 1.

## The lineup

The complete list of artists, stages, times, and nights for EDC 2026. Scraped once from the official source when it's published, then treated as a mostly-static reference. Schema allows for late additions and time changes, but the assumption is low churn.

## A set

A specific (artist × stage × start-time × end-time × night) combination. An artist can play more than once (different stages, different nights); each occurrence is its own set. Votes attach to sets, not artists, so that a user can want to see Fred again.. on Saturday night without being committed to his Friday back-to-back appearance.

## A vote / heart

A single action meaning 'I want to see this set.' There is one vote state: wanted / not wanted. Not voting is not the same as voting no - it just means 'not a priority, open to discuss.' This absence is itself useful data (it's the pool the app draws from later for discovery).

## The flowwwww

The single shared schedule for one night of EDC. Derived from the crew's votes, with clashes auto-resolved by vote weight (see §6). The flowwwww is always a single object per night (Friday flowwwww, Saturday flowwwww, Sunday flowwwww), not one per user. Every crew member sees the same flowwwww.

_Naming note:_ the lowercase and extra w's are intentional. It reads the way a friend would text it ('here's the flowwwww for saturday') and that tone is part of the product.

## A clash

Two or more sets with overlapping times that the crew collectively hearted. Clashes are the decision points that matter - they're where the plan has to collapse from 'everything we'd like' to 'what we're actually doing.'

# 4\. Design principles

These are the rules that should settle disagreements during implementation. If a feature fights one of these, cut the feature.

### 4.1 The app is the planner, the group chat is the conversation

Every feature earns its place by doing something texting can't. Rendering the lineup visually, previewing audio, showing the plan as a timeline, generating a shareable image - yes. Threaded discussion, DMs, reactions-as-primary-communication - no.

### 4.2 Less effort is always better, but information density is the real goal

The list view is dense on purpose. Rows show the minimum needed to decide (name, stage, time, crew signal) and expand inline for detail. Screens that make you navigate more than once to complete a common action are suspect.

### 4.3 Hype is a real feature, not decoration

The swipe view exists because seeing your night laid out as a sequence of beautiful cards feels different from seeing it as a grid. Both matter. The app should make someone want to open it the day before EDC just to look at Saturday's lineup one more time.

### 4.4 Rave-coded outside, warm inside

Visual language leans into PLUR aesthetics - deep violets, neon pink and cyan, glow on important elements, waveforms as both decoration and data viz. But content (lineup rows, comments, the flowwwww cards) stays legible and calm. The chrome is hype; the information is grounded.

### 4.5 Opinionated defaults, reversible at any time

Auto-resolve clashes by vote weight. Auto-populate the flowwwww from hearts. Auto-generate the swipe view in chronological order. Every auto-decision has a single-tap override. The app never needs you to confirm - if an action is easily undone, it should happen immediately.

### 4.6 Design for this specific crew, not for scale

3 users, 1 festival, 3 nights. This is a constraint, not a limitation. Designing for scale introduces complexity (multiple crews, permissions, moderation, notification hierarchies) that would actively make the product worse for the actual users. Scale concerns come later.

# 5\. Scope map - the three screens

Phase 1 is three screens. Anything that doesn't fit one of these three is out of scope.

## 5.1 Home

Minimal landing screen. Shows crew, countdown to EDC, and primary entry points to Lineup and the flowwwww. Crew invite link lives here.

- Crew roster with avatars.
- Days-to-EDC countdown.
- CTA into Lineup (voting).
- CTA into flowwwww (plan view).
- Quick invite link for new crew members (Phase 1 caps at 3 users but the mechanism is there).

## 5.2 Lineup

The primary voting surface. Dense scannable list of every set in the festival, with inline expansion for detail. One heart action per row.

- Grouped by day (Friday / Saturday / Sunday tabs) and sub-grouped by time block (Early / Peak / After Hours).
- Stage filter pills for narrowing.
- Each row: artist name, stage, time, crew-vote dots, heart button.
- Tapping a row expands it inline: preview player, genre tags, 'sounds like' line, crew row with reactions, comment affordance if any.
- Collapsing leaves the scroll position intact.
- Heart can be tapped from the row or the expanded view - same action, same state.

## 5.3 flowwwww

The shared schedule. Two views, user switches between them with a tab/toggle within the screen.

### Timeline view (planning)

- Single vertical column, sunset-to-sunrise, one card per set the crew is going to.
- Cards show artist, stage, time, comment indicator (if any comments), and crew avatars showing who hearted.
- Clashes auto-resolved; the 'losing' option can appear as a faded ghost card for context but is not an active part of the flow.
- Tap any card to open its detail (same UI as the expanded Lineup row).
- Any card can be edited: swap the auto-picked clash winner, remove from flow, etc.

### Swipe view (hype)

- Stories-style, full-screen cards, one per set in chronological order for the selected night.
- Pick a night (Fri / Sat / Sun) via day tabs at top.
- Swipe horizontally: left = next set, right = previous set.
- Progress dots at top (set N of M).
- The set with the most crew votes for that night gets a 'HEADLINER' treatment - visual differentiation, not a separate card.
- Each card shows the rich card design: artist name, stage, time, sounds-like line, crew avatars, comment indicator.
- Tap and hold to pause, tap to advance. Same grammar as Instagram Stories.
- Tapping any card opens its detail view (same as Lineup expansion, including the preview player).

# 6\. How clashes resolve

A clash is two or more sets with overlapping times where at least one crew member hearted each set. Clashes are the most product-critical moments because they're where the plan actually gets made. Phase 1 uses **auto-resolution by vote weight, with a manual override,** which is the lowest-friction path that still respects the crew's input.

## Resolution algorithm

- For each clash, count the number of hearts each conflicting set has.
- The set with the most hearts wins and appears in the flowwwww.
- Tie-breaker 1: the set with the earliest heart wins (rewards whoever flagged it first).
- Tie-breaker 2: if still tied, the app picks one deterministically and marks it as 'open' for crew input.

## State per set in the flowwwww

Every set in the flowwwww is in one of three states:

- **Locked** - no clash occurred, or the auto-resolve had a clear winner. Shown normally.
- **Auto-picked** - there was a clash; app picked a winner by vote weight. Displayed with a subtle 'auto' badge. Can be overridden by tapping and selecting an alternative.
- **Open** - clash with no clear winner (tied hearts). Displayed with a question-mark affordance that prompts the crew to pick one. No set is committed to the flowwwww until one is selected.

## Override

Any crew member can tap any auto-picked set and swap it for an alternative that clashed. The swap is immediate - no confirmation, no draft state. The change is visible to the whole crew instantly on next load.

If a swap feels controversial, the crew resolves it the way they already resolve everything: the group chat, or in person in Vegas. The app facilitates; it doesn't mediate.

## What we deliberately don't build for clashes

- No formal voting UI on clashes ('vote to swap'). The group chat is the voting mechanism.
- No change notifications or audit log. If a swap matters, people will talk about it.
- No 'lock-in' state that freezes the plan. Every set in the flowwwww is editable forever.
- No per-person view of 'what I'll do if the group splits.' Phase 1 is strictly one-plan.

# 7\. 'Sounds like' - the artist preview system

For the long tail of EDC's lineup, most crew members won't recognize the artist name. The 'sounds like' line is the single most important piece of content for making voting feel low-friction instead of overwhelming.

## Primary source: Last.fm similar artists API

Last.fm still exposes similar-artists data based on scrobble collaborative filtering. It's free, reliable, and reasonably accurate for EDM's mainstream and mid-tier - less reliable for the deepest long tail but fine.

_Why not Spotify:_ Spotify deprecated the Related Artists and Recommendations endpoints for new applications in November 2024. For any new app, this door is closed.

## Two-tier content strategy

When rendering the 'sounds like' line for an artist, the app tries tiers in order and uses the first that produces content:

### Tier 1 - Personalized (preferred)

Cross-reference Last.fm's similar-artists list for the current artist against the crew's already-hearted artists. If there's overlap, render: 'Sounds like your \[Artist A\] and \[Artist B\] picks.' Use up to two crew-relevant references. This is dramatically more useful than generic similarity because it anchors the comparison in artists the user has actively endorsed.

### Tier 2 - Generic fallback

If no crew-relevant matches exist, show the top 1-2 most well-known similar artists from Last.fm: 'Sounds like Disclosure.' Always show something - a fallback is better than a blank line because the field becomes a reliable anchor point on the card.

## Content placement

The 'sounds like' line lives in the expanded row of the Lineup list, not on the collapsed row (too much text for a row that's meant to be scanned). It also appears on the swipe view cards and in the shareable flowwwww image.

## Preview audio

15-second audio previews from a characteristic part of one of the artist's biggest tracks.

- Primary source: Spotify preview_url (still available on track objects, even post-deprecation, for tracks that expose it).
- Fallback: YouTube embed of their top track if no Spotify preview is available.
- First play in a session requires a tap (browser autoplay restrictions). Subsequent plays in the same session can continue auto-playing briefly after tap-to-advance since the gesture has already been granted.
- Closing the expanded row or navigating away stops playback.

# 8\. Voting mechanics - the lineup in depth

## The action: one heart

The only voting action is a heart: 'I want to see this set.' No multi-tier (no must-see / interested / pass). Reasons this single-action model was chosen:

- A 3-person crew has obvious taste overlap and the differentiation between 'must-see' and 'interested' doesn't produce meaningfully different scheduling outcomes. The group chat will absorb any nuance.
- Every additional action state creates UI surface, social friction, and a decision the user has to make.
- Not voting is itself a valid and useful state - the 'neutral pool' is what the discovery surface will draw from in Phase 2.

## Defaults and visibility

- A row's visual state changes when hearted - the background gets a subtle pink glow and the heart icon fills. Zero-ambiguity about whether a vote is registered.
- Crew members' votes are visible as small colored dots on each row (one dot per crew member who hearted).
- Crew members' votes do NOT show which direction they voted - only that they voted. Since 'heart or no heart' is binary, a dot's presence is all the information that exists.
- A user who hasn't hearted a set isn't rendered on that set's row - their absence is invisible. This avoids any sense of social pressure.

## Unfamiliar artists

For artists the user doesn't recognize, the flow is: see name → genre tag catches attention → tap row to expand → preview plays on button tap → heart or move on. The expanded row is designed so that 'preview, glance at sounds-like, decide' takes under 20 seconds.

## Coverage expectations

The app does not expect or require the user to vote on every artist. The crew's combined hearts on the most anticipated 30-50 sets across the three nights is enough signal to build a working flowwwww. Anything beyond that is bonus.

# 9\. Comments

Comments absorb three distinct use cases: clash discussion ('actually I really want Four Tet'), hype ('omg gotta see him'), and logistics ('meet me here before'). All three get the same lightweight surface.

## Model

- Any set can have comments. Comments attach to a set, not to an artist - different sets by the same artist have independent threads.
- Comments are flat (no nesting / threading). Short messages in time order.
- Text only in v1 - no image uploads, no links, no @mentions.
- Reactions (emoji) on any comment. These are the primary mechanism for low-information agreement ('yes', 'lol', 'ugh').
- No moderation needed for a 3-person crew.

## Visibility

- A small comment indicator icon (💬) appears on any set card (both in the Lineup list and in the flowwwww timeline / swipe view) when comments exist. The icon shows only presence, not a count, in v1 - keeps the visual minimal.
- Comments are not visible on the collapsed Lineup row. They surface when the row is expanded or when the set is tapped in the flowwwww.

## Not building in v1

- Notifications for new comments. The group chat exists; the crew will see comments when they open the app.
- Reply-to-comment. Reactions are sufficient.
- Edit/delete history. Soft-delete only; no audit trail.

# 10\. Visual and interaction design

## 10.1 Vibe

Two intersecting axes. Visual: rave/PLUR - deep violets, neon pinks and cyans, acid yellows, glow on important elements, waveform motifs, subtle scanline/noise textures on surfaces. Interaction: playful - swipe gestures, spring-based animations, confetti moments on completion, loading screens that build anticipation.

## 10.2 Color system

- **Base surface:** deep violet-black (#0A0420 to #1A0638 gradient) - the night sky base.
- **Primary accent:** hot pink (#FF3DCB) - used for the heart action, primary CTAs, user identity.
- **Secondary accent:** electric cyan (#00FFDC) - used for crew signal, info surfaces.
- **Warning/attention:** acid yellow (#FFE600) - used for clashes, 'new' tags.
- **Additional:** violet (#B94FFF) for tertiary accents, electric green (#C9FF4D) reserved for stats/breakdowns.
- **Glow rule:** glow effects only on important CTAs and active preview states. Glow should mean something.

## 10.3 Typography

- **Display:** a rounded/chunky grotesque like Space Grotesk or Chillax. Confident and big on hero moments.
- **Body:** Inter or DM Sans. Clean, readable, no stylistic fight with the display face.
- **Hierarchy:** size and weight contrast do the heavy lifting. Avoid overusing all-caps except for short tracking labels ('CLASH · 1A').

## 10.4 Motion principles

- Spring-based, slight overshoot on transitions - nothing snaps into place flatly.
- Swipe commits (heart, next card) get a confetti/particle burst and a gentle haptic-style visual bump.
- Loading states are waveforms or pulsing owls, never spinners.
- The preview playback waveform animates in sync with audio progress - active portion bright, unplayed ghosted.
- Collapsing/expanding list rows uses smooth vertical spring; rows below are pushed down, not overlapped.

## 10.5 Tone of voice

Scene-literate and warm. 'Your crew is voting' not 'Awaiting participant responses.' 'Clash alert - you can't be at both' not 'Schedule conflict detected.' The app reads as a friend texting the plan, not a calendar app rendering it.

# 11\. Data and integrations

## 11.1 EDC lineup data

- Source: scraped one-time from the official EDC Las Vegas 2026 schedule when it's published by Insomniac.
- Stored as a static JSON file bundled with the app - no live fetch from Insomniac.
- When the lineup changes (late additions, cancellations, time swaps), the JSON is manually updated and redeployed. Acceptable churn for 3 nights of a single festival.
- Schema must accommodate multiple sets per artist, multiple stages, and the overnight schedule (a set at 2am belongs to the prior calendar day's 'night').

## 11.2 Stage geography and walk times

- A static walk-time matrix between each pair of stages at the Las Vegas Motor Speedway. ~8 stages → ~28 pairs.
- Measured manually by looking at the festival map. Rough minutes-between-stages estimates are sufficient.
- Used to inform clash messaging ('17 min walk between these two stages') but not automated plan optimization in v1.

## 11.3 Audio previews

- Spotify preview_url is the primary source - still available on track objects for tracks that expose it.
- Spotify artist metadata (image, monthly listeners) via the standard /artists endpoint, which is not deprecated.
- Fallback: for artists/tracks without Spotify preview_url, embed a YouTube top-track result.
- Fetched client-side at runtime, not pre-bundled - avoids stale previews and licensing concerns.

## 11.4 Similar artists / 'sounds like'

- Last.fm API - specifically the artist.getSimilar method.
- Results cached client-side per artist after first fetch.
- Top 10 similar artists are pulled; the app selects the best 1-2 for the 'sounds like' line based on (a) crew overlap, then (b) general fame.

## 11.5 Image assets

- Artist images from Spotify's artists/{id} endpoint.
- Stage color/theme colors hand-coded (one-time, ~8 stages).
- EDC-specific illustrative elements (owls, kineticFIELD motifs) created in-house - do not use official EDC or Insomniac imagery/IP.

## 11.6 Data we explicitly don't collect in Phase 1

- Location data of any kind.
- Health/fitness data (HealthKit is deferred to Phase 2).
- Spotify user listening history (requires OAuth; deferred).
- Any analytics beyond what's needed to verify the app works for the crew.

# 12\. Platform and authentication

## 12.1 PWA (Progressive Web App)

v1 is a web app with PWA enhancements - installable to the iOS home screen, works offline for already-loaded content, renders full-screen when launched from home screen.

Native iOS is explicitly deferred. The crew is small enough that 'install the PWA from this link' is low friction, and building native blocks ship timing.

## 12.2 Authentication

- Magic-link auth (email-based, no passwords).
- One crew per user in Phase 1 - no switcher, no multi-crew accounts.
- First user creates the crew and gets an invite link to send to others.
- Joining via invite link auto-places the user in that crew.
- User identity: name + avatar color picked at join time. No uploaded profile photos in v1.

## 12.3 Offline behavior

- The lineup JSON is bundled and works offline immediately.
- Artist images, preview URLs, and sounds-like data are fetched online but cached after first load.
- Voting and comments require online to sync to other crew members but should not break the UI when offline (queue and sync).
- Offline is meaningful even in Phase 1 - at EDC itself, cell coverage is unreliable even just for checking the plan.

# 13\. Explicitly deferred - not in Phase 1

Captured here so these aren't rediscovered as surprises later. Each is a real direction with a real use case, just not one that fits the v1 timebox.

## 13.1 Phase 2 - During-festival experience

- One-tap moment capture (photo / voice note auto-tagged with current set).
- Self-reported location ('I'm at kineticFIELD') for lightweight crew coordination.
- Gap-filling / discovery surface - 'it's 2am and you have 45 minutes before Anyma, here's an unknown artist playing nearby.'
- Aggressive offline/battery discipline in service of surviving a 3-night festival.

## 13.2 Phase 3 - Memory and recap

- Per-night and per-festival recaps - your path through the venue, starred song moments, photos, voice notes.
- A Wrapped-style shareable sequence ('your EDC in 10 cards') - note that in v1 the swipe-through-your-night view absorbs most of this job for the pre-festival moment.
- HealthKit integration for dance-miles stat, if native app is built.
- Shareable recap images to the group chat.

## 13.3 Multi-itinerary support

When the crew grows beyond ~5 people, one shared schedule stops being realistic - at a festival like Coachella with a 12-person crew, groups naturally split. Supporting this properly requires:

- A flowwwww object owned by a subgroup, not the whole crew.
- A user can belong to multiple subgroups; see their own primary itinerary but switch to see others'.
- Group rendezvous markers on the timeline ('we all meet back here at Dom Dolla').
- Self-reported location becomes critical infrastructure (not optional).

This isn't just a 'toggle' on the v1 model. The data model changes meaningfully, and the coordination surface becomes a real feature rather than a non-goal. Flag when scoping v2 so it doesn't get rushed.

## 13.4 Multi-festival generalization

Same core product, pointed at other festivals. Requires lineup-import infrastructure (scrape tooling or partnerships), stage geography per venue, and the ability for a crew to select which festival they're planning for. The single-card 'rich card' design is already portable - it was designed for this use case even though v1 doesn't deploy it generally.

## 13.5 Pre-festival ceremonial recap

A Wrapped-style 10-card swipeable sequence unlocked ~7 days before the festival ('Your EDC is taking shape'). Designed in detail during product exploration, not shipped in v1 because the swipe-through-your-night view covers the hype job adequately. Easy to add on top later - all the data is there.

## 13.6 Radiate-style social features

Social/community features - connecting with other ravers, marketplace, meeting strangers going to the same shows - are out of scope. The crew is the only social unit.

# 14\. Open questions for implementation

Things we've intentionally not resolved yet because they're downstream of decisions still to be made. Flagged here so they don't get missed.

## 14.1 Data model specifics

- Exact schema for the lineup JSON - we've specified the concepts (artist, set, stage, night) but not the serialization.
- How to model overnight sets - a set starting Friday at 11pm and ending Saturday at 1am. Probably tied to a 'festival night' concept rather than a calendar date.
- What the minimum viable walk-time matrix looks like - is it a flat pairwise map, or do we need stage-to-stage-via-common-paths?

## 14.2 Hosting and backend

- Where do votes and comments persist? Firestore / Supabase / a minimal custom backend?
- Rate limits on Last.fm and Spotify APIs - do we need a small proxy layer for caching, or is per-user client-side caching enough for a 3-person crew?
- Is magic-link auth self-hosted or via a provider?

## 14.3 Design / interaction specifics

- How does the day switcher render on the two flowwwww views - tabs, a segmented control, a swipe? Different UX for the two views or shared?
- The 'headliner' set - is it determined purely by crew vote count, or is there a tiebreaker (e.g. most famous artist)?
- When previewing audio in the expanded row, does it keep playing if the user scrolls the list? Pauses? Ducks?
- For the swipe view: if the user has 0 hearts on a night (no plan), what does the swipe view show? An empty state? A gentle nudge back to Lineup?

## 14.4 Lineup delivery

- EDC 2026 lineup drop schedule - need to monitor Insomniac for announcements and set up a scraping workflow.
- Handling phased lineup releases (sometimes set times are announced later than artist names).
- What's the plan for last-minute changes during the festival itself? Probably a simple admin page that rewrites the JSON.

# Appendix A - Conversation summary and decision log

This section is a brief record of key decisions reached during product exploration, with the reasoning. Useful context for anyone picking up this PRD fresh.

### Why festival-first, not general concert app

A general 'concert companion' competes directly with Songkick / Bandsintown and has a weak 'why switch' story. A festival-specific tool has a sharper wedge, genuinely underserved (official festival apps are bad at everything except during-event), and the before/during/after arc maps naturally to the product.

### Why EDC specifically

EDC LV has real constraints that generic festival tools ignore: overnight schedule, 8+ stages, huge geography, dense and tiered lineup, strong scene culture. Solving it well is both harder and more differentiating.

### Why one action (heart), not multiple tiers

Initially explored a 5-action model (must-see / yes / maybe / pass / hard-no) and a 3-action model (must-see / interested / neutral). For a 3-person crew, the extra tiers don't produce meaningfully different scheduling outcomes - obvious consensus sets are obvious, and the group chat handles nuance better than any UI. One action is cleaner, less socially fraught, and uses the 'not voted' state as its own useful signal.

### Why list view over swipe-to-vote

A Tinder-style swipe-through-every-artist flow felt fun in mockup but is actually a 170-decision task. Most lineup entries don't warrant a decision - users have strong opinions on ~20 artists and are neutral on the rest. A list with inline expansion is faster, respects the asymmetry of user knowledge, and keeps the card design for places it genuinely shines.

### Why inline expansion, not a separate card screen

The rich-card-as-screen pattern creates a navigation cost that compounds across many votes and hurts PWA feel (no free back-gesture). Inline expansion keeps the list as the home base, allows multiple rows expanded simultaneously if desired, and scopes the card's real job to 'detail view' rather than 'navigation destination.'

### Why one shared schedule, not per-person

The EDC 2026 crew is 3 people who intend to stay together. Forcing a per-person itinerary model adds complexity (who's where, how do we coordinate?) that isn't needed until the crew grows past ~5 and splitting up becomes the norm. Flagged as real v2 work, not a quick toggle.

### Why auto-resolve clashes

Clashes are the only tension points in planning, and forcing a vote-on-every-clash UI is busywork when the answer is usually obvious (more hearts = winner). Auto-resolution with a single-tap override handles 95% of cases silently and lets the crew chat absorb the 5% that matter.

### Why no banners / notifications about crew state

Group chat already does this well. Any feature that duplicates 'your friend opened the app' or 'plan was changed' adds cognitive load to a product whose users are already talking to each other.

### Why PWA over native

Faster to ship, works for the actual users (small iOS-using crew), cross-platform-adjacent. Genuine tradeoffs: HealthKit and deep OS integration are deferred to Phase 2 where they matter most anyway.

### Why Last.fm for similar artists

Spotify deprecated the Related Artists and Recommendations endpoints for new applications in November 2024. Last.fm is free, well-documented, still active, and its scrobble-based similarity is reasonably accurate for mainstream and mid-tier EDM. Personalizing the 'sounds like' line using crew-hearted artists as the reference makes the feature dramatically more useful than a generic similarity comparison.