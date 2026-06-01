<script lang="ts">
	import Junction from "$lib/circuit/Junction.svelte";
	import { node, pins, type Part } from "$lib/circuit/pins";
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
	
	const R1: Part = { x: 200,  y: 60,  orientation: 'horizontal', length: 200 };
	const R2: Part = { x: 200,  y: 160, orientation: 'horizontal', length: 200 };
	const R3: Part = { x: 200,  y: 260, orientation: 'horizontal', length: 200 };

	const L1 = pins(R1).a;
	const L2 = pins(R2).a;
	const L3 = pins(R3).a;

	const B1 = pins(R1).b;
	const B2 = pins(R2).b;
	const B3 = pins(R3).b;
 
	const midL = node(L1.x, (L1.y + L3.y) / 2);
	const midR = node(B1.x, (B1.y + B3.y) / 2);
</script>

<svg viewBox="0 0 380 320" width="380" height="320" style="color:#1a1a1a;" class="bg-bg-200">
  	<Resistor {...R1} name="R1" value={formatSiValue(r1).replace(' ', '')} />
  	<Resistor {...R2} name="R2" value={formatSiValue(r2).replace(' ', '')} />
  	<Resistor {...R3} name="R3" value={formatSiValue(r3).replace(' ', '')} />

  	<Wire from={pins(R1).a} to={pins(R3).a} />
  	<Wire from={pins(R1).b} to={pins(R3).b} />
	<Wire from={{ x: 0, y: midL.y }} to={midL}/>
	<Wire from={midR} to={{ x: midR.x + 200, y: midL.y}}/>

  	<Junction at={midL}/>
  	<Junction at={midR}/>
</svg>