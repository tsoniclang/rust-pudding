import type { int32 } from "@tsonic/core/types.js";

export function main(): void {
  const values: int32[] = [1, 2, 3];
  const doubled = values.map((value) => value * 2);
  const evens = doubled.filter((value) => value % 2 === 0);
  if (doubled.reduce((total, value) => total + value, 0) !== 12) {
    throw new Error("reduce proof failed");
  }
  if (evens.length !== 3 || !values.some((value) => value > 2) || !values.every((value) => value > 0)) {
    throw new Error("callback proof failed");
  }
}
