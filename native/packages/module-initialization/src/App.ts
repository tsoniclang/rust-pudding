import type { int32 } from "@tsonic/core/types.js";
import { addressOf, loadPointer, storePointer } from "@tsonic/core/lang.js";
import { next } from "./state.js";

const first: int32 = next();
let second: int32 = first + 1;
const secondLocation = addressOf(second);

export function main(): void {
  if (first !== 3 || loadPointer(secondLocation) !== 4) {
    throw new Error("module dependency initialization failed");
  }
  storePointer(secondLocation, 8);
  if (second !== 8) {
    throw new Error("module binding location identity failed");
  }
}
