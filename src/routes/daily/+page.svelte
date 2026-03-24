<script lang="ts">
	import { onMount } from 'svelte';
	import HexGrid from '$lib/components/HexGrid.svelte';
	import { loadWordValidator } from '$lib/engine/wordValidator.js';
	import {
		generateDailyPuzzle,
		calculateStarThresholds,
		getStarRating,
		DAILY_MOVE_BUDGET,
		todayUTC
	} from '$lib/engine/dailyPuzzle.js';
	import { submitWord, pathToWord } from '$lib/engine/forgeEngine.js';
	import { mulberry32, dateToSeed } from '$lib/engine/dailyPuzzle.js';
	import type { HexCoord } from '$lib/engine/hexGrid.js';
	import { hexKey } from '$lib/engine/hexGrid.js';
	import { get as idbGet, set as idbSet } from 'idb-keyval';
	import ForgeShareCard from '$lib/components/ForgeShareCard.svelte';
	import ForgeWheel from '$lib/components/ForgeWheel.svelte';
	import { loadSpinResult } from '$lib/engine/forgeWheel.js';
	import type { SpinResult } from '$lib/engine/forgeWheel.js';

	// -------------------------------------------------------------------------
	// Types
	// -------------------------------------------------------------------------

	interface DailyResult {
		date: string;
		score: number;
		stars: 1 | 2 | 3 | 4 | 5;
		wordsFound: string[];
		movesUsed: number;
	}

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let loading = $state(true);
	let loadError = $state<string | null>(null);

	// Puzzle
	let puzzle = $state<ReturnType<typeof generateDailyPuzzle> | null>(null);
	let grid = $state<ReturnType<typeof generateDailyPuzzle>['grid'] | null>(null);
	let rng = $state<(() => number) | null>(null);

	// Game progress
	let path = $state<HexCoord[]>([]);
	let score = $state(0);
	let movesLeft = $state(DAILY_MOVE_BUDGET);
	let wordsFound = $state<{ word: string; points: number }[]>([]);

	// Feedback
	let feedback = $state<string | null>(null);
	let feedbackType = $state<'success' | 'error'>('success');
	let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// Game state
	let gameOver = $state(false);
	let alreadyCompleted = $state(false);
	let previousResult = $state<DailyResult | null>(null);

	// Forge Wheel
	let wheelSpinResult = $state<SpinResult | null>(null);

	// Validator
	let validator: Awaited<ReturnType<typeof loadWordValidator>> | null = null;

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	const currentWord = $derived(grid && path.length > 0 ? pathToWord(grid, path) : '');

	const catalystCoord = $derived(puzzle?.catalystTile.coord ?? null);

	const starThresholds = $derived(puzzle ? calculateStarThresholds(puzzle) : null);

	const stars = $derived(
		starThresholds ? getStarRating(score, starThresholds) : (1 as 1 | 2 | 3 | 4 | 5)
	);

	// -------------------------------------------------------------------------
	// IDB key for today's result
	// -------------------------------------------------------------------------

	const DAILY_RESULT_PREFIX = 'lexicon-forge:daily:';

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	onMount(async () => {
		try {
			const today = todayUTC();

			// Check if already completed today
			const saved = await idbGet<DailyResult>(`${DAILY_RESULT_PREFIX}${today}`);
			if (saved) {
				alreadyCompleted = true;
				previousResult = saved;
				wheelSpinResult = await loadSpinResult(today);
				loading = false;
				return;
			}

			// Load validator + generate puzzle in parallel
			const [v, p] = await Promise.all([
				loadWordValidator(),
				Promise.resolve(generateDailyPuzzle(today))
			]);

			validator = v;
			puzzle = p;
			grid = p.grid;

			// Create a fresh RNG seeded from today — offset past the grid generation calls
			// by using a secondary seed derived from the primary seed
			rng = mulberry32(dateToSeed(today) ^ 0xdeadbeef);

			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load puzzle';
			loading = false;
		}
	});

	// -------------------------------------------------------------------------
	// Tile interaction
	// -------------------------------------------------------------------------

	function handleTileClick(coord: HexCoord) {
		if (gameOver || !grid) return;

		const key = hexKey(coord);
		const alreadyInPath = path.some((c) => hexKey(c) === key);

		if (alreadyInPath) {
			// If clicking the last tile, clear the path
			if (hexKey(path[path.length - 1]) === key) {
				path = [];
			}
			return;
		}

		path = [...path, coord];
	}

	// -------------------------------------------------------------------------
	// Word submission
	// -------------------------------------------------------------------------

	function showFeedback(msg: string, type: 'success' | 'error') {
		if (feedbackTimer) globalThis.clearTimeout(feedbackTimer);
		feedback = msg;
		feedbackType = type;
		feedbackTimer = globalThis.setTimeout(() => {
			feedback = null;
		}, 2000);
	}

	function handleSubmit() {
		if (!grid || !validator || !rng || gameOver || path.length < 3) return;

		const result = submitWord(
			grid,
			path,
			(w) => validator!.isWord(w),
			rng,
			catalystCoord ?? undefined
		);

		if (result.success && result.result) {
			const { grid: newGrid, score: scoreBreakdown, word } = result.result;
			grid = newGrid;
			score += scoreBreakdown.total;
			movesLeft -= 1;
			wordsFound = [...wordsFound, { word, points: scoreBreakdown.total }];
			path = [];

			const rarityEmoji: Record<string, string> = {
				common: '',
				uncommon: '✦',
				rare: '★',
				epic: '⚡',
				obscure: '💎'
			};
			const emoji = rarityEmoji[scoreBreakdown.rarity] ?? '';
			showFeedback(`${word} +${scoreBreakdown.total} ${emoji}`, 'success');

			if (movesLeft === 0) {
				endGame();
			}
		} else {
			path = [];
			const reasonMsg: Record<string, string> = {
				too_short: 'Need at least 3 letters',
				not_a_word: 'Not a valid word',
				catalyst_not_used: `Must use the catalyst letter "${puzzle?.catalystTile.letter}"`
			};
			showFeedback(reasonMsg[result.reason ?? ''] ?? 'Invalid word', 'error');
		}
	}

	function handleClear() {
		path = [];
	}

	// -------------------------------------------------------------------------
	// End game
	// -------------------------------------------------------------------------

	async function endGame() {
		gameOver = true;

		const today = todayUTC();
		const result: DailyResult = {
			date: today,
			score,
			stars,
			wordsFound: wordsFound.map((w) => w.word),
			movesUsed: DAILY_MOVE_BUDGET - movesLeft
		};

		try {
			await idbSet(`${DAILY_RESULT_PREFIX}${today}`, result);
			previousResult = result;
		} catch {
			// Storage unavailable — game still ends
		}
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	function starDisplay(count: 1 | 2 | 3 | 4 | 5): string {
		return '⭐'.repeat(count) + '☆'.repeat(5 - count);
	}
</script>

<svelte:head>
	<title>Daily Forge — Lexicon Forge</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
	<div class="flex w-full max-w-md items-center justify-between">
		<a href="/" class="text-gray-500 hover:text-forge-orange transition-colors">← Back</a>
		<h1 class="bg-forge-gradient bg-clip-text text-2xl font-bold text-transparent">Daily Forge</h1>
		<span class="text-sm text-gray-500">{todayUTC()}</span>
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<p class="text-gray-400 animate-pulse">Loading puzzle…</p>
		</div>
	{:else if loadError}
		<div class="flex flex-1 flex-col items-center justify-center gap-4">
			<p class="text-red-400">{loadError}</p>
			<a href="/" class="text-forge-orange hover:underline">← Back to menu</a>
		</div>
	{:else if alreadyCompleted && previousResult && !gameOver}
		<!-- Already completed today -->
		<div class="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
			<div class="w-full rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
				<p class="mb-2 text-sm text-gray-400">Today's puzzle complete!</p>
				<div class="mb-4 text-4xl">{starDisplay(previousResult.stars)}</div>
				<p class="text-3xl font-bold text-forge-orange">{previousResult.score.toLocaleString()}</p>
				<p class="mt-1 text-sm text-gray-500">
					pts · {previousResult.wordsFound.length} words · {previousResult.movesUsed} moves
				</p>
				<div class="mt-4 flex flex-wrap justify-center gap-2">
					{#each previousResult.wordsFound as word}
						<span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">{word}</span>
					{/each}
				</div>
			</div>
			<ForgeShareCard
				date={previousResult.date}
				score={previousResult.score}
				stars={previousResult.stars}
				wordsFound={previousResult.wordsFound}
				movesUsed={previousResult.movesUsed}
			/>
			<ForgeWheel
				date={previousResult.date}
				previousResult={wheelSpinResult}
				onspun={(r) => {
					wheelSpinResult = r;
				}}
			/>
			<p class="text-sm text-gray-600">Come back tomorrow for a new puzzle!</p>
		</div>
	{:else if gameOver && previousResult}
		<!-- End-of-game summary -->
		<div class="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
			<div class="w-full rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
				<p class="mb-2 text-sm text-gray-400">Puzzle complete!</p>
				<div class="mb-4 text-4xl animate-bounce">{starDisplay(previousResult.stars)}</div>
				<p class="text-3xl font-bold text-forge-orange">{previousResult.score.toLocaleString()}</p>
				<p class="mt-1 text-sm text-gray-500">
					pts · {wordsFound.length} words · {DAILY_MOVE_BUDGET - movesLeft} moves
				</p>
				<div class="mt-4 flex flex-wrap justify-center gap-2">
					{#each wordsFound as w}
						<span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300"
							>{w.word} <span class="text-forge-orange">+{w.points}</span></span
						>
					{/each}
				</div>
			</div>
			<ForgeShareCard
				date={previousResult.date}
				score={previousResult.score}
				stars={previousResult.stars}
				wordsFound={previousResult.wordsFound}
				movesUsed={previousResult.movesUsed}
			/>
			<ForgeWheel
				date={previousResult.date}
				previousResult={wheelSpinResult}
				onspun={(r) => {
					wheelSpinResult = r;
				}}
			/>
			<p class="text-sm text-gray-600">Come back tomorrow for a new puzzle!</p>
		</div>
	{:else if grid && puzzle}
		<!-- Active game -->

		<!-- Stats bar -->
		<div
			class="flex w-full max-w-md items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
		>
			<div class="text-center">
				<p class="text-xs text-gray-500">Score</p>
				<p class="text-lg font-bold text-forge-orange">{score.toLocaleString()}</p>
			</div>
			<div class="text-center">
				<p class="text-xs text-gray-500">Catalyst</p>
				<p class="text-xl font-bold text-yellow-400">{puzzle.catalystTile.letter}</p>
			</div>
			<div class="text-center">
				<p class="text-xs text-gray-500">Moves left</p>
				<p
					class="text-lg font-bold"
					class:text-red-400={movesLeft <= 3}
					class:text-gray-100={movesLeft > 3}
				>
					{movesLeft}/{DAILY_MOVE_BUDGET}
				</p>
			</div>
		</div>

		<!-- Hex grid -->
		<div class="w-full max-w-md">
			<HexGrid
				{grid}
				selectedPath={path}
				tileSize={42}
				catalystCoord={catalystCoord ?? undefined}
				ontileclick={handleTileClick}
			/>
		</div>

		<!-- Current word display -->
		<div class="flex h-10 w-full max-w-md items-center justify-center">
			{#if feedback}
				<p
					class="text-sm font-medium"
					class:text-green-400={feedbackType === 'success'}
					class:text-red-400={feedbackType === 'error'}
				>
					{feedback}
				</p>
			{:else if currentWord.length > 0}
				<p class="text-xl font-bold tracking-widest text-gray-100">{currentWord}</p>
			{:else}
				<p class="text-sm text-gray-600">Select tiles to form a word</p>
			{/if}
		</div>

		<!-- Action buttons -->
		<div class="flex w-full max-w-md gap-3">
			<button
				onclick={handleClear}
				disabled={path.length === 0}
				class="flex-1 rounded-lg border border-gray-700 bg-gray-900 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500 hover:text-gray-100 disabled:opacity-40"
			>
				Clear
			</button>
			<button
				onclick={handleSubmit}
				disabled={path.length < 3}
				class="flex-1 rounded-lg bg-forge-orange py-3 text-sm font-bold text-gray-900 transition-opacity hover:opacity-90 disabled:opacity-40"
			>
				Forge Word
			</button>
		</div>

		<!-- Words found this session -->
		{#if wordsFound.length > 0}
			<div class="w-full max-w-md">
				<p class="mb-2 text-xs text-gray-500">
					{wordsFound.length} word{wordsFound.length !== 1 ? 's' : ''} forged
				</p>
				<div class="flex flex-wrap gap-2">
					{#each wordsFound as w}
						<span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">
							{w.word} <span class="text-forge-orange">+{w.points}</span>
						</span>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Give up / end game early -->
		{#if movesLeft > 0 && wordsFound.length > 0}
			<button
				onclick={endGame}
				class="mt-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
			>
				End game early
			</button>
		{/if}
	{/if}
</main>
