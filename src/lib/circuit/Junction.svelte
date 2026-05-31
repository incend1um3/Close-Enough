<script lang="ts">
  // Junction.svelte — a solder dot marking a connected node.
  // Place one wherever 3+ conductors meet so the connection is unambiguous.
  // (Plain 2-wire corners don't need a dot.)
  import type { SVGAttributes } from 'svelte/elements';
  import type { Pin } from './pins';

  interface JunctionProps extends SVGAttributes<SVGCircleElement> {
    at: Pin;
    r?: number;
    fill?: string;
  }

  let { at, r = 3.5, fill = 'currentColor', ...rest }: JunctionProps = $props();
</script>

<circle cx={at.x} cy={at.y} {r} {fill} {...rest} />
