/**
 * Tests for the achievement system.
 */
import { describe, it, expect } from 'vitest';
import {
	ACHIEVEMENT_DEFS,
	DEFAULT_ACHIEVEMENT_STATS,
	achievementProgress,
	applyStatsUpdate,
	defaultAchievementStore,
	evaluateAchievements,
	getRecord,
	resolveAchievementDisplay,
	updateStats,
	type AchievementStats
} from './achievements.js';

// ---------------------------------------------------------------------------
// ACHIEVEMENT_DEFS structure
// ---------------------------------------------------------------------------

describe('ACHIEVEMENT_DEFS', () => {
	it('contains at least one achievement per cognitive dimension', () => {
		const categories = new Set(ACHIEVEMENT_DEFS.map((d) => d.category));
		expect(categories.has('vocabularyDepth')).toBe(true);
		expect(categories.has('processingSpeed')).toBe(true);
		expect(categories.has('patternRecognition')).toBe(true);
		expect(categories.has('workingMemory')).toBe(true);
		expect(categories.has('strategicThinking')).toBe(true);
	});

	it('all definitions have unique IDs', () => {
		const ids = ACHIEVEMENT_DEFS.map((d) => d.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('all definitions have non-empty name, description, and emoji', () => {
		for (const def of ACHIEVEMENT_DEFS) {
			expect(def.name.length).toBeGreaterThan(0);
			expect(def.description.length).toBeGreaterThan(0);
			expect(def.emoji.length).toBeGreaterThan(0);
		}
	});

	it('contains at least one hidden achievement', () => {
		expect(ACHIEVEMENT_DEFS.some((d) => d.hidden)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// updateStats — vocabulary
// ---------------------------------------------------------------------------

describe('updateStats — vocabulary', () => {
	it('adds long words (6+) to uniqueLongWords', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, { type: 'vocabulary', wordsFound: ['castle', 'throne'] });
		expect(updated.uniqueLongWords).toContain('castle');
		expect(updated.uniqueLongWords).toContain('throne');
	});

	it('ignores words shorter than 6 letters', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, {
			type: 'vocabulary',
			wordsFound: ['cat', 'word', 'forge']
		});
		expect(updated.uniqueLongWords).toHaveLength(0);
	});

	it('deduplicates words across calls', () => {
		let stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		stats = updateStats(stats, { type: 'vocabulary', wordsFound: ['castle'] });
		stats = updateStats(stats, { type: 'vocabulary', wordsFound: ['castle', 'throne'] });
		expect(stats.uniqueLongWords).toHaveLength(2);
	});

	it('lower-cases words before storing', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, { type: 'vocabulary', wordsFound: ['CASTLE'] });
		expect(updated.uniqueLongWords).toContain('castle');
		expect(updated.uniqueLongWords).not.toContain('CASTLE');
	});

	it('does not mutate the input stats', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		updateStats(stats, { type: 'vocabulary', wordsFound: ['castle'] });
		expect(stats.uniqueLongWords).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// updateStats — speed
// ---------------------------------------------------------------------------

describe('updateStats — speed', () => {
	it('updates maxComboEver when new combo is higher', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 2 };
		const updated = updateStats(stats, { type: 'speed', maxCombo: 4 });
		expect(updated.maxComboEver).toBe(4);
	});

	it('keeps existing maxComboEver when new combo is lower', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 5 };
		const updated = updateStats(stats, { type: 'speed', maxCombo: 3 });
		expect(updated.maxComboEver).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// updateStats — pattern
// ---------------------------------------------------------------------------

describe('updateStats — pattern', () => {
	it('updates longestCascadeChainEver when new chain is longer', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, { type: 'pattern', cascadeChain: 3 });
		expect(updated.longestCascadeChainEver).toBe(3);
	});

	it('does not decrease longestCascadeChainEver', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, longestCascadeChainEver: 5 };
		const updated = updateStats(stats, { type: 'pattern', cascadeChain: 2 });
		expect(updated.longestCascadeChainEver).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// updateStats — memory
// ---------------------------------------------------------------------------

describe('updateStats — memory', () => {
	it('sets crucibleWithTwoSecondView when round completed with ≤2s view time', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, {
			type: 'memory',
			viewTimeSeconds: 2,
			roundCompleted: true
		});
		expect(updated.crucibleWithTwoSecondView).toBe(true);
	});

	it('does not set crucibleWithTwoSecondView when round not completed', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, {
			type: 'memory',
			viewTimeSeconds: 2,
			roundCompleted: false
		});
		expect(updated.crucibleWithTwoSecondView).toBe(false);
	});

	it('does not set crucibleWithTwoSecondView when view time > 2s', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS };
		const updated = updateStats(stats, {
			type: 'memory',
			viewTimeSeconds: 3,
			roundCompleted: true
		});
		expect(updated.crucibleWithTwoSecondView).toBe(false);
	});

	it('preserves existing crucibleWithTwoSecondView = true', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, crucibleWithTwoSecondView: true };
		const updated = updateStats(stats, {
			type: 'memory',
			viewTimeSeconds: 5,
			roundCompleted: false
		});
		expect(updated.crucibleWithTwoSecondView).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// updateStats — strategy
// ---------------------------------------------------------------------------

describe('updateStats — strategy', () => {
	it('updates maxDailyForgeStars when new rating is higher', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxDailyForgeStars: 3 };
		const updated = updateStats(stats, { type: 'strategy', starsEarned: 5 });
		expect(updated.maxDailyForgeStars).toBe(5);
	});

	it('does not decrease maxDailyForgeStars', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxDailyForgeStars: 5 };
		const updated = updateStats(stats, { type: 'strategy', starsEarned: 3 });
		expect(updated.maxDailyForgeStars).toBe(5);
	});
});

// ---------------------------------------------------------------------------
// evaluateAchievements
// ---------------------------------------------------------------------------

describe('evaluateAchievements', () => {
	it('returns empty array for default stats', () => {
		expect(evaluateAchievements(DEFAULT_ACHIEVEMENT_STATS)).toHaveLength(0);
	});

	it('unlocks vocab_word_collector at 10 unique long words', () => {
		const stats: AchievementStats = {
			...DEFAULT_ACHIEVEMENT_STATS,
			uniqueLongWords: Array.from({ length: 10 }, (_, i) => `word${i}x`)
		};
		expect(evaluateAchievements(stats)).toContain('vocab_word_collector');
	});

	it('does not unlock vocab_word_collector at 9 unique long words', () => {
		const stats: AchievementStats = {
			...DEFAULT_ACHIEVEMENT_STATS,
			uniqueLongWords: Array.from({ length: 9 }, (_, i) => `word${i}x`)
		};
		expect(evaluateAchievements(stats)).not.toContain('vocab_word_collector');
	});

	it('unlocks vocab_lexicographer at 100 unique long words', () => {
		const stats: AchievementStats = {
			...DEFAULT_ACHIEVEMENT_STATS,
			uniqueLongWords: Array.from({ length: 100 }, (_, i) => `word${i}xxxxx`)
		};
		const ids = evaluateAchievements(stats);
		expect(ids).toContain('vocab_lexicographer');
		expect(ids).toContain('vocab_word_collector');
	});

	it('unlocks speed_hot_streak at maxComboEver 4', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 4 };
		expect(evaluateAchievements(stats)).toContain('speed_hot_streak');
	});

	it('unlocks speed_lightning_fingers at maxComboEver 5', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 5 };
		const ids = evaluateAchievements(stats);
		expect(ids).toContain('speed_lightning_fingers');
		expect(ids).toContain('speed_hot_streak');
	});

	it('unlocks pattern_chain_master at longestCascadeChainEver 4', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, longestCascadeChainEver: 4 };
		const ids = evaluateAchievements(stats);
		expect(ids).toContain('pattern_chain_master');
		expect(ids).toContain('pattern_cascade_novice');
	});

	it('unlocks memory_photographic when crucibleWithTwoSecondView is true', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, crucibleWithTwoSecondView: true };
		expect(evaluateAchievements(stats)).toContain('memory_photographic');
	});

	it('unlocks strategy_perfect_forge at maxDailyForgeStars 5', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxDailyForgeStars: 5 };
		const ids = evaluateAchievements(stats);
		expect(ids).toContain('strategy_perfect_forge');
		expect(ids).toContain('strategy_three_stars');
	});
});

// ---------------------------------------------------------------------------
// applyStatsUpdate
// ---------------------------------------------------------------------------

describe('applyStatsUpdate', () => {
	it('returns no newlyUnlocked for default stats', () => {
		const store = defaultAchievementStore();
		const { newlyUnlocked } = applyStatsUpdate(store, DEFAULT_ACHIEVEMENT_STATS, '2026-01-01');
		expect(newlyUnlocked).toHaveLength(0);
	});

	it('returns newly unlocked IDs when criteria are met', () => {
		const store = defaultAchievementStore();
		const stats: AchievementStats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 5 };
		const { newlyUnlocked } = applyStatsUpdate(store, stats, '2026-01-01');
		expect(newlyUnlocked).toContain('speed_lightning_fingers');
	});

	it('stores the unlock date in the record', () => {
		const store = defaultAchievementStore();
		const stats: AchievementStats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 5 };
		const { store: updated } = applyStatsUpdate(store, stats, '2026-01-15');
		expect(updated.records['speed_lightning_fingers'].unlockedAt).toBe('2026-01-15');
	});

	it('does not re-unlock an already unlocked achievement', () => {
		const store = defaultAchievementStore();
		const stats: AchievementStats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 5 };
		const { store: first } = applyStatsUpdate(store, stats, '2026-01-01');
		const { newlyUnlocked: second } = applyStatsUpdate(first, stats, '2026-02-01');
		expect(second).not.toContain('speed_lightning_fingers');
	});

	it('persists updated stats in returned store', () => {
		const store = defaultAchievementStore();
		const stats: AchievementStats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 3 };
		const { store: updated } = applyStatsUpdate(store, stats, '2026-01-01');
		expect(updated.stats.maxComboEver).toBe(3);
	});
});

// ---------------------------------------------------------------------------
// getRecord
// ---------------------------------------------------------------------------

describe('getRecord', () => {
	it('returns a locked record for an unknown achievement ID', () => {
		const store = defaultAchievementStore();
		const record = getRecord(store, 'unknown_id');
		expect(record.id).toBe('unknown_id');
		expect(record.unlockedAt).toBeNull();
	});

	it('returns the stored record when present', () => {
		const store = defaultAchievementStore();
		const stats: AchievementStats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 5 };
		const { store: updated } = applyStatsUpdate(store, stats, '2026-01-10');
		const record = getRecord(updated, 'speed_lightning_fingers');
		expect(record.unlockedAt).toBe('2026-01-10');
	});
});

// ---------------------------------------------------------------------------
// resolveAchievementDisplay
// ---------------------------------------------------------------------------

describe('resolveAchievementDisplay', () => {
	it('shows real name/description for a non-hidden achievement regardless of unlock state', () => {
		const def = ACHIEVEMENT_DEFS.find((d) => !d.hidden)!;
		const lockedRecord = { id: def.id, unlockedAt: null };
		const display = resolveAchievementDisplay(def, lockedRecord);
		expect(display.name).toBe(def.name);
		expect(display.description).toBe(def.description);
	});

	it('hides a hidden achievement name/description when locked', () => {
		const def = ACHIEVEMENT_DEFS.find((d) => d.hidden)!;
		const lockedRecord = { id: def.id, unlockedAt: null };
		const display = resolveAchievementDisplay(def, lockedRecord);
		expect(display.name).toBe('???');
		expect(display.emoji).toBe('🔒');
	});

	it('reveals a hidden achievement name/description when unlocked', () => {
		const def = ACHIEVEMENT_DEFS.find((d) => d.hidden)!;
		const unlockedRecord = { id: def.id, unlockedAt: '2026-01-01' };
		const display = resolveAchievementDisplay(def, unlockedRecord);
		expect(display.name).toBe(def.name);
		expect(display.emoji).toBe(def.emoji);
	});
});

// ---------------------------------------------------------------------------
// achievementProgress
// ---------------------------------------------------------------------------

describe('achievementProgress', () => {
	it('returns 0 for no progress on vocab_word_collector', () => {
		expect(achievementProgress('vocab_word_collector', DEFAULT_ACHIEVEMENT_STATS)).toBe(0);
	});

	it('returns 0.5 for halfway progress on vocab_word_collector', () => {
		const stats: AchievementStats = {
			...DEFAULT_ACHIEVEMENT_STATS,
			uniqueLongWords: Array.from({ length: 5 }, (_, i) => `word${i}xx`)
		};
		expect(achievementProgress('vocab_word_collector', stats)).toBeCloseTo(0.5);
	});

	it('returns 1 when achievement criteria are met', () => {
		const stats: AchievementStats = {
			...DEFAULT_ACHIEVEMENT_STATS,
			uniqueLongWords: Array.from({ length: 10 }, (_, i) => `word${i}xx`)
		};
		expect(achievementProgress('vocab_word_collector', stats)).toBe(1);
	});

	it('returns 0.8 at maxComboEver 4 for speed_lightning_fingers', () => {
		const stats = { ...DEFAULT_ACHIEVEMENT_STATS, maxComboEver: 4 };
		expect(achievementProgress('speed_lightning_fingers', stats)).toBeCloseTo(0.8);
	});

	it('returns 0 for unknown achievement ID', () => {
		expect(achievementProgress('nonexistent', DEFAULT_ACHIEVEMENT_STATS)).toBe(0);
	});
});
