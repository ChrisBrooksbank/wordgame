<script lang="ts">
	import {
		WHEEL_SEGMENTS,
		selectSegment,
		segmentCenterAngle,
		wheelRng,
		saveSpinResult
	} from '$lib/engine/forgeWheel.js';
	import type { SpinResult } from '$lib/engine/forgeWheel.js';

	// -------------------------------------------------------------------------
	// Props
	// -------------------------------------------------------------------------

	interface Props {
		date: string;
		/** Called with the result once the spin animation completes. */
		onspun?: (_result: SpinResult) => void;
		/** If a result was already saved (spin already used today), pass it here. */
		previousResult?: SpinResult | null;
	}

	let { date, onspun, previousResult = null }: Props = $props();

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	let spinning = $state(false);
	let spinResult = $state<SpinResult | null>(null);
	$effect(() => {
		spinResult = previousResult ?? null;
	});
	let currentRotation = $state(0);
	let targetRotation = $state(0);

	// -------------------------------------------------------------------------
	// SVG wheel geometry
	// -------------------------------------------------------------------------

	const RADIUS = 110;
	const CX = 120;
	const CY = 120;
	const TOTAL_WEIGHT = WHEEL_SEGMENTS.reduce((s, seg) => s + seg.weight, 0);

	/** Convert degrees (clockwise from top) to SVG arc endpoint. */
	function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
		// SVG: 0° at right, clockwise. We use "from top" so subtract 90.
		const rad = ((angleDeg - 90) * Math.PI) / 180;
		return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
	}

	/** Build an SVG pie-slice path string for one wheel segment. */
	function segmentPath(startAngle: number, endAngle: number): string {
		const start = polarToCartesian(CX, CY, RADIUS, startAngle);
		const end = polarToCartesian(CX, CY, RADIUS, endAngle);
		const largeArc = endAngle - startAngle > 180 ? 1 : 0;
		return [
			`M ${CX} ${CY}`,
			`L ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
			`A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
			'Z'
		].join(' ');
	}

	/** Build label position for a segment. */
	function labelPos(startAngle: number, endAngle: number) {
		const mid = (startAngle + endAngle) / 2;
		return polarToCartesian(CX, CY, RADIUS * 0.65, mid);
	}

	// Precompute per-segment geometry
	const segments = $derived(
		WHEEL_SEGMENTS.map((seg, i) => {
			let start = 0;
			for (let j = 0; j < i; j++) {
				start += (WHEEL_SEGMENTS[j].weight / TOTAL_WEIGHT) * 360;
			}
			const span = (seg.weight / TOTAL_WEIGHT) * 360;
			const end = start + span;
			const lp = labelPos(start, end);
			return { seg, start, end, lp };
		})
	);

	// -------------------------------------------------------------------------
	// Spin logic
	// -------------------------------------------------------------------------

	async function spin() {
		if (spinning || spinResult) return;

		spinning = true;

		// Determine winning segment
		const rng = wheelRng(date);
		const winningIndex = selectSegment(rng);
		const winningCenter = segmentCenterAngle(winningIndex);

		// Pointer is at top (0°). We want the winning segment's center to reach top.
		// Rotate wheel so winning center aligns with top pointer:
		// final_rotation ≡ -winningCenter + 360*k for integer k
		// Add multiple full rotations (5–8) for visual effect.
		const fullSpins = 6;
		const alignAngle = (360 - winningCenter) % 360;
		targetRotation = currentRotation + fullSpins * 360 + alignAngle;

		// Wait for animation to finish (2.5s transition)
		await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 2600));

		currentRotation = targetRotation;

		const result: SpinResult = {
			date,
			segmentIndex: winningIndex,
			reward: WHEEL_SEGMENTS[winningIndex].reward
		};

		try {
			await saveSpinResult(result);
		} catch {
			// Storage unavailable — still show result
		}

		spinResult = result;
		spinning = false;
		onspun?.(result);
	}
</script>

<div class="flex flex-col items-center gap-4">
	<p class="text-sm font-semibold text-forge-orange">Forge Wheel</p>
	<p class="text-xs text-gray-500">Spin once to claim your daily reward!</p>

	<!-- Wheel container with pointer -->
	<div class="relative" style="width: 240px; height: 240px;">
		<!-- Pointer at top -->
		<div
			class="absolute left-1/2 z-10 -translate-x-1/2"
			style="top: -10px; width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 20px solid #f97316;"
		></div>

		<!-- Spinning wheel SVG -->
		<svg
			viewBox="0 0 240 240"
			width="240"
			height="240"
			style="transform: rotate({targetRotation}deg); transition: {spinning
				? 'transform 2.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
				: 'none'};"
		>
			{#each segments as { seg, start, end, lp }}
				<path d={segmentPath(start, end)} fill={seg.color} stroke="#1f2937" stroke-width="2" />
				<text
					x={lp.x}
					y={lp.y}
					text-anchor="middle"
					dominant-baseline="middle"
					font-size="14"
					fill="white"
					font-weight="bold"
					style="pointer-events: none; text-shadow: 0 1px 2px rgba(0,0,0,0.8);"
				>
					{seg.emoji}
				</text>
			{/each}
			<!-- Center circle -->
			<circle cx={CX} cy={CY} r="18" fill="#111827" stroke="#374151" stroke-width="2" />
			<text
				x={CX}
				y={CY}
				text-anchor="middle"
				dominant-baseline="middle"
				font-size="14"
				fill="#f97316">🔥</text
			>
		</svg>
	</div>

	<!-- Spin button or result -->
	{#if spinResult}
		<div
			class="w-full rounded-xl border border-gray-700 bg-gray-900 p-4 text-center"
			aria-live="polite"
		>
			<p class="text-3xl">{WHEEL_SEGMENTS[spinResult.segmentIndex].emoji}</p>
			<p class="mt-1 text-lg font-bold text-forge-orange">{spinResult.reward.label}</p>
			<p class="mt-1 text-xs text-gray-400">{spinResult.reward.description}</p>
		</div>
	{:else}
		<button
			onclick={spin}
			disabled={spinning}
			class="rounded-lg bg-forge-orange px-8 py-3 text-sm font-bold text-gray-900 transition-opacity hover:opacity-90 disabled:opacity-50"
		>
			{spinning ? 'Spinning…' : 'Spin!'}
		</button>
	{/if}
</div>
