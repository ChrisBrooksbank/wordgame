<script lang="ts">
	import {
		ACHIEVEMENT_DEFS,
		achievementProgress,
		getRecord,
		resolveAchievementDisplay
	} from '$lib/engine/achievements.js';
	import type { AchievementStore } from '$lib/engine/achievements.js';

	interface Props {
		store: AchievementStore;
	}

	let { store }: Props = $props();

	const CATEGORY_LABELS: Record<string, string> = {
		vocabularyDepth: 'Vocabulary',
		processingSpeed: 'Speed',
		patternRecognition: 'Pattern',
		workingMemory: 'Memory',
		strategicThinking: 'Strategy'
	};

	const CATEGORY_COLORS: Record<string, string> = {
		vocabularyDepth: 'text-blue-400',
		processingSpeed: 'text-orange-400',
		patternRecognition: 'text-purple-400',
		workingMemory: 'text-green-400',
		strategicThinking: 'text-yellow-400'
	};

	const categories = [
		'vocabularyDepth',
		'processingSpeed',
		'patternRecognition',
		'workingMemory',
		'strategicThinking'
	] as const;

	function defsForCategory(category: string) {
		return ACHIEVEMENT_DEFS.filter((d) => d.category === category);
	}

	function unlockedCount(): number {
		return ACHIEVEMENT_DEFS.filter((d) => getRecord(store, d.id).unlockedAt !== null).length;
	}
</script>

<div class="flex flex-col gap-6 p-4">
	<!-- Header summary -->
	<div class="text-center">
		<p class="text-2xl font-extrabold text-white">Achievements</p>
		<p class="mt-1 text-sm text-gray-400">
			{unlockedCount()} / {ACHIEVEMENT_DEFS.length} unlocked
		</p>
	</div>

	<!-- Per-category sections -->
	{#each categories as category}
		{@const defs = defsForCategory(category)}
		<section>
			<h2 class="mb-2 text-xs font-bold uppercase tracking-widest {CATEGORY_COLORS[category]}">
				{CATEGORY_LABELS[category]}
			</h2>

			<div class="flex flex-col gap-2">
				{#each defs as def}
					{@const record = getRecord(store, def.id)}
					{@const display = resolveAchievementDisplay(def, record)}
					{@const progress = achievementProgress(def.id, store.stats)}
					{@const unlocked = record.unlockedAt !== null}

					<div
						class="flex items-center gap-3 rounded-lg border px-3 py-2 {unlocked
							? 'border-gray-600 bg-gray-800/60'
							: 'border-gray-700/50 bg-gray-900/40 opacity-70'}"
					>
						<!-- Emoji -->
						<div class="flex-shrink-0 text-2xl" aria-hidden="true">{display.emoji}</div>

						<!-- Name / description / progress -->
						<div class="flex flex-1 flex-col gap-0.5">
							<p class="text-sm font-semibold {unlocked ? 'text-white' : 'text-gray-400'}">
								{display.name}
							</p>
							<p class="text-xs text-gray-500">{display.description}</p>

							{#if !unlocked && progress > 0}
								<!-- Progress bar (only shown when there's measurable progress) -->
								<div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-gray-700">
									<div
										class="h-full rounded-full bg-amber-500 transition-all duration-300"
										style="width: {Math.round(progress * 100)}%"
									></div>
								</div>
							{/if}
						</div>

						<!-- Unlock date badge -->
						{#if unlocked && record.unlockedAt}
							<p class="flex-shrink-0 text-xs text-gray-500">
								{record.unlockedAt.slice(0, 10)}
							</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>
	{/each}
</div>
