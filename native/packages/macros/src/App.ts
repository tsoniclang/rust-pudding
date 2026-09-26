import type { int32, nativeUint } from "@tsonic/core/types.js";
import { load, propagate, range, tokens } from "@tsonic/rust/lang.js";
import { Result } from "@tsonic/rust/core/result.js";
import { println, vec } from "@tsonic/rust/std/index.js";
import type { Vec } from "@tsonic/rust/std/vec.js";

function increment(value: Result<int32, int32>): Result<int32, int32> {
  return Result.Ok<int32, int32>(propagate(value) + 1);
}

export function main(): Result<void, int32> {
  const values: Vec<int32> = vec([1, 2, 3]);
  const copies: Vec<int32> = vec(tokens`[7; 3]`);
  const mapped = range<nativeUint>(0, 4).map(value => value + 1).collect<Vec<nativeUint>>();
  const selected = range<nativeUint>(0, 4).filter(value => load(value) < 2).count();
  const answer = propagate(increment(Result.Ok<int32, int32>(40)));
  if (values.pop() !== 3 || copies.pop() !== 7 || mapped.len() !== 4 || selected !== 2 || answer !== 41) {
    return Result.Err<void, int32>(1);
  }
  println("native macros: {} {}", mapped.len(), answer);
  return Result.Ok<void, int32>(undefined);
}
