import {
  addressOf,
  equalPointer,
  loadPointer,
  storePointer,
} from "@tsonic/core/lang.js";
import type { int32, Pointer } from "@tsonic/core/types.js";
import { forwardValue } from "./forward.js";

class Pair {
  left: int32;
  right: int32;

  constructor(left: int32, right: int32) {
    this.left = left;
    this.right = right;
  }
}

function increment(pointer: Pointer<int32>): void {
  storePointer(pointer, loadPointer(pointer) + 1);
}

export function main(): void {
  let value: int32 = 1;
  const alias = addressOf(value);
  value += 1;
  increment(alias);
  if (value !== 3 || loadPointer(alias) !== 3) {
    throw new Error("local location aliasing failed");
  }

  let pair = new Pair(4, 5);
  const first = addressOf(pair.left);
  const firstAgain = addressOf(pair.left);
  storePointer(first, 6);
  if (pair.left !== 6 || loadPointer(firstAgain) !== 6 || !equalPointer(first, firstAgain)) {
    throw new Error("projected location aliasing failed");
  }

  const allocated = forwardValue<int32>(40);
  increment(allocated);
  if (loadPointer(allocated) !== 41) {
    throw new Error("transitive location contract failed");
  }
}
