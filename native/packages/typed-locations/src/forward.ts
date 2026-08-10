import type { Pointer } from "@tsonic/core/types.js";
import { allocateValue } from "./storage.js";

export function forwardValue<T>(value: T): Pointer<T> {
  return allocateValue(value);
}
