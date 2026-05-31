<script lang="ts">
	import { pins, type Part } from "$lib/circuit/pins";
	import Resistor from "$lib/circuit/Resistor.svelte";
	import Wire from "$lib/circuit/Wire.svelte";
	import { formatSiValue } from "$lib/format-si";

	let {
		r1,
		r2,
	}: {
		r1: number,
		r2: number
	} = $props()

	const R1: Part = { x: 100, y: 80, orientation: 'horizontal', length: 200 };
	const R2: Part = { x: 280, y: 80, orientation: 'horizontal', length: 200 };
</script>

<svg viewBox="0 0 380 140" width="380" height="140" style="color:#1a1a1a;" class="bg-bg-200 p-2">
	<Resistor {...R1} name="R1" value={formatSiValue(r1).replace(' ', '')} />
	<Resistor {...R2} name="R2" value={formatSiValue(r2).replace(' ', '')} />

	<Wire from={pins(R1).b} to={pins(R2).a} />
</svg>