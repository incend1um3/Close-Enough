<script lang="ts">
  // Gnd.svelte — ground symbol (KiCad-style "rake": a stem into three
  // descending horizontal bars). Single-terminal: connects at one pin.
  //
  // Anchor it at the connection point with either `at={pin}` or x/y.
  //   <Gnd at={pins(C1).b} />
  //   <Gnd x={120} y={200} />
  // The pin sits at the anchor; the symbol hangs along `direction`
  // (default 'down'). Wire to the same point:
  //   const G = node(120, 200);
  //   <Gnd at={G} /> <Wire from={pins(C1).b} to={G} />
  import type { SVGAttributes } from 'svelte/elements';
  import type { Pin } from './pins';

  type Direction = 'up' | 'down' | 'left' | 'right';

  interface GndProps extends SVGAttributes<SVGGElement> {
    at?: Pin;            // connection point (preferred); overrides x/y
    x?: number;
    y?: number;
    direction?: Direction; // which way the symbol points (default 'down')
    width?: number;        // width of the widest (top) bar
    lead?: number;         // stem length from pin to first bar
    barGap?: number;       // vertical spacing between bars
    name?: string;         // net label, e.g. "GND"
    stroke?: string;
    strokeWidth?: number;
  }

  let {
    at,
    x = 0,
    y = 0,
    direction = 'down',
    width = 26,
    lead = 10,
    barGap = 5,
    name = 'GND',
    stroke = 'currentColor',
    strokeWidth = 2,
    ...rest
  }: GndProps = $props();

  const ax = $derived(at ? at.x : x);
  const ay = $derived(at ? at.y : y);

  // Canonical drawing points 'down' (+Y); rotate to face `direction`.
  const angle = $derived(
    ({ down: 0, left: 90, up: 180, right: 270 } as const)[direction]
  );

  // Three bars, widest at the stem end, narrowing outward.
  const bars = $derived([
    { w: width,        y: lead },
    { w: width * 0.62, y: lead + barGap },
    { w: width * 0.28, y: lead + 2 * barGap },
  ]);

  // Label sits just beyond the last bar, along the screen direction.
  const extent = $derived(lead + 2 * barGap);
  const labelGap = 8;
  const dir = $derived(
    ({ down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] } as const)[direction]
  );
  const lx = $derived(dir[0] * (extent + labelGap));
  const ly = $derived(dir[1] * (extent + labelGap));
  const anchor = $derived(
    direction === 'left' ? 'end' : direction === 'right' ? 'start' : 'middle'
  );
  const baseline = $derived(
    direction === 'down' ? 'hanging' : direction === 'up' ? 'auto' : 'middle'
  );
</script>

<g transform="translate({ax},{ay})" {...rest}>
  <!-- symbol drawn along local +Y, then rotated to face `direction` -->
  <g transform="rotate({angle})">
    <line x1="0" y1="0" x2="0" y2={lead} {stroke} stroke-width={strokeWidth} stroke-linecap="round" />
    {#each bars as bar}
      <line
        x1={-bar.w / 2} y1={bar.y}
        x2={bar.w / 2}  y2={bar.y}
        {stroke} stroke-width={strokeWidth} stroke-linecap="round"
      />
    {/each}
  </g>

  <!-- label in screen space -->
  {#if name}
    <text
      x={lx} y={ly}
      text-anchor={anchor} dominant-baseline={baseline}
      font-size="13" fill={stroke} class="tracking-wide">{name}</text>
  {/if}
</g>
