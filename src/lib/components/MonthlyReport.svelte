<script lang="ts">
	import RadarChart from './RadarChart.svelte';
	import { COGNITIVE_DIMENSIONS, getSnapshotNearDate } from '$lib/engine/cognitiveRating.js';
	import type {
		CognitiveDimension,
		CognitiveProfile,
		WeeklySnapshot
	} from '$lib/engine/cognitiveRating.js';

	interface Props {
		profile: CognitiveProfile;
		snapshots: WeeklySnapshot[];
		/** ISO date string for "today". Defaults to actual today. */
		currentDate?: string;
		/** Games played this month (provided by caller). */
		gamesPlayed?: number;
		/** Total words found this month (provided by caller). */
		wordsFound?: number;
		/** Achievement names unlocked this month. */
		achievements?: string[];
	}

	let {
		profile,
		snapshots,
		currentDate = new Date().toISOString().slice(0, 10),
		gamesPlayed = 0,
		wordsFound = 0,
		achievements = []
	}: Props = $props();

	const DIM_LABELS: Record<CognitiveDimension, string> = {
		vocabularyDepth: 'Vocabulary Depth',
		processingSpeed: 'Processing Speed',
		patternRecognition: 'Pattern Recognition',
		workingMemory: 'Working Memory',
		strategicThinking: 'Strategic Thinking'
	};

	// Compute the date 30 days before currentDate.
	const thirtyDaysAgoDate = $derived.by(() => {
		const d = new Date(currentDate);
		d.setUTCDate(d.getUTCDate() - 30);
		return d.toISOString().slice(0, 10);
	});

	const historicalSnapshot = $derived(getSnapshotNearDate(snapshots, thirtyDaysAgoDate));

	const currentRatings = $derived({
		vocabularyDepth: profile.vocabularyDepth.rating,
		processingSpeed: profile.processingSpeed.rating,
		patternRecognition: profile.patternRecognition.rating,
		workingMemory: profile.workingMemory.rating,
		strategicThinking: profile.strategicThinking.rating
	});

	const historicalRatings = $derived(historicalSnapshot ? historicalSnapshot.ratings : null);

	// Sort dimensions by current rating for strengths / growth-area lists.
	const dimAnalysis = $derived(
		COGNITIVE_DIMENSIONS.map((dim) => ({
			dim,
			rating: profile[dim].rating,
			delta: historicalRatings ? profile[dim].rating - historicalRatings[dim] : 0
		})).sort((a, b) => b.rating - a.rating)
	);

	const topStrengths = $derived(dimAnalysis.filter((d) => d.rating >= 1200).slice(0, 2));
	const growthAreas = $derived(dimAnalysis.filter((d) => d.rating < 1000).slice(0, 2));

	const monthLabel = $derived(
		new Date(currentDate).toLocaleString('default', { month: 'long', year: 'numeric' })
	);

	// Shareable plain-text summary.
	const shareText = $derived.by(() => {
		const lines: string[] = [
			`Lexicon Forge — ${monthLabel} Cognitive Report`,
			`Games: ${gamesPlayed} | Words: ${wordsFound.toLocaleString()}`,
			'',
			'Cognitive Ratings:'
		];
		for (const dim of COGNITIVE_DIMENSIONS) {
			const delta = historicalRatings ? profile[dim].rating - historicalRatings[dim] : 0;
			const sign = delta >= 0 ? '+' : '';
			lines.push(`  ${DIM_LABELS[dim]}: ${profile[dim].rating} (${sign}${delta})`);
		}
		if (topStrengths.length > 0) {
			lines.push('', `Strengths: ${topStrengths.map((d) => DIM_LABELS[d.dim]).join(', ')}`);
		}
		if (growthAreas.length > 0) {
			lines.push(`Growth areas: ${growthAreas.map((d) => DIM_LABELS[d.dim]).join(', ')}`);
		}
		return lines.join('\n');
	});

	let copied = $state(false);
	let copyTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	async function copyReport() {
		if (copyTimer) globalThis.clearTimeout(copyTimer);
		try {
			await globalThis.navigator.clipboard.writeText(shareText);
		} catch {
			const el = globalThis.document.createElement('textarea');
			el.value = shareText;
			el.style.cssText = 'position:fixed;opacity:0';
			globalThis.document.body.appendChild(el);
			el.select();
			globalThis.document.execCommand('copy');
			globalThis.document.body.removeChild(el);
		}
		copied = true;
		copyTimer = globalThis.setTimeout(() => {
			copied = false;
		}, 2000);
	}
</script>

<div class="space-y-5">
	<div class="text-center">
		<h2 class="text-lg font-bold text-white">Monthly Cognitive Report</h2>
		<p class="text-sm text-gray-400">{monthLabel}</p>
	</div>

	<!-- Radar chart with 30-days-ago overlay -->
	<div class="flex justify-center pb-6">
		<RadarChart ratings={currentRatings} {historicalRatings} />
	</div>

	<!-- Legend -->
	{#if historicalRatings}
		<div class="flex justify-center gap-5 text-xs text-gray-400">
			<span class="flex items-center gap-1.5">
				<span class="inline-block h-0.5 w-5 rounded bg-blue-400"></span>
				Current
			</span>
			<span class="flex items-center gap-1.5">
				<svg width="20" height="4" aria-hidden="true">
					<line
						x1="0"
						y1="2"
						x2="20"
						y2="2"
						stroke="#6b7280"
						stroke-width="1.5"
						stroke-dasharray="4 3"
					/>
				</svg>
				30 days ago
			</span>
		</div>
	{/if}

	<!-- Key stats -->
	<div class="grid grid-cols-2 gap-3">
		<div class="rounded-lg bg-gray-800 p-3 text-center">
			<p class="text-2xl font-bold text-white">{gamesPlayed}</p>
			<p class="text-xs text-gray-400">Games Played</p>
		</div>
		<div class="rounded-lg bg-gray-800 p-3 text-center">
			<p class="text-2xl font-bold text-white">{wordsFound.toLocaleString()}</p>
			<p class="text-xs text-gray-400">Words Found</p>
		</div>
	</div>

	<!-- Strengths -->
	{#if topStrengths.length > 0}
		<div class="rounded-lg border border-green-800 bg-green-900/30 p-3">
			<p class="mb-1.5 text-xs font-semibold text-green-400">Strengths</p>
			{#each topStrengths as { dim, rating, delta }}
				<div class="flex items-center justify-between text-xs">
					<span class="text-gray-300">{DIM_LABELS[dim]}</span>
					<span class="font-medium text-green-400">
						{rating}{delta !== 0 ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Growth areas -->
	{#if growthAreas.length > 0}
		<div class="rounded-lg border border-amber-800 bg-amber-900/30 p-3">
			<p class="mb-1.5 text-xs font-semibold text-amber-400">Growth Areas</p>
			{#each growthAreas as { dim, rating, delta }}
				<div class="flex items-center justify-between text-xs">
					<span class="text-gray-300">{DIM_LABELS[dim]}</span>
					<span class="font-medium text-amber-400">
						{rating}{delta !== 0 ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Achievements -->
	{#if achievements.length > 0}
		<div class="rounded-lg bg-gray-800 p-3">
			<p class="mb-1.5 text-xs font-semibold text-purple-400">Achievements Unlocked</p>
			{#each achievements as achievement}
				<p class="text-xs text-gray-300">🏆 {achievement}</p>
			{/each}
		</div>
	{/if}

	<!-- Share button -->
	<button
		onclick={copyReport}
		class="w-full rounded-lg border py-2 text-sm font-medium transition-colors"
		class:border-green-700={copied}
		class:text-green-400={copied}
		class:bg-gray-800={!copied}
		class:border-gray-700={!copied}
		class:text-gray-300={!copied}
	>
		{copied ? '✓ Copied!' : 'Share Monthly Report'}
	</button>
</div>
