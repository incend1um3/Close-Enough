<script lang="ts">
  // Wire.svelte — connects two pin objects ({x, y}), e.g. from pins().
  // Usage: <Wire from={pins(R1).b} to={pins(C1).a} />
  import type { SVGAttributes } from 'svelte/elements';
  import type { Pin } from './pins';

  interface WireProps extends Omit<SVGAttributes<SVGLineElement>, 'from' | 'to'> {
    from: Pin;
    to: Pin;
    stroke?: string;
    strokeWidth?: number;
  }

  let {
    from,
    to,
    stroke = 'currentColor',
    strokeWidth = 2,
    ...rest
  }: WireProps = $props();
</script>

<line
  x1={from.x} y1={from.y}
  x2={to.x}   y2={to.y}
  {stroke} stroke-width={strokeWidth}
  stroke-linecap="round"
  {...rest}
/>
