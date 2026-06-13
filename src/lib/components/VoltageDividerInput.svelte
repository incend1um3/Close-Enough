<script lang="ts">
	import type { VoltageDividerComputeRequest } from "$lib/calculator/workers/solver";
	import { parseValue } from "$lib/parse-value";
	import { e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import { get } from "svelte/store";
	import ESeriesSelector from "./ESeriesSelector.svelte";
	import { ok } from "true-myth/result";
	import InfoTooltip from "./InfoTooltip.svelte";

	let {
		computeReq: req = $bindable(),
		error = $bindable(),
		...rest
	}: { 
		computeReq: VoltageDividerComputeRequest,
		error: boolean,
		class?: string,
	} = $props();

	const Input = {
	    Vin:			 		0,
	    Vout:			 		1,
	    MaxOutputImpedance:		2,
	    MinImpedance:			3,
	    MaxImpedance:			4,
		MinCurrent:				5,
	    MaxCurrent:				6,
	} as const;
	type Input = typeof Input[keyof typeof Input];

	let inputs = $state<Record<Input, string>>({ 
	    [Input.Vin]:                String(req.vin ?? ""), 
	    [Input.Vout]:               String(req.vout ?? ""),
	    [Input.MaxOutputImpedance]: String(req.maxOutputImpedance ?? ""),
	    [Input.MinImpedance]: 		req.constraint.type === "impedance" ? String(req.constraint.min) : "",
	    [Input.MaxImpedance]: 		req.constraint.type === "impedance" ? String(req.constraint.max) : "",
	    [Input.MinCurrent]:   		req.constraint.type === "current"   ? String(req.constraint.min) : "",
	    [Input.MaxCurrent]:   		req.constraint.type === "current"   ? String(req.constraint.max) : "",
	});

	let constraintType: 'impedance' | 'current' = $state('current');
	let vInParsed = $derived(parseValue(inputs[Input.Vin]).map(v => v.value));
	let vOutParsed = $derived(parseValue(inputs[Input.Vout]).map(v => v.value));
	let maxOutputImpedanceParsed = $derived(parseValue(inputs[Input.MaxOutputImpedance]).map(v => v.value));
	let minImpedanceParsed = $derived(parseValue(inputs[Input.MinImpedance]).map(v => v.value));
	let maxImpedanceParsed = $derived(!inputs[Input.MaxImpedance].trim() ? ok(Infinity) : parseValue(inputs[Input.MaxImpedance]).map(v => v.value));
	let minCurrentParsed = $derived(!inputs[Input.MinCurrent].trim() ? ok(0) : parseValue(inputs[Input.MinCurrent]).map(v => v.value));
	let maxCurrentParsed = $derived(parseValue(inputs[Input.MaxCurrent]).map(v => v.value));

	let voutGreaterThanVin = $derived(
		vInParsed.isOk && vOutParsed.isOk && vOutParsed.value >= vInParsed.value
	);

	$effect(() => {
		error = !(
			vInParsed.isOk && vOutParsed.isOk && !voutGreaterThanVin &&
			maxOutputImpedanceParsed.isOk &&
			(constraintType === 'impedance' 
				? (minImpedanceParsed.isOk && maxImpedanceParsed.isOk) 
				: (minCurrentParsed.isOk && maxCurrentParsed.isOk))
		);
	})

	$effect(() => {
		if (vInParsed.isOk && vOutParsed.isOk && !voutGreaterThanVin) {
			req.vin = vInParsed.value;
			req.vout = vOutParsed.value;
		}
		if (maxOutputImpedanceParsed.isOk) {
			req.maxOutputImpedance = maxOutputImpedanceParsed.value;
		}
		if (minImpedanceParsed.isOk && maxImpedanceParsed.isOk && constraintType === 'impedance') {
			req.constraint = {
				type: 'impedance',
				min: minImpedanceParsed.value,
				max: maxImpedanceParsed.value
			}
		}
		if (minCurrentParsed.isOk && maxCurrentParsed.isOk && constraintType === 'current') {
			req.constraint = {
				type: 'current',
				min: minCurrentParsed.value,
				max: maxCurrentParsed.value
			}
		}
	});

	let libSize = $derived(
		(get(e24CacheStore)?.sortedSeriesIndices.length || 0) +
		(get(e96CacheStore)?.sortedSeriesIndices.length || 0) +
		(get(e192CacheStore)?.sortedSeriesIndices.length || 0)
	);
</script>

{#snippet inputBox(label: string, input: Input, symbol: string)}
	<div class="flex flex-col flex-1">
		<p>{label}</p>
		<div class="flex gap-4 items-stretch border border-gray-300">
			<input
				type="text"
				bind:value={inputs[input]}
				class="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-2xl tracking-wide"
			>
			<div class="p-3 border-l border-gray-300 aspect-square text-center items-center text-2xl font-bold">
				{symbol}
			</div>
		</div>
	</div>
{/snippet}

<div class="p-8 border border-gray-300 shadow-sm bg-amber-50 self-start {rest.class}">
	<div class="flex gap-8">
		{@render inputBox("Vin", Input.Vin, 'V')}
		{@render inputBox("Vout", Input.Vout, 'V')}
	</div>
	<p class="text-rose-500">
		{#if !vInParsed.isOk || !vOutParsed.isOk}
			Failed to parse
		{:else if voutGreaterThanVin}
			Vin must be greater than Vout
		{/if}
	</p>
	<p class="mb-6 opacity-50">Type with prefix: 3.3k, 4k7</p>

	{@render inputBox("Max Output Impedance", Input.MaxOutputImpedance, 'Ω')}

	<div class="mt-4 flex gap-4 items-center">
		<p>CONSTRAINT TYPE:</p>
		<div class="flex relative w-fit
			before:absolute before:top-0 before:left-0 before:bg-amber-200 before:w-[50%] before:h-full before:transition-transform
			before:duration-150 before:ease-in-out before:rounded-full before:drop-shadow-sm {constraintType === 'current' && "before:translate-x-full"}"
		>
			<button class="z-10 py-1 px-4 w-28" onclick={() => constraintType = 'impedance'}>IMPEDANCE</button>
			<button class="z-10 py-1 px-4 w-28" onclick={() => constraintType = 'current'}>CURRENT</button>
		</div>
	</div>

	<div class="flex gap-8 mt-2">
		{#if constraintType === "impedance"}
			{@render inputBox("Min Impedance", Input.MinImpedance, 'Ω')}
			{@render inputBox("Max Impedance", Input.MaxImpedance, 'Ω')}
		{:else}
			{@render inputBox("Min Current", Input.MinCurrent, 'A')}
			{@render inputBox("Max Current", Input.MaxCurrent, 'A')}
		{/if}
	</div>
	<p class="text-rose-500">
		{#if (constraintType === "impedance" && !(minImpedanceParsed.isOk && minImpedanceParsed.isOk)) || (constraintType === "current" && !(minCurrentParsed.isOk && maxCurrentParsed.isOk))}
			Failed to parse
		{/if}
	</p>

	<p class="mt-4">MAX NUMBER OF COMPONENTS</p>
	<div class="flex gap-4">
		{#each [2, 3] as i}
			<button
				data-selected={req.n === i}
				class="border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 
				w-12 h-12 font-bold flex items-center justify-center rounded-sm text-xl" 
				onclick={() => req.n = i}
			>
				{i}
			</button>
		{/each}
	</div>
	<p class="opacity-50 mb-6">Higher value = more search time</p>

	
	<p>
		E-SERIES 
		<InfoTooltip>
			<p class="mb-2">Each combination is generated from one E-series only.</p>
			<p>For example, a combination may contain E24 + E24, but never something like E24 + E48</p>
		</InfoTooltip>
	</p>
	<ESeriesSelector bind:e24Subset={req.e24Subset} bind:e96Subset={req.e96Subset} bind:useE192={req.useE192}/>

	<p class="mt-4">CUSTOM VALUES</p>
	<textarea class="bg-bg-200 border border-gray-300"></textarea>
	<p class="opacity-50 text-right">0/10000</p>

	<div class="w-full flex justify-between opacity-50 mt-6">
		<p>Library size</p>
		<p>{libSize} values</p>
	</div>
</div>