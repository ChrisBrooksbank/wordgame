# Lexicon Forge

A word forging game built with SvelteKit, featuring hexagonal tile grids and multiple game modes.

**Play now:** https://lexicon-wordforge.netlify.app

## Game Modes

- **Daily Forge** — 5x5 hex grid, 15 moves, catalyst letter. New puzzle each day.
- **Rush Mode** — 4x4 grid, 90 seconds, combos.
- **Memory Crucible** — 4x4 grid, memorize tiles, 3 strikes.
- **Architect** — Rectangular grid, place fragments.
- **Cascade** — 5x8 grid, auto-forge chains, 20 moves.

## Tech Stack

- [SvelteKit](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- DAWG (Directed Acyclic Word Graph) for word validation
- PWA with offline support
- Deployed on [Netlify](https://www.netlify.com/)

## Development

```bash
npm install
npm run build:wordlist   # generate word dictionary
npm run dev              # start dev server at localhost:5173
npm run build            # production build
npm run check            # typecheck + lint + format + test
```
