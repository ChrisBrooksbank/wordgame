# CLAUDE.md

## Project Overview

Lexicon Forge — a word-forging game with hexagonal tile grids and multiple game modes. Players forge words from letter tiles in Daily Forge, Rush Mode, Memory Crucible, Architect, and Cascade modes.

**Live:** https://lexicon-wordforge.netlify.app

## Tech Stack

- SvelteKit + Svelte 5
- TypeScript
- Tailwind CSS
- DAWG (Directed Acyclic Word Graph) for word validation
- PWA with offline support
- Deployed on Netlify

## Development Commands

```bash
npm install
npm run build:wordlist   # Generate word dictionary (run first)
npm run dev              # Start dev server at localhost:5173
npm run build            # Production build
npm run check            # Typecheck + lint + format + test
```

## Architecture

- `src/lib/` — Shared components and utilities
- `src/routes/` — SvelteKit pages (one per game mode)
- `static/` — PWA manifest, icons
- Word list is compiled to a DAWG binary for fast validation

## Deployment

Auto-deploys to Netlify from the main branch.
