<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import HexGrid from '$lib/components/HexGrid.svelte';
	import { loadWordValidator } from '$lib/engine/wordValidator.js';
	import { mulberry32 } from '$lib/engine/dailyPuzzle.js';
	import type { HexCoord } from '$lib/engine/hexGrid.js';
	import { hexKey } from '$lib/engine/hexGrid.js';
	import { pathToWord } from '$lib/engine/forgeEngine.js';
	import {
		initialMemoryState,
		tickMemory,
		submitMemoryWord,
		MAX_STRIKES
	} from '$lib/engine/memoryCrucible.js';
	import type { MemoryCrucibleState } from '$lib/engine/memoryCrucible.js';

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let gameState = $state<MemoryCrucibleState | null>(null);
	let rng: (() => number) | null = null;
	let validator: Awaited<ReturnType<typeof loadWordValidator>> | null = null;

	let path = $state<HexCoord[]>([]);

	let intervalId: ReturnType<typeof globalThis.setInterval> | null = null;
	let lastTick = 0;

	// Feedback shown below the grid
	let feedback = $state<string | null>(null);
	let feedbackType = $state<'success' | 'error'>('success');
	let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	const phase = $derived(gameState?.phase ?? 'view');
	const tilesHidden = $derived(phase === 'play');

	const currentWord = $derived(
		gameState && path.length > 0 ? pathToWord(gameState.grid, path) : ''
	);

	const strikeDisplay = $derived(() => {
		const strikes = gameState?.strikes ?? 0;
		return Array.from({ length: MAX_STRIKES }, (_, i) => i < strikes);
	});

	const viewTimerSec = $derived(gameState ? Math.ceil(gameState.viewTimerMs / 1000) : 0);

	const roundTimerSec = $derived(gameState ? Math.ceil(gameState.roundTimerMs / 1000) : 0);

	const roundTimerUrgent = $derived(roundTimerSec <= 10);

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	onMount(async () => {
		try {
			validator = await loadWordValidator();
			rng = mulberry32(Math.floor(Date.now()));
			gameState = initialMemoryState(rng);
			startInterval();
			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load';
			loading = false;
		}
	});

	onDestroy(() => {
		stopInterval();
	});

	// -------------------------------------------------------------------------
	// Game loop
	// -------------------------------------------------------------------------

	function startInterval() {
		lastTick = Date.now();
		intervalId = globalThis.setInterval(() => {
			if (!gameState) return;
			const now = Date.now();
			const elapsed = now - lastTick;
			lastTick = now;
			gameState = tickMemory(gameState, elapsed);
			// Clear path when view phase ends (tiles flip)
			if (gameState.phase !== 'view') {
				// path stays valid
			}
		}, 100);
	}

	function stopInterval() {
		if (intervalId !== null) {
			globalThis.clearInterval(intervalId);
			intervalId = null;
		}
	}

	// -------------------------------------------------------------------------
	// Tile interaction
	// -------------------------------------------------------------------------

	function handleTileClick(coord: HexCoord) {
		if (!gameState || gameState.phase !== 'play') return;

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
		if (!gameState || !validator || !rng || gameState.phase !== 'play' || path.length < 3) return;

		const result = submitMemoryWord(gameState, path, (w) => validator!.isWord(w), rng);
		gameState = result.newState;
		path = [];

		if (result.success) {
			showFeedback(`${result.word} +${result.points}`, 'success');
		} else {
			const msgs: Record<string, string> = {
				too_short: 'Need at least 3 letters',
				not_a_word: 'Not a valid word'
			};
			showFeedback(msgs[result.reason] ?? 'Invalid word', 'error');
		}
	}

	function handleClear() {
		path = [];
	}

	// -------------------------------------------------------------------------
	// New game
	// -------------------------------------------------------------------------

	function newGame() {
		stopInterval();
		rng = mulberry32(Math.floor(Date.now()));
		gameState = initialMemoryState(rng);
		path = [];
		feedback = null;
		startInterval();
	}
</script>

<svelte:head>
	<title>Memory Crucible — Lexicon Forge</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
	<div class="flex w-full max-w-md items-center justify-between">
		<a href="/" class="text-gray-500 hover:text-forge-orange transition-colors">← Back</a>
		<h1 class="bg-forge-gradient bg-clip-text text-2xl font-bold text-transparent">
			Memory Crucible
		</h1>
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
	{:else if gameState?.phase === 'gameover'}
		<!-- Game over screen -->
		<div class="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
			<div class="w-full rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
				<p class="mb-2 text-sm text-gray-400">
					{gameState.strikes >= MAX_STRIKES ? '3 strikes — game over!' : 'Time ran out!'}
				</p>
				<p class="text-4xl font-bold text-forge-orange">{gameState.score.toLocaleString()}</p>
				<p class="mt-1 text-sm text-gray-500">
					pts · {gameState.wordsFound.length} word{gameState.wordsFound.length !== 1 ? 's' : ''} · round
					{gameState.round - 1}
				</p>

				{#if gameState.wordsFound.length > 0}
					<div class="mt-4 border-t border-gray-800 pt-4">
						<p class="mb-2 text-xs text-gray-500">Words forged from memory</p>
						<div class="flex flex-wrap justify-center gap-2">
							{#each gameState.wordsFound as w}
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
	{:else if gameState}
		<!-- Active game -->

		<!-- Stats bar -->
		<div
			class="flex w-full max-w-md items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
		>
			<!-- Round -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Round</p>
				<p class="text-lg font-bold text-gray-100">{gameState.round}</p>
			</div>

			<!-- Score -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Score</p>
				<p class="text-lg font-bold text-forge-orange">{gameState.score.toLocaleString()}</p>
			</div>

			<!-- Strikes -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Strikes</p>
				<div class="flex gap-1 justify-center mt-0.5">
					{#each strikeDisplay() as used}
						<span class="text-base font-bold" class:text-red-500={used} class:text-gray-700={!used}
							>✕</span
						>
					{/each}
				</div>
			</div>
		</div>

		<!-- Phase indicator + timer -->
		<div
			class="w-full max-w-md rounded-lg border px-4 py-3 text-center
			{phase === 'view' ? 'border-blue-800 bg-blue-950' : 'border-purple-800 bg-purple-950'}"
		>
			{#if phase === 'view'}
				<p class="text-sm font-bold text-blue-300">Memorize the tiles!</p>
				<p class="mt-1 font-mono text-2xl font-bold text-blue-100 tabular-nums">
					{viewTimerSec}s
				</p>
				<p class="mt-0.5 text-xs text-blue-400">Tiles hide when the timer expires</p>
			{:else}
				<p class="text-sm font-bold text-purple-300">Play from memory</p>
				<p
					class="mt-1 font-mono text-2xl font-bold tabular-nums"
					class:text-red-400={roundTimerUrgent}
					class:animate-pulse={roundTimerUrgent}
					class:text-purple-100={!roundTimerUrgent}
				>
					{roundTimerSec}s
				</p>
				<p class="mt-0.5 text-xs text-purple-400">Forge a word before time runs out</p>
			{/if}
		</div>

		<!-- Hex grid -->
		<div class="w-full max-w-md">
			<HexGrid
				grid={gameState.grid}
				selectedPath={path}
				tileSize={46}
				hideTiles={tilesHidden}
				ontileclick={handleTileClick}
			/>
		</div>

		<!-- Current word / feedback -->
		<div class="flex h-10 w-full max-w-md items-center justify-center">
			{#if feedback}
				<p
					class="text-sm font-medium"
					class:text-green-400={feedbackType === 'success'}
					class:text-red-400={feedbackType === 'error'}
				>
					{feedback}
				</p>
			{:else if phase === 'play' && currentWord.length > 0}
				<p class="text-xl font-bold tracking-widest text-gray-100">{currentWord}</p>
			{:else if phase === 'view'}
				<p class="text-sm text-blue-400">Study the tile positions…</p>
			{:else}
				<p class="text-sm text-gray-600">Select tiles from memory</p>
			{/if}
		</div>

		<!-- Action buttons (only in play phase) -->
		{#if phase === 'play'}
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
		{/if}

		<!-- Words found this game -->
		{#if gameState.wordsFound.length > 0}
			<div class="w-full max-w-md">
				<p class="mb-2 text-xs text-gray-500">
					{gameState.wordsFound.length} word{gameState.wordsFound.length !== 1 ? 's' : ''} forged
				</p>
				<div class="flex flex-wrap gap-2">
					{#each gameState.wordsFound as w}
						<span class="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">
							{w.word} <span class="text-forge-orange">+{w.points}</span>
						</span>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
