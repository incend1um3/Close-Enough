<script lang="ts">
	import { ESERIES_LIST, type E24Subset, type E96Subset, type ESeries } from "$lib/calculator/eseries";
	import type { VoltageDividerComputeRequest } from "$lib/calculator/workers/solver";
	import { parseValue } from "$lib/parse-value";
	import { e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import { get } from "svelte/store";

	let {
		computeReq: req = $bindable(),
		...rest
	}: { 
		computeReq: VoltageDividerComputeRequest
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
	let vInParsed = $derived(parseValue(inputs[Input.Vin]));
	let vOutParsed = $derived(parseValue(inputs[Input.Vout]));
	let maxOutputImpedanceParsed = $derived(parseValue(inputs[Input.MaxOutputImpedance]));
	let minImpedanceParsed = $derived(parseValue(inputs[Input.MinImpedance]));
	let maxImpedanceParsed = $derived(parseValue(inputs[Input.MaxImpedance]));
	let minCurrentParsed = $derived(parseValue(inputs[Input.MinCurrent]));
	let maxCurrentParsed = $derived(parseValue(inputs[Input.MaxCurrent]));

	$effect(() => {
		if (vInParsed.isOk) {
			req.vin = vInParsed.value.value;
		}
		if (vOutParsed.isOk) {
			req.vout = vOutParsed.value.value;
		}
		if (maxOutputImpedanceParsed.isOk) {
			req.maxOutputImpedance = maxOutputImpedanceParsed.value.value;
		}
		if (minImpedanceParsed.isOk && maxImpedanceParsed.isOk && constraintType === 'impedance') {
			req.constraint = {
				type: 'impedance',
				min: minImpedanceParsed.value.value,
				max: maxImpedanceParsed.value.value
			}
		}
		if (minCurrentParsed.isOk && maxCurrentParsed.isOk && constraintType === 'current') {
			req.constraint = {
				type: 'current',
				min: minCurrentParsed.value.value,
				max: maxCurrentParsed.value.value
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
	<p hidden={vInParsed.isOk && vOutParsed.isOk} class="text-rose-500">Failed to parse</p>
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

	<p>E-SERIES</p>
	<div class="flex gap-4 mb-6">
		{#each ESERIES_LIST as value}
			<button
				data-selected={req.e24Subset === value || req.e96Subset === value || (value === 192 && req.useE192)}
				class="border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 
				w-13 h-10 font-semibold flex items-center justify-center rounded-sm"
				onclick={() => {
					if (value <= 24) {
						req.e24Subset = req.e24Subset === value ? null : value as E24Subset;
					} else if (value <= 96) {
						req.e96Subset = req.e96Subset === value ? null : value as E96Subset;
					} else {
						req.useE192 = !req.useE192;
					}
				}}
			>
				E{value}
			</button>

			{#if value === 24 || value === 96}
				<span class="rounded-lg border border-gray-200 mx-2"></span>
			{/if}
		{/each}
	</div>

	<p>CUSTOM VALUES</p>
	<textarea class="mb-6"></textarea>

	<div class="w-full flex justify-between opacity-50">
		<p>Library size</p>
		<p>{libSize} values</p>
	</div>
</div>