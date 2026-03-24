# Phase 6: Brain Training & Progression

## Overview

Cognitive profile tracking, Forge Rank progression, achievements, and cosmetic reward system.

## User Stories

- As a player, I want to see how my cognitive skills improve over time
- As a player, I want a visible rank that reflects my overall mastery
- As a player, I want achievements that recognize my accomplishments
- As a player, I want to earn cosmetic rewards through gameplay

## Requirements

### Cognitive Profile Engine
- [ ] 5-axis rating system:
  1. Vocabulary Depth — unique words found, average rarity, average length
  2. Processing Speed — Rush WPM, time-per-word, combo consistency
  3. Pattern Recognition — cascade chains, cross-mode consistency, novel board performance
  4. Working Memory — Memory Crucible rounds survived, accuracy, planning depth
  5. Strategic Thinking — star ratings across modes, par performance, move efficiency
- [ ] ELO-like adaptive rating per dimension (start at 1000, K-factor adjusts with games played)
- [ ] Rating updates after each game based on performance vs expected
- [ ] Weekly snapshots stored for trend analysis
- [ ] 30-day trend lines per dimension

### Radar Chart Visualization
- [ ] SVG-based 5-axis radar chart
- [ ] Animated transitions when ratings change
- [ ] Overlay: current vs 30-days-ago for progress visualization
- [ ] Tap axis label for detailed breakdown of that dimension
- [ ] Color-coded by strength (green) and growth area (amber)

### Forge Rank
- [ ] Rank tiers: Spark → Ember → Flame → Blaze → Inferno → Forge Master → Legendary
- [ ] Rank determined by composite score across all 5 cognitive dimensions
- [ ] Rank-up animation and celebration screen
- [ ] Rank badge displayed on profile and share cards
- [ ] Rank thresholds: Spark (0-999), Ember (1000-1499), Flame (1500-1999), Blaze (2000-2499), Inferno (2500-2999), Forge Master (3000-3499), Legendary (3500+)

### Achievement System
- [ ] Achievement categories aligned with cognitive dimensions
- [ ] Example achievements:
  - Vocabulary: "Lexicographer" (find 100 unique 6+ letter words)
  - Speed: "Lightning Fingers" (5x combo in Rush)
  - Pattern: "Chain Master" (4+ chain in Cascade)
  - Memory: "Photographic" (complete round with 2s view time)
  - Strategy: "Perfect Forge" (5 stars on Daily Forge)
- [ ] Achievement notification popup
- [ ] Achievement gallery/showcase page
- [ ] Hidden achievements (revealed on unlock)

### Cosmetic System
- [ ] Board skins: different grid visual themes (volcano, ice, forest, void, gold)
- [ ] Tile styles: different letter tile appearances
- [ ] Trail effects: visual effect when tracing word paths
- [ ] All cosmetics earned through gameplay (achievements, Forge Wheel, rank milestones)
- [ ] Cosmetic equip/preview UI
- [ ] No purchasable cosmetics — everything is earned

### Monthly Report
- [ ] Shareable monthly cognitive progress report
- [ ] Before/after radar chart comparison
- [ ] Key stats: games played, words found, best achievements
- [ ] Highlighted growth areas and strengths
- [ ] Shareable as image or text summary

## Acceptance Criteria

- [ ] Cognitive ratings update correctly after each game
- [ ] Radar chart renders and animates properly
- [ ] Forge Rank progresses through tiers correctly
- [ ] Achievements unlock and notify
- [ ] Cosmetics can be equipped and display correctly in-game
- [ ] Monthly report generates with accurate data
- [ ] All data persists in IndexedDB

## Out of Scope

- Social comparison of cognitive profiles (Phase 7)
- Animated cosmetic effects rendering (Phase 8)
