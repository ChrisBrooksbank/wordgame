/**
 * Architect Mode engine.
 *
 * Crossword-style rectangular grid puzzle:
 *  - Player receives letter groups (2-3 letter fragments)
 *  - Place groups into the grid so every row and column forms a valid word
 *  - Groups cannot be split or rearranged internally
 *
 * Difficulty tiers:
 *  Apprentice:  4×4 grid, 2-letter groups
 *  Journeyman:  5×5 grid, 2-3 letter groups
 *  Master:      6×6 grid, 2-3 letter groups
 *  Grandmaster: 7×7 grid, 3-letter groups
 *
 * Scoring:
 *  Par = number of groups (one placement per group is optimal)
 *  3 stars: moves ≤ par
 *  2 stars: moves ≤ par + 2
 *  1 star:  any completion beyond that
 */

export type Difficulty = 'apprentice' | 'journeyman' | 'master' | 'grandmaster';
export type ArchitectPhase = 'playing' | 'complete';

export interface DifficultyConfig {
	gridSize: number;
	label: string;
	description: string;
}

export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
	apprentice: { gridSize: 4, label: 'Apprentice', description: '4×4 grid · 2-letter groups' },
	journeyman: { gridSize: 5, label: 'Journeyman', description: '5×5 grid · 2–3 letter groups' },
	master: { gridSize: 6, label: 'Master', description: '6×6 grid · 2–3 letter groups' },
	grandmaster: { gridSize: 7, label: 'Grandmaster', description: '7×7 grid · 3-letter groups' }
};

/** Row partition schemes: how each row is split into groups by grid size. */
const ROW_PARTITIONS: Record<number, number[][]> = {
	4: [[2, 2]],
	5: [
		[2, 3],
		[3, 2]
	],
	6: [
		[2, 2, 2],
		[3, 3]
	],
	7: [
		[3, 4],
		[4, 3]
	]
};

// ---------------------------------------------------------------------------
// Hardcoded valid word grids
// Each inner array is one row of letters. All rows AND columns must be valid words.
// ---------------------------------------------------------------------------

/** 4×4 perfect word squares (same words reading across and down). */
const GRIDS_4X4: string[][][] = [
	// HEAT / EACH / ACRE / THEE
	[
		['H', 'E', 'A', 'T'],
		['E', 'A', 'C', 'H'],
		['A', 'C', 'R', 'E'],
		['T', 'H', 'E', 'E']
	],
	// TRAM / RACE / ACES / MESS
	[
		['T', 'R', 'A', 'M'],
		['R', 'A', 'C', 'E'],
		['A', 'C', 'E', 'S'],
		['M', 'E', 'S', 'S']
	],
	// BALD / ARIA / LIAR / DARE
	[
		['B', 'A', 'L', 'D'],
		['A', 'R', 'I', 'A'],
		['L', 'I', 'A', 'R'],
		['D', 'A', 'R', 'E']
	]
];

/** 5×5 perfect word square. */
const GRIDS_5X5: string[][][] = [
	// HEART / EMBER / ABASE / RESET / TRETS
	[
		['H', 'E', 'A', 'R', 'T'],
		['E', 'M', 'B', 'E', 'R'],
		['A', 'B', 'A', 'S', 'E'],
		['R', 'E', 'S', 'E', 'T'],
		['T', 'R', 'E', 'T', 'S']
	]
];

const HARDCODED_GRIDS: Record<Difficulty, string[][][]> = {
	apprentice: GRIDS_4X4,
	journeyman: GRIDS_5X5,
	master: [],
	grandmaster: []
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LetterGroup {
	id: string;
	letters: string; // e.g. "HE" or "ACR"
}

export interface PlacedGroup {
	groupId: string;
	row: number;
	colStart: number;
}

export interface ArchitectPuzzle {
	difficulty: Difficulty;
	gridSize: number;
	/** The solved grid, row-major: solution[row][col]. Used for validation reference. */
	solution: string[][];
	/** All letter groups the player must place. */
	groups: LetterGroup[];
	/** Optimal number of placement moves (= groups.length). */
	par: number;
}

interface ArchitectSnapshot {
	grid: (string | null)[][];
	unplacedGroupIds: string[];
	placements: PlacedGroup[];
	moves: number;
}

export interface ArchitectState {
	puzzle: ArchitectPuzzle;
	/** Current grid, null = empty cell. */
	grid: (string | null)[][];
	/** IDs of groups not yet placed on the grid. */
	unplacedGroupIds: string[];
	/** All currently placed groups with their positions. */
	placements: PlacedGroup[];
	/** Total placement actions taken (not decremented by undo). */
	moves: number;
	phase: ArchitectPhase;
	stars: 0 | 1 | 2 | 3;
	undoStack: ArchitectSnapshot[];
	redoStack: ArchitectSnapshot[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

function pickPartition(size: number, rng: () => number): number[] {
	const options = ROW_PARTITIONS[size] ?? [[Math.ceil(size / 2), Math.floor(size / 2)]];
	return options[Math.floor(rng() * options.length)];
}

function gridToGroups(grid: string[][], rng: () => number): LetterGroup[] {
	const size = grid.length;
	const groups: LetterGroup[] = [];
	for (let row = 0; row < size; row++) {
		const partition = pickPartition(size, rng);
		let col = 0;
		for (const groupSize of partition) {
			const letters = grid[row].slice(col, col + groupSize).join('');
			groups.push({ id: `${row}-${col}`, letters });
			col += groupSize;
		}
	}
	return shuffleArray(groups, rng);
}

// ---------------------------------------------------------------------------
// Public API — puzzle creation
// ---------------------------------------------------------------------------

/**
 * Creates an Architect puzzle for the given difficulty.
 * Returns null if no puzzles are available for that difficulty.
 */
export function createArchitectPuzzle(
	difficulty: Difficulty,
	rng: () => number
): ArchitectPuzzle | null {
	const grids = HARDCODED_GRIDS[difficulty];
	if (grids.length === 0) return null;

	const grid = grids[Math.floor(rng() * grids.length)];
	const groups = gridToGroups(grid, rng);

	return {
		difficulty,
		gridSize: grid.length,
		solution: grid,
		groups,
		par: groups.length
	};
}

// ---------------------------------------------------------------------------
// Public API — state management
// ---------------------------------------------------------------------------

export function initialArchitectState(puzzle: ArchitectPuzzle): ArchitectState {
	return {
		puzzle,
		grid: Array.from({ length: puzzle.gridSize }, () => Array(puzzle.gridSize).fill(null)),
		unplacedGroupIds: puzzle.groups.map((g) => g.id),
		placements: [],
		moves: 0,
		phase: 'playing',
		stars: 0,
		undoStack: [],
		redoStack: []
	};
}

function snapshot(state: ArchitectState): ArchitectSnapshot {
	return {
		grid: state.grid.map((row) => [...row]),
		unplacedGroupIds: [...state.unplacedGroupIds],
		placements: [...state.placements],
		moves: state.moves
	};
}

function restoreSnapshot(state: ArchitectState, snap: ArchitectSnapshot): ArchitectState {
	return {
		...state,
		grid: snap.grid.map((row) => [...row]),
		unplacedGroupIds: [...snap.unplacedGroupIds],
		placements: [...snap.placements],
		moves: snap.moves
	};
}

/** Returns true if the group can be placed at (row, colStart) without overlapping existing tiles. */
export function canPlaceGroup(
	state: ArchitectState,
	groupId: string,
	row: number,
	colStart: number
): boolean {
	if (state.phase !== 'playing') return false;

	const group = state.puzzle.groups.find((g) => g.id === groupId);
	if (!group) return false;
	if (!state.unplacedGroupIds.includes(groupId)) return false;

	const { gridSize } = state.puzzle;
	if (row < 0 || row >= gridSize) return false;
	if (colStart < 0 || colStart + group.letters.length > gridSize) return false;

	for (let c = colStart; c < colStart + group.letters.length; c++) {
		if (state.grid[row][c] !== null) return false;
	}
	return true;
}

/** Places a group at (row, colStart). Increments move counter. */
export function placeGroup(
	state: ArchitectState,
	groupId: string,
	row: number,
	colStart: number
): ArchitectState {
	if (!canPlaceGroup(state, groupId, row, colStart)) return state;

	const group = state.puzzle.groups.find((g) => g.id === groupId)!;
	const snap = snapshot(state);

	const newGrid = state.grid.map((r) => [...r]);
	for (let c = 0; c < group.letters.length; c++) {
		newGrid[row][colStart + c] = group.letters[c];
	}

	return {
		...state,
		grid: newGrid,
		placements: [...state.placements, { groupId, row, colStart }],
		unplacedGroupIds: state.unplacedGroupIds.filter((id) => id !== groupId),
		moves: state.moves + 1,
		undoStack: [...state.undoStack, snap],
		redoStack: []
	};
}

/** Removes a placed group from the grid, returning it to the unplaced bank. Does NOT affect move count. */
export function removeGroup(state: ArchitectState, groupId: string): ArchitectState {
	const placement = state.placements.find((p) => p.groupId === groupId);
	if (!placement) return state;

	const group = state.puzzle.groups.find((g) => g.id === groupId)!;
	const newGrid = state.grid.map((r) => [...r]);
	for (let c = 0; c < group.letters.length; c++) {
		newGrid[placement.row][placement.colStart + c] = null;
	}

	return {
		...state,
		grid: newGrid,
		placements: state.placements.filter((p) => p.groupId !== groupId),
		unplacedGroupIds: [...state.unplacedGroupIds, groupId]
	};
}

export function undoArchitect(state: ArchitectState): ArchitectState {
	if (state.undoStack.length === 0) return state;
	const snap = state.undoStack[state.undoStack.length - 1];
	const currentSnap = snapshot(state);
	return {
		...restoreSnapshot(state, snap),
		undoStack: state.undoStack.slice(0, -1),
		redoStack: [currentSnap, ...state.redoStack],
		phase: state.phase
	};
}

export function redoArchitect(state: ArchitectState): ArchitectState {
	if (state.redoStack.length === 0) return state;
	const snap = state.redoStack[0];
	const currentSnap = snapshot(state);
	return {
		...restoreSnapshot(state, snap),
		undoStack: [...state.undoStack, currentSnap],
		redoStack: state.redoStack.slice(1),
		phase: state.phase
	};
}

// ---------------------------------------------------------------------------
// Public API — validation and scoring
// ---------------------------------------------------------------------------

/** Returns true when every cell in the grid is filled. */
export function isGridFull(grid: (string | null)[][]): boolean {
	return grid.every((row) => row.every((cell) => cell !== null));
}

/** Validates that all rows and columns spell valid words. */
export function validateGrid(
	grid: (string | null)[][],
	isValidWord: (word: string) => boolean
): boolean {
	const size = grid.length;

	for (let r = 0; r < size; r++) {
		const word = (grid[r] as string[]).join('');
		if (!isValidWord(word)) return false;
	}

	for (let c = 0; c < size; c++) {
		const word = (grid.map((row) => row[c]) as string[]).join('');
		if (!isValidWord(word)) return false;
	}

	return true;
}

/**
 * Star rating based on moves vs par:
 *  3 stars: ≤ par
 *  2 stars: ≤ par + 2
 *  1 star:  any completion
 */
export function calculateStars(moves: number, par: number): 1 | 2 | 3 {
	if (moves <= par) return 3;
	if (moves <= par + 2) return 2;
	return 1;
}

/**
 * Checks if the grid is fully filled and valid. If so, transitions to complete phase.
 * Call this after every placement.
 */
export function checkCompletion(
	state: ArchitectState,
	isValidWord: (word: string) => boolean
): ArchitectState {
	if (!isGridFull(state.grid)) return state;
	if (!validateGrid(state.grid, isValidWord)) return state;

	const stars = calculateStars(state.moves, state.puzzle.par);
	return { ...state, phase: 'complete', stars };
}
