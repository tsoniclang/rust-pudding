import { ok } from "node:assert";

export function main(): void {
  ok(true);
  ok(2 + 2 === 4, "arithmetic invariant failed");
}
