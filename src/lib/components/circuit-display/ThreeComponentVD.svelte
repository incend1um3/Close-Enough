<script lang="ts">
	import type { VoltageDividerCombination } from "$lib/calculator/workers/solver";
	import Gnd from "$lib/circuit/Gnd.svelte";
	import Junction from "$lib/circuit/Junction.svelte";
	import { node, pins, type Part } from "$lib/circuit/pins";
	import Pwr from "$lib/circuit/Pwr.svelte";
	import Resistor from "$lib/circuit/Resistor.svelte";
	import Wire from "$lib/circuit/Wire.svelte";
	import { formatSiValue } from "$lib/format-si";
	import { isCombinationVoltageDivider } from "$lib/util";

	let {
		combination,
	}: {
		combination: VoltageDividerCombination,
	} = $props()

	let vd3ComponentConfig = $derived.by(() => {
		if (combination.top.type !== "single" || combination.bottom.type !== "single") {
			const t = combination.top, b = combination.bottom;
			if (t.type === 'series') {
				return { config: 'top-series', r1: t.v1, r2: t.v2, r3: b.v1 };
			} else if (t.type === 'parallel') {
				return { config: 'top-parallel', r1: t.v1, r2: t.v2, r3: b.v1 };
			} else if (b.type === 'series') {
				return { config: 'bottom-series', r1: t.v1, r2: b.v1, r3: b.v2 };
			} else {
				return { config: 'bottom-parallel', r1: t.v1, r2: b.v1, r3: (b as any).v2 };
			}
		}
	});

	const { config, r1, r2, r3 } = $derived(vd3ComponentConfig!);
	const vin = $derived(combination.vin);
	const vout = $derived(combination.vout);

	const svgH = $derived((combination.top.type === 'parallel' || combination.bottom.type === 'parallel') ? 440 : 580);

	const armLen = 160;
	const xL = 40;
	const xR = 150;
	const xC = (xL + xR)/2;
	const labelXOffset = 190;
</script>

<svg viewBox="0 0 300 {svgH}" style="color:#1a1a1a;" class="bg-bg-200 w-full h-auto">
	{#if config === 'top-series'}
		{@const R1: Part = { x: xC, y: 150, orientation: 'vertical', length: armLen }}
		{@const R2: Part = { x: xC, y: 280, orientation: 'vertical', length: armLen }}
		{@const R3: Part = { x: xC, y: 440, orientation: 'vertical', length: armLen }}
		{@const pwr = node(xC, pins(R1).a.y)}
		{@const gnd = node(xC, 520)}
		{@const tap = node(xC, 360)}
		{@const tapLabel = node(xC + labelXOffset, 360)}

		<Pwr at={pwr} name={formatSiValue(vin, true, 'V')}/>
		<Resistor {...R1} name="R1" value={formatSiValue(r1)} />
		<Resistor {...R2} name="R2" value={formatSiValue(r2)} />
		<Resistor {...R3} name="R3" value={formatSiValue(r3)} />
		<Gnd at={gnd}/>

		<Wire from={tap} to={tapLabel} />
		<Junction at={tap}/>

		<text x={tapLabel.x - 50} y={tapLabel.y - 8}>{formatSiValue(vout, true, 'V')}</text>

	{:else if config === 'top-parallel'}
		{@const R1: Part = { x: xL, y: 150, orientation: 'vertical', length: armLen }}
		{@const R2: Part = { x: xR, y: 150, orientation: 'vertical', length: armLen }}
		{@const R3: Part = { x: xC, y: 310, orientation: 'vertical', length: armLen }}
		{@const pwr = node(xC, pins(R1).a.y)}
		{@const gnd = node(xC, pins(R3).b.y)}
		{@const tap = node(xC, pins(R1).b.y)}
		{@const tapLabel = node(xC + labelXOffset, pins(R3).a.y)}

		<Pwr at={pwr} name={formatSiValue(vin, true, 'V')}/>
		<Resistor {...R1} name="R1" value={formatSiValue(r1)} />
		<Resistor {...R2} name="R2" value={formatSiValue(r2)} />
		<Resistor {...R3} name="R3" value={formatSiValue(r3)} />
		<Gnd at={gnd}/>

		<Wire from={pwr} to={pins(R1).a} />
		<Wire from={pwr} to={pins(R2).a} />
		<Wire from={pins(R1).b} to={tap} />
		<Wire from={pins(R2).b} to={tap} />
		<Wire from={tap} to={tapLabel} />
		<Junction at={pwr}/>
		<Junction at={tap}/>
		<Junction at={pins(R2).b}/>

		<text x={tapLabel.x - 50} y={tapLabel.y - 8}>{formatSiValue(vout, true, 'V')}</text>

	{:else if config === 'bottom-series'}
		{@const R1: Part = { x: xC, y: 150, orientation: 'vertical', length: armLen }}
		{@const R2: Part = { x: xC, y: 310, orientation: 'vertical', length: armLen }}
		{@const R3: Part = { x: xC, y: 450, orientation: 'vertical', length: armLen }}
		{@const pwr = node(xC, pins(R1).a.y)}
		{@const gnd = node(xC, pins(R3).b.y)}
		{@const tap = node(xC, pins(R1).b.y)}
		{@const tapLabel = node(xC + labelXOffset, tap.y)}

		<Pwr at={pwr} name={formatSiValue(vin, true, 'V')}/>
		<Resistor {...R1} name="R1" value={formatSiValue(r1)} />
		<Resistor {...R2} name="R2" value={formatSiValue(r2)} />
		<Resistor {...R3} name="R3" value={formatSiValue(r3)} />
		<Gnd at={gnd}/>

		<Wire from={tap} to={tapLabel} />
		<Junction at={tap}/>

		<text x={tapLabel.x - 50} y={tapLabel.y - 8}>{formatSiValue(vout, true, 'V')}</text>

	{:else if config === 'bottom-parallel'}
		{@const R1: Part = { x: xC, y: 150, orientation: 'vertical', length: armLen }}
		{@const R2: Part = { x: xL, y: 310, orientation: 'vertical', length: armLen }}
		{@const R3: Part = { x: xR, y: 310, orientation: 'vertical', length: armLen }}
		{@const pwr = node(xC, pins(R1).a.y)}
		{@const gnd = node(xC, pins(R2).b.y)}
		{@const tap = node(xC, pins(R1).b.y)}
		{@const tapLabel = node(xC + labelXOffset, pins(R3).a.y)}

		<Pwr at={pwr} name={formatSiValue(vin, true, 'V')}/>
		<Resistor {...R1} name="R1" value={formatSiValue(r1)} />
		<Resistor {...R2} name="R2" value={formatSiValue(r2)} />
		<Resistor {...R3} name="R3" value={formatSiValue(r3)} />
		<Gnd at={gnd}/>

		<Wire from={tap} to={pins(R2).a} />
		<Wire from={tap} to={pins(R3).a} />
		<Wire from={pins(R2).b} to={gnd} />
		<Wire from={pins(R3).b} to={gnd} />
		<Wire from={tap} to={tapLabel} />
		<Junction at={pins(R3).a}/>
		<Junction at={tap}/>
		<Junction at={gnd}/>

		<text x={tapLabel.x - 50} y={tapLabel.y - 8}>{formatSiValue(vout, true, 'V')}</text>
	{/if}
</svg>