<script lang="ts">
	import type { VoltageDividerComputeRequest } from "$lib/calculator/workers/solver";
	import { parseValue, type ParsedValue } from "$lib/parse-value";
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
	    PinnedR1:				7,
	    PinnedR2:				8,
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
	    [Input.PinnedR1]:   		String(req.pinnedR1 ?? ""),
	    [Input.PinnedR2]:   		String((req as any).pinnedR2 ?? ""),
	});

	const ensureNonNegative = (v: number) => v >= 0 ? ok(v) : err("Value cannot be negative!");
	const ensureGt0 = (v: number) => v > 0 ? ok(v) : err("Value must be greater than zero!");
	const ensureUnitVolts = (v: ParsedValue) => v.unit === "volt" ? ok(v) : err("Invalid unit");
	const ensureUnitOhms = (v: ParsedValue) => v.unit === "ohm" ? ok(v) : err("Invalid unit");
	const ensureUnitAmps = (v: ParsedValue) => v.unit === "amp" ? ok(v) : err("Invalid unit");
	
	let constraintType: 'impedance' | 'current' = $state(req.constraint.type);
	
	let vInParsed = $derived(
		parseValue(inputs[Input.Vin], "volt")
			.andThen(ensureUnitVolts)
			.map(v => v.value)
			.andThen(ensureGt0)
	);

	let vOutParsed = $derived(
		parseValue(inputs[Input.Vout], "volt")
		.andThen(ensureUnitVolts)
		.map(v => v.value)
		.andThen(ensureGt0)
	);

	let maxOutputImpedanceParsed = $derived(
		!inputs[Input.MaxOutputImpedance].trim()
		? ok(Infinity)
		: parseValue(inputs[Input.MaxOutputImpedance], "ohm")
			.andThen(ensureUnitOhms)
			.map(v => v.value)
			.andThen(ensureGt0)
	);

	let minImpedanceParsed = $derived(
		!inputs[Input.MinImpedance].trim()
		? ok(0)
		: parseValue(inputs[Input.MinImpedance], "ohm")
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
			.andThen(ensureGt0));

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
			.andThen(ensureGt0)
	);

	let pinnedR1Parsed = $derived(
		!inputs[Input.PinnedR1].trim()
		? ok(null)
		: parseValue(inputs[Input.PinnedR1], "ohm")
			.andThen(ensureUnitOhms)
			.map(v => v.value)
			.andThen(ensureGt0)
	);

	let pinnedR2Parsed = $derived(
		!inputs[Input.PinnedR2].trim()
		? ok(null)
		: parseValue(inputs[Input.PinnedR2], "ohm")
			.andThen(ensureUnitOhms)
			.map(v => v.value)
			.andThen(ensureGt0)
	);

	let voutGreaterThanVin = $derived(
		vInParsed.isOk && vOutParsed.isOk && vOutParsed.value >= vInParsed.value
	);
	let minImpedanceOrCurrentGreaterThanMax = $derived(
		constraintType === 'impedance'
		? minImpedanceParsed.isOk && maxImpedanceParsed.isOk && minImpedanceParsed.value >= maxImpedanceParsed.value
		: minCurrentParsed.isOk && maxCurrentParsed.isOk && minCurrentParsed.value >= maxCurrentParsed.value
	);
	let pinnedR1EqPinnedR2 = $derived(
		pinnedR1Parsed.isOk && pinnedR2Parsed.isOk && pinnedR1Parsed.value === pinnedR2Parsed.value
	);

	$effect(() => {
		error = !(
			vInParsed.isOk && vOutParsed.isOk && !voutGreaterThanVin &&
			maxOutputImpedanceParsed.isOk &&
			(req.e24Subset || req.e96Subset || req.useE192) &&
			(constraintType === 'impedance' 
				? (minImpedanceParsed.isOk && maxImpedanceParsed.isOk) 
				: (minCurrentParsed.isOk && maxCurrentParsed.isOk)) &&
			!minImpedanceOrCurrentGreaterThanMax &&
			pinnedR1Parsed.isOk && ((pinnedR2Parsed.isOk && !pinnedR1EqPinnedR2) || req.n === 2)
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
		if (pinnedR1Parsed.isOk) {
			req.pinnedR1 = pinnedR1Parsed.value;
		}
		if (pinnedR2Parsed.isOk && req.n === 3) {
			req.pinnedR2 = pinnedR2Parsed.value;
		}
	});
</script>

{#snippet inputBox(label: string, input: Input, symbol: string, disabled: boolean = false)}
	<div class="flex flex-col flex-1 {disabled ? "opacity-30 cursor-not-allowed pointer-events-none" : ''}">
		<p>{label}</p>
		<div class="flex gap-4 items-stretch border border-gray-300">
			<input
				type="text"
				disabled={disabled}
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
	<p class="text-rose-500 mb-4">
		{#if !vInParsed.isOk || !vOutParsed.isOk}
			Failed to parse: {vInParsed.isErr ? vInParsed.error : (vOutParsed as any).error}
		{:else if voutGreaterThanVin}
			Vin must be greater than Vout
		{/if}
	</p>

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
	
	<p class="mt-4">
		Pinned Values
		<InfoTooltip>
			<p class="mb-2">This allows you to generate combinations where the specified values will always be included.</p>
		</InfoTooltip>
	</p>
	<div class="flex gap-4 sm:gap-8">
		{@render inputBox("R1", Input.PinnedR1, 'Ω')}
		{@render inputBox("R2", Input.PinnedR2, 'Ω', req.n !== 3)}
	</div>
	<p class="text-rose-500">
		{#if pinnedR1Parsed.isErr || (pinnedR2Parsed.isErr && req.n < 3)}
			Failed to parse: {pinnedR1Parsed.isErr ? pinnedR1Parsed.error : (pinnedR2Parsed as any).error}
		{:else if req.n === 3 && pinnedR1EqPinnedR2}
			R₁ must not be equal to R₂
		{/if}
	</p>

	<p class="mt-4">MAX NUMBER OF COMPONENTS</p>
	<div class="flex gap-4">
		{#each [2, 3] as i}
			<button
				data-selected={req.n === i}
				class="border border-gray-300 data-[selected=true]:border-amber-500 data-[selected=true]:bg-amber-500 
				w-12 h-12 font-bold flex items-center justify-center rounded-sm text-xl" 
				onclick={() => req.n = i as any}
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
</div>