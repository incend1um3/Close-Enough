<script lang="ts">
	import { getCalculatorContext } from "$lib/calculator/context";
	import BestMatch from "$lib/components/BestMatch.svelte";
	import ErrorWidget from "$lib/components/ErrorWidget.svelte";
	import LoadingWidget from "$lib/components/LoadingWidget.svelte";
	import Match from "$lib/components/Match.svelte";
	import VoltageDividerInput from "$lib/components/VoltageDividerInput.svelte";

	const context = getCalculatorContext();

	$effect(() => {
		localStorage.setItem("voltage-divider-solver-values", JSON.stringify(context.voltageDivider.computeReq));
	});
</script>

<svelte:head>
	<title>Voltage Divider Solver - Close Enough</title>
	<meta 
		name="description"
		content="Calculate the resistor pair that produces your target output voltage, with current and impedance constraints, from E-Series values."
	/>
</svelte:head>

<div class="flex gap-12 flex-wrap">
	<VoltageDividerInput
		bind:computeReq={context.voltageDivider.computeReq}
		bind:error={context.voltageDivider.inputError}
		class="flex-2"
	/>
	{#if !context.voltageDivider.inputError}
		{#await context.voltageDivider.resultsPromise}
			<LoadingWidget text="Solving..."/>
		{:then results}
			{#if results}
				<div class="flex flex-col gap-3 flex-3">
					<BestMatch selectedCombination={results[0]} targetValue={context.voltageDivider.computeReq.vout} solveTime={context.voltageDivider.solveTime}/>
					<p class="opacity-70 mt-5 tracking-wider">ALTERNATIVES</p>
					<div class="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
						{#each results.slice(1) as c}
							<Match selectedCombination={c} targetValue={context.voltageDivider.computeReq.vout}/>
						{/each}
					</div>
				</div>
			{:else}
				<LoadingWidget text="Waiting for cache to load..." />
			{/if}		
		{/await}
	{:else}
		<ErrorWidget />
	{/if}
</div>

