import { allocatePointer } from "@tsonic/core/lang.js";
import type { Pointer } from "@tsonic/core/types.js";

export function allocateValue<T>(value: T): Pointer<T> {
  return allocatePointer(value);
}
