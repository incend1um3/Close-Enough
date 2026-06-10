<script lang="ts">
  // Pwr.svelte — power port symbol. Single-terminal: connects at one pin
  // and points to a rail marker. Styles mirror KiCad's power family:
  //   'bar'    -> stem + horizontal bar  (like +5V / VDD)   [default]
  //   'circle' -> stem + open circle     (like VCC)
  //   'arrow'  -> stem + filled triangle (supply arrow)
  //
  // Anchor at the connection point with `at={pin}` or x/y; symbol points
  // along `direction` (default 'up'). The label IS the meaning here, e.g.
  //   <Pwr at={pins(R1).a} name="+5V" />
  //   const V = node(120, 40);
  //   <Pwr at={V} name="VCC" style="circle" /> <Wire from={V} to={pins(R1).a} />
  import type { SVGAttributes } from 'svelte/elements';
  import type { Pin } from './pins';

  type Direction = 'up' | 'down' | 'left' | 'right';
  type PwrStyle = 'bar' | 'circle' | 'arrow';

  interface PwrProps extends Omit<SVGAttributes<SVGGElement>, 'style'> {
    at?: Pin;              // connection point (preferred); overrides x/y
    x?: number;
    y?: number;
    direction?: Direction; // which way the symbol points (default 'up')
    style?: PwrStyle;      // marker shape (default 'bar')
    width?: number;        // bar width / arrow base / 2*circle radius
    lead?: number;         // stem length from pin to the marker
    name?: string;         // net label, e.g. "+5V", "VCC", "VDD"
    stroke?: string;
    strokeWidth?: number;
    fill?: string;         // arrow fill (default = stroke)
  }

  let {
    at,
    x = 0,
    y = 0,
    direction = 'up',
    style = 'arrow',
    width = 26,
    lead = 22,
    name = 'PWR',
    stroke = 'currentColor',
    strokeWidth = 2,
    fill,
    ...rest
  }: PwrProps = $props();

  const ax = $derived(at ? at.x : x);
  const ay = $derived(at ? at.y : y);

  // Canonical drawing points 'down' (+Y); rotate to face `direction`.
  const angle = $derived(
    ({ down: 0, left: 90, up: 180, right: 270 } as const)[direction]
  );

  const half = $derived(width / 2);
  const r = $derived(width / 2);
  // How far the marker reaches outward, for label placement.
  const extent = $derived(
    style === 'circle' ? lead + 2 * r : style === 'arrow' ? lead + half : lead
  );

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
    {#if style === 'bar'}
      <line x1={-half} y1={lead} x2={half} y2={lead} {stroke} stroke-width={strokeWidth} stroke-linecap="round" />
    {:else if style === 'circle'}
      <circle cx="0" cy={lead + r} {r} fill="none" {stroke} stroke-width={strokeWidth} />
    {:else}
      <!-- arrow: filled triangle pointing outward (+Y) -->
      <polygon
        points="0,{lead + half} {-half},{lead} {half},{lead}"
        fill={fill ?? 'none'} {stroke} stroke-width={strokeWidth} stroke-linejoin="round" />
    {/if}
  </g>

  <!-- label in screen space -->
  {#if name}
    <text
      x={lx} y={ly}
      text-anchor={anchor} dominant-baseline={baseline}
      font-size="13" fill={stroke} class="tracking-wide">{name}</text>
  {/if}
</g>
