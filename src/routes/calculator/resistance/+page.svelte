<script lang="ts">
	import { getCalculatorContext } from '$lib/calculator/context';
	import BestMatch from '$lib/components/BestMatch.svelte';
	import ErrorWidget from '$lib/components/ErrorWidget.svelte';
	import LoadingWidget from '$lib/components/LoadingWidget.svelte';
	import Match from '$lib/components/Match.svelte';
	import ValueInput from '$lib/components/ValueInput.svelte';

	const context = getCalculatorContext();

	$effect(() => {
		localStorage.setItem("resistor-solver-values", JSON.stringify(context.resistance.computeReq));
	});
</script>

<svelte:head>
	<title>Resistor Combination Solver - Close Enough</title>
	<meta 
		name="description"
		content="Calculate series and parallel resistor combinations that hits your target resistance using E-Series values."
	/>
</svelte:head>


<div class="flex gap-12 flex-wrap">
	<ValueInput 
		v1Label="TARGET RESISTANCE" 
		bind:v1={context.resistance.computeReq.target} 
		bind:n={context.resistance.computeReq.n} 
		bind:selectedE24Subset={context.resistance.computeReq.e24Subset} 
		bind:selectedE96Subset={context.resistance.computeReq.e96Subset} 
		bind:e192Selected={context.resistance.computeReq.useE192}
		symbol="Ω"
		class="flex-2"
	/>
	{#if !context.resistance.inputError}
		{#await context.resistance.resultsPromise}
			<LoadingWidget text="Solving..."/>
		{:then results}
			{#if results}
				<div class="flex flex-col gap-3 flex-3 min-w-96">
					<BestMatch selectedCombination={results[0]} targetValue={context.resistance.computeReq.target} solveTime={context.resistance.solveTime}/>
					<p class="opacity-70 mt-5 tracking-wider">ALTERNATIVES</p>
					<div 
						class="grid grid-cols-[repeat(auto-fill,minmax(min(var(--col-min),100%),1fr))] gap-4"
						style="--col-min: {context.resistance.computeReq.n <= 2 ? '350px' : '400px'}"
					>
						{#each results.slice(1) as c}
							<Match selectedCombination={c} targetValue={context.resistance.computeReq.target}/>
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