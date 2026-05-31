<script lang="ts">
  // Capacitor.svelte — non-polarized capacitor symbol (two straight parallel plates).
  // Centered at (x, y). orientation: 'horizontal' (default) or 'vertical'.
  // Labels: `name` (e.g. C1) and `value` (e.g. 100nF).
  //   horizontal -> name above, value below
  //   vertical   -> name + value stacked on two lines, beside the part
  import type { SVGAttributes } from 'svelte/elements';
  import type { Orientation } from './pins';

  interface CapacitorProps extends SVGAttributes<SVGGElement> {
    x?: number;
    y?: number;
    orientation?: Orientation;
    length?: number;      // tip-to-tip terminal distance
    gap?: number;         // distance between the two plates
    plateHeight?: number; // length of each plate
    name?: string;        // reference designator, e.g. "C1"
    value?: string;       // e.g. "100nF"
    stroke?: string;
    strokeWidth?: number;
  }

  let {
    x = 0,
    y = 0,
    orientation = 'horizontal',
    length = 80,
    gap = 8,
    plateHeight = 22,
    name = '',
    value = '',
    stroke = 'currentColor',
    strokeWidth = 2,
    ...rest
  }: CapacitorProps = $props();

  const halfLen   = $derived(length / 2);
  const halfGap   = $derived(gap / 2);
  const halfPlate = $derived(plateHeight / 2);   // perpendicular half-extent
  const angle     = $derived(orientation === 'vertical' ? 90 : 0);

  const labelGap = 6;
  const lineH = 14;
  const vLines = $derived([name, value].filter(Boolean)); // vertical: stacked
</script>

<g transform="translate({x},{y})" {...rest}>
  <!-- symbol body + leads, drawn along local x-axis then rotated -->
  <g transform="rotate({angle})">
    <line x1={-halfLen} y1="0" x2={-halfGap} y2="0" {stroke} stroke-width={strokeWidth} />
    <line x1={halfGap}  y1="0" x2={halfLen}  y2="0" {stroke} stroke-width={strokeWidth} />
    <line x1={-halfGap} y1={-halfPlate} x2={-halfGap} y2={halfPlate} {stroke} stroke-width={strokeWidth} />
    <line x1={halfGap}  y1={-halfPlate} x2={halfGap}  y2={halfPlate} {stroke} stroke-width={strokeWidth} />
  </g>

  <!-- labels in screen space -->
  {#if orientation === 'horizontal'}
    {#if name}
      <text x="0" y={-(halfPlate + labelGap)} text-anchor="middle"
            font-size="12" fill={stroke}>{name}</text>
    {/if}
    {#if value}
      <text x="0" y={halfPlate + labelGap} text-anchor="middle" dominant-baseline="hanging"
            font-size="12" fill={stroke}>{value}</text>
    {/if}
  {:else}
    {#each vLines as line, i}
      <text
        x={halfPlate + labelGap + 2}
        y={(i - (vLines.length - 1) / 2) * lineH}
        text-anchor="start" dominant-baseline="middle"
        font-size="12" fill={stroke}>{line}</text>
    {/each}
  {/if}
</g>
