import type { int32 } from "@tsonic/core/types.js";

export function bump(values: int32[]): void {
  values[0] = values[0] + 1;
}

export function main(): void {
  const values: int32[] = [1, 2, 3];
  bump(values);
  const fixed: [int32, int32, int32] = [10, 20, 30];
  if (values[0] !== 2 || fixed[0] + fixed[1] + fixed[2] !== 60) {
    throw new Error("slice or fixed-array proof failed");
  }
}
