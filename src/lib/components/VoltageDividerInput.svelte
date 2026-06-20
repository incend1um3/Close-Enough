<script lang="ts">
	import type { VoltageDividerComputeRequest } from "$lib/calculator/workers/solver";
	import { parseValue, type ParsedValue } from "$lib/parse-value";
	import { e192CacheStore, e24CacheStore, e96CacheStore } from "$lib/stores/cache";
	import ESeriesSelector from "./ESeriesSelector.svelte";
	import { err, ok } from "true-myth/result";
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

	const ensureNonNegative = (v: number) => v >= 0 ? ok(v) : err("Value cannot be negative!");
	const ensureUnitVolts = (v: ParsedValue) => v.unit === "volt" ? ok(v) : err("Invalid unit");
	const ensureUnitOhms = (v: ParsedValue) => v.unit === "ohm" ? ok(v) : err("Invalid unit");
	const ensureUnitAmps = (v: ParsedValue) => v.unit === "amp" ? ok(v) : err("Invalid unit");
	
	let constraintType: 'impedance' | 'current' = $state(req.constraint.type);
	
	let vInParsed = $derived(
		parseValue(inputs[Input.Vin], "volt")
		.andThen(ensureUnitVolts)
		.map(v => v.value)
		.andThen(ensureNonNegative)
	);

	let vOutParsed = $derived(
		parseValue(inputs[Input.Vout], "volt")
		.andThen(ensureUnitVolts)
		.map(v => v.value)
		.andThen(ensureNonNegative)
	);

	let maxOutputImpedanceParsed = $derived(
		!inputs[Input.MaxOutputImpedance].trim()
		? ok(Infinity)
		: parseValue(inputs[Input.MaxOutputImpedance], "ohm")
			.andThen(ensureUnitOhms)
			.map(v => v.value)
			.andThen(ensureNonNegative)
	);

	let minImpedanceParsed = $derived(
		parseValue(inputs[Input.MinImpedance], "ohm")
		.andThen(ensureUnitOhms)
		.map(v => v.value)
		.andThen(ensureNonNegative)
	);

	let maxImpedanceParsed = $derived(
		!inputs[Input.MaxImpedance].trim() 
		? ok(Infinity) 
		: parseValue(inputs[Input.MaxImpedance], "ohm")
			.andThen(ensureUnitOhms)
			.map(v => v.value)
			.andThen(ensureNonNegative));

	let minCurrentParsed = $derived(
		!inputs[Input.MinCurrent].trim() 
		? ok(0) 
		: parseValue(inputs[Input.MinCurrent], "amp")
			.andThen(ensureUnitAmps)
			.map(v => v.value)
			.andThen(ensureNonNegative));

	let maxCurrentParsed = $derived(
		parseValue(inputs[Input.MaxCurrent], "amp")
		.andThen(ensureUnitAmps)
		.map(v => v.value)
		.andThen(ensureNonNegative)
	);

	let voutGreaterThanVin = $derived(
		vInParsed.isOk && vOutParsed.isOk && vOutParsed.value >= vInParsed.value
	);
	let minImpedanceOrCurrentGreaterThanMax = $derived(
		constraintType === 'impedance'
		? minImpedanceParsed.isOk && maxImpedanceParsed.isOk && minImpedanceParsed.value >= maxImpedanceParsed.value
		: minCurrentParsed.isOk && maxCurrentParsed.isOk && minCurrentParsed.value >= maxCurrentParsed.value
	);

	$effect(() => {
		error = !(
			vInParsed.isOk && vOutParsed.isOk && !voutGreaterThanVin &&
			maxOutputImpedanceParsed.isOk &&
			(req.e24Subset || req.e96Subset || req.useE192) &&
			(constraintType === 'impedance' 
				? (minImpedanceParsed.isOk && maxImpedanceParsed.isOk) 
				: (minCurrentParsed.isOk && maxCurrentParsed.isOk)) &&
			!minImpedanceOrCurrentGreaterThanMax
		);
	});

	$effect(() => {
		if (vInParsed.isOk && vOutParsed.isOk && !voutGreaterThanVin) {
			req.vin = vInParsed.value;
			req.vout = vOutParsed.value;
		}
		if (maxOutputImpedanceParsed.isOk) {
			req.maxOutputImpedance = maxOutputImpedanceParsed.value;
		}
		if (minImpedanceParsed.isOk && maxImpedanceParsed.isOk && constraintType === 'impedance') {
			req.constraint.type = 'impedance';
			req.constraint.min = minImpedanceParsed.value;
			req.constraint.max = maxImpedanceParsed.value;
		}
		if (minCurrentParsed.isOk && maxCurrentParsed.isOk && constraintType === 'current') {
			req.constraint.type = 'current';
			req.constraint.min = minCurrentParsed.value;
			req.constraint.max = maxCurrentParsed.value;
		}
	});

	let libSize = $derived(
		($e24CacheStore?.sortedSeriesIndices.length || 0) +
		($e96CacheStore?.sortedSeriesIndices.length || 0) +
		($e192CacheStore?.sortedSeriesIndices.length || 0)
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
			<div class="p-2 border-l border-gray-300 aspect-square text-center items-center text-2xl font-bold">
				{symbol}
			</div>
		</div>
	</div>
{/snippet}

<div class="p-4 sm:p-8 border border-gray-300 shadow-sm bg-amber-50 self-start {rest.class}">
	<div class="flex gap-4 sm:gap-8">
		{@render inputBox("Vin", Input.Vin, 'V')}
		{@render inputBox("Vout", Input.Vout, 'V')}
	</div>
	<p class="text-rose-500">
		{#if !vInParsed.isOk || !vOutParsed.isOk}
			Failed to parse: {vInParsed.isErr ? vInParsed.error : (vOutParsed as any).error}
		{:else if voutGreaterThanVin}
			Vin must be greater than Vout
		{/if}
	</p>
	<p class="mb-4 opacity-50">Type with prefix: 3.3k, 4k7</p>

	{@render inputBox("Max Output Impedance", Input.MaxOutputImpedance, 'Ω')}
	<p class="text-rose-500">
		{#if !maxOutputImpedanceParsed.isOk}
			Failed to parse: {maxOutputImpedanceParsed.error}
		{/if}
	</p>
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

	<div class="flex gap-4 sm:gap-8 mt-2">
		{#if constraintType === "impedance"}
			{@render inputBox("Min Impedance", Input.MinImpedance, 'Ω')}
			{@render inputBox("Max Impedance", Input.MaxImpedance, 'Ω')}
		{:else}
			{@render inputBox("Min Current", Input.MinCurrent, 'A')}
			{@render inputBox("Max Current", Input.MaxCurrent, 'A')}
		{/if}
	</div>
	<p class="text-rose-500">
		{#if (constraintType === "impedance" && !(minImpedanceParsed.isOk && maxImpedanceParsed.isOk)) || (constraintType === "current" && !(minCurrentParsed.isOk && maxCurrentParsed.isOk))}
			Failed to parse
		{:else if minImpedanceOrCurrentGreaterThanMax}
			Maximum value must be greater than minimum!
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
	<textarea class="bg-bg-200 border border-gray-300 cursor-not-allowed" placeholder="Not yet implemented." disabled></textarea>
	<p class="opacity-50 text-right">0/1000</p>

	<div class="w-full flex justify-between opacity-50 mt-6">
		<p>Library size</p>
		<p>{libSize} values</p>
	</div>
</div>