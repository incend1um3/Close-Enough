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
	
	const R1: Part = { x: 180,  y: 60,  orientation: 'horizontal', length: 200 };
	const R2: Part = { x: 340,  y: 60, orientation: 'horizontal', length: 200 };
	const R3: Part = { x: 260,  y: 160, orientation: 'horizontal', length: 200 };

	const L1 = pins(R1).a;
	const L2 = pins(R2).a;
	const L3 = pins(R3).a;

	const B1 = pins(R1).b;
	const B2 = pins(R2).b;
	const B3 = pins(R3).b;
 
	const midL = node(L1.x, (L1.y + L3.y) / 2);
	const midR = node(B2.x, (B1.y + B3.y) / 2);
</script>

<svg viewBox="0 0 500 220" style="color:#1a1a1a;" class="bg-bg-200 w-full h-auto">
  	<Resistor {...R1} name="R1" value={formatSiValue(r1).replace(' ', '')} />
  	<Resistor {...R2} name="R2" value={formatSiValue(r2).replace(' ', '')} />
  	<Resistor {...R3} name="R3" value={formatSiValue(r3).replace(' ', '')} />

  	<Wire from={pins(R1).a} to={midL} />
  	<Wire from={pins(R2).b} to={midR} />

  	<Wire from={midL} to={{ x: midL.x, y: B3.y }} />
  	<Wire from={{ x: midL.x, y: B3.y }} to={pins(R3).a} />

	<Wire from={pins(R3).b} to={{ x: midR.x, y: B3.y }} />
	<Wire from={{ x: midR.x, y: B3.y }} to={midR} />

	<Wire from={{ x: 0, y: midL.y }} to={midL}/>
	<Wire from={midR} to={{ x: midR.x + 200, y: midL.y}}/>

  	<Junction at={midL}/>
  	<Junction at={midR}/>
</svg>