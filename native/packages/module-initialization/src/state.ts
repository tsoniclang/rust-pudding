import type { int32 } from "@tsonic/core/types.js";

let sequence: int32 = 1;
sequence += 1;

export function next(): int32 {
  sequence += 1;
  return sequence;
}
