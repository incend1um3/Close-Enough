<script lang="ts">
	import Gnd from "$lib/circuit/Gnd.svelte";
	import Junction from "$lib/circuit/Junction.svelte";
	import { node, pins, type Part } from "$lib/circuit/pins";
	import Pwr from "$lib/circuit/Pwr.svelte";
	import Resistor from "$lib/circuit/Resistor.svelte";
	import Wire from "$lib/circuit/Wire.svelte";
	import { formatSiValue } from "$lib/format-si";

	let {
		vin,
		vout,
		r1,
		r2,
	}: {
		r1: number,
		r2: number,
		vin: number,
		vout: number
	} = $props()

	const R1: Part = { x: 60, y: 150, orientation: 'vertical', length: 160 };
	const R2: Part = { x: 60, y: 300, orientation: 'vertical', length: 160 };

	const mid = node(R1.x!, (pins(R1).b.y + pins(R2).a.y) / 2)
</script>

<svg viewBox="0 0 300 440" style="color:#1a1a1a;" class="bg-bg-200 w-full h-auto">
	<Pwr at={pins(R1).a} name={formatSiValue(vin, true, 'V')}/>

	<Resistor {...R1} name="R1" value={formatSiValue(r1)} />
	<Resistor {...R2} name="R2" value={formatSiValue(r2)} />

	<Gnd at={pins(R2).b}/>

	<Wire from={mid} to={node(mid.x + 200, mid.y)} />
	<Junction at={mid}/>

	<text x={mid.x + 200 - 50} y={mid.y - 8}>{formatSiValue(vout, true, 'V').replace(' ', '')}</text>
</svg>