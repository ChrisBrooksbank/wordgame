# Implementation Plan

## Status

- Planning iterations: 1
- Build iterations: 1
- Last updated: 2026-03-24

## Tasks

### Phase 1: Project Scaffolding

- [x] Scaffold SvelteKit project with TypeScript strict mode, Tailwind CSS, Vitest, ESLint, Prettier (spec: 01-core-engine.md)
- [x] Add PWA manifest stub, favicon placeholder, and basic SvelteKit routing structure (spec: 01-core-engine.md)

### Phase 2: Core Engine

- [x] Implement hex grid data model: axial coordinates (q,r), adjacency calculation, support for 4x4/5x5/5x8 grid sizes + unit tests (spec: 01-core-engine.md)
- [x] Build word list compiler script: read ~280k word corpus, output DAWG/Trie binary to static/ (spec: 01-core-engine.md)
- [x] Implement DAWG/Trie word validator: load binary, isWord(), isPrefix() methods + unit tests (spec: 01-core-engine.md)
- [x] Implement scoring system: length² base score, rarity multipliers (1x-5x) lookup table + unit tests (spec: 01-core-engine.md)
- [x] Implement SVG hex grid renderer component: pointy-top hexes, tile display, responsive sizing (spec: 01-core-engine.md)
- [x] Implement tile selection mechanic: path building, adjacency validation, path visualization on SVG (spec: 01-core-engine.md)
- [x] Implement forge mechanic: word submission, tile consumption, gravity (tiles fall), new tile generation + tests (spec: 01-core-engine.md)
- [x] Implement Svelte stores + IndexedDB persistence via idb-keyval: game state save/restore (spec: 01-core-engine.md)

### Phase 3: Daily Forge Mode

- [x] Implement seeded PRNG (mulberry32) and daily puzzle generator: deterministic tile layout from date string (spec: 02-daily-forge.md)
- [x] Implement Catalyst Letter mechanic: center tile designation, enforce center tile in every word path (spec: 02-daily-forge.md)
- [x] Implement 15-move budget tracker and 1-5 star rating system based on score thresholds (spec: 02-daily-forge.md)
- [x] Build Daily Forge game screen: 5x5 hex grid, move counter, score display, end-of-game summary (spec: 02-daily-forge.md)
- [x] Implement Forge Map share card: abstract word-path visualization with no spoilers, copy-to-clipboard (spec: 02-daily-forge.md)
- [x] Implement streak system: daily streak counter, shield bank (1 per 7-day streak, max 3), streak-break protection (spec: 02-daily-forge.md)
- [x] Implement Forge Wheel: daily variable-ratio reward spinner shown on puzzle completion (spec: 02-daily-forge.md)

### Phase 4: Rush Mode

- [x] Build Rush Mode game screen: 4x4 hex grid, 90-second countdown timer, live score display (spec: 03-rush-mode.md)
- [x] Implement combo system: 1x-5x multiplier, resets after 3 seconds of inactivity, visual indicator (spec: 03-rush-mode.md)
- [x] Implement heat meter: tracks word frequency, highlights available 5+ letter words at max heat (spec: 03-rush-mode.md)
- [x] Implement adaptive difficulty: adjust letter distribution based on recent player performance (spec: 03-rush-mode.md)
- [x] Implement personal best tracking: high score, best combo streak, most words, longest word (spec: 03-rush-mode.md)

### Phase 5: PWA Infrastructure

- [x] Create complete Web App Manifest with all icon sizes (48-512px) and maskable variant (spec: 04-pwa-infrastructure.md)
- [x] Integrate Workbox service worker: cache-first for static assets and DAWG binary, network-first for dynamic data (spec: 04-pwa-infrastructure.md)
- [x] Implement offline detection: graceful degradation UI, disable network-dependent features when offline (spec: 04-pwa-infrastructure.md)
- [x] Implement custom install prompt: show after 3rd session or 2nd Daily Forge completion (spec: 04-pwa-infrastructure.md)

### Phase 6: Remaining Game Modes

- [x] Build Memory Crucible mode: 4x4 hex, show tiles briefly (8s→2s decreasing), play from memory, 3-strike game over (spec: 05-remaining-modes.md)
- [ ] Build Architect mode: rectangular grid, place letter fragments, difficulty tiers (4x4→7x7), par scoring + 3-star rating (spec: 05-remaining-modes.md)
- [ ] Build Cascade mode: 5x8 hex grid, auto-forge detection after gravity settle, chain multipliers (1-chain=1x, 4+=30x), 20-move budget (spec: 05-remaining-modes.md)

### Phase 7: Brain Training & Progression

- [ ] Implement 5-axis ELO rating system: Vocabulary Depth, Processing Speed, Pattern Recognition, Working Memory, Strategic Thinking (spec: 06-brain-training.md)
- [ ] Implement Forge Rank progression: 7 tiers (Spark → Legendary), rank-up ceremony UI (spec: 06-brain-training.md)
- [ ] Build achievement system: categories aligned to cognitive dimensions, unlock notifications (spec: 06-brain-training.md)
- [ ] Implement cosmetic reward system: board skins, tile styles, trail effects — all earned via gameplay (spec: 06-brain-training.md)
- [ ] Build radar chart visualization: 5-axis cognitive profile with trend lines, monthly shareable report (spec: 06-brain-training.md)

### Phase 8: Push Notifications (Cloudflare Workers)

- [ ] Deploy Cloudflare Worker for push notification delivery: daily reminders and streak-warning alerts (spec: 04-pwa-infrastructure.md)
- [ ] Implement push subscription opt-in flow on frontend, store subscription in Cloudflare KV (spec: 04-pwa-infrastructure.md)

## Completed

<!-- Completed tasks move here -->

## Notes

### Architecture Decisions
- **Tech Stack**: SvelteKit + TypeScript (strict) + Tailwind CSS + Vitest + ESLint/Prettier
- **Hex Rendering**: SVG with pointy-top orientation, axial (q,r) coordinate system
- **Word Validation**: Client-side DAWG binary (~280k words), built at compile time via scripts/buildWordList.ts
- **Daily Puzzles**: Seeded PRNG (mulberry32) — no server needed, date string is the seed
- **State Persistence**: Svelte stores + IndexedDB via idb-keyval
- **Offline-first**: All game logic works fully offline; Cloudflare Workers only for push notifications
- **No purchasable cosmetics**: All rewards earned through gameplay
- **Grid Sizes**: 4x4 (12 tiles) for Rush/Memory, 5x5 (19 tiles) for Daily, 5x8 (~30 tiles) for Cascade

### Dependency Order
Phase 1 (scaffolding) → Phase 2 (core engine) → Phase 3 (Daily Forge) and Phase 4 (Rush) can run in parallel → Phase 5 (PWA) can layer on at any point after Phase 1 → Phase 6 (remaining modes) depends on Phase 2 engine → Phase 7 (brain training) depends on all game modes being playable

### Performance Targets
- LCP < 2s, INP < 100ms, JS bundle < 80KB gzipped (spec: 04-pwa-infrastructure.md)
