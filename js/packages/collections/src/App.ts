import type { int32 } from "@tsonic/core/types.js";

export function main(): void {
  const values: int32[] = [1, 2, 3];
  let total: int32 = 0;
  for (const value of values) total += value;
  if (total !== 6 || values.length !== 3 || !values.includes(2) || values.indexOf(3) !== 2) {
    throw new Error("array proof failed");
  }
  const copied = values.slice(1, 3);
  if (copied.join("-") !== "2-3") {
    throw new Error("array copy proof failed");
  }

  const text = "abcd";
  if (text.slice(1, -1) !== "bc" || text.repeat(2) !== "abcdabcd" || text.codePointAt(0) !== 97) {
    throw new Error("string copy proof failed");
  }

  const map = new Map<int32, string>();
  map.set(1, "one");
  map.set(1, "uno");
  if (map.size !== 1 || !map.has(1) || (map.get(1) ?? "") !== "uno") {
    throw new Error("map proof failed");
  }

  const set = new Set<int32>();
  set.add(7);
  set.add(7);
  if (set.size !== 1 || !set.has(7)) {
    throw new Error("set proof failed");
  }
}
