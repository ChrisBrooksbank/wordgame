import { describe, it, expect } from 'vitest';
import {
	getChainMultiplier,
	initialCascadeState,
	findBestCascadeWord,
	submitCascadeWord,
	CASCADE_MOVE_BUDGET
} from './cascade.js';
import type { CascadeState } from './cascade.js';
import type { HexTile, HexCoord } from './hexGrid.js';
import { hexKey } from './hexGrid.js';

/** Deterministic RNG that always returns 0 (picks first weighted letter = 'A'). */
const rng0 = () => 0;

// ---------------------------------------------------------------------------
// getChainMultiplier
// ---------------------------------------------------------------------------

describe('getChainMultiplier', () => {
	it('chain 1 → 1x', () => {
		expect(getChainMultiplier(1)).toBe(1);
	});

	it('chain 2 → 5x', () => {
		expect(getChainMultiplier(2)).toBe(5);
	});

	it('chain 3 → 12x', () => {
		expect(getChainMultiplier(3)).toBe(12);
	});

	it('chain 4 → 30x', () => {
		expect(getChainMultiplier(4)).toBe(30);
	});

	it('chain 10 → 30x (capped at 4+)', () => {
		expect(getChainMultiplier(10)).toBe(30);
	});
});

// ---------------------------------------------------------------------------
// initialCascadeState
// ---------------------------------------------------------------------------

describe('initialCascadeState', () => {
	it('starts in playing phase', () => {
		const state = initialCascadeState(rng0);
		expect(state.phase).toBe('playing');
	});

	it('starts with 0 moves used', () => {
		const state = initialCascadeState(rng0);
		expect(state.movesUsed).toBe(0);
	});

	it('starts with 0 score', () => {
		const state = initialCascadeState(rng0);
		expect(state.score).toBe(0);
		expect(state.manualScore).toBe(0);
		expect(state.cascadeScore).toBe(0);
	});

	it('starts with empty wordsFound', () => {
		const state = initialCascadeState(rng0);
		expect(state.wordsFound).toHaveLength(0);
	});

	it('creates a 5x8 grid with 40 tiles', () => {
		const state = initialCascadeState(rng0);
		expect(state.grid.size).toBe('5x8');
		expect(state.grid.tiles).toHaveLength(40);
	});
});

// ---------------------------------------------------------------------------
// findBestCascadeWord
// ---------------------------------------------------------------------------

describe('findBestCascadeWord', () => {
	/** Builds a minimal tile list from letter + coord pairs. */
	function makeTiles(entries: Array<{ letter: string; q: number; r: number }>): HexTile[] {
		return entries.map((e, i) => ({
			letter: e.letter,
			coord: { q: e.q, r: e.r },
			id: `t${i}`
		}));
	}

	it('returns null when no valid word exists', () => {
		const tiles = makeTiles([
			{ letter: 'X', q: 0, r: 0 },
			{ letter: 'Q', q: 1, r: 0 },
			{ letter: 'Z', q: 0, r: 1 }
		]);
		// Validator that accepts nothing
		const result = findBestCascadeWord(
			tiles,
			() => false,
			() => false
		);
		expect(result).toBeNull();
	});

	it('finds a valid 3-letter word', () => {
		// Place C-A-T in a line (adjacent hex coords)
		const tiles = makeTiles([
			{ letter: 'C', q: 0, r: 0 },
			{ letter: 'A', q: 1, r: 0 },
			{ letter: 'T', q: 2, r: 0 }
		]);
		const words = new Set(['CAT']);
		const prefixes = new Set(['C', 'CA', 'CAT']);
		const result = findBestCascadeWord(
			tiles,
			(w) => words.has(w),
			(p) => prefixes.has(p)
		);
		expect(result).not.toBeNull();
		expect(result!.word).toBe('CAT');
		expect(result!.path).toHaveLength(3);
	});

	it('prefers longer words over shorter ones', () => {
		// Place C-A-T-S in a line
		const tiles = makeTiles([
			{ letter: 'C', q: 0, r: 0 },
			{ letter: 'A', q: 1, r: 0 },
			{ letter: 'T', q: 2, r: 0 },
			{ letter: 'S', q: 3, r: 0 }
		]);
		const words = new Set(['CAT', 'CATS']);
		const prefixes = new Set(['C', 'CA', 'CAT', 'CATS']);
		const result = findBestCascadeWord(
			tiles,
			(w) => words.has(w),
			(p) => prefixes.has(p)
		);
		expect(result).not.toBeNull();
		expect(result!.word).toBe('CATS');
	});

	it('returns null for empty tile list', () => {
		const result = findBestCascadeWord(
			[],
			() => false,
			() => false
		);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// submitCascadeWord
// ---------------------------------------------------------------------------

describe('submitCascadeWord', () => {
	/** Validator that accepts only specified words; prefix check is generous. */
	function makeValidator(words: string[]) {
		const wordSet = new Set(words);
		return {
			isWord: (w: string) => wordSet.has(w),
			isPrefix: (p: string) => {
				for (const w of wordSet) {
					if (w.startsWith(p)) return true;
				}
				return true; // generous to avoid pruning in tests
			}
		};
	}

	it('fails when path is too short', () => {
		const state = initialCascadeState(rng0);
		const { result } = submitCascadeWord(
			state,
			[],
			() => false,
			() => false,
			rng0
		);
		expect(result.success).toBe(false);
		expect(result.reason).toBe('too_short');
	});

	it('fails when path length is 2', () => {
		const state = initialCascadeState(rng0);
		const path = state.grid.tiles.slice(0, 2).map((t) => t.coord);
		const { result } = submitCascadeWord(
			state,
			path,
			() => false,
			() => false,
			rng0
		);
		expect(result.success).toBe(false);
		expect(result.reason).toBe('too_short');
	});

	it('fails when word is not valid', () => {
		const state = initialCascadeState(rng0);
		// Pick first 3 adjacent tiles — they form some random combo
		// We need to find adjacent tiles from the grid
		const tiles = state.grid.tiles;
		// Find 3 adjacent tiles
		const t0 = tiles[0];
		const adj1 = tiles.find((t) => {
			const k = hexKey(t.coord);
			return (
				k !== hexKey(t0.coord) &&
				Math.abs(t.coord.q - t0.coord.q) + Math.abs(t.coord.r - t0.coord.r) <= 2
			);
		});
		if (!adj1) return; // skip if layout doesn't allow
		const adj2 = tiles.find((t) => {
			const k = hexKey(t.coord);
			return (
				k !== hexKey(t0.coord) &&
				k !== hexKey(adj1.coord) &&
				Math.abs(t.coord.q - adj1.coord.q) + Math.abs(t.coord.r - adj1.coord.r) <= 2
			);
		});
		if (!adj2) return; // skip if layout doesn't allow
		const path = [t0.coord, adj1.coord, adj2.coord];
		const { result } = submitCascadeWord(
			state,
			path,
			() => false,
			() => true,
			rng0
		);
		expect(result.success).toBe(false);
		expect(result.reason).toBe('not_a_word');
	});

	it('succeeds and increments move count', () => {
		// Create a state where we can construct a valid path manually
		// We'll create a state with known tile layout
		const state = initialCascadeState(rng0);

		// Override grid with a known layout for testing
		const coords: HexCoord[] = [
			{ q: 0, r: 0 },
			{ q: 1, r: 0 },
			{ q: 2, r: 0 },
			{ q: 3, r: 0 }
		];
		const tiles: HexTile[] = [
			{ letter: 'C', coord: coords[0], id: 'tc0' },
			{ letter: 'A', coord: coords[1], id: 'tc1' },
			{ letter: 'T', coord: coords[2], id: 'tc2' },
			{ letter: 'S', coord: coords[3], id: 'tc3' }
		];
		const testState: CascadeState = {
			...state,
			grid: { tiles, size: '5x8' }
		};

		const path = [coords[0], coords[1], coords[2]]; // C-A-T
		const validator = makeValidator(['CAT']);
		const { newState, result } = submitCascadeWord(
			testState,
			path,
			validator.isWord,
			validator.isPrefix,
			rng0
		);

		expect(result.success).toBe(true);
		expect(result.manualWord?.word).toBe('CAT');
		expect(newState.movesUsed).toBe(1);
		expect(newState.score).toBeGreaterThan(0);
		expect(newState.manualScore).toBeGreaterThan(0);
	});

	it('does not allow submission in gameover phase', () => {
		const state = initialCascadeState(rng0);
		const gameoverState: CascadeState = { ...state, phase: 'gameover' };
		const { result } = submitCascadeWord(
			gameoverState,
			[],
			() => false,
			() => false,
			rng0
		);
		expect(result.success).toBe(false);
	});

	it('transitions to gameover when move budget is exhausted', () => {
		const state = initialCascadeState(rng0);
		// Set movesUsed to one below budget
		const coords: HexCoord[] = [
			{ q: 0, r: 0 },
			{ q: 1, r: 0 },
			{ q: 2, r: 0 }
		];
		const tiles: HexTile[] = [
			{ letter: 'C', coord: coords[0], id: 'tx0' },
			{ letter: 'A', coord: coords[1], id: 'tx1' },
			{ letter: 'T', coord: coords[2], id: 'tx2' }
		];
		const nearEndState: CascadeState = {
			...state,
			grid: { tiles, size: '5x8' },
			movesUsed: CASCADE_MOVE_BUDGET - 1
		};

		const path = coords;
		const validator = makeValidator(['CAT']);
		const { newState } = submitCascadeWord(
			nearEndState,
			path,
			validator.isWord,
			validator.isPrefix,
			rng0
		);
		expect(newState.phase).toBe('gameover');
		expect(newState.movesUsed).toBe(CASCADE_MOVE_BUDGET);
	});

	it('cascade chain is detected and scored correctly', () => {
		// Set up a grid where after forging "CAT", another word "DOG" will cascade.
		// Use valid 5x8 bottom-row positions so gravity doesn't scatter tiles:
		//   CAT: C(-3,7) A(-2,7) T(-1,7)  — bottom row, each adjacent (diff q+1)
		//   DOG: D(0,7)  O(1,7)  G(1,6)   — D/O on bottom row, G one row up in q=1 column
		// After CAT is consumed, D/O/G remain at their positions (already at column bottoms).
		const tiles: HexTile[] = [
			{ letter: 'C', coord: { q: -3, r: 7 }, id: 'ta0' },
			{ letter: 'A', coord: { q: -2, r: 7 }, id: 'ta1' },
			{ letter: 'T', coord: { q: -1, r: 7 }, id: 'ta2' },
			{ letter: 'D', coord: { q: 0, r: 7 }, id: 'ta3' },
			{ letter: 'O', coord: { q: 1, r: 7 }, id: 'ta4' },
			{ letter: 'G', coord: { q: 1, r: 6 }, id: 'ta5' }
		];
		const state: CascadeState = {
			phase: 'playing',
			grid: { tiles, size: '5x8' },
			movesUsed: 0,
			score: 0,
			manualScore: 0,
			cascadeScore: 0,
			wordsFound: []
		};

		const validWords = new Set(['CAT', 'DOG']);
		const validator = makeValidator([...validWords]);

		// Forge CAT using the first three tile coords
		const path = tiles.slice(0, 3).map((t) => t.coord);
		const { newState, result } = submitCascadeWord(
			state,
			path,
			validator.isWord,
			validator.isPrefix,
			rng0
		);

		expect(result.success).toBe(true);
		expect(result.manualWord?.word).toBe('CAT');
		// DOG should cascade (it's in the eligible tiles D,O,G which are adjacent)
		expect(result.cascadeChain.length).toBeGreaterThanOrEqual(1);
		const dogCascade = result.cascadeChain.find((w) => w.word === 'DOG');
		expect(dogCascade).toBeDefined();
		expect(dogCascade?.chainNumber).toBe(1);
		expect(dogCascade?.multiplier).toBe(1);
		expect(newState.cascadeScore).toBeGreaterThan(0);
		expect(newState.wordsFound.length).toBeGreaterThanOrEqual(2);
	});

	it('cascade chain 2 uses 5x multiplier', () => {
		// Layout designed so that two cascade waves occur:
		//   CAT: C(-3,7) A(-2,7) T(-1,7)  — player forges these
		//   DOG: D(0,7)  O(1,7)  G(1,6)   — cascade chain 1 after CAT consumed
		//   RUN: R(-3,6) U(-2,6) N(-1,6)  — these fall to (-3,7)(-2,7)(-1,7) after CAT
		//                                    consumed, then form cascade chain 2 after DOG
		//
		// Gravity analysis:
		//   q=-3 column has 2 positions: (-3,6) and (-3,7).
		//     C(-3,7) consumed → R(-3,6) falls to (-3,7).
		//   q=-2 column similarly: A(-2,7) consumed → U(-2,6) falls to (-2,7).
		//   q=-1 column: T(-1,7) consumed → N(-1,6) falls to (-1,7).
		//   After CAT+gravity: eligible = D(0,7) O(1,7) G(1,6) R(-3,7) U(-2,7) N(-1,7).
		//   DFS finds DOG first (DOG > RUN by DFS order) → chain 1 (×1).
		//   After DOG+gravity: eligible = R(-3,7) U(-2,7) N(-1,7) → forms RUN → chain 2 (×5).
		const tiles: HexTile[] = [
			{ letter: 'C', coord: { q: -3, r: 7 }, id: 'tb0' },
			{ letter: 'A', coord: { q: -2, r: 7 }, id: 'tb1' },
			{ letter: 'T', coord: { q: -1, r: 7 }, id: 'tb2' },
			{ letter: 'D', coord: { q: 0, r: 7 }, id: 'tb3' },
			{ letter: 'O', coord: { q: 1, r: 7 }, id: 'tb4' },
			{ letter: 'G', coord: { q: 1, r: 6 }, id: 'tb5' },
			{ letter: 'R', coord: { q: -3, r: 6 }, id: 'tb6' },
			{ letter: 'U', coord: { q: -2, r: 6 }, id: 'tb7' },
			{ letter: 'N', coord: { q: -1, r: 6 }, id: 'tb8' }
		];
		const state: CascadeState = {
			phase: 'playing',
			grid: { tiles, size: '5x8' },
			movesUsed: 0,
			score: 0,
			manualScore: 0,
			cascadeScore: 0,
			wordsFound: []
		};

		const validWords = new Set(['CAT', 'DOG', 'RUN']);
		const validator = makeValidator([...validWords]);

		const path = tiles.slice(0, 3).map((t) => t.coord); // forge "CAT"
		const { result } = submitCascadeWord(state, path, validator.isWord, validator.isPrefix, rng0);

		expect(result.success).toBe(true);
		// Should detect DOG as chain 1 (D,O,G remain at bottom after CAT consumed)
		const dogCascade = result.cascadeChain.find((w) => w.word === 'DOG');
		expect(dogCascade?.chainNumber).toBe(1);
		expect(dogCascade?.multiplier).toBe(1);

		// RUN appears as chain 2 (5x): R,U,N fall from row-6 to row-7 (replacing C,A,T),
		// then after DOG is consumed they form a valid adjacent path.
		const runCascade = result.cascadeChain.find((w) => w.word === 'RUN');
		expect(runCascade).toBeDefined();
		expect(runCascade?.chainNumber).toBe(2);
		expect(runCascade?.multiplier).toBe(5);
	});
});
