<script lang="ts">
	import { isOnline } from '$lib/stores/networkStatus.js';
</script>

{#if !$isOnline}
	<div
		class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-400 opacity-80"
		role="status"
		aria-live="polite"
	>
		Offline
	</div>
{/if}
