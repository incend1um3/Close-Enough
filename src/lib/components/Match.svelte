<script lang="ts">
	import { MathUtil } from '$lib/math';
	import MaterialSymbolsKidStar from '~icons/material-symbols/kid-star';
	import { formatSiValue } from '$lib/format-si';
	import type { Combination, VoltageDividerCombination } from '$lib/calculator/workers/solver';
	import SeriesResistor from './circuit-display/SeriesResistor.svelte';
	import ParallelResistor from './circuit-display/ParallelResistor.svelte';
	import SingleResistor from './circuit-display/SingleResistor.svelte';
	import Parallel3 from './circuit-display/Parallel3.svelte';
	import Series3 from './circuit-display/Series3.svelte';
	import SeriesTwoParallelOne from './circuit-display/SeriesTwoParallelOne.svelte';
	import Parallel2Series1 from './circuit-display/Parallel2Series1.svelte';
	import { getNumComponentsFromCombination, isCombinationVoltageDivider } from '$lib/util';
	import VoltageDivider from './circuit-display/VoltageDivider.svelte';

	const { 
		targetValue,
		selectedCombination
	}: {
		targetValue: number,
		selectedCombination: Combination | VoltageDividerCombination,
	} = $props();

	let result = $derived(isCombinationVoltageDivider(selectedCombination) ? selectedCombination.vout : selectedCombination.result);

	let percentageDifference = $derived(MathUtil.percentageDifference(targetValue, result));
	let numComponents = $derived(getNumComponentsFromCombination(selectedCombination));
</script>

<div class="flex flex-col border p-5 sm:p-6 flex-1 border-y-gray-300 border-gray-300 shadow-sm bg-amber-50">
	<div class="flex justify-between items-center mb-1">
		<p class="text-4xl tracking-wide">{formatSiValue(result, false, isCombinationVoltageDivider(selectedCombination) ? 'V' : 'Ω')}</p>
		<div class={`rounded-lg py-1 px-2 flex gap-2 items-center ${percentageDifference <= 1.0 ? 'bg-green-300/70' : percentageDifference <= 10.0 ? 'bg-yellow-300' : 'bg-red-400'}`}>
			{#if percentageDifference <= 0.01}
				EXACT
				<MaterialSymbolsKidStar class="mix-blend-screen text-white"/>
			{:else}	
				{parseFloat(percentageDifference.toPrecision(3))}%
			{/if}
		</div>
	</div>
	<p class="opacity-70 whitespace-pre-wrap">
		<span class="whitespace-pre">E-{selectedCombination.eSeries}  •&nbsp; </span>
	    {#if !isCombinationVoltageDivider(selectedCombination)}
			<span class="whitespace-pre">{numComponents} COMPONENT{numComponents > 1 ? 'S' : ''}</span>
		{:else}
			<span class="whitespace-pre">{numComponents} COMPONENT{numComponents > 1 ? 'S' : ''}  •&nbsp; </span>
	        <span class="whitespace-pre">{formatSiValue(selectedCombination.outputImpedance, false)} Output Impedance  •&nbsp; </span>
	        <span class="whitespace-pre">{formatSiValue(selectedCombination.totalImpedance, false)} Total Impedance  •&nbsp; </span>
	        <span class="whitespace-pre">{formatSiValue(selectedCombination.current, false, 'A')} Bleed Current  •&nbsp; </span>
		{/if}
	</p>
	{#if !isCombinationVoltageDivider(selectedCombination)}
		<div class="w-full max-w-[400px] mx-auto mt-3">
			{#if selectedCombination.type === 'single'}
				<SingleResistor r1={selectedCombination.result} />
			{:else if selectedCombination.type === 'series'}
				<SeriesResistor r1={selectedCombination.v1} r2={selectedCombination.v2}/>
			{:else if selectedCombination.type === 'parallel'}
				<ParallelResistor r1={selectedCombination.v1} r2={selectedCombination.v2}/>
			{:else if selectedCombination.type === "r+r+r"}
				<Series3 r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
			{:else if selectedCombination.type === "r||r||r"}
				<Parallel3 r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
			{:else if selectedCombination.type === "(r+r)||r"}
				<SeriesTwoParallelOne r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
			{:else if selectedCombination.type === "(r||r)+r"}
				<Parallel2Series1 r1={selectedCombination.v1} r2={selectedCombination.v2} r3={selectedCombination.v3}/>
			{/if}
		</div>
	{:else}
		<div class="w-full max-w-[300px] mx-auto mt-3">
			<VoltageDivider vin={selectedCombination.vin} vout={selectedCombination.vout} r1={selectedCombination.top.v1} r2={selectedCombination.bottom.v1}/>
		</div>
	{/if}
</div>