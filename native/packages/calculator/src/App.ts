import type { float64 } from "@tsonic/core/types.js";

export function add(left: float64, right: float64): float64 {
  return left + right;
}

export function divide(left: float64, right: float64): float64 {
  if (right === 0) {
    throw new Error("division by zero");
  }
  return left / right;
}

export function main(): void {
  if (add(10, 3) !== 13) {
    throw new Error("addition failed");
  }
  if (divide(10, 2) !== 5) {
    throw new Error("division failed");
  }
  let rejected = false;
  try {
    divide(10, 0);
  } catch (error) {
    rejected = true;
  }
  if (!rejected) {
    throw new Error("division by zero was accepted");
  }
}
