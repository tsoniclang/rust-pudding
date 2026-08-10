import { ok } from "node:assert";

function sumIsFour(left: number, right: number): boolean {
  return left + right === 4;
}

export function main(): void {
  ok(true);
  ok(sumIsFour(2, 2), "arithmetic invariant failed");
}
