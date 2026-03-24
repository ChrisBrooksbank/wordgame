/**
 * Cosmetic reward system for Lexicon Forge.
 *
 * Three cosmetic categories:
 *   - Board skins: colour themes applied to the hex grid
 *   - Tile styles: stroke/decoration variants for letter tiles
 *   - Trail effects: path-line appearance when tracing a word
 *
 * All cosmetics are earned through gameplay — achievements, rank milestones,
 * or Forge Wheel rewards.  Nothing is purchasable.
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';

// ---------------------------------------------------------------------------
// Board skins
// ---------------------------------------------------------------------------

export interface BoardSkinColors {
	tileFill: string;
	tileSelectedFill: string;
	tileLastFill: string;
	tileCatalystFill: string;
	tileStroke: string;
	tileSelectedStroke: string;
	tileCatalystStroke: string;
	tileCanAddStroke: string;
	tileHeatFill: string;
	tileHeatStroke: string;
	textFill: string;
	textSelectedFill: string;
}

export interface BoardSkin {
	id: string;
	name: string;
	description: string;
	emoji: string;
	colors: BoardSkinColors;
}

export const BOARD_SKINS: BoardSkin[] = [
	{
		id: 'default',
		name: 'Forge',
		description: 'The classic dark forge aesthetic.',
		emoji: '⚒️',
		colors: {
			tileFill: '#1f2937',
			tileSelectedFill: '#f59e0b',
			tileLastFill: '#f97316',
			tileCatalystFill: '#1c2a1c',
			tileStroke: '#374151',
			tileSelectedStroke: '#f97316',
			tileCatalystStroke: '#fbbf24',
			tileCanAddStroke: '#6b7280',
			tileHeatFill: '#1a2e1a',
			tileHeatStroke: '#4ade80',
			textFill: '#f3f4f6',
			textSelectedFill: '#1f2937'
		}
	},
	{
		id: 'volcano',
		name: 'Volcano',
		description: 'Molten lava erupts beneath the tiles.',
		emoji: '🌋',
		colors: {
			tileFill: '#1c0a00',
			tileSelectedFill: '#dc2626',
			tileLastFill: '#ef4444',
			tileCatalystFill: '#2d0d0d',
			tileStroke: '#7f1d1d',
			tileSelectedStroke: '#fca5a5',
			tileCatalystStroke: '#f97316',
			tileCanAddStroke: '#b45309',
			tileHeatFill: '#2d1500',
			tileHeatStroke: '#fb923c',
			textFill: '#fef2f2',
			textSelectedFill: '#1c0a00'
		}
	},
	{
		id: 'ice',
		name: 'Glacier',
		description: 'Crystalline frost covers every tile.',
		emoji: '❄️',
		colors: {
			tileFill: '#0c1a2e',
			tileSelectedFill: '#38bdf8',
			tileLastFill: '#0ea5e9',
			tileCatalystFill: '#0a1929',
			tileStroke: '#1e3a5f',
			tileSelectedStroke: '#7dd3fc',
			tileCatalystStroke: '#bae6fd',
			tileCanAddStroke: '#475569',
			tileHeatFill: '#0a2030',
			tileHeatStroke: '#93c5fd',
			textFill: '#e0f2fe',
			textSelectedFill: '#0c1a2e'
		}
	},
	{
		id: 'forest',
		name: 'Ancient Forest',
		description: 'Gnarled roots and deep green canopy.',
		emoji: '🌲',
		colors: {
			tileFill: '#0f1f0f',
			tileSelectedFill: '#16a34a',
			tileLastFill: '#15803d',
			tileCatalystFill: '#0a1a0a',
			tileStroke: '#14532d',
			tileSelectedStroke: '#4ade80',
			tileCatalystStroke: '#86efac',
			tileCanAddStroke: '#4b5563',
			tileHeatFill: '#0c1e0c',
			tileHeatStroke: '#34d399',
			textFill: '#dcfce7',
			textSelectedFill: '#0f1f0f'
		}
	},
	{
		id: 'void',
		name: 'Void',
		description: 'Where words dissolve into nothingness.',
		emoji: '🌌',
		colors: {
			tileFill: '#0a0a0f',
			tileSelectedFill: '#7c3aed',
			tileLastFill: '#6d28d9',
			tileCatalystFill: '#0d0a1a',
			tileStroke: '#1e1b4b',
			tileSelectedStroke: '#a78bfa',
			tileCatalystStroke: '#c4b5fd',
			tileCanAddStroke: '#374151',
			tileHeatFill: '#0d0a18',
			tileHeatStroke: '#818cf8',
			textFill: '#ede9fe',
			textSelectedFill: '#0a0a0f'
		}
	},
	{
		id: 'gold',
		name: 'Golden Forge',
		description: 'Only the mightiest wordsmiths can wield this.',
		emoji: '✨',
		colors: {
			tileFill: '#1a1200',
			tileSelectedFill: '#d97706',
			tileLastFill: '#b45309',
			tileCatalystFill: '#1a0f00',
			tileStroke: '#78350f',
			tileSelectedStroke: '#fbbf24',
			tileCatalystStroke: '#fde68a',
			tileCanAddStroke: '#92400e',
			tileHeatFill: '#1a1000',
			tileHeatStroke: '#fcd34d',
			textFill: '#fef3c7',
			textSelectedFill: '#1a1200'
		}
	}
];

// ---------------------------------------------------------------------------
// Tile styles
// ---------------------------------------------------------------------------

export interface TileStyle {
	id: string;
	name: string;
	description: string;
	emoji: string;
	strokeWidth: number;
	selectedStrokeWidth: number;
	/** Optional SVG filter id to apply (referenced via url(#<id>)). */
	filterEffect?: 'glow' | 'gem';
}

export const TILE_STYLES: TileStyle[] = [
	{
		id: 'default',
		name: 'Standard',
		description: 'Classic solid hex tiles.',
		emoji: '⬡',
		strokeWidth: 2,
		selectedStrokeWidth: 3
	},
	{
		id: 'outlined',
		name: 'Outlined',
		description: 'Thicker, bolder borders on every tile.',
		emoji: '🔲',
		strokeWidth: 3,
		selectedStrokeWidth: 5
	},
	{
		id: 'gem',
		name: 'Gemstone',
		description: 'A prismatic shimmer on every letter.',
		emoji: '💎',
		strokeWidth: 2,
		selectedStrokeWidth: 4,
		filterEffect: 'gem'
	}
];

// ---------------------------------------------------------------------------
// Trail effects
// ---------------------------------------------------------------------------

export interface TrailEffect {
	id: string;
	name: string;
	description: string;
	emoji: string;
	stroke: string;
	strokeWidth: number;
	opacity: number;
	strokeDasharray?: string;
}

export const TRAIL_EFFECTS: TrailEffect[] = [
	{
		id: 'default',
		name: 'Ember',
		description: 'A warm orange glow traces your path.',
		emoji: '🔥',
		stroke: '#f97316',
		strokeWidth: 3,
		opacity: 0.7
	},
	{
		id: 'fire',
		name: 'Inferno',
		description: 'A blazing red-hot trail for speedsters.',
		emoji: '⚡',
		stroke: '#ef4444',
		strokeWidth: 4,
		opacity: 0.85
	},
	{
		id: 'ice_trail',
		name: 'Frostline',
		description: 'Cool cyan crystals form as you trace.',
		emoji: '❄️',
		stroke: '#67e8f9',
		strokeWidth: 3,
		opacity: 0.75,
		strokeDasharray: '8 4'
	},
	{
		id: 'void_trail',
		name: 'Void Pulse',
		description: 'A pulsing violet rift through space.',
		emoji: '🌌',
		stroke: '#a78bfa',
		strokeWidth: 3,
		opacity: 0.8,
		strokeDasharray: '12 3'
	}
];

// ---------------------------------------------------------------------------
// Unlock conditions
// ---------------------------------------------------------------------------

export type UnlockCondition =
	| { type: 'always' }
	| { type: 'rank'; minScore: number }
	| { type: 'achievement'; achievementId: string }
	| { type: 'unique_long_words'; count: number }
	| { type: 'achievement_count'; count: number }
	| { type: 'forge_wheel' };

export interface CosmeticUnlockInfo {
	/** The cosmetic category. */
	category: 'skin' | 'tileStyle' | 'trail';
	/** ID of the cosmetic item. */
	id: string;
	condition: UnlockCondition;
}

export const COSMETIC_UNLOCK_TABLE: CosmeticUnlockInfo[] = [
	// Board skins
	{ category: 'skin', id: 'default', condition: { type: 'always' } },
	{ category: 'skin', id: 'volcano', condition: { type: 'rank', minScore: 2500 } },
	{
		category: 'skin',
		id: 'ice',
		condition: { type: 'achievement', achievementId: 'strategy_perfect_forge' }
	},
	{ category: 'skin', id: 'forest', condition: { type: 'unique_long_words', count: 50 } },
	{ category: 'skin', id: 'void', condition: { type: 'rank', minScore: 3500 } },
	{ category: 'skin', id: 'gold', condition: { type: 'achievement_count', count: 5 } },

	// Tile styles
	{ category: 'tileStyle', id: 'default', condition: { type: 'always' } },
	{ category: 'tileStyle', id: 'outlined', condition: { type: 'rank', minScore: 1000 } },
	{ category: 'tileStyle', id: 'gem', condition: { type: 'forge_wheel' } },

	// Trail effects
	{ category: 'trail', id: 'default', condition: { type: 'always' } },
	{
		category: 'trail',
		id: 'fire',
		condition: { type: 'achievement', achievementId: 'speed_lightning_fingers' }
	},
	{
		category: 'trail',
		id: 'ice_trail',
		condition: { type: 'achievement', achievementId: 'memory_photographic' }
	},
	{ category: 'trail', id: 'void_trail', condition: { type: 'rank', minScore: 2500 } }
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export interface CosmeticsStore {
	equippedSkinId: string;
	equippedTileStyleId: string;
	equippedTrailEffectId: string;
	unlockedSkinIds: string[];
	unlockedTileStyleIds: string[];
	unlockedTrailEffectIds: string[];
}

export const COSMETICS_IDB_KEY = 'lexicon-forge:cosmetics';

export function defaultCosmeticsStore(): CosmeticsStore {
	return {
		equippedSkinId: 'default',
		equippedTileStyleId: 'default',
		equippedTrailEffectId: 'default',
		unlockedSkinIds: ['default'],
		unlockedTileStyleIds: ['default'],
		unlockedTrailEffectIds: ['default']
	};
}

// ---------------------------------------------------------------------------
// Unlock evaluation
// ---------------------------------------------------------------------------

export interface UnlockContext {
	compositeScore: number;
	unlockedAchievementIds: string[];
	uniqueLongWordCount: number;
	forgeWheelCosmeticIds: string[];
}

/**
 * Returns true when the given condition is satisfied by the provided context.
 */
export function isConditionMet(condition: UnlockCondition, ctx: UnlockContext): boolean {
	switch (condition.type) {
		case 'always':
			return true;
		case 'rank':
			return ctx.compositeScore >= condition.minScore;
		case 'achievement':
			return ctx.unlockedAchievementIds.includes(condition.achievementId);
		case 'unique_long_words':
			return ctx.uniqueLongWordCount >= condition.count;
		case 'achievement_count':
			return ctx.unlockedAchievementIds.length >= condition.count;
		case 'forge_wheel':
			return false; // Granted explicitly by Forge Wheel, not auto-unlocked
	}
}

/**
 * Evaluates the full unlock table against the given context and returns an
 * updated store with all newly earned cosmetics added to unlocked lists.
 *
 * Does NOT change equipped items — the player chooses what to equip.
 *
 * @returns the updated store and the IDs of cosmetics newly unlocked.
 */
export function evaluateUnlocks(
	store: CosmeticsStore,
	ctx: UnlockContext
): { store: CosmeticsStore; newlyUnlocked: string[] } {
	const updated = { ...store };
	const newlyUnlocked: string[] = [];

	for (const info of COSMETIC_UNLOCK_TABLE) {
		if (info.condition.type === 'forge_wheel') continue; // Handled separately

		const alreadyUnlocked =
			info.category === 'skin'
				? store.unlockedSkinIds.includes(info.id)
				: info.category === 'tileStyle'
					? store.unlockedTileStyleIds.includes(info.id)
					: store.unlockedTrailEffectIds.includes(info.id);

		if (!alreadyUnlocked && isConditionMet(info.condition, ctx)) {
			newlyUnlocked.push(info.id);
			if (info.category === 'skin') {
				updated.unlockedSkinIds = [...updated.unlockedSkinIds, info.id];
			} else if (info.category === 'tileStyle') {
				updated.unlockedTileStyleIds = [...updated.unlockedTileStyleIds, info.id];
			} else {
				updated.unlockedTrailEffectIds = [...updated.unlockedTrailEffectIds, info.id];
			}
		}
	}

	return { store: updated, newlyUnlocked };
}

/**
 * Grants a cosmetic that was awarded via the Forge Wheel.
 * Returns the updated store and whether the item was newly unlocked.
 */
export function grantForgeWheelCosmetic(
	store: CosmeticsStore,
	category: 'skin' | 'tileStyle' | 'trail',
	id: string
): { store: CosmeticsStore; granted: boolean } {
	const list =
		category === 'skin'
			? store.unlockedSkinIds
			: category === 'tileStyle'
				? store.unlockedTileStyleIds
				: store.unlockedTrailEffectIds;

	if (list.includes(id)) return { store, granted: false };

	const updated = { ...store };
	if (category === 'skin') {
		updated.unlockedSkinIds = [...store.unlockedSkinIds, id];
	} else if (category === 'tileStyle') {
		updated.unlockedTileStyleIds = [...store.unlockedTileStyleIds, id];
	} else {
		updated.unlockedTrailEffectIds = [...store.unlockedTrailEffectIds, id];
	}

	return { store: updated, granted: true };
}

// ---------------------------------------------------------------------------
// Equip helpers
// ---------------------------------------------------------------------------

/**
 * Equips a board skin.  Throws if the skin is not unlocked.
 */
export function equipSkin(store: CosmeticsStore, skinId: string): CosmeticsStore {
	if (!store.unlockedSkinIds.includes(skinId)) {
		throw new Error(`Skin "${skinId}" is not unlocked.`);
	}
	return { ...store, equippedSkinId: skinId };
}

/**
 * Equips a tile style.  Throws if the style is not unlocked.
 */
export function equipTileStyle(store: CosmeticsStore, styleId: string): CosmeticsStore {
	if (!store.unlockedTileStyleIds.includes(styleId)) {
		throw new Error(`Tile style "${styleId}" is not unlocked.`);
	}
	return { ...store, equippedTileStyleId: styleId };
}

/**
 * Equips a trail effect.  Throws if the trail is not unlocked.
 */
export function equipTrailEffect(store: CosmeticsStore, trailId: string): CosmeticsStore {
	if (!store.unlockedTrailEffectIds.includes(trailId)) {
		throw new Error(`Trail effect "${trailId}" is not unlocked.`);
	}
	return { ...store, equippedTrailEffectId: trailId };
}

// ---------------------------------------------------------------------------
// Resolved cosmetics (lookup helpers)
// ---------------------------------------------------------------------------

export function getBoardSkin(id: string): BoardSkin {
	return BOARD_SKINS.find((s) => s.id === id) ?? BOARD_SKINS[0];
}

export function getTileStyle(id: string): TileStyle {
	return TILE_STYLES.find((s) => s.id === id) ?? TILE_STYLES[0];
}

export function getTrailEffect(id: string): TrailEffect {
	return TRAIL_EFFECTS.find((t) => t.id === id) ?? TRAIL_EFFECTS[0];
}

/** Returns the human-readable unlock hint for a condition. */
export function unlockHint(condition: UnlockCondition): string {
	switch (condition.type) {
		case 'always':
			return 'Available from the start.';
		case 'rank':
			if (condition.minScore >= 3500) return 'Reach Legendary rank.';
			if (condition.minScore >= 2500) return 'Reach Inferno rank.';
			if (condition.minScore >= 1000) return 'Reach Ember rank.';
			return `Reach a composite score of ${condition.minScore}.`;
		case 'achievement':
			return `Unlock the "${condition.achievementId.replace(/_/g, ' ')}" achievement.`;
		case 'unique_long_words':
			return `Find ${condition.count} unique words of 6+ letters.`;
		case 'achievement_count':
			return `Unlock ${condition.count} achievements.`;
		case 'forge_wheel':
			return 'Awarded from the Forge Wheel.';
	}
}

// ---------------------------------------------------------------------------
// IndexedDB persistence
// ---------------------------------------------------------------------------

export async function loadCosmeticsStore(): Promise<CosmeticsStore> {
	const stored = await idbGet<CosmeticsStore>(COSMETICS_IDB_KEY);
	return stored ?? defaultCosmeticsStore();
}

export async function saveCosmeticsStore(store: CosmeticsStore): Promise<void> {
	await idbSet(COSMETICS_IDB_KEY, store);
}
