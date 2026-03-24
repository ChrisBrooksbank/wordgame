<script lang="ts">
	import type { HexGrid, HexCoord } from '$lib/engine/hexGrid.js';
	import {
		hexToPixel,
		hexCorners,
		hexKey,
		computeGridBounds,
		gridCoords
	} from '$lib/engine/hexGrid.js';

	interface Props {
		grid: HexGrid;
		selectedPath?: HexCoord[];
		tileSize?: number;
	}

	let { grid, selectedPath = [], tileSize = 40 }: Props = $props();

	const coords = $derived(gridCoords(grid.size));

	const bounds = $derived(computeGridBounds(coords, tileSize));

	const viewBox = $derived(`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`);

	const renderedTiles = $derived(
		grid.tiles.map((tile) => {
			const center = hexToPixel(tile.coord, tileSize);
			const corners = hexCorners(center, tileSize);
			const points = corners.map((c) => `${c.x},${c.y}`).join(' ');
			const key = hexKey(tile.coord);
			const isSelected = selectedPath.some((c) => hexKey(c) === key);
			return { ...tile, center, points, isSelected };
		})
	);
</script>

<svg
	class="h-auto w-full"
	{viewBox}
	xmlns="http://www.w3.org/2000/svg"
	role="img"
	aria-label="Hexagonal letter grid"
>
	{#each renderedTiles as tile (tile.id)}
		<g>
			<polygon
				points={tile.points}
				fill={tile.isSelected ? '#f59e0b' : '#1f2937'}
				stroke={tile.isSelected ? '#f97316' : '#374151'}
				stroke-width="2"
			/>
			<text
				x={tile.center.x}
				y={tile.center.y}
				text-anchor="middle"
				dominant-baseline="central"
				fill={tile.isSelected ? '#1f2937' : '#f3f4f6'}
				font-size={tileSize * 0.45}
				font-weight="bold"
				font-family="system-ui, sans-serif"
			>
				{tile.letter}
			</text>
		</g>
	{/each}
</svg>
