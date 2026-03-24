# Phase 3: Rush Mode

## Overview

Timed flow-state mode — 90 seconds, combo multipliers, heat meter, and adaptive difficulty for replayable high-score chasing.

## User Stories

- As a player, I want a fast-paced timed mode to test my speed
- As a player, I want combo rewards for finding words quickly in succession
- As a player, I want the game to adapt to my skill level
- As a player, I want to track and beat my personal best scores

## Requirements

### Core Mechanics
- [ ] 4x4 hex grid (12 tiles)
- [ ] 90-second countdown timer with visual urgency (color shifts in final 15s)
- [ ] No move limit — find as many words as possible
- [ ] Timer display with precision to tenths of a second
- [ ] Game-over screen with score breakdown

### Combo System
- [ ] Combo multiplier starts at 1x
- [ ] Finding a word within 3 seconds of the previous word increases combo (1x → 2x → 3x → 4x → 5x)
- [ ] Combo resets to 1x if more than 3 seconds pass between words
- [ ] Visual combo indicator with escalating effects
- [ ] Combo timer bar showing remaining time to maintain combo

### Heat Meter
- [ ] Heat meter fills based on words found and combo streaks
- [ ] At max heat: briefly highlight all available 5+ letter words on the board (3 seconds)
- [ ] Heat decays over time if no words are found
- [ ] Variable-ratio activation creates anticipation (not predictable threshold)
- [ ] Visual heat effects on the board (glow intensity increases)

### Adaptive Difficulty
- [ ] Track player's running average score and words-per-minute
- [ ] Adjust tile letter distribution based on performance:
  - Below average: more common letters (E, A, R, S, T)
  - Above average: more challenging letters (Q, X, Z, J, K)
- [ ] Difficulty adjusts between games, not mid-game
- [ ] Store difficulty profile in player stats

### Personal Bests
- [ ] Track all-time high score
- [ ] Track best combo streak
- [ ] Track most words in a single game
- [ ] Track longest word found
- [ ] Personal best notifications when broken

## Acceptance Criteria

- [ ] Timer counts down accurately from 90 seconds
- [ ] Combo multiplier increases/resets correctly at 3-second threshold
- [ ] Heat meter fills and triggers word highlights
- [ ] Tile distribution shifts based on player performance history
- [ ] Personal bests are tracked and displayed
- [ ] Score breakdown shows combo contribution

## Out of Scope

- Global leaderboards (Phase 7)
- Animations and particle effects (Phase 8)
- Sound effects for combos (Phase 8)
