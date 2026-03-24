import { describe, it, expect } from 'vitest';
import {
	createArchitectPuzzle,
	initialArchitectState,
	canPlaceGroup,
	placeGroup,
	removeGroup,
	undoArchitect,
	redoArchitect,
	isGridFull,
	validateGrid,
	calculateStars,
	checkCompletion,
	DIFFICULTY_CONFIGS
} from './architect.js';
import type { ArchitectPuzzle, ArchitectState } from './architect.js';

/** Deterministic RNG that always returns 0 (selects first option). */
const rng0 = () => 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePuzzle(): ArchitectPuzzle {
	const puzzle = createArchitectPuzzle('apprentice', rng0);
	if (!puzzle) throw new Error('Expected apprentice puzzle to be available');
	return puzzle;
}

function makeState(): ArchitectState {
	return initialArchitectState(makePuzzle());
}

// ---------------------------------------------------------------------------
// createArchitectPuzzle
// ---------------------------------------------------------------------------

describe('createArchitectPuzzle', () => {
	it('returns a puzzle for apprentice difficulty', () => {
		const puzzle = createArchitectPuzzle('apprentice', rng0);
		expect(puzzle).not.toBeNull();
	});

	it('returns a puzzle for journeyman difficulty', () => {
		const puzzle = createArchitectPuzzle('journeyman', rng0);
		expect(puzzle).not.toBeNull();
	});

	it('returns null for master (no puzzles available yet)', () => {
		const puzzle = createArchitectPuzzle('master', rng0);
		expect(puzzle).toBeNull();
	});

	it('returns null for grandmaster (no puzzles available yet)', () => {
		const puzzle = createArchitectPuzzle('grandmaster', rng0);
		expect(puzzle).toBeNull();
	});

	it('apprentice puzzle has gridSize 4', () => {
		const puzzle = createArchitectPuzzle('apprentice', rng0)!;
		expect(puzzle.gridSize).toBe(4);
	});

	it('puzzle solution has correct dimensions', () => {
		const puzzle = createArchitectPuzzle('apprentice', rng0)!;
		expect(puzzle.solution).toHaveLength(puzzle.gridSize);
		puzzle.solution.forEach((row) => expect(row).toHaveLength(puzzle.gridSize));
	});

	it('all groups together cover all cells in the solution', () => {
		const puzzle = createArchitectPuzzle('apprentice', rng0)!;
		// We don't store the origin row in the public type; verify total letter count
		const totalLetters = puzzle.groups.reduce((sum, g) => sum + g.letters.length, 0);
		expect(totalLetters).toBe(puzzle.gridSize * puzzle.gridSize);
	});

	it('par equals number of groups', () => {
		const puzzle = createArchitectPuzzle('apprentice', rng0)!;
		expect(puzzle.par).toBe(puzzle.groups.length);
	});

	it('all group ids are unique', () => {
		const puzzle = createArchitectPuzzle('apprentice', rng0)!;
		const ids = puzzle.groups.map((g) => g.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});

// ---------------------------------------------------------------------------
// DIFFICULTY_CONFIGS
// ---------------------------------------------------------------------------

describe('DIFFICULTY_CONFIGS', () => {
	it('apprentice has gridSize 4', () => {
		expect(DIFFICULTY_CONFIGS.apprentice.gridSize).toBe(4);
	});

	it('journeyman has gridSize 5', () => {
		expect(DIFFICULTY_CONFIGS.journeyman.gridSize).toBe(5);
	});

	it('master has gridSize 6', () => {
		expect(DIFFICULTY_CONFIGS.master.gridSize).toBe(6);
	});

	it('grandmaster has gridSize 7', () => {
		expect(DIFFICULTY_CONFIGS.grandmaster.gridSize).toBe(7);
	});
});

// ---------------------------------------------------------------------------
// initialArchitectState
// ---------------------------------------------------------------------------

describe('initialArchitectState', () => {
	it('starts in playing phase', () => {
		expect(makeState().phase).toBe('playing');
	});

	it('grid is all null', () => {
		const state = makeState();
		state.grid.forEach((row) => row.forEach((cell) => expect(cell).toBeNull()));
	});

	it('all groups start unplaced', () => {
		const state = makeState();
		expect(state.unplacedGroupIds).toHaveLength(state.puzzle.groups.length);
	});

	it('placements is empty', () => {
		expect(makeState().placements).toHaveLength(0);
	});

	it('moves starts at 0', () => {
		expect(makeState().moves).toBe(0);
	});

	it('undo and redo stacks are empty', () => {
		const state = makeState();
		expect(state.undoStack).toHaveLength(0);
		expect(state.redoStack).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// canPlaceGroup
// ---------------------------------------------------------------------------

describe('canPlaceGroup', () => {
	it('returns true for a valid placement in an empty grid', () => {
		const state = makeState();
		const groupId = state.puzzle.groups[0].id;
		// Place at row 0, colStart 0 (always valid for 2-letter group in 4x4)
		expect(canPlaceGroup(state, groupId, 0, 0)).toBe(true);
	});

	it('returns false for invalid groupId', () => {
		const state = makeState();
		expect(canPlaceGroup(state, 'nonexistent', 0, 0)).toBe(false);
	});

	it('returns false if group is already placed', () => {
		const state = makeState();
		const groupId = state.puzzle.groups[0].id;
		const placed = placeGroup(state, groupId, 0, 0);
		expect(canPlaceGroup(placed, groupId, 1, 0)).toBe(false);
	});

	it('returns false if placement exceeds grid boundary', () => {
		const state = makeState();
		const group = state.puzzle.groups.find((g) => g.letters.length === 2);
		if (!group) return; // skip if no 2-letter group
		// colStart 3 with 2-letter group would reach col 4 (out of bounds for 4x4)
		expect(canPlaceGroup(state, group.id, 0, 3)).toBe(false);
	});

	it('returns false if target cells are occupied', () => {
		const state = makeState();
		const [g0, g1] = state.puzzle.groups;
		// Place first group at row 0, col 0
		const placed = placeGroup(state, g0.id, 0, 0);
		// Try to place second group overlapping at row 0, col 0
		expect(canPlaceGroup(placed, g1.id, 0, 0)).toBe(false);
	});

	it('returns false when phase is complete', () => {
		const state: ArchitectState = { ...makeState(), phase: 'complete' };
		expect(canPlaceGroup(state, state.puzzle.groups[0].id, 0, 0)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// placeGroup
// ---------------------------------------------------------------------------

describe('placeGroup', () => {
	it('fills the correct cells in the grid', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		for (let c = 0; c < group.letters.length; c++) {
			expect(placed.grid[0][c]).toBe(group.letters[c]);
		}
	});

	it('removes the group from unplacedGroupIds', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		expect(placed.unplacedGroupIds).not.toContain(group.id);
	});

	it('adds placement to placements array', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		expect(placed.placements).toHaveLength(1);
		expect(placed.placements[0]).toMatchObject({ groupId: group.id, row: 0, colStart: 0 });
	});

	it('increments moves by 1', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		expect(placed.moves).toBe(1);
	});

	it('pushes a snapshot onto undoStack', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		expect(placed.undoStack).toHaveLength(1);
	});

	it('clears the redoStack on new placement', () => {
		const state = makeState();
		const groups = state.puzzle.groups;
		// Place first, undo to populate redoStack, then place again
		const s1 = placeGroup(state, groups[0].id, 0, 0);
		const s2 = undoArchitect(s1);
		expect(s2.redoStack).toHaveLength(1);
		const s3 = placeGroup(s2, groups[0].id, 0, 0);
		expect(s3.redoStack).toHaveLength(0);
	});

	it('returns state unchanged for invalid placement', () => {
		const state = makeState();
		const result = placeGroup(state, 'bad-id', 0, 0);
		expect(result).toBe(state);
	});
});

// ---------------------------------------------------------------------------
// removeGroup
// ---------------------------------------------------------------------------

describe('removeGroup', () => {
	it('clears cells and returns group to unplaced bank', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		const removed = removeGroup(placed, group.id);

		// Cells should be null again
		for (let c = 0; c < group.letters.length; c++) {
			expect(removed.grid[0][c]).toBeNull();
		}
		expect(removed.unplacedGroupIds).toContain(group.id);
		expect(removed.placements.find((p) => p.groupId === group.id)).toBeUndefined();
	});

	it('does not change moves', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		const removed = removeGroup(placed, group.id);
		expect(removed.moves).toBe(1); // move was counted when placed
	});

	it('returns state unchanged for non-placed groupId', () => {
		const state = makeState();
		const result = removeGroup(state, state.puzzle.groups[0].id);
		expect(result).toBe(state);
	});
});

// ---------------------------------------------------------------------------
// undoArchitect / redoArchitect
// ---------------------------------------------------------------------------

describe('undoArchitect', () => {
	it('returns to previous state (empty grid) after one placement', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		const undone = undoArchitect(placed);

		expect(undone.unplacedGroupIds).toContain(group.id);
		for (let c = 0; c < group.letters.length; c++) {
			expect(undone.grid[0][c]).toBeNull();
		}
	});

	it('restores moves counter to pre-placement value', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		const undone = undoArchitect(placed);
		expect(undone.moves).toBe(0);
	});

	it('pushes current state onto redoStack', () => {
		const state = makeState();
		const placed = placeGroup(state, state.puzzle.groups[0].id, 0, 0);
		const undone = undoArchitect(placed);
		expect(undone.redoStack).toHaveLength(1);
	});

	it('returns same state when undoStack is empty', () => {
		const state = makeState();
		expect(undoArchitect(state)).toBe(state);
	});
});

describe('redoArchitect', () => {
	it('reapplies a previously undone placement', () => {
		const state = makeState();
		const group = state.puzzle.groups[0];
		const placed = placeGroup(state, group.id, 0, 0);
		const undone = undoArchitect(placed);
		const redone = redoArchitect(undone);

		expect(redone.unplacedGroupIds).not.toContain(group.id);
		expect(redone.grid[0][0]).toBe(group.letters[0]);
	});

	it('moves counter is restored to post-placement value', () => {
		const state = makeState();
		const placed = placeGroup(state, state.puzzle.groups[0].id, 0, 0);
		const undone = undoArchitect(placed);
		const redone = redoArchitect(undone);
		expect(redone.moves).toBe(1);
	});

	it('returns same state when redoStack is empty', () => {
		const state = makeState();
		expect(redoArchitect(state)).toBe(state);
	});
});

// ---------------------------------------------------------------------------
// isGridFull
// ---------------------------------------------------------------------------

describe('isGridFull', () => {
	it('returns false for an empty grid', () => {
		const state = makeState();
		expect(isGridFull(state.grid)).toBe(false);
	});

	it('returns true when all cells are filled', () => {
		const grid = [
			['A', 'B'],
			['C', 'D']
		];
		expect(isGridFull(grid)).toBe(true);
	});

	it('returns false if any cell is null', () => {
		const grid = [
			['A', null],
			['C', 'D']
		];
		expect(isGridFull(grid)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// validateGrid
// ---------------------------------------------------------------------------

describe('validateGrid', () => {
	it('returns true when all rows and columns are valid words', () => {
		// 2×2 grid where rows = AB, CD and columns = AC, BD (all "words" per mock)
		const grid = [
			['A', 'B'],
			['C', 'D']
		];
		const allValid = () => true;
		expect(validateGrid(grid, allValid)).toBe(true);
	});

	it('returns false when a row is not a valid word', () => {
		const grid = [
			['X', 'X'],
			['A', 'B']
		];
		const validator = (w: string) => w !== 'XX';
		expect(validateGrid(grid, validator)).toBe(false);
	});

	it('returns false when a column is not a valid word', () => {
		const grid = [
			['A', 'B'],
			['C', 'D']
		];
		// columns: AC (invalid), BD
		const validator = (w: string) => w !== 'AC';
		expect(validateGrid(grid, validator)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// calculateStars
// ---------------------------------------------------------------------------

describe('calculateStars', () => {
	it('returns 3 stars when moves equal par', () => {
		expect(calculateStars(8, 8)).toBe(3);
	});

	it('returns 3 stars when moves are below par', () => {
		expect(calculateStars(6, 8)).toBe(3);
	});

	it('returns 2 stars when moves = par + 1', () => {
		expect(calculateStars(9, 8)).toBe(2);
	});

	it('returns 2 stars when moves = par + 2', () => {
		expect(calculateStars(10, 8)).toBe(2);
	});

	it('returns 1 star when moves = par + 3', () => {
		expect(calculateStars(11, 8)).toBe(1);
	});

	it('returns 1 star when moves are well above par', () => {
		expect(calculateStars(100, 8)).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// checkCompletion
// ---------------------------------------------------------------------------

describe('checkCompletion', () => {
	it('does not complete when grid is not full', () => {
		const state = makeState();
		const result = checkCompletion(state, () => true);
		expect(result.phase).toBe('playing');
	});

	it('transitions to complete when grid is full and all words are valid', () => {
		// Build a minimal 1×1 puzzle manually
		const puzzle: ArchitectPuzzle = {
			difficulty: 'apprentice',
			gridSize: 1,
			solution: [['A']],
			groups: [{ id: 'g0', letters: 'A' }],
			par: 1
		};
		let state = initialArchitectState(puzzle);
		state = placeGroup(state, 'g0', 0, 0);
		const result = checkCompletion(state, () => true);
		expect(result.phase).toBe('complete');
		expect(result.stars).toBeGreaterThan(0);
	});

	it('stays in playing phase if grid is full but words are invalid', () => {
		const puzzle: ArchitectPuzzle = {
			difficulty: 'apprentice',
			gridSize: 1,
			solution: [['A']],
			groups: [{ id: 'g0', letters: 'A' }],
			par: 1
		};
		let state = initialArchitectState(puzzle);
		state = placeGroup(state, 'g0', 0, 0);
		const result = checkCompletion(state, () => false);
		expect(result.phase).toBe('playing');
	});
});
