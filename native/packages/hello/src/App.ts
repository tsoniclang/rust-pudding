import type { int32 } from "@tsonic/core/types.js";

function requireExact(actual: int32, expected: int32): void {
  if (actual !== expected) {
    throw new Error("native hello proof failed");
  }
}

export function main(): void {
  const answer: int32 = 40 + 2;
  requireExact(answer, 42);
}
