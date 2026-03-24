<script lang="ts">
	import { COGNITIVE_DIMENSIONS } from '$lib/engine/cognitiveRating.js';
	import type { CognitiveDimension } from '$lib/engine/cognitiveRating.js';

	interface Props {
		/** Current ratings for all 5 dimensions (100–3000 scale). */
		ratings: Record<CognitiveDimension, number>;
		/** Optional historical ratings for 30-days-ago overlay. */
		historicalRatings?: Record<CognitiveDimension, number> | null;
		/** Chart width/height in pixels. */
		size?: number;
		/** Called when an axis label is tapped. */
		onAxisTap?: (_dimension: CognitiveDimension) => void;
	}

	let { ratings, historicalRatings = null, size = 280, onAxisTap }: Props = $props();

	const MIN_RATING = 100;
	const MAX_RATING = 3000;

	// Axes: start from top (–90°), 72° increments clockwise.
	const LABELS: Record<CognitiveDimension, string> = {
		vocabularyDepth: 'Vocabulary',
		processingSpeed: 'Speed',
		patternRecognition: 'Pattern',
		workingMemory: 'Memory',
		strategicThinking: 'Strategy'
	};

	// text-anchor per axis index (0=top, 1=top-right, 2=bottom-right, 3=bottom-left, 4=top-left)
	const ANCHORS: ('middle' | 'start' | 'end')[] = ['middle', 'start', 'start', 'end', 'end'];
	// dominant-baseline per axis index
	const BASELINES: string[] = ['auto', 'middle', 'hanging', 'hanging', 'middle'];

	function angleRad(i: number): number {
		return ((-90 + i * 72) * Math.PI) / 180;
	}

	function normalize(rating: number): number {
		return Math.max(0.05, Math.min(1, (rating - MIN_RATING) / (MAX_RATING - MIN_RATING)));
	}

	const cx = $derived(size / 2);
	const cy = $derived(size / 2);
	const R = $derived(size * 0.36);
	const labelR = $derived(size * 0.47);
	const fontSize = $derived(Math.max(10, size * 0.045));

	function radialPoint(fraction: number, axisIndex: number, baseR: number): string {
		const a = angleRad(axisIndex);
		const x = cx + fraction * baseR * Math.cos(a);
		const y = cy + fraction * baseR * Math.sin(a);
		return `${x.toFixed(2)},${y.toFixed(2)}`;
	}

	function polygonPoints(ratingMap: Record<CognitiveDimension, number>): string {
		return COGNITIVE_DIMENSIONS.map((dim, i) => radialPoint(normalize(ratingMap[dim]), i, R)).join(
			' '
		);
	}

	function gridPolygon(fraction: number): string {
		return COGNITIVE_DIMENSIONS.map((_, i) => radialPoint(fraction, i, R)).join(' ');
	}

	const currentPoints = $derived(polygonPoints(ratings));
	const historicalPoints = $derived(historicalRatings ? polygonPoints(historicalRatings) : null);

	const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];

	function dimColor(dim: CognitiveDimension): string {
		const r = ratings[dim];
		if (r >= 1200) return '#22c55e'; // green-500
		if (r < 1000) return '#f59e0b'; // amber-400
		return '#60a5fa'; // blue-400 neutral
	}

	const avgRating = $derived(
		COGNITIVE_DIMENSIONS.reduce((sum, d) => sum + ratings[d], 0) / COGNITIVE_DIMENSIONS.length
	);
	const fillColor = $derived(
		avgRating >= 1200 ? '#22c55e' : avgRating < 1000 ? '#f59e0b' : '#60a5fa'
	);

	let selectedDim = $state<CognitiveDimension | null>(null);

	function handleAxisTap(dim: CognitiveDimension) {
		selectedDim = selectedDim === dim ? null : dim;
		onAxisTap?.(dim);
	}
</script>

<div class="relative inline-block">
	<svg
		width={size}
		height={size}
		viewBox={`0 0 ${size} ${size}`}
		role="img"
		aria-label="Cognitive profile radar chart"
		style="overflow: visible;"
	>
		<!-- Grid rings -->
		{#each GRID_LEVELS as level, gi}
			<polygon
				points={gridPolygon(level)}
				fill="none"
				stroke="#374151"
				stroke-width="1"
				opacity={gi === GRID_LEVELS.length - 1 ? 0.8 : 0.4}
			/>
		{/each}

		<!-- Axis lines -->
		{#each COGNITIVE_DIMENSIONS as _, i}
			{@const a = angleRad(i)}
			<line
				x1={cx}
				y1={cy}
				x2={(cx + R * Math.cos(a)).toFixed(2)}
				y2={(cy + R * Math.sin(a)).toFixed(2)}
				stroke="#374151"
				stroke-width="1"
				opacity="0.6"
			/>
		{/each}

		<!-- Historical overlay (30-days-ago) -->
		{#if historicalPoints}
			<polygon
				points={historicalPoints}
				fill="none"
				stroke="#6b7280"
				stroke-width="1.5"
				stroke-dasharray="4 3"
				opacity="0.7"
			/>
		{/if}

		<!-- Current ratings polygon -->
		<polygon
			points={currentPoints}
			fill={fillColor}
			fill-opacity="0.2"
			stroke={fillColor}
			stroke-width="2"
			class="radar-poly"
		/>

		<!-- Per-dimension dots at current rating position -->
		{#each COGNITIVE_DIMENSIONS as dim, i}
			{@const a = angleRad(i)}
			{@const r = normalize(ratings[dim]) * R}
			<circle
				cx={(cx + r * Math.cos(a)).toFixed(2)}
				cy={(cy + r * Math.sin(a)).toFixed(2)}
				r="3.5"
				fill={dimColor(dim)}
			/>
		{/each}

		<!-- Axis labels (interactive) -->
		{#each COGNITIVE_DIMENSIONS as dim, i}
			{@const a = angleRad(i)}
			{@const lx = (cx + labelR * Math.cos(a)).toFixed(2)}
			{@const ly = (cy + labelR * Math.sin(a)).toFixed(2)}
			<text
				x={lx}
				y={ly}
				text-anchor={ANCHORS[i]}
				dominant-baseline={BASELINES[i]}
				font-size={fontSize}
				fill={selectedDim === dim ? dimColor(dim) : '#9ca3af'}
				class="cursor-pointer select-none font-medium transition-colors"
				role="button"
				tabindex="0"
				onclick={() => handleAxisTap(dim)}
				onkeydown={(e) => e.key === 'Enter' && handleAxisTap(dim)}
			>
				{LABELS[dim]}
			</text>
		{/each}
	</svg>

	<!-- Dimension detail popup shown below the chart when an axis is selected -->
	{#if selectedDim}
		{@const dim = selectedDim}
		<div
			class="absolute -bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-center text-xs shadow-lg"
		>
			<p class="font-semibold" style="color: {dimColor(dim)}">{LABELS[dim]}</p>
			<p class="text-gray-300">
				Rating: <span class="font-bold text-white">{ratings[dim]}</span>
			</p>
			{#if historicalRatings}
				{@const delta = ratings[dim] - historicalRatings[dim]}
				<p class={delta >= 0 ? 'text-green-400' : 'text-red-400'}>
					{delta >= 0 ? '+' : ''}{delta} vs 30d ago
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.radar-poly {
		transition:
			fill-opacity 0.4s ease,
			stroke 0.4s ease;
	}
</style>
