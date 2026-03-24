# Phase 5: Remaining Game Modes

## Overview

Implement Memory Crucible, Architect, and Cascade modes — each targeting different cognitive skills.

## User Stories

- As a player, I want a memory challenge mode to test my working memory
- As a player, I want a logic-puzzle mode that combines language with spatial reasoning
- As a player, I want a cascade/chain-reaction mode for deep strategic play

## Requirements

### Memory Crucible
- [ ] 4x4 hex grid (12 tiles) with letters shown briefly
- [ ] View phase: tiles visible for decreasing duration per round (8s → 6s → 4s → 3s → 2s)
- [ ] Hide phase: tiles flip face-down (smooth flip animation)
- [ ] Player traces paths on hidden grid from memory
- [ ] Correct word: tiles briefly reveal, score awarded, tiles consumed + refilled
- [ ] Incorrect trace (invalid path or not a word): strike (X mark)
- [ ] Game over: 3 strikes OR 30-second timeout per round
- [ ] Round progression: new tiles after each successful word, view time decreases
- [ ] Score bonus for longer words found from memory
- [ ] Display: round number, strikes remaining, view timer, score

### Architect Mode
- [ ] Crossword-style rectangular grid (not hex)
- [ ] Player receives letter groups (2-3 letter fragments)
- [ ] Place groups into grid regions so every row and column forms valid words
- [ ] Groups cannot be split or rearranged internally
- [ ] Difficulty scaling:
  - Apprentice: 4x4 grid, 2-letter groups
  - Journeyman: 5x5 grid, 2-3 letter groups
  - Master: 6x6 grid, 2-3 letter groups
  - Grandmaster: 7x7 grid, 3 letter groups
- [ ] Par score: optimal number of placement moves
- [ ] Star rating: 3 stars (≤ par), 2 stars (par+2), 1 star (par+5)
- [ ] Undo/redo support
- [ ] Puzzle generation: start from valid filled grid, extract groups, verify unique solution

### Cascade Mode
- [ ] Tall hex grid (5 wide × 8 tall, ~30 tiles)
- [ ] Standard word forging with tile consumption
- [ ] After tiles consumed, gravity pulls remaining tiles down
- [ ] Falling tiles that form valid words auto-forge (cascade!)
- [ ] Chain detection: scan for valid words after each gravity settle
- [ ] Chain multipliers: 1-chain=1x, 2-chain=5x, 3-chain=12x, 4+=30x
- [ ] 20-move budget, no timer — pure strategy
- [ ] Visual chain counter with escalating effects
- [ ] Score breakdown showing manual vs cascade-forged words
- [ ] Board state preview: show where tiles will fall before confirming word

## Acceptance Criteria

- [ ] Memory Crucible: tiles hide/reveal correctly, strikes tracked, rounds progress
- [ ] Memory Crucible: game over on 3 strikes or timeout
- [ ] Architect: grid validates all rows and columns as valid words
- [ ] Architect: groups cannot be split, difficulty levels generate correctly
- [ ] Cascade: gravity works correctly on tall hex grid
- [ ] Cascade: auto-forge detection finds valid words after gravity settle
- [ ] Cascade: chain multipliers apply correctly
- [ ] All three modes persist state and track statistics

## Out of Scope

- Mode-specific animations (Phase 8)
- Cognitive skill tracking integration (Phase 6)
- Mode-specific tutorials/onboarding (Phase 8)
