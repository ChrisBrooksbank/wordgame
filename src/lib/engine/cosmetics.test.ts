/**
 * Tests for the cosmetic reward system.
 */
import { describe, it, expect } from 'vitest';
import {
	BOARD_SKINS,
	TILE_STYLES,
	TRAIL_EFFECTS,
	COSMETIC_UNLOCK_TABLE,
	defaultCosmeticsStore,
	evaluateUnlocks,
	grantForgeWheelCosmetic,
	equipSkin,
	equipTileStyle,
	equipTrailEffect,
	getBoardSkin,
	getTileStyle,
	getTrailEffect,
	isConditionMet,
	unlockHint,
	type UnlockContext
} from './cosmetics.js';

// ---------------------------------------------------------------------------
// Definitions integrity
// ---------------------------------------------------------------------------

describe('BOARD_SKINS', () => {
	it('includes a "default" skin', () => {
		expect(BOARD_SKINS.some((s) => s.id === 'default')).toBe(true);
	});

	it('all skins have unique IDs', () => {
		const ids = BOARD_SKINS.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('all skins have required color fields', () => {
		const requiredKeys: (keyof (typeof BOARD_SKINS)[0]['colors'])[] = [
			'tileFill',
			'tileSelectedFill',
			'tileLastFill',
			'tileCatalystFill',
			'tileStroke',
			'tileSelectedStroke',
			'tileCatalystStroke',
			'tileCanAddStroke',
			'tileHeatFill',
			'tileHeatStroke',
			'textFill',
			'textSelectedFill'
		];
		for (const skin of BOARD_SKINS) {
			for (const key of requiredKeys) {
				expect(skin.colors[key], `${skin.id}.colors.${key}`).toBeTruthy();
			}
		}
	});

	it('includes volcano, ice, forest, void, and gold skins', () => {
		const ids = new Set(BOARD_SKINS.map((s) => s.id));
		expect(ids.has('volcano')).toBe(true);
		expect(ids.has('ice')).toBe(true);
		expect(ids.has('forest')).toBe(true);
		expect(ids.has('void')).toBe(true);
		expect(ids.has('gold')).toBe(true);
	});
});

describe('TILE_STYLES', () => {
	it('includes a "default" style', () => {
		expect(TILE_STYLES.some((s) => s.id === 'default')).toBe(true);
	});

	it('all styles have unique IDs', () => {
		const ids = TILE_STYLES.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

describe('TRAIL_EFFECTS', () => {
	it('includes a "default" trail', () => {
		expect(TRAIL_EFFECTS.some((t) => t.id === 'default')).toBe(true);
	});

	it('all trails have unique IDs', () => {
		const ids = TRAIL_EFFECTS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('all trails have valid stroke and opacity', () => {
		for (const trail of TRAIL_EFFECTS) {
			expect(trail.stroke).toMatch(/^#[0-9a-f]{6}$/i);
			expect(trail.opacity).toBeGreaterThan(0);
			expect(trail.opacity).toBeLessThanOrEqual(1);
			expect(trail.strokeWidth).toBeGreaterThan(0);
		}
	});
});

describe('COSMETIC_UNLOCK_TABLE', () => {
	it('has an entry for every board skin', () => {
		const skinIds = new Set(
			COSMETIC_UNLOCK_TABLE.filter((e) => e.category === 'skin').map((e) => e.id)
		);
		for (const skin of BOARD_SKINS) {
			expect(skinIds.has(skin.id), `Missing unlock entry for skin "${skin.id}"`).toBe(true);
		}
	});

	it('has an entry for every tile style', () => {
		const styleIds = new Set(
			COSMETIC_UNLOCK_TABLE.filter((e) => e.category === 'tileStyle').map((e) => e.id)
		);
		for (const style of TILE_STYLES) {
			expect(styleIds.has(style.id), `Missing unlock entry for style "${style.id}"`).toBe(true);
		}
	});

	it('has an entry for every trail effect', () => {
		const trailIds = new Set(
			COSMETIC_UNLOCK_TABLE.filter((e) => e.category === 'trail').map((e) => e.id)
		);
		for (const trail of TRAIL_EFFECTS) {
			expect(trailIds.has(trail.id), `Missing unlock entry for trail "${trail.id}"`).toBe(true);
		}
	});
});

// ---------------------------------------------------------------------------
// defaultCosmeticsStore
// ---------------------------------------------------------------------------

describe('defaultCosmeticsStore', () => {
	it('equips default items', () => {
		const store = defaultCosmeticsStore();
		expect(store.equippedSkinId).toBe('default');
		expect(store.equippedTileStyleId).toBe('default');
		expect(store.equippedTrailEffectId).toBe('default');
	});

	it('only unlocks default items', () => {
		const store = defaultCosmeticsStore();
		expect(store.unlockedSkinIds).toEqual(['default']);
		expect(store.unlockedTileStyleIds).toEqual(['default']);
		expect(store.unlockedTrailEffectIds).toEqual(['default']);
	});
});

// ---------------------------------------------------------------------------
// isConditionMet
// ---------------------------------------------------------------------------

const baseCtx: UnlockContext = {
	compositeScore: 0,
	unlockedAchievementIds: [],
	uniqueLongWordCount: 0,
	forgeWheelCosmeticIds: []
};

describe('isConditionMet', () => {
	it('always condition is always true', () => {
		expect(isConditionMet({ type: 'always' }, baseCtx)).toBe(true);
	});

	it('rank condition checks compositeScore', () => {
		expect(
			isConditionMet({ type: 'rank', minScore: 1000 }, { ...baseCtx, compositeScore: 999 })
		).toBe(false);
		expect(
			isConditionMet({ type: 'rank', minScore: 1000 }, { ...baseCtx, compositeScore: 1000 })
		).toBe(true);
		expect(
			isConditionMet({ type: 'rank', minScore: 1000 }, { ...baseCtx, compositeScore: 2000 })
		).toBe(true);
	});

	it('achievement condition checks achievement IDs', () => {
		expect(
			isConditionMet(
				{ type: 'achievement', achievementId: 'speed_lightning_fingers' },
				{ ...baseCtx, unlockedAchievementIds: [] }
			)
		).toBe(false);
		expect(
			isConditionMet(
				{ type: 'achievement', achievementId: 'speed_lightning_fingers' },
				{ ...baseCtx, unlockedAchievementIds: ['speed_lightning_fingers'] }
			)
		).toBe(true);
	});

	it('unique_long_words condition checks count', () => {
		expect(
			isConditionMet(
				{ type: 'unique_long_words', count: 50 },
				{ ...baseCtx, uniqueLongWordCount: 49 }
			)
		).toBe(false);
		expect(
			isConditionMet(
				{ type: 'unique_long_words', count: 50 },
				{ ...baseCtx, uniqueLongWordCount: 50 }
			)
		).toBe(true);
	});

	it('achievement_count condition counts achievements', () => {
		expect(
			isConditionMet(
				{ type: 'achievement_count', count: 5 },
				{ ...baseCtx, unlockedAchievementIds: ['a', 'b', 'c', 'd'] }
			)
		).toBe(false);
		expect(
			isConditionMet(
				{ type: 'achievement_count', count: 5 },
				{ ...baseCtx, unlockedAchievementIds: ['a', 'b', 'c', 'd', 'e'] }
			)
		).toBe(true);
	});

	it('forge_wheel condition is always false (granted explicitly)', () => {
		expect(isConditionMet({ type: 'forge_wheel' }, baseCtx)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// evaluateUnlocks
// ---------------------------------------------------------------------------

describe('evaluateUnlocks', () => {
	it('returns no new unlocks for a fresh player with no progress', () => {
		const store = defaultCosmeticsStore();
		const { newlyUnlocked } = evaluateUnlocks(store, baseCtx);
		expect(newlyUnlocked).toHaveLength(0);
	});

	it('unlocks outlined tile style when rank reaches Ember (1000)', () => {
		const store = defaultCosmeticsStore();
		const ctx: UnlockContext = { ...baseCtx, compositeScore: 1000 };
		const { store: updated, newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).toContain('outlined');
		expect(updated.unlockedTileStyleIds).toContain('outlined');
	});

	it('unlocks volcano skin when rank reaches Inferno (2500)', () => {
		const store = defaultCosmeticsStore();
		const ctx: UnlockContext = { ...baseCtx, compositeScore: 2500 };
		const { store: updated, newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).toContain('volcano');
		expect(updated.unlockedSkinIds).toContain('volcano');
	});

	it('unlocks void skin when rank reaches Legendary (3500)', () => {
		const store = defaultCosmeticsStore();
		const ctx: UnlockContext = { ...baseCtx, compositeScore: 3500 };
		const { store: updated, newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).toContain('void');
		expect(updated.unlockedSkinIds).toContain('void');
	});

	it('unlocks ice skin when strategy_perfect_forge achievement earned', () => {
		const store = defaultCosmeticsStore();
		const ctx: UnlockContext = {
			...baseCtx,
			unlockedAchievementIds: ['strategy_perfect_forge']
		};
		const { store: updated, newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).toContain('ice');
		expect(updated.unlockedSkinIds).toContain('ice');
	});

	it('unlocks forest skin after finding 50 unique long words', () => {
		const store = defaultCosmeticsStore();
		const ctx: UnlockContext = { ...baseCtx, uniqueLongWordCount: 50 };
		const { store: updated, newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).toContain('forest');
		expect(updated.unlockedSkinIds).toContain('forest');
	});

	it('unlocks gold skin after earning 5 achievements', () => {
		const store = defaultCosmeticsStore();
		const ctx: UnlockContext = {
			...baseCtx,
			unlockedAchievementIds: ['a1', 'a2', 'a3', 'a4', 'a5']
		};
		const { store: updated, newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).toContain('gold');
		expect(updated.unlockedSkinIds).toContain('gold');
	});

	it('does not re-unlock already-unlocked items', () => {
		const store = {
			...defaultCosmeticsStore(),
			unlockedSkinIds: ['default', 'volcano']
		};
		const ctx: UnlockContext = { ...baseCtx, compositeScore: 2500 };
		const { newlyUnlocked } = evaluateUnlocks(store, ctx);
		expect(newlyUnlocked).not.toContain('volcano');
	});

	it('does not unlock forge_wheel items automatically', () => {
		const store = defaultCosmeticsStore();
		// gem tile style requires forge_wheel — must not auto-unlock
		const ctx: UnlockContext = { ...baseCtx, compositeScore: 9999 };
		const { store: updated } = evaluateUnlocks(store, ctx);
		expect(updated.unlockedTileStyleIds).not.toContain('gem');
	});
});

// ---------------------------------------------------------------------------
// grantForgeWheelCosmetic
// ---------------------------------------------------------------------------

describe('grantForgeWheelCosmetic', () => {
	it('grants a new Forge Wheel cosmetic', () => {
		const store = defaultCosmeticsStore();
		const { store: updated, granted } = grantForgeWheelCosmetic(store, 'tileStyle', 'gem');
		expect(granted).toBe(true);
		expect(updated.unlockedTileStyleIds).toContain('gem');
	});

	it('returns granted=false when already unlocked', () => {
		const store = {
			...defaultCosmeticsStore(),
			unlockedTileStyleIds: ['default', 'gem']
		};
		const { granted } = grantForgeWheelCosmetic(store, 'tileStyle', 'gem');
		expect(granted).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// equip helpers
// ---------------------------------------------------------------------------

describe('equipSkin', () => {
	it('equips an unlocked skin', () => {
		const store = { ...defaultCosmeticsStore(), unlockedSkinIds: ['default', 'volcano'] };
		const updated = equipSkin(store, 'volcano');
		expect(updated.equippedSkinId).toBe('volcano');
	});

	it('throws when skin is not unlocked', () => {
		const store = defaultCosmeticsStore();
		expect(() => equipSkin(store, 'void')).toThrow();
	});
});

describe('equipTileStyle', () => {
	it('equips an unlocked tile style', () => {
		const store = { ...defaultCosmeticsStore(), unlockedTileStyleIds: ['default', 'outlined'] };
		const updated = equipTileStyle(store, 'outlined');
		expect(updated.equippedTileStyleId).toBe('outlined');
	});

	it('throws when tile style is not unlocked', () => {
		const store = defaultCosmeticsStore();
		expect(() => equipTileStyle(store, 'gem')).toThrow();
	});
});

describe('equipTrailEffect', () => {
	it('equips an unlocked trail effect', () => {
		const store = { ...defaultCosmeticsStore(), unlockedTrailEffectIds: ['default', 'fire'] };
		const updated = equipTrailEffect(store, 'fire');
		expect(updated.equippedTrailEffectId).toBe('fire');
	});

	it('throws when trail effect is not unlocked', () => {
		const store = defaultCosmeticsStore();
		expect(() => equipTrailEffect(store, 'ice_trail')).toThrow();
	});
});

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

describe('getBoardSkin', () => {
	it('returns the correct skin by ID', () => {
		const skin = getBoardSkin('volcano');
		expect(skin.id).toBe('volcano');
	});

	it('falls back to default for unknown IDs', () => {
		const skin = getBoardSkin('nonexistent');
		expect(skin.id).toBe('default');
	});
});

describe('getTileStyle', () => {
	it('returns the correct style by ID', () => {
		const style = getTileStyle('outlined');
		expect(style.id).toBe('outlined');
	});

	it('falls back to default for unknown IDs', () => {
		const style = getTileStyle('nonexistent');
		expect(style.id).toBe('default');
	});
});

describe('getTrailEffect', () => {
	it('returns the correct trail by ID', () => {
		const trail = getTrailEffect('fire');
		expect(trail.id).toBe('fire');
	});

	it('falls back to default for unknown IDs', () => {
		const trail = getTrailEffect('nonexistent');
		expect(trail.id).toBe('default');
	});
});

// ---------------------------------------------------------------------------
// unlockHint
// ---------------------------------------------------------------------------

describe('unlockHint', () => {
	it('returns a non-empty string for every condition type', () => {
		const conditions = [
			{ type: 'always' as const },
			{ type: 'rank' as const, minScore: 1000 },
			{ type: 'rank' as const, minScore: 2500 },
			{ type: 'rank' as const, minScore: 3500 },
			{ type: 'achievement' as const, achievementId: 'speed_lightning_fingers' },
			{ type: 'unique_long_words' as const, count: 50 },
			{ type: 'achievement_count' as const, count: 5 },
			{ type: 'forge_wheel' as const }
		];
		for (const condition of conditions) {
			const hint = unlockHint(condition);
			expect(typeof hint).toBe('string');
			expect(hint.length).toBeGreaterThan(0);
		}
	});
});
