<script lang="ts">
	import { puzzleDayNumber } from '$lib/engine/dailyPuzzle.js';

	interface Props {
		date: string;
		score: number;
		stars: 1 | 2 | 3 | 4 | 5;
		wordsFound: string[];
		movesUsed: number;
	}

	let { date, score, stars, wordsFound, movesUsed }: Props = $props();

	let copied = $state(false);
	let copyTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

	const dayNumber = $derived(puzzleDayNumber(date));

	const shareText = $derived(
		`Lexicon Forge #${dayNumber} ${'⭐'.repeat(stars)}${'☆'.repeat(5 - stars)} | ${score.toLocaleString()} pts | 🔥 ${wordsFound.length} words`
	);

	async function copy() {
		if (copyTimer) globalThis.clearTimeout(copyTimer);
		try {
			await globalThis.navigator.clipboard.writeText(shareText);
		} catch {
			// Fallback for older browsers
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

	// -------------------------------------------------------------------------
	// Abstract hex visualization — pointy-top hexagons
	// Each word = one row of hexagons; hex count = word length; no letters shown
	// -------------------------------------------------------------------------

	const SIZE = 8;
	const HEX_W = SIZE * Math.sqrt(3);
	const H_GAP = 2;
	const V_GAP = 3;
	const COL_STEP = HEX_W + H_GAP;
	const ROW_STEP = SIZE * 1.5 + V_GAP;
	const PAD = SIZE + 4;

	function hexPoints(cx: number, cy: number): string {
		return Array.from({ length: 6 }, (_, i) => {
			const a = (Math.PI / 3) * i - Math.PI / 6;
			return `${(cx + SIZE * Math.cos(a)).toFixed(1)},${(cy + SIZE * Math.sin(a)).toFixed(1)}`;
		}).join(' ');
	}

	const maxLen = $derived(wordsFound.length > 0 ? Math.max(...wordsFound.map((w) => w.length)) : 1);
	const svgWidth = $derived(PAD * 2 + maxLen * COL_STEP - H_GAP);
	const svgHeight = $derived(PAD * 2 + wordsFound.length * ROW_STEP - V_GAP);
</script>

<div class="w-full space-y-3">
	<!-- Abstract word-path visualization -->
	{#if wordsFound.length > 0}
		<div class="flex justify-center overflow-x-auto">
			<svg
				width={svgWidth}
				height={svgHeight}
				viewBox={`0 0 ${svgWidth} ${svgHeight}`}
				role="img"
				aria-label="Abstract word path visualization — {wordsFound.length} words forged"
			>
				{#each wordsFound as word, row}
					{#each { length: word.length } as _, col}
						{@const cx = PAD + col * COL_STEP}
						{@const cy = PAD + row * ROW_STEP}
						<polygon
							points={hexPoints(cx, cy)}
							fill="#f59e0b"
							fill-opacity={0.25 + (word.length / 12) * 0.65}
							stroke="#f97316"
							stroke-width="1"
						/>
					{/each}
				{/each}
			</svg>
		</div>
	{/if}

	<!-- Share text preview -->
	<p class="truncate text-center font-mono text-xs text-gray-500">{shareText}</p>

	<!-- Copy button -->
	<button
		onclick={copy}
		class="w-full rounded-lg border py-2 text-sm font-medium transition-colors"
		class:border-green-700={copied}
		class:text-green-400={copied}
		class:bg-gray-800={!copied}
		class:border-gray-700={!copied}
		class:text-gray-300={!copied}
	>
		{copied ? '✓ Copied!' : 'Copy Result'}
	</button>

	<p class="text-center text-xs text-gray-600">{movesUsed} move{movesUsed !== 1 ? 's' : ''} used</p>
</div>
