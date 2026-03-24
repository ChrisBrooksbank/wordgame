# Phase 1: Core Engine

## Overview

Foundation layer: SvelteKit project scaffolding, hex grid engine, word validation, core forge mechanic, scoring, and persistence.

## User Stories

- As a player, I want to see a hexagonal grid of letter tiles so that I can find words
- As a player, I want to trace a path through adjacent tiles to form a word
- As a player, I want consumed tiles to disappear and new tiles to fall in so the board stays full
- As a player, I want my score to reflect word length and rarity

## Requirements

### Project Scaffolding
- [ ] SvelteKit project with TypeScript strict mode
- [ ] Tailwind CSS configured with custom theme (forge colors: amber, orange, red gradients)
- [ ] PWA manifest stub (name: Lexicon Forge, theme color, icons placeholder)
- [ ] Vitest configured for unit tests
- [ ] ESLint + Prettier configured
- [ ] `npm run check` script that runs typecheck + lint + format-check + tests

### Hex Grid Engine (`src/lib/engine/hexGrid.ts`)
- [ ] Axial coordinate system (q, r) for hexagonal grid
- [ ] Configurable grid sizes: 4x4 (12 tiles), 5x5 (19 tiles), 5x8 (tall, ~30 tiles)
- [ ] Adjacency calculation for hex tiles (6 neighbors)
- [ ] Path validation: each tile in path must be adjacent to previous
- [ ] SVG rendering helpers: hex-to-pixel conversion, pointy-top orientation
- [ ] Grid generation with letter distribution (weighted by English frequency)

### Word Validation (`src/lib/engine/wordValidator.ts`)
- [ ] DAWG/Trie data structure for O(m) word lookup
- [ ] Build script (`scripts/buildWordList.ts`) to compile word corpus into compact binary
- [ ] Runtime loader that fetches and deserializes the DAWG
- [ ] Prefix checking (is this partial path a valid prefix?) for UX hints
- [ ] Word list: standard tournament word list (~280k words)

### Core Forge Mechanic (`src/lib/engine/forgeEngine.ts`)
- [ ] Tile selection: tap/click tiles to build a path
- [ ] Path visualization: highlight selected tiles, show connecting line
- [ ] Word submission: validate path forms a real word
- [ ] Tile consumption: remove used tiles from grid with animation trigger
- [ ] Gravity: tiles above consumed tiles fall down to fill gaps
- [ ] Tile generation: new random tiles appear at top to fill remaining gaps
- [ ] Minimum word length: 3 letters

### Scoring (`src/lib/engine/scoring.ts`)
- [ ] Base score: length² (3-letter=9, 4=16, 5=25, 6=36, 7=49, 8+=64+)
- [ ] Rarity multiplier lookup: common (1x), uncommon (2x), rare (3x), epic (4x), obscure (5x)
- [ ] Rarity derived from word frequency corpus
- [ ] Score display with multiplier breakdown

### Persistence (`src/lib/stores/gameState.ts`)
- [ ] Svelte stores for reactive game state
- [ ] IndexedDB persistence via idb-keyval
- [ ] Save/restore game state across sessions
- [ ] Store player statistics (games played, total score, best words)

## Acceptance Criteria

- [ ] `npm run check` passes (typecheck, lint, format, tests)
- [ ] Hex grid renders correctly at all 3 sizes in SVG
- [ ] Can trace a path and submit a valid word
- [ ] Tiles fall and regenerate after word consumption
- [ ] Score calculates correctly with rarity multiplier
- [ ] Game state persists across page reloads
- [ ] Unit tests cover hex adjacency, word validation, scoring, gravity

## Out of Scope

- Game modes (Daily Forge, Rush, etc.) — those are later phases
- Animations and visual polish — Phase 8
- Backend/social features — Phases 7-8
- Sound and haptics — Phase 8
