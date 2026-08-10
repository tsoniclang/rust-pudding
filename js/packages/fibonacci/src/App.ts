import type { int32 } from "@tsonic/core/types.js";

export function fibonacci(value: int32): int32 {
  if (value < 2) return value;
  return fibonacci(value - 1) + fibonacci(value - 2);
}

export function main(): void {
  if (
    fibonacci(0) !== 0 ||
    fibonacci(1) !== 1 ||
    fibonacci(2) !== 1 ||
    fibonacci(3) !== 2 ||
    fibonacci(4) !== 3 ||
    fibonacci(5) !== 5
  ) {
    throw new Error("JavaScript callback Fibonacci proof failed");
  }
}
