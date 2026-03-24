<script lang="ts">
	import { onMount } from 'svelte';
	import HexGrid from '$lib/components/HexGrid.svelte';
	import { loadWordValidator } from '$lib/engine/wordValidator.js';
	import { mulberry32 } from '$lib/engine/dailyPuzzle.js';
	import type { HexCoord } from '$lib/engine/hexGrid.js';
	import { hexKey } from '$lib/engine/hexGrid.js';
	import {
		initialCascadeState,
		submitCascadeWord,
		getChainMultiplier,
		CASCADE_MOVE_BUDGET
	} from '$lib/engine/cascade.js';
	import type { CascadeState, CascadeWord } from '$lib/engine/cascade.js';

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let cascadeState = $state<CascadeState | null>(null);
	let rng: (() => number) | null = null;
	let validator: Awaited<ReturnType<typeof loadWordValidator>> | null = null;

	let path = $state<HexCoord[]>([]);

	// Feedback
	let feedback = $state<string | null>(null);
	let feedbackType = $state<'success' | 'error' | 'cascade'>('success');
	let feedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// Chain animation state
	let chainDisplay = $state<CascadeWord[]>([]);
	let chainDisplayTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	const grid = $derived(cascadeState?.grid ?? null);
	const movesLeft = $derived(
		cascadeState ? CASCADE_MOVE_BUDGET - cascadeState.movesUsed : CASCADE_MOVE_BUDGET
	);
	const gameOver = $derived(cascadeState?.phase === 'gameover');

	const currentWord = $derived(() => {
		if (!grid || path.length === 0) return '';
		return path
			.map((coord) => grid.tiles.find((t) => hexKey(t.coord) === hexKey(coord))?.letter ?? '')
			.join('');
	});

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	onMount(async () => {
		try {
			validator = await loadWordValidator();
			rng = mulberry32(Math.floor(Date.now()));
			cascadeState = initialCascadeState(rng);
			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load';
			loading = false;
		}
	});

	// -------------------------------------------------------------------------
	// Interaction
	// -------------------------------------------------------------------------

	function handleTileClick(coord: HexCoord) {
		if (gameOver || !grid) return;

		const key = hexKey(coord);
		const alreadyInPath = path.some((c) => hexKey(c) === key);

		if (alreadyInPath) {
			// Clicking last tile clears path; clicking earlier tile does nothing
			if (hexKey(path[path.length - 1]) === key) {
				path = [];
			}
			return;
		}

		path = [...path, coord];
	}

	function showFeedback(msg: string, type: 'success' | 'error' | 'cascade') {
		if (feedbackTimer) globalThis.clearTimeout(feedbackTimer);
		feedback = msg;
		feedbackType = type;
		feedbackTimer = globalThis.setTimeout(() => {
			feedback = null;
		}, 2000);
	}

	function handleSubmit() {
		if (!cascadeState || !validator || !rng || gameOver || path.length < 3) return;

		const { newState, result } = submitCascadeWord(
			cascadeState,
			path,
			(w) => validator!.isWord(w),
			(p) => validator!.isPrefix(p),
			rng
		);

		if (result.success) {
			cascadeState = newState;
			path = [];

			if (result.cascadeChain.length > 0) {
				// Show cascade chain summary
				chainDisplay = result.cascadeChain;
				showFeedback(
					`${result.manualWord!.word} +${result.manualWord!.points} → ${result.cascadeChain.length} cascade${result.cascadeChain.length !== 1 ? 's' : ''}!`,
					'cascade'
				);
				if (chainDisplayTimer) globalThis.clearTimeout(chainDisplayTimer);
				chainDisplayTimer = globalThis.setTimeout(() => {
					chainDisplay = [];
				}, 3000);
			} else {
				chainDisplay = [];
				showFeedback(`${result.manualWord!.word} +${result.manualWord!.points}`, 'success');
			}
		} else {
			path = [];
			const msgs: Record<string, string> = {
				too_short: 'Need at least 3 letters',
				not_a_word: 'Not a valid word'
			};
			showFeedback(msgs[result.reason ?? ''] ?? 'Invalid word', 'error');
		}
	}

	function handleClear() {
		path = [];
	}

	function newGame() {
		rng = mulberry32(Math.floor(Date.now()));
		cascadeState = initialCascadeState(rng!);
		path = [];
		feedback = null;
		chainDisplay = [];
	}

	// Chain color classes
	function chainColor(multiplier: number): string {
		if (multiplier >= 30) return 'text-purple-400';
		if (multiplier >= 12) return 'text-red-400';
		if (multiplier >= 5) return 'text-forge-orange';
		return 'text-yellow-400';
	}

	function chainLabel(chainNum: number): string {
		const multiplier = getChainMultiplier(chainNum);
		if (multiplier >= 30) return `CHAIN ${chainNum}! ×30 🔥`;
		if (multiplier >= 12) return `CHAIN ${chainNum}! ×12 ⚡`;
		if (multiplier >= 5) return `CHAIN ${chainNum}! ×5 ✦`;
		return `CHAIN ${chainNum} ×1`;
	}
</script>

<svelte:head>
	<title>Cascade — Lexicon Forge</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
	<!-- Header -->
	<div class="flex w-full max-w-md items-center justify-between">
		<a href="/" class="text-gray-500 transition-colors hover:text-forge-orange">← Back</a>
		<h1 class="bg-forge-gradient bg-clip-text text-2xl font-bold text-transparent">Cascade</h1>
		<span class="text-sm text-gray-500">5×8 grid</span>
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
	{:else if gameOver && cascadeState}
		<!-- Game Over Summary -->
		<div class="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
			<div class="w-full rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
				<p class="mb-2 text-sm text-gray-400">Cascade complete!</p>
				<p class="text-4xl font-bold text-forge-orange">
					{cascadeState.score.toLocaleString()}
				</p>
				<p class="mt-1 text-sm text-gray-500">
					pts · {cascadeState.wordsFound.length} word{cascadeState.wordsFound.length !== 1
						? 's'
						: ''}
					· {CASCADE_MOVE_BUDGET} moves
				</p>

				<!-- Score breakdown -->
				<div class="mt-4 grid grid-cols-2 gap-3 border-t border-gray-800 pt-4 text-left">
					<div class="rounded-lg bg-gray-800 px-3 py-2">
						<p class="text-xs text-gray-500">Manual</p>
						<p class="font-bold text-gray-100">{cascadeState.manualScore.toLocaleString()}</p>
					</div>
					<div class="rounded-lg bg-gray-800 px-3 py-2">
						<p class="text-xs text-gray-500">Cascade</p>
						<p class="font-bold text-purple-400">{cascadeState.cascadeScore.toLocaleString()}</p>
					</div>
				</div>

				<!-- Max chain info -->
				{#if cascadeState.wordsFound.some((w) => w.chainNumber > 0)}
					{@const maxChain = Math.max(...cascadeState.wordsFound.map((w) => w.chainNumber))}
					<div class="mt-3 rounded-lg border border-purple-800 bg-purple-950 px-4 py-2 text-center">
						<p class="text-sm font-bold text-purple-300">
							Best chain: {maxChain} ({getChainMultiplier(maxChain)}×)
						</p>
					</div>
				{/if}

				<!-- Words list -->
				{#if cascadeState.wordsFound.length > 0}
					<div class="mt-4 border-t border-gray-800 pt-4 text-left">
						<p class="mb-2 text-xs text-gray-500">Words forged</p>
						<div class="flex max-h-40 flex-col gap-1 overflow-y-auto">
							{#each cascadeState.wordsFound as w}
								<div class="flex items-center justify-between text-xs">
									<span
										class:text-purple-400={w.chainNumber > 0}
										class:text-gray-300={w.chainNumber === 0}
									>
										{#if w.chainNumber > 0}
											<span class="mr-1 text-gray-500">⤷</span>
										{/if}
										{w.word}
										{#if w.multiplier > 1}
											<span class="text-gray-500"> ×{w.multiplier}</span>
										{/if}
									</span>
									<span class="text-forge-orange">+{w.points}</span>
								</div>
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
			<a href="/" class="text-sm text-gray-500 transition-colors hover:text-gray-300">← Menu</a>
		</div>
	{:else if cascadeState && grid}
		<!-- Active game -->

		<!-- Stats bar -->
		<div
			class="flex w-full max-w-md items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-3"
		>
			<!-- Moves left -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Moves</p>
				<p
					class="text-lg font-bold tabular-nums"
					class:text-red-400={movesLeft <= 5}
					class:text-yellow-400={movesLeft > 5 && movesLeft <= 10}
					class:text-gray-100={movesLeft > 10}
				>
					{movesLeft}
				</p>
			</div>

			<!-- Score -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Score</p>
				<p class="text-lg font-bold text-forge-orange">{cascadeState.score.toLocaleString()}</p>
			</div>

			<!-- Cascade score -->
			<div class="text-center">
				<p class="text-xs text-gray-500">Cascade</p>
				<p class="text-lg font-bold text-purple-400">
					{cascadeState.cascadeScore.toLocaleString()}
				</p>
			</div>
		</div>

		<!-- Active cascade chain display -->
		{#if chainDisplay.length > 0}
			<div class="w-full max-w-md rounded-lg border border-purple-800 bg-purple-950 px-4 py-3">
				<p class="mb-2 text-xs font-bold text-purple-300">Cascade Chain!</p>
				<div class="flex flex-col gap-1">
					{#each chainDisplay as cw}
						<div class="flex items-center justify-between text-xs">
							<span class={chainColor(cw.multiplier)}>
								{chainLabel(cw.chainNumber)} — {cw.word}
							</span>
							<span class="text-gray-300">+{cw.points}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Hex grid -->
		<div class="w-full max-w-md">
			<HexGrid {grid} selectedPath={path} tileSize={34} ontileclick={handleTileClick} />
		</div>

		<!-- Current word / feedback -->
		<div class="flex h-10 w-full max-w-md items-center justify-center">
			{#if feedback}
				<p
					class="text-sm font-medium"
					class:text-green-400={feedbackType === 'success'}
					class:text-red-400={feedbackType === 'error'}
					class:text-purple-400={feedbackType === 'cascade'}
				>
					{feedback}
				</p>
			{:else if currentWord().length > 0}
				<p class="text-xl font-bold tracking-widest text-gray-100">{currentWord()}</p>
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

		<!-- Words forged list -->
		{#if cascadeState.wordsFound.length > 0}
			<div class="w-full max-w-md">
				<p class="mb-2 text-xs text-gray-500">
					{cascadeState.wordsFound.length} word{cascadeState.wordsFound.length !== 1 ? 's' : ''} forged
				</p>
				<div class="flex flex-wrap gap-2">
					{#each cascadeState.wordsFound as w}
						<span
							class="rounded px-2 py-1 text-xs"
							class:bg-purple-900={w.chainNumber > 0}
							class:text-purple-300={w.chainNumber > 0}
							class:bg-gray-800={w.chainNumber === 0}
							class:text-gray-300={w.chainNumber === 0}
						>
							{w.word}
							{#if w.multiplier > 1}<span class="text-gray-500 text-[10px]">
									×{w.multiplier}</span
								>{/if}
							<span
								class:text-forge-orange={w.chainNumber === 0}
								class:text-purple-400={w.chainNumber > 0}
							>
								+{w.points}
							</span>
						</span>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
