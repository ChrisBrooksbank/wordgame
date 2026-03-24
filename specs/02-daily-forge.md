# Phase 2: Daily Forge Mode

## Overview

The flagship daily challenge mode — same puzzle for everyone, 15-move budget, Catalyst Letter mechanic, star rating, and shareable results.

## User Stories

- As a player, I want a new puzzle every day so I have a reason to come back
- As a player, I want to know everyone got the same puzzle so I can compare fairly
- As a player, I want a star rating so I can gauge my performance
- As a player, I want to share my result without spoiling the puzzle
- As a player, I want my streak tracked with protection against missed days

## Requirements

### Daily Puzzle Generation
- [ ] Seeded PRNG (mulberry32) generates deterministic puzzle from date string
- [ ] 5x5 hex grid (19 tiles) with balanced letter distribution
- [ ] Catalyst Letter: center tile must be used in every valid word
- [ ] Puzzle quality validation: ensure minimum viable words exist (≥15 words findable)
- [ ] Same seed = same puzzle worldwide (timezone-aware: UTC midnight rollover)

### Game Rules
- [ ] 15-move budget (each word submission = 1 move)
- [ ] Catalyst Letter enforcement: words not containing it are rejected with feedback
- [ ] Move counter display with remaining moves
- [ ] Game ends when moves exhausted or player submits final score
- [ ] Cannot replay the same day's puzzle (locked after completion)

### Star Rating
- [ ] 1-5 star rating based on score thresholds
- [ ] Thresholds calculated per-puzzle based on theoretical max score
- [ ] Star display with animation on game completion
- [ ] Historical star ratings stored per day

### Forge Map (Share Card)
- [ ] Abstract branching path visualization showing word discovery order
- [ ] No spoilers: shows structure (lengths, branches) but not actual letters/words
- [ ] One-tap copy to clipboard as text: `Lexicon Forge #[day] ⭐⭐⭐⭐ | 2,340 pts | 🔥 12 words`
- [ ] Visual share card (canvas/SVG → image) for social media

### Streak System
- [ ] Track consecutive days played
- [ ] Shield system: 1 free shield earned per 7-day streak
- [ ] Bank up to 3 shields maximum
- [ ] Auto-use shield on missed day (no manual intervention)
- [ ] Streak display with shield count

### Forge Wheel
- [ ] Daily variable-ratio reward after completing Daily Forge
- [ ] Reward types: sparks (XP), cosmetic items, rare word cards
- [ ] Spin animation with weighted random outcome
- [ ] Can only spin once per day (after completing puzzle)

## Acceptance Criteria

- [ ] Same date produces identical puzzle across devices
- [ ] Catalyst Letter mechanic works correctly
- [ ] 15-move budget enforced
- [ ] Star rating displays on completion
- [ ] Share text copies correctly to clipboard
- [ ] Streak persists across sessions
- [ ] Shields auto-activate on missed days
- [ ] Forge Wheel spins once per day with random reward

## Out of Scope

- Forge Wheel cosmetic items rendering (Phase 6)
- Friend leaderboard for daily scores (Phase 7)
- Push notification reminders (Phase 4)
