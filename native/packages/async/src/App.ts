import type { int32 } from "@tsonic/core/types.js";

export async function increment(value: int32): Promise<int32> {
  return value + 1;
}

export async function answer(): Promise<int32> {
  return await increment(41);
}
