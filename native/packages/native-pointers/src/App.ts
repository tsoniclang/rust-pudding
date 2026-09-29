import {
  loadnativeptr,
  offsetnativeptr,
  safety,
  storenativeptr,
  unsafecontext,
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
  unsafecontext();
  storenativeptr(destination, loadnativeptr(source));
  return offsetnativeptr(source, elementOffset);
}

safety(copyAndAdvance).requiresunsafe();

export function declaredUnsafe(value: int32): int32 {
  return value;
}

safety(declaredUnsafe).requiresunsafe();

export function invokeDeclaredUnsafe(value: int32): int32 {
  return unsafecontext(declaredUnsafe(value));
}
