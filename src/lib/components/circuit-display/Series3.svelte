<script lang="ts">
	import { pins, type Part } from "$lib/circuit/pins";
	import Resistor from "$lib/circuit/Resistor.svelte";
	import Wire from "$lib/circuit/Wire.svelte";
	import { formatSiValue } from "$lib/format-si";

	let {
		r1,
		r2,
		r3,
	}: {
		r1: number,
		r2: number,
		r3: number,
	} = $props()

	const R1: Part = { x: 110, y: 80, orientation: 'horizontal', length: 200 };
	const R2: Part = { x: 250, y: 80, orientation: 'horizontal', length: 200 };
	const R3: Part = { x: 390, y: 80, orientation: 'horizontal', length: 200 };
</script>

<svg viewBox="0 0 510 140" style="color:#1a1a1a;" class="bg-bg-200 w-full h-auto">
	<Resistor {...R1} name="R1" value={formatSiValue(r1).replace(' ', '')} />
	<Resistor {...R2} name="R2" value={formatSiValue(r2).replace(' ', '')} />
	<Resistor {...R3} name="R3" value={formatSiValue(r3).replace(' ', '')} />

	<Wire from={{ x: 0, y: R1.y! }} to={pins(R1).a} />
	<Wire from={pins(R3).b} to={{ x: pins(R3).b.x + 200, y: pins(R3).b.y}} />
</svg>