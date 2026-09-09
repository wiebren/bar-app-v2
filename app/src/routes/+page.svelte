<script lang="ts">
	import { goto } from '$app/navigation';
	import { pb } from '$lib/pb';
	import { onMount } from 'svelte';

	// After login you land on your own tab; other tabs are charged from the
	// order screen's "streep voor iemand anders" picker.
	onMount(() => {
		const id = pb.authStore.record?.id;
		goto(id ? `/tab/${id}` : '/login', { replaceState: true });
	});
</script>
