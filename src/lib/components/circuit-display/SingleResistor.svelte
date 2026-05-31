<script lang="ts">
	import { pins, type Part } from "$lib/circuit/pins";
	import Resistor from "$lib/circuit/Resistor.svelte";
	import { formatSiValue } from "$lib/format-si";

	let {
		r1,
	}: {
		r1: number,
	} = $props()

	const R1: Part = { x:150, y: 40, orientation: 'horizontal', length: 250 };
</script>

<svg viewBox="0 0 300 100" width="300" height="100" style="color:#1a1a1a;" class="bg-white">
	<!-- components -->
	<Resistor {...R1} name="R1" value={formatSiValue(r1).replace(' ', '')} />
</svg>