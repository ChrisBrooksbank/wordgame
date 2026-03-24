/**
 * Forge Wheel — daily variable-ratio reward system.
 *
 * Shows a spinner after completing the Daily Forge puzzle.
 * Players can spin once per day. Rewards are weighted randomly.
 */

import { get as idbGet, set as idbSet } from 'idb-keyval';
import { mulberry32 } from './dailyPuzzle.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RewardType = 'sparks' | 'rare_word_card' | 'cosmetic_item';

export interface WheelReward {
	type: RewardType;
	label: string;
	/** Amount of XP, only defined for sparks rewards. */
	amount?: number;
	description: string;
}

export interface WheelSegment {
	reward: WheelReward;
	/** Relative weight used for weighted random selection. */
	weight: number;
	color: string;
	emoji: string;
}

export interface SpinResult {
	date: string;
	segmentIndex: number;
	reward: WheelReward;
}

// ---------------------------------------------------------------------------
// Wheel segments (variable-ratio reward table, total weight = 100)
// ---------------------------------------------------------------------------

export const WHEEL_SEGMENTS: WheelSegment[] = [
	{
		reward: { type: 'sparks', label: '50 Sparks', amount: 50, description: 'A small burst of XP' },
		weight: 30,
		color: '#f59e0b',
		emoji: '⚡'
	},
	{
		reward: {
			type: 'rare_word_card',
			label: 'Word Card',
			description: 'A rare word for your collection'
		},
		weight: 15,
		color: '#8b5cf6',
		emoji: '📜'
	},
	{
		reward: {
			type: 'sparks',
			label: '100 Sparks',
			amount: 100,
			description: 'A solid burst of XP'
		},
		weight: 20,
		color: '#f97316',
		emoji: '⚡'
	},
	{
		reward: {
			type: 'cosmetic_item',
			label: 'Tile Style',
			description: 'A new cosmetic tile style'
		},
		weight: 5,
		color: '#ec4899',
		emoji: '🎨'
	},
	{
		reward: {
			type: 'sparks',
			label: '200 Sparks',
			amount: 200,
			description: 'A large burst of XP'
		},
		weight: 10,
		color: '#10b981',
		emoji: '⚡'
	},
	{
		reward: {
			type: 'rare_word_card',
			label: 'Word Card',
			description: 'A rare word for your collection'
		},
		weight: 15,
		color: '#6366f1',
		emoji: '📜'
	},
	{
		reward: {
			type: 'sparks',
			label: '75 Sparks',
			amount: 75,
			description: 'A moderate burst of XP'
		},
		weight: 5,
		color: '#facc15',
		emoji: '⚡'
	}
];

// ---------------------------------------------------------------------------
// Spin logic
// ---------------------------------------------------------------------------

/**
 * Selects a segment index using weighted random selection.
 * @param rng A PRNG function returning values in [0, 1)
 */
export function selectSegment(rng: () => number): number {
	const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
	const rand = rng() * totalWeight;

	let cumulative = 0;
	for (let i = 0; i < WHEEL_SEGMENTS.length; i++) {
		cumulative += WHEEL_SEGMENTS[i].weight;
		if (rand < cumulative) return i;
	}
	return WHEEL_SEGMENTS.length - 1;
}

/**
 * Returns the start angle (in degrees, clockwise from top) of a segment.
 * Segments are laid out proportionally by weight.
 */
export function segmentStartAngle(index: number): number {
	const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
	let angle = 0;
	for (let i = 0; i < index; i++) {
		angle += (WHEEL_SEGMENTS[i].weight / totalWeight) * 360;
	}
	return angle;
}

/**
 * Returns the center angle (in degrees, clockwise from top) of a segment.
 */
export function segmentCenterAngle(index: number): number {
	const totalWeight = WHEEL_SEGMENTS.reduce((sum, s) => sum + s.weight, 0);
	const start = segmentStartAngle(index);
	const span = (WHEEL_SEGMENTS[index].weight / totalWeight) * 360;
	return start + span / 2;
}

/**
 * Creates a seeded RNG for the wheel spin based on date.
 * Uses a different salt than the puzzle generator to avoid correlation.
 */
export function wheelRng(date: string): () => number {
	const seed = Array.from(date).reduce(
		(acc, c) => (acc ^ (c.charCodeAt(0) * 2654435761)) >>> 0,
		0x12345678
	);
	return mulberry32(seed);
}

// ---------------------------------------------------------------------------
// IDB persistence
// ---------------------------------------------------------------------------

const WHEEL_SPIN_PREFIX = 'lexicon-forge:wheel-spin:';

export async function loadSpinResult(date: string): Promise<SpinResult | null> {
	return (await idbGet<SpinResult>(`${WHEEL_SPIN_PREFIX}${date}`)) ?? null;
}

export async function saveSpinResult(result: SpinResult): Promise<void> {
	await idbSet(`${WHEEL_SPIN_PREFIX}${result.date}`, result);
}
