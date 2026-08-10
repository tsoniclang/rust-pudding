import { ok } from "node:assert";
import { format } from "node:util";

function sumIsFour(left: number, right: number): boolean {
  return left + right === 4;
}

export function main(): void {
  ok(true);
  ok(sumIsFour(2, 2), "arithmetic invariant failed");
  ok(format("%s:%d", "count", 3) === "count:3", "variadic formatting failed");
  ok(format("%s") === "%s", "empty variadic formatting failed");
}
