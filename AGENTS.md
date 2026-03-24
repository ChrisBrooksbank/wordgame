# AGENTS.md - Operational Guide

Keep this file under 60 lines. It's loaded every iteration.

## Project

Lexicon Forge — hexagonal grid word game PWA built with SvelteKit + TypeScript + Tailwind CSS.

## Build Commands

```bash
npm run build          # Production build
npm run dev            # Development server
```

## Test Commands

```bash
npm test               # Run tests (watch mode)
npm run test:run       # Run tests once
npm run test:coverage  # Coverage report
```

## Validation (run before committing)

```bash
npm run check          # Run ALL checks (typecheck, lint, format, tests)
```

## Tech Stack

- Framework: SvelteKit
- Language: TypeScript
- Styling: Tailwind CSS + custom animations
- Board: SVG hexagonal grid
- Word Validation: DAWG/Trie (client-side)
- Daily Puzzles: Seeded PRNG (mulberry32)
- Storage: IndexedDB (idb-keyval)
- Backend: Cloudflare Workers + KV

## Project Notes

- Hex grid uses axial coordinates (q, r)
- All game logic must work fully offline
- Word list compiled to DAWG binary format
- Daily puzzles are deterministic from date seed
