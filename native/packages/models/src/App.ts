import type { int32 } from "@tsonic/core/types.js";

export interface Point {
  x: int32;
  y: int32;
}

export type Mode = "off" | "on";

export class Counter {
  value: int32;

  constructor(value: int32) {
    this.value = value;
  }

  add(delta: int32): int32 {
    this.value += delta;
    return this.value;
  }

  current(): int32 {
    return this.value;
  }
}

export function passThrough<T>(value: T): T {
  return value;
}

export function valueOrZero(value: int32 | null): int32 {
  return value ?? 0;
}

export function main(): void {
  const point: Point = { x: 3, y: 4 };
  const entry: [int32, string] = [7, "seven"];
  const mode: Mode = "on";
  const counter = new Counter(10);
  if (point.x + point.y !== 7 || entry[0] !== 7 || mode !== "on") {
    throw new Error("record, tuple, or enum proof failed");
  }
  if (counter.add(5) !== 15 || counter.current() !== 15) {
    throw new Error("class proof failed");
  }
  if (passThrough(41) + 1 !== 42 || valueOrZero(null) !== 0 || valueOrZero(5) !== 5) {
    throw new Error("generic or option proof failed");
  }
}
