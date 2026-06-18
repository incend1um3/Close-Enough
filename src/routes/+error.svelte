<script>
	import { page } from '$app/state';
</script>

<div class="text-center h-full flex flex-col items-center justify-center">
	{#if page.status === 404}
		<h1 class="text-5xl">404 Page Not Found</h1>
		<p class="text-xl">The page you're looking for doesn't exist.</p>
	{:else}
		<h1 class="text-3xl">{page.status} - {page.error?.message}</h1>
	{/if}
	
	<a href="/" class="underline">Go Back</a>
</div>
