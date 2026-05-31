<script lang="ts">
  // Resistor.svelte — IEC / "international" resistor symbol (rectangular body).
  // Centered at (x, y). orientation: 'horizontal' (default) or 'vertical'.
  // Labels: `name` (e.g. R1) and `value` (e.g. 1kΩ).
  //   horizontal -> name above, value below
  //   vertical   -> name + value stacked on two lines, beside the part
  import type { SVGAttributes } from 'svelte/elements';
  import type { Orientation } from './pins';

  interface ResistorProps extends SVGAttributes<SVGGElement> {
    x?: number;
    y?: number;
    orientation?: Orientation;
    length?: number;     // tip-to-tip terminal distance
    bodyLength?: number; // length of the rectangular body
    bodyHeight?: number; // height of the rectangular body
    name?: string;       // reference designator, e.g. "R1"
    value?: string;      // e.g. "1kΩ"
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
  }

  let {
    x = 0,
    y = 0,
    orientation = 'horizontal',
    length = 80,
    bodyLength = 44 * 1.9,
    bodyHeight = 18 * 1.9,
    name = '',
    value = '',
    stroke = 'currentColor',
    strokeWidth = 2,
    fill = 'none',
    ...rest
  }: ResistorProps = $props();

  const halfLen  = $derived(length / 2);
  const halfBody = $derived(bodyLength / 2);
  const halfH    = $derived(bodyHeight / 2);   // perpendicular half-extent
  const angle    = $derived(orientation === 'vertical' ? 90 : 0);

  const labelGap = 8;
  const lineH = 14;
  const vLines = $derived([name, value].filter(Boolean)); // vertical: stacked
</script>

<g transform="translate({x},{y})" {...rest}>
  <!-- symbol body + leads, drawn along local x-axis then rotated -->
  <g transform="rotate({angle})">
    <line x1={-halfLen} y1="0" x2={-halfBody} y2="0" {stroke} stroke-width={strokeWidth} />
    <line x1={halfBody} y1="0" x2={halfLen}  y2="0" {stroke} stroke-width={strokeWidth} />
    <rect
      x={-halfBody} y={-halfH}
      width={bodyLength} height={bodyHeight}
      {fill} {stroke} stroke-width={strokeWidth}
	  rx=4
    />
  </g>

  <!-- labels in screen space -->
  {#if orientation === 'horizontal'}
    {#if name}
      <text x="0" y={-(halfH + labelGap)} text-anchor="middle"
            font-size="14" fill={stroke} class="text-lg tracking-wide">{name}</text>
    {/if}
    {#if value}
      <text x="0" y={halfH + labelGap} text-anchor="middle" dominant-baseline="hanging"
            font-size="14" fill={stroke} class="text-lg tracking-wide">{value}</text>
    {/if}
  {:else}
    {#each vLines as line, i}
      <text
        x={halfH + labelGap + 2}
        y={(i - (vLines.length - 1) / 2) * lineH}
        text-anchor="start" dominant-baseline="middle"
        font-size="14" fill={stroke}>{line}</text>
    {/each}
  {/if}
</g>
