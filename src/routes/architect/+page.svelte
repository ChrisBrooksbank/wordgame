<script lang="ts">
	import { onMount } from 'svelte';
	import { loadWordValidator } from '$lib/engine/wordValidator.js';
	import { mulberry32 } from '$lib/engine/dailyPuzzle.js';
	import {
		createArchitectPuzzle,
		initialArchitectState,
		canPlaceGroup,
		placeGroup,
		removeGroup,
		undoArchitect,
		redoArchitect,
		checkCompletion,
		DIFFICULTY_CONFIGS
	} from '$lib/engine/architect.js';
	import type { ArchitectState, Difficulty } from '$lib/engine/architect.js';

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let loading = $state(true);
	let loadError = $state<string | null>(null);

	let gameState = $state<ArchitectState | null>(null);
	let selectedGroupId = $state<string | null>(null);
	let difficulty = $state<Difficulty>('apprentice');
	let showDifficultyMenu = $state(true);

	let validator: Awaited<ReturnType<typeof loadWordValidator>> | null = null;

	// Feedback shown when a word grid is invalid after filling
	let invalidFeedback = $state(false);
	let invalidFeedbackTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	onMount(async () => {
		try {
			validator = await loadWordValidator();
			loading = false;
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Failed to load';
			loading = false;
		}
	});

	// -------------------------------------------------------------------------
	// Derived
	// -------------------------------------------------------------------------

	const puzzle = $derived(gameState?.puzzle ?? null);
	const gridSize = $derived(puzzle?.gridSize ?? 4);
	const unplacedGroups = $derived(
		puzzle?.groups.filter((g) => gameState?.unplacedGroupIds.includes(g.id)) ?? []
	);

	const selectedGroup = $derived(
		selectedGroupId ? (puzzle?.groups.find((g) => g.id === selectedGroupId) ?? null) : null
	);

	const canUndo = $derived((gameState?.undoStack.length ?? 0) > 0);
	const canRedo = $derived((gameState?.redoStack.length ?? 0) > 0);

	/** Map from groupId to color index (0-based) for visual distinction. */
	const groupColorMap = $derived.by(() => {
		const map = new Map<string, number>();
		puzzle?.groups.forEach((g, i) => map.set(g.id, i));
		return map;
	});

	const TILE_COLORS = [
		'bg-blue-700',
		'bg-purple-700',
		'bg-teal-700',
		'bg-orange-700',
		'bg-pink-700',
		'bg-lime-700',
		'bg-cyan-700',
		'bg-amber-700',
		'bg-rose-700',
		'bg-indigo-700',
		'bg-emerald-700',
		'bg-yellow-700',
		'bg-fuchsia-700',
		'bg-sky-700'
	];

	function groupColor(groupId: string): string {
		const idx = groupColorMap.get(groupId) ?? 0;
		return TILE_COLORS[idx % TILE_COLORS.length];
	}

	/** Returns the groupId that occupies a given (row, col), or null if empty. */
	function cellGroupId(row: number, col: number): string | null {
		if (!gameState) return null;
		const placement = gameState.placements.find(
			(p) =>
				p.row === row &&
				col >= p.colStart &&
				col < p.colStart + (puzzle?.groups.find((g) => g.id === p.groupId)?.letters.length ?? 0)
		);
		return placement?.groupId ?? null;
	}

	// -------------------------------------------------------------------------
	// Actions
	// -------------------------------------------------------------------------

	function startGame(diff: Difficulty) {
		const rng = mulberry32(Math.floor(Date.now()));
		const p = createArchitectPuzzle(diff, rng);
		if (!p) {
			// Difficulty not yet available
			return;
		}
		difficulty = diff;
		gameState = initialArchitectState(p);
		selectedGroupId = null;
		invalidFeedback = false;
		showDifficultyMenu = false;
	}

	function selectGroup(groupId: string) {
		selectedGroupId = selectedGroupId === groupId ? null : groupId;
	}

	function handleCellClick(row: number, col: number) {
		if (!gameState || !validator) return;

		const occupant = cellGroupId(row, col);

		if (occupant) {
			// Click on placed group → remove it back to bank
			gameState = removeGroup(gameState, occupant);
			if (selectedGroupId === occupant) selectedGroupId = null;
			return;
		}

		if (!selectedGroupId) return;

		// Try to place selected group starting at (row, col)
		if (!canPlaceGroup(gameState, selectedGroupId, row, col)) return;

		gameState = placeGroup(gameState, selectedGroupId, row, col);
		selectedGroupId = null;

		// Check if placement completes the grid with valid words
		const checked = checkCompletion(gameState, (w) => validator!.isWord(w));
		if (checked !== gameState) {
			gameState = checked;
		} else if (gameState.unplacedGroupIds.length === 0 && gameState.phase === 'playing') {
			// Grid is full but words are invalid — show feedback
			showInvalidFeedback();
		}
	}

	function showInvalidFeedback() {
		if (invalidFeedbackTimer) globalThis.clearTimeout(invalidFeedbackTimer);
		invalidFeedback = true;
		invalidFeedbackTimer = globalThis.setTimeout(() => {
			invalidFeedback = false;
		}, 2000);
	}

	function handleUndo() {
		if (!gameState) return;
		gameState = undoArchitect(gameState);
		selectedGroupId = null;
	}

	function handleRedo() {
		if (!gameState) return;
		gameState = redoArchitect(gameState);
	}

	function handleNewGame() {
		showDifficultyMenu = true;
		gameState = null;
		selectedGroupId = null;
	}
</script>

<svelte:head>
	<title>Architect — Lexicon Forge</title>
</svelte:head>

<main class="flex min-h-screen flex-col items-center gap-4 px-4 py-6">
	<!-- Header -->
	<div class="flex w-full max-w-lg items-center justify-between">
		<a href="/" class="text-gray-500 transition-colors hover:text-forge-orange">← Back</a>
		<h1 class="bg-forge-gradient bg-clip-text text-2xl font-bold text-transparent">Architect</h1>
		{#if gameState && !showDifficultyMenu}
			<button
				onclick={handleNewGame}
				class="text-sm text-gray-500 transition-colors hover:text-gray-300"
			>
				New
			</button>
		{:else}
			<span class="w-12"></span>
		{/if}
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
	{:else if showDifficultyMenu}
		<!-- Difficulty selection -->
		<div class="flex w-full max-w-sm flex-col gap-3 pt-4">
			<p class="text-center text-sm text-gray-400">
				Place letter fragments to fill every row and column with valid words.
			</p>
			{#each Object.entries(DIFFICULTY_CONFIGS) as [diff, config]}
				{@const available = diff === 'apprentice' || diff === 'journeyman'}
				<button
					onclick={() => available && startGame(diff as Difficulty)}
					disabled={!available}
					class="w-full rounded-xl border px-5 py-4 text-left transition-colors
						{available
						? 'border-gray-700 bg-gray-900 hover:border-forge-orange hover:bg-gray-800 cursor-pointer'
						: 'border-gray-800 bg-gray-950 opacity-40 cursor-not-allowed'}"
				>
					<p class="font-bold text-gray-100">{config.label}</p>
					<p class="mt-0.5 text-sm text-gray-500">
						{config.description}{available ? '' : ' · Coming soon'}
					</p>
				</button>
			{/each}
		</div>
	{:else if gameState?.phase === 'complete'}
		<!-- Completion screen -->
		<div class="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
			<div class="w-full rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
				<p class="mb-2 text-sm text-gray-400">Puzzle complete!</p>
				<div class="flex justify-center gap-1 text-4xl">
					{#each [1, 2, 3] as star}
						<span
							class:text-yellow-400={star <= (gameState?.stars ?? 0)}
							class:text-gray-700={star > (gameState?.stars ?? 0)}>★</span
						>
					{/each}
				</div>
				<p class="mt-3 text-lg font-bold text-forge-orange">
					{gameState?.moves} move{gameState?.moves !== 1 ? 's' : ''}
				</p>
				<p class="mt-1 text-sm text-gray-500">
					Par: {gameState?.puzzle.par} · {DIFFICULTY_CONFIGS[
						gameState?.puzzle.difficulty ?? 'apprentice'
					].label}
				</p>
			</div>

			<!-- Show completed grid -->
			{#if gameState}
				<div
					class="grid gap-1"
					style="grid-template-columns: repeat({gameState.puzzle.gridSize}, 2.5rem);"
				>
					{#each gameState.grid as row, r}
						{#each row as cell, c}
							{@const gid = cellGroupId(r, c)}
							<div
								class="flex h-10 w-10 items-center justify-center rounded text-sm font-bold text-white
									{gid ? groupColor(gid) : 'bg-gray-800'}"
							>
								{cell ?? ''}
							</div>
						{/each}
					{/each}
				</div>
			{/if}

			<div class="flex w-full max-w-xs flex-col gap-3">
				<button
					onclick={() => startGame(difficulty)}
					class="w-full rounded-lg bg-forge-orange py-3 text-sm font-bold text-gray-900 transition-opacity hover:opacity-90"
				>
					Play Again
				</button>
				<button
					onclick={handleNewGame}
					class="w-full rounded-lg border border-gray-700 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-500"
				>
					Change Difficulty
				</button>
			</div>
		</div>
	{:else if gameState}
		<!-- Active game -->

		<!-- Stats bar -->
		<div
			class="flex w-full max-w-lg items-center justify-between rounded-lg border border-gray-800 bg-gray-900 px-4 py-2"
		>
			<div class="text-center">
				<p class="text-xs text-gray-500">Difficulty</p>
				<p class="text-sm font-bold text-gray-200">
					{DIFFICULTY_CONFIGS[gameState.puzzle.difficulty].label}
				</p>
			</div>
			<div class="text-center">
				<p class="text-xs text-gray-500">Moves</p>
				<p class="text-sm font-bold text-forge-orange">{gameState.moves}</p>
			</div>
			<div class="text-center">
				<p class="text-xs text-gray-500">Par</p>
				<p class="text-sm font-bold text-gray-200">{gameState.puzzle.par}</p>
			</div>
			<div class="flex gap-1">
				<button
					onclick={handleUndo}
					disabled={!canUndo}
					class="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-30"
					title="Undo"
				>
					↩
				</button>
				<button
					onclick={handleRedo}
					disabled={!canRedo}
					class="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-200 disabled:opacity-30"
					title="Redo"
				>
					↪
				</button>
			</div>
		</div>

		<!-- Invalid feedback banner -->
		{#if invalidFeedback}
			<div
				class="w-full max-w-lg rounded-lg border border-red-800 bg-red-950 px-4 py-2 text-center"
			>
				<p class="text-sm text-red-300">
					Some rows or columns don't form valid words — keep rearranging!
				</p>
			</div>
		{/if}

		<!-- Selected group indicator -->
		<div class="flex h-8 w-full max-w-lg items-center justify-center">
			{#if selectedGroup}
				<p class="text-sm text-gray-300">
					Placing <span class="font-bold tracking-widest text-forge-orange"
						>{selectedGroup.letters}</span
					> — click a cell to place it
				</p>
			{:else if unplacedGroups.length > 0}
				<p class="text-sm text-gray-600">Select a fragment from the bank below</p>
			{/if}
		</div>

		<!-- Grid -->
		<div
			class="grid gap-1 rounded-lg border border-gray-800 bg-gray-950 p-2"
			style="grid-template-columns: repeat({gridSize}, 2.75rem);"
		>
			{#each gameState.grid as row, r}
				{#each row as cell, c}
					{@const gid = cellGroupId(r, c)}
					{@const isTarget =
						selectedGroupId !== null && canPlaceGroup(gameState, selectedGroupId, r, c)}
					<button
						onclick={() => handleCellClick(r, c)}
						class="flex h-11 w-11 items-center justify-center rounded text-sm font-bold transition-all
							{gid
							? `${groupColor(gid)} text-white cursor-pointer hover:opacity-80`
							: isTarget
								? 'border-2 border-forge-orange bg-gray-800 text-gray-400 cursor-pointer'
								: 'border border-gray-700 bg-gray-900 text-gray-600 cursor-default'}"
						aria-label="Row {r + 1}, Column {c + 1}{cell ? `: ${cell}` : ''}"
					>
						{cell ?? ''}
					</button>
				{/each}
			{/each}
		</div>

		<!-- Letter group bank -->
		{#if unplacedGroups.length > 0}
			<div class="w-full max-w-lg">
				<p class="mb-2 text-xs text-gray-500">
					{unplacedGroups.length} fragment{unplacedGroups.length !== 1 ? 's' : ''} remaining
				</p>
				<div class="flex flex-wrap gap-2">
					{#each unplacedGroups as group}
						<button
							onclick={() => selectGroup(group.id)}
							class="rounded-lg border px-3 py-2 text-sm font-bold tracking-widest transition-all
								{selectedGroupId === group.id
								? `${groupColor(group.id)} border-forge-orange text-white scale-105`
								: `${groupColor(group.id)} border-transparent text-white opacity-80 hover:opacity-100 hover:scale-105`}"
						>
							{group.letters}
						</button>
					{/each}
				</div>
			</div>
		{:else if gameState.phase === 'playing'}
			<p class="text-sm text-gray-500">All fragments placed — checking…</p>
		{/if}

		<!-- Placed groups key -->
		{#if gameState.placements.length > 0}
			<div class="w-full max-w-lg">
				<p class="mb-2 text-xs text-gray-500">Placed (click on grid to remove)</p>
				<div class="flex flex-wrap gap-2">
					{#each gameState.placements as p}
						{@const grp = gameState.puzzle.groups.find((g) => g.id === p.groupId)}
						{#if grp}
							<span
								class="rounded px-2 py-1 text-xs font-bold tracking-widest text-white {groupColor(
									grp.id
								)} opacity-60"
							>
								{grp.letters}
							</span>
						{/if}
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</main>
