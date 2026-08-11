import type { int32 } from "@tsonic/core/types.js";

let argumentEvaluations: int32 = 0;

function currentArgumentEvaluations(): int32 {
  return argumentEvaluations;
}

function invoke(action: (value: int32) => int32, value: int32): int32 {
  return action(value);
}

function counter(seed: int32): () => int32 {
  let value = seed;
  return (): int32 => {
    value += 1;
    return value;
  };
}

function optionalArgument(): int32 {
  argumentEvaluations += 1;
  return 4;
}

function invokeOptional(action: ((value: int32) => int32) | null): int32 | null {
  return action?.(optionalArgument()) ?? null;
}

function total(first: int32, ...rest: int32[]): int32 {
  let result = first;
  for (const value of rest) {
    result += value;
  }
  return result;
}

export function main(): void {
  const increment = (value: int32): int32 => value + 1;
  if (invoke(increment, 4) !== 5) {
    throw new Error("direct callable invocation failed");
  }

  const next = counter(3);
  if (next() !== 4 || next() !== 5) {
    throw new Error("escaping mutable closure capture failed");
  }

  if (invokeOptional(null) !== null || currentArgumentEvaluations() !== 0) {
    throw new Error("optional callable evaluated an absent call");
  }
  if (invokeOptional((value: int32): int32 => value + 1) !== 5 || currentArgumentEvaluations() !== 1) {
    throw new Error("optional callable invocation failed");
  }

  const factorial = function recur(value: int32): int32 {
    return value <= 1 ? 1 : value * recur(value - 1);
  };
  if (factorial(5) !== 120 || total(1, 2, 3, 4) !== 10) {
    throw new Error("recursive or rest callable contract failed");
  }
}
