import type { int32 } from "@tsonic/core/types.js";

export class Counter {
  value: int32;

  constructor(value: int32) {
    this.value = value;
  }

  increment(): int32 {
    this.value += 1;
    return this.value;
  }
}
