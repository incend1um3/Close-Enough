<script lang="ts">
  // ParallelDemo.svelte — two resistors in parallel, joined by top/bottom rails.
  //
  //   in ----+----+        '+' = T-junction (3 wires)  -> Junction dot
  //          |    |        plain corner (2 wires)      -> no dot
  //         R1   R2
  //          |    |
  //  out ----+----+
  import Resistor from './Resistor.svelte';
  import Wire from './Wire.svelte';
  import Junction from './Junction.svelte';
  import { pins, node, type Part } from './pins';

  const topY = 60;
  const botY = 200;

  const R1: Part = { x: 140, y: 130, orientation: 'vertical', length: 70 };
  const R2: Part = { x: 220, y: 130, orientation: 'vertical', length: 70 };

  // rail points directly above / below each resistor
  const t1 = node(R1.x!, topY), t2 = node(R2.x!, topY);
  const b1 = node(R1.x!, botY), b2 = node(R2.x!, botY);

  // input / output terminals
  const inT  = node(40, topY);
  const outT = node(40, botY);
</script>

<svg viewBox="0 0 320 260" width="320" height="260" style="color:#1a1a1a; background:#fafafa">
  <Resistor {...R1} name="R1" value="1kΩ" />
  <Resistor {...R2} name="R2" value="2kΩ" />

  <!-- each resistor's leads up/down to the rails -->
  <Wire from={pins(R1).a} to={t1} />
  <Wire from={pins(R2).a} to={t2} />
  <Wire from={pins(R1).b} to={b1} />
  <Wire from={pins(R2).b} to={b2} />

  <!-- the rails themselves -->
  <Wire from={t1} to={t2} />
  <Wire from={b1} to={b2} />

  <!-- input / output stubs -->
  <Wire from={inT}  to={t1} />
  <Wire from={outT} to={b1} />

  <!-- dots only where 3 conductors meet (t1 and b1); t2/b2 are 2-wire corners -->
  <Junction at={t1} />
  <Junction at={b1} />
</svg>
