// pins.ts
// Geometry + shared types for 2-terminal components.

export type Orientation = 'horizontal' | 'vertical';

export interface Pin {
  x: number;
  y: number;
}

/** Minimal geometry a 2-terminal part needs to expose its pins. */
export interface Part {
  x?: number;
  y?: number;
  orientation?: Orientation;
  length?: number; // tip-to-tip terminal distance
}

export interface Pins {
  a: Pin; // top (vertical) / left (horizontal) tip
  b: Pin; // bottom (vertical) / right (horizontal) tip
}

/**
 * World-space positions of a part's two pins. The part is centered at
 * (x, y); pins sit at the tips, +/- length/2 along the orientation axis.
 */
export function pins({
  x = 0,
  y = 0,
  orientation = 'horizontal',
  length = 80,
}: Part = {}): Pins {
  const h = length / 2;
  if (orientation === 'vertical') {
    return { a: { x, y: y - h }, b: { x, y: y + h } };
  }
  return { a: { x: x - h, y }, b: { x: x + h, y } };
}

/** A free-standing connection point (e.g. a rail or T-junction). */
export function node(x: number, y: number): Pin {
  return { x, y };
}
