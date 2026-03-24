<script lang="ts">
	import '../app.css';
	import OfflineBadge from '$lib/components/OfflineBadge.svelte';
	import InstallPrompt from '$lib/components/InstallPrompt.svelte';
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

{@render children()}
<OfflineBadge />
<InstallPrompt />
