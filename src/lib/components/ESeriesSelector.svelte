<script lang="ts">
	import { E24_SUBSETs as E24_SUBSETS, E96_SUBSETS, type E24Subset, type E96Subset } from "$lib/calculator/eseries";

	let {
		e24Subset = $bindable(24),
		e96Subset = $bindable(null),
		useE192 = $bindable(false),
		...rest
	}: {
		e24Subset: E24Subset | null,
		e96Subset: E96Subset | null,
		useE192: boolean,
		class?: string,
	} = $props();
</script>


<div class="flex gap-4 flex-wrap {rest.class}">
	<div class="flex gap-4">
		{#each E24_SUBSETS as n}
			<button data-selected={e24Subset === n} onclick={() => e24Subset = e24Subset === n ? null : n}>E{n}</button>
		{/each}
	</div>
	<span class="rounded-lg border border-gray-200 mx-2"></span>	
	<div class="flex gap-4">
		{#each E96_SUBSETS as n}
			<button data-selected={e96Subset === n} onclick={() => e96Subset = e96Subset === n ? null : n}>E{n}</button>
		{/each}
	</div>
	<span class="rounded-lg border border-gray-200 mx-2"></span>
	<button data-selected={useE192} onclick={() => useE192 = !useE192}>E192</button>
</div>

<style>
	@reference "../../routes/layout.css";

	button {
		@apply border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 data-[selected=true]:drop-shadow-md
			drop-shadow-amber-800 w-14 h-10 font-semibold flex items-center justify-center rounded-sm;
	}
</style>