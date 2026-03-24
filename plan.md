# Lexicon Forge — PWA Word Game Plan

## Context

We're building an original, best-in-class PWA word game from scratch (empty directory). Research shows the word game market grew 50%+ since 2022. The winning formula combines: daily scarcity (Wordle Effect), reactive gameplay (not static boards), multiple cognitive training modes, and friend-level social features. No existing game combines a reactive hex grid with tile consumption, cascade physics, and multi-mode cognitive training.

## Core Concept

**Lexicon Forge** — a hexagonal grid word game where you forge words by connecting adjacent tiles. When tiles are consumed, new ones fall in, creating cascading opportunities. You're not just finding words — you're sculpting the board state to unlock deeper, rarer words.

The forge metaphor runs throughout: tiles glow, words are "forged," combos create heat, and your profile is your "Forge Rank."

## 5 Game Modes

### 1. Daily Forge (Universal Daily Challenge)
- 5x5 hex grid (19 tiles), same puzzle for everyone, 15-move budget
- Catalyst Letter (must-use center letter, like Spelling Bee)
- Scoring: length² x rarity multiplier (common 1x → obscure 5x)
- 1-5 star rating, shareable Forge Map (abstract branching path, no spoilers)
- **Trains: Vocabulary Depth, Strategic Thinking**

### 2. Rush (Timed Flow)
- 4x4 hex grid, 90-second timer, no move limit
- Combo multiplier (1x→5x) for words within 3 seconds of each other
- Heat meter → at max, briefly highlights available 5+ letter words (variable reward)
- Adaptive tile difficulty based on running performance
- **Trains: Processing Speed, Pattern Recognition**

### 3. Memory Crucible
- 4x4 hex grid shown briefly, then tiles flip face-down
- Forge words from memory by tracing paths on hidden grid
- Rounds with decreasing view time (8s → 6s → 4s...)
- Game ends after 3 incorrect traces or 30s timeout
- **Trains: Working Memory, Vocabulary Depth**

### 4. Architect (Logic + Language)
- Crossword-style grid, place letter groups into regions
- Each row/column must form valid words, groups can't be split
- Scaling sizes: Apprentice (4x4) → Grandmaster (7x7)
- Par score and star rating based on moves vs optimal
- **Trains: Strategic Thinking, Pattern Recognition**

### 5. Cascade (Chain Thinking)
- Tall hex grid (5x8), tiles fall when consumed
- Engineer cascading chain reactions: falling tiles form auto-forged words
- Chain multipliers: 2-chain=5x, 3-chain=12x, 4+=30x
- 20 moves, no timer, pure strategy
- **Trains: Pattern Recognition, Strategic Thinking, Vocabulary**

## Progression System

- **Forge Rank**: Spark → Ember → Flame → Blaze → Inferno → Forge Master → Legendary
- **Streaks**: with Shield system (1 free shield per 7-day streak, bank up to 3, auto-uses on missed day)
- **Forge Wheel**: daily variable-ratio reward after Daily Forge (sparks/cosmetics/rare word cards)
- **Achievements**: tied to cognitive skill categories
- **Cosmetics**: board skins, tile styles, trail effects — all earned, never purchased

## Brain Training Tracking

5-axis radar chart ("Forge Profile"):
1. **Vocabulary Depth** — unique words, rarity, length
2. **Processing Speed** — Rush scores, time-per-word, combos
3. **Pattern Recognition** — cascade chains, consistency, novel board performance
4. **Working Memory** — Memory Crucible rounds, accuracy, planning depth
5. **Strategic Thinking** — star ratings, par performance, move efficiency

ELO-like adaptive rating per dimension. Weekly snapshots, 30-day trend lines, monthly shareable reports.

## Social Features

- Spoiler-free share cards (Forge Map shape + stars + score)
- Friend codes (8-char alphanumeric), friend leaderboard for Daily Forge
- Text sharing: `Lexicon Forge #142 ⭐⭐⭐⭐ | 2,340 pts | 🔥 12 words`
- No global leaderboard (friend-level is more motivating per research)

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | SvelteKit | Tiny bundles, compiled reactivity, PWA-ready |
| Language | TypeScript | Type safety for game logic |
| Styling | Tailwind CSS + custom animations | Rapid iteration + forge effects |
| Board | SVG hexagonal grid | Crisp at all sizes, hardware-accelerated |
| Word Validation | DAWG/Trie (~1.8MB compressed) | O(m) lookup, fully client-side |
| Daily Puzzles | Seeded PRNG (mulberry32) | Deterministic from date, no server needed |
| Storage | IndexedDB (idb-keyval) | Offline-first persistence |
| Backend | Cloudflare Workers + KV | Leaderboards, friend graph, push notifications |
| Auth | Anonymous-first, optional passkey/magic link | Zero-friction onboarding |
| Analytics | Plausible | Privacy-respecting, lightweight |

## Key Files to Create

- `src/lib/engine/hexGrid.ts` — hex coordinate system, adjacency, rendering
- `src/lib/engine/forgeEngine.ts` — core game loop (select, validate, consume, gravity, generate)
- `src/lib/engine/wordValidator.ts` — DAWG loading and lookup
- `src/lib/engine/scoring.ts` — score calculation, rarity multipliers
- `src/lib/stores/gameState.ts` — Svelte stores + IndexedDB sync
- `scripts/buildWordList.ts` — compile word corpus into DAWG binary

## Implementation Phases

### Phase 1: Core Engine (Weeks 1-3)
- SvelteKit + TypeScript + Tailwind + PWA scaffolding
- Hex grid engine (data model, SVG rendering, adjacency)
- Word validation (DAWG builder + runtime loader)
- Core forge mechanic (selection, validation, consumption, gravity, generation)
- Scoring system with rarity lookup
- IndexedDB persistence

### Phase 2: Daily Forge Mode (Weeks 3-5)
- Seeded PRNG for deterministic daily puzzles
- 15-move budget, Catalyst Letter, star rating
- Forge Map visualization + share card generation
- Streak system with shields
- Forge Wheel reward animation

### Phase 3: Rush Mode (Weeks 5-6)
- Timer, combo tracker, multiplier system
- Heat meter with variable-ratio highlights
- Adaptive tile distribution
- Personal best tracking

### Phase 4: PWA Infrastructure (Weeks 6-7)
- Service worker (Workbox: cache-first for assets, network-first for dynamic)
- Web app manifest, offline detection
- Push notifications via Cloudflare Workers
- Install prompt UX

### Phase 5: Remaining Modes (Weeks 7-10)
- Memory Crucible (flip animations, memory timer, round progression)
- Architect (grid generation, group placement, constraint validation)
- Cascade (tall grid, gravity physics, chain detection, cascade animation)

### Phase 6: Brain Training + Progression (Weeks 10-12)
- Cognitive profile engine (ELO-like per-dimension)
- Radar chart (SVG, animated), trend visualization
- Achievement system, Forge Rank, cosmetic unlocks

### Phase 7: Social Features (Weeks 12-14)
- Cloudflare Workers backend (KV, API routes)
- Friend codes, friend leaderboard, cross-device sync
- Share card refinement

### Phase 8: Polish + Launch (Weeks 14-16)
- Animation polish (forge glow, particle sparks, cascade waterfalls)
- Sound design (tile taps, forge chimes, combo sizzle)
- Haptics (Vibration API), accessibility audit, performance audit
- Landing page, soft launch

## Verification Plan

1. **Core engine**: unit tests for hex adjacency, word validation, scoring, gravity
2. **Each mode**: play-test manually, verify scoring, edge cases (no valid words, full board)
3. **PWA**: Lighthouse audit targeting 90+ on all categories
4. **Offline**: airplane mode testing — all modes playable, sync on reconnect
5. **Performance**: LCP < 2s, INP < 100ms, JS bundle < 80KB gzipped
6. **Cross-browser**: Chrome, Safari, Firefox on desktop + mobile
