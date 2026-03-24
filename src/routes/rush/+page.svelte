<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HexGrid from '$lib/components/HexGrid.svelte';
	import { loadWordValidator } from '$lib/engine/wordValidator.js';
	import { generateGrid } from '$lib/engine/hexGrid.js';
	import { submitWord, pathToWord } from '$lib/engine/forgeEngine.js';
	import { mulberry32 } from '$lib/engine/dailyPuzzle.js';
	import type { HexCoord, HexGrid as HexGridType } from '$lib/engine/hexGrid.js';
	import { hexKey } from '$lib/engine/hexGrid.js';
	import {
		initialComboState,
		recordWord as recordComboWord,
		COMBO_WINDOW_MS,
		MAX_COMBO
	} from '$lib/engine/combo.js';
	import type { ComboState } from '$lib/engine/combo.js';

	// -------------------------------------------------------------------------
	// Constants
	// -------------------------------------------------------------------------

	const RUSH_DURATION_MS = 90_000;
	const URGENCY_THRESHOLD_MS = 15_000;

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let grid = $state<HexGridType | null>(null);
	let rng: (() => number) | null = null;
	let validator: Awaited<ReturnType<typeof loadWordValidator>> | null = null;

	// Timer
	let timeRemainingMs = $state(RUSH_DURATION_MS);
	let gameStarted = $state(false);
	let gameOver = $state(false);
	let intervalId: ReturnType<typeof globalThis.setInterval> | null = null;
	let lastTick = 0;

	// Game progress
	let path = $state<HexCoord[]>([]);
	let score = $state(0);
	let wordsFound = $state<{ word: string; points: number }[]>([]);

	// Combo system
	let comboState = $state<ComboState>(initialComboState());
	/** Remaining combo window in ms, updated every tick. */
	let comboTimerMs = $state(0);

	// Feedback
	let feedback = $state<string | null>(null);
	let feedbackType = $state<'success' | 'error'>('success');
	let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	const currentWord = $derived(grid && path.length > 0 ? pathToWord(grid, path) : '');

	const timeDisplay = $derived(() => {
		const totalSec = timeRemainingMs / 1000;
		const mins = Math.floor(totalSec / 60);
		const secs = Math.floor(totalSec % 60);
		const tenths = Math.floor((timeRemainingMs % 1000) / 100);
		if (mins > 0) {
			return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
		}
		return `${secs}.${tenths}`;
	});

	const isUrgent = $derived(timeRemainingMs <= URGENCY_THRESHOLD_MS);

	/** 0→1 progress of the active combo window. */
	const comboProgress = $derived(comboTimerMs / COMBO_WINDOW_MS);

	const comboActive = $derived(comboState.multiplier > 1 && comboTimerMs > 0);

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	onMount(async () => {
		try {
			validator = await loadWordValidator();
			rng = mulberry32(Math.floor(Date.now()));
			grid = generateGrid('4x4', rng);
			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load';
			loading = false;
		}
	});

	onDestroy(() => {
		stopTimer();
	});

	// -------------------------------------------------------------------------
	// Timer
	// -------------------------------------------------------------------------

	function startTimer() {
		gameStarted = true;
		lastTick = Date.now();
		intervalId = globalThis.setInterval(() => {
			const now = Date.now();
			const elapsed = now - lastTick;
			lastTick = now;
			timeRemainingMs = Math.max(0, timeRemainingMs - elapsed);
			// Tick combo timer and reset multiplier if window expires
			if (comboTimerMs > 0) {
				comboTimerMs = Math.max(0, comboTimerMs - elapsed);
				if (comboTimerMs === 0) {
					comboState = initialComboState();
				}
			}
			if (timeRemainingMs === 0) {
				stopTimer();
				endGame();
			}
		}, 100);
	}

	function stopTimer() {
		if (intervalId !== null) {
			globalThis.clearInterval(intervalId);
			intervalId = null;
		}
	}

	// -------------------------------------------------------------------------
	// Tile interaction
	// -------------------------------------------------------------------------

	function handleTileClick(coord: HexCoord) {
		if (gameOver || !grid) return;

		// Start timer on first tile click
		if (!gameStarted) {
			startTimer();
		}

		const key = hexKey(coord);
		const alreadyInPath = path.some((c) => hexKey(c) === key);

		if (alreadyInPath) {
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
		}, 1500);
	}

	function handleSubmit() {
		if (!grid || !validator || !rng || gameOver || path.length < 3) return;

		if (!gameStarted) startTimer();

		const result = submitWord(grid, path, (w) => validator!.isWord(w), rng);

		if (result.success && result.result) {
			const { grid: newGrid, score: scoreBreakdown, word } = result.result;
			grid = newGrid;

			// Apply combo multiplier
			const { multiplier: comboMultiplier, newState } = recordComboWord(comboState, Date.now());
			comboState = newState;
			comboTimerMs = COMBO_WINDOW_MS;

			const points = scoreBreakdown.total * comboMultiplier;
			score += points;
			wordsFound = [...wordsFound, { word, points }];
			path = [];

			const rarityEmoji: Record<string, string> = {
				common: '',
				uncommon: '✦',
				rare: '★',
				epic: '⚡',
				obscure: '💎'
			};
			const emoji = rarityEmoji[scoreBreakdown.rarity] ?? '';
			const comboTag = comboMultiplier > 1 ? ` ×${comboMultiplier}` : '';
			showFeedback(`${word} +${points}${comboTag} ${emoji}`, 'success');
		} else {
			path = [];
			const reasonMsg: Record<string, string> = {
				too_short: 'Need at least 3 letters',
				not_a_word: 'Not a valid word'
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

	function endGame() {
		stopTimer();
		gameOver = true;
		path = [];
	}

	// -------------------------------------------------------------------------
	// New game
	// -------------------------------------------------------------------------

	function newGame() {
		stopTimer();
		rng = mulberry32(Math.floor(Date.now()));
		grid = generateGrid('4x4', rng);
		path = [];
		score = 0;
		wordsFound = [];
		feedback = null;
		timeRemainingMs = RUSH_DURATION_MS;
		gameStarted = false;
		gameOver = false;
		comboState = initialComboState();
		comboTimerMs = 0;
	}
</script>

<svelte:head>
	<title>Rush Mode — Lexicon Forge</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
	<div class="flex w-full max-w-md items-center justify-between">
		<a href="/" class="text-gray-500 hover:text-forge-orange transition-colors">← Back</a>
		<h1 class="bg-forge-gradient bg-clip-text text-2xl font-bold text-transparent">Rush Mode</h1>
		<span class="text-sm text-gray-500">4×4 grid</span>
	</div>

	{#if loading}
		<div class="flex flex-1 items-center justify-center">
			<p class="animate-pulse text-gray-400">Loading…</p>
		</div>
	{:else if loadError}
		<div class="flex flex-1 flex-col items-center justify-center gap-4">
			<p class="text-red-400">{loadError}</p>
			<a href="/" class="text-forge-orange hover:underline">← Back to menu</a>
		</div>
	{:else if gameOver}
		<!-- Game over summary -->
		<div class="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
			<div class="w-full rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
				<p class="mb-2 text-sm text-gray-400">Time's up!</p>
				<p class="text-4xl font-bold text-forge-orange">{score.toLocaleString()}</p>
				<p class="mt-1 text-sm text-gray-500">
					pts · {wordsFound.length} word{wordsFound.length !== 1 ? 's' : ''}
				</p>

				{#if wordsFound.length > 0}
					<div class="mt-4 border-t border-gray-800 pt-4">
						<p class="mb-2 text-xs text-gray-500">Words forged</p>
						<div class="flex flex-wrap justify-center gap-2">
							{#each wordsFound as w}
								<span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">
									{w.word} <span class="text-forge-orange">+{w.points}</span>
								</span>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<button
				onclick={newGame}
				class="w-full max-w-xs rounded-lg bg-forge-orange py-3 text-sm font-bold text-gray-900 transition-opacity hover:opacity-90"
			>
				Play Again
			</button>
			<a href="/" class="text-sm text-gray-500 hover:text-gray-300 transition-colors">← Menu</a>
		</div>
	{:else if grid}
		<!-- Active game -->

		<!-- Stats bar -->
		<div
			class="flex w-full max-w-md items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
		>
			<!-- Timer -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Time</p>
				<p
					class="font-mono text-lg font-bold tabular-nums"
					class:text-red-400={isUrgent}
					class:animate-pulse={isUrgent}
					class:text-gray-100={!isUrgent}
				>
					{timeDisplay()}
				</p>
			</div>

			<!-- Score -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Score</p>
				<p class="text-lg font-bold text-forge-orange">{score.toLocaleString()}</p>
			</div>

			<!-- Words count -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Words</p>
				<p class="text-lg font-bold text-gray-100">{wordsFound.length}</p>
			</div>
		</div>

		{#if !gameStarted}
			<p class="text-sm text-gray-500">Tap a tile to start the timer</p>
		{/if}

		<!-- Combo indicator -->
		<div class="w-full max-w-md">
			{#if comboActive}
				<div class="flex items-center justify-between px-1 pb-1">
					<span
						class="text-sm font-bold"
						class:text-yellow-400={comboState.multiplier === 2}
						class:text-forge-orange={comboState.multiplier === 3}
						class:text-red-400={comboState.multiplier === 4}
						class:text-purple-400={comboState.multiplier === 5}
					>
						{comboState.multiplier}× COMBO
					</span>
					<span class="text-xs text-gray-500">
						{comboState.multiplier < MAX_COMBO ? 'Keep going!' : 'MAX!'}
					</span>
				</div>
				<!-- Timer bar -->
				<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
					<div
						class="h-full rounded-full transition-all duration-100"
						class:bg-yellow-400={comboState.multiplier === 2}
						class:bg-forge-orange={comboState.multiplier === 3}
						class:bg-red-400={comboState.multiplier === 4}
						class:bg-purple-400={comboState.multiplier === 5}
						style="width: {(comboProgress * 100).toFixed(1)}%"
					></div>
				</div>
			{:else}
				<!-- Placeholder to keep layout stable -->
				<div class="h-6"></div>
			{/if}
		</div>

		<!-- Hex grid -->
		<div class="w-full max-w-md">
			<HexGrid {grid} selectedPath={path} tileSize={46} ontileclick={handleTileClick} />
		</div>

		<!-- Current word / feedback display -->
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

		<!-- Recent words -->
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
	{/if}
</main>
