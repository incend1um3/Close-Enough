<script lang="ts">
	import Junction from "$lib/circuit/Junction.svelte";
	import { node, pins, type Part } from "$lib/circuit/pins";
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
	
	const R1: Part = { x: 200,  y: 60,  orientation: 'horizontal', length: 200 }; // horizontal
	const R2: Part = { x: 200,  y: 180, orientation: 'horizontal', length: 200 }; // vertical

	const L1 = pins(R1).a;
	const L2 = pins(R2).a;
	const B1 = pins(R1).b;
	const B2 = pins(R2).b;
 
	const midL = node(L1.x, (L1.y + L2.y) / 2);
	const midR = node(B1.x, (B1.y + B2.y) / 2);
</script>

<svg viewBox="0 0 380 230" style="color:#1a1a1a;" class="bg-bg-200 w-full h-auto">
  	<Resistor {...R1} name="R1" value={formatSiValue(r1).replace(' ', '')} />
  	<Resistor {...R2} name="R2" value={formatSiValue(r2).replace(' ', '')} />

  	<Wire from={pins(R1).a} to={pins(R2).a} />
  	<Wire from={pins(R1).b} to={pins(R2).b} />
	<Wire from={{ x: 0, y: midL.y }} to={midL}/>
	<Wire from={midR} to={{ x: midR.x + 200, y: midL.y}}/>

  	<Junction at={midL}/>
  	<Junction at={midR}/>
</svg>