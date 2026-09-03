import {
  loadNativePointer,
  offsetNativePointer,
  safety,
  storeNativePointer,
  unsafeContext,
} from "@tsonic/core/lang.js";
import type {
  NativePointer,
  int32,
  nativeInt,
} from "@tsonic/core/types.js";

export function copyAndAdvance(
  source: NativePointer<int32>,
  destination: NativePointer<int32>,
  elementOffset: nativeInt,
): NativePointer<int32> {
  unsafeContext();
  storeNativePointer(destination, loadNativePointer(source));
  return offsetNativePointer(source, elementOffset);
}

safety(copyAndAdvance).requiresUnsafe();

export function declaredUnsafe(value: int32): int32 {
  return value;
}

safety(declaredUnsafe).requiresUnsafe();

export function invokeDeclaredUnsafe(value: int32): int32 {
  return unsafeContext(declaredUnsafe(value));
}
