import type { int32 } from "@tsonic/core/types.js";
import { unsafeContext } from "@tsonic/core/lang.js";
import { load, ref } from "@tsonic/rust/lang.js";
import type { constPtr, u8 } from "@tsonic/rust/types.js";
import { HashMap, HashSet } from "@tsonic/rust/std/collections.js";
import { Vec } from "@tsonic/rust/std/vec.js";
import {
  Widget,
  byte_ptr,
  choose_borrowed,
  dangerous,
  double,
  duplicate,
  featured,
  first_byte,
  identity,
  maybe_positive,
  preserve_borrowed,
  require_local_future,
  require_send_static_future,
  singleton_map,
} from "@tsonic/rust/crates/widget_alias/index.js";
import { triple } from "@tsonic/rust/crates/widget_alias/math.js";

function check(condition: boolean): void {
  if (!condition) {
    throw new Error("Rust compiler-provider proof failed");
  }
}

function readByte(pointer: constPtr<u8>): u8 {
  return unsafeContext(first_byte(pointer));
}

async function completeLater(): Promise<void> {
  await Promise.resolve();
}

export function main(): void {
  const map = new HashMap<string, int32>();
  map.insert("answer", 42);
  check(!map.is_empty());
  map.clear();
  check(map.is_empty());

  const set = new HashSet<int32>();
  check(set.insert(7));
  check(!set.is_empty());

  const values = new Vec<int32>();
  values.push(3);
  check(values.pop() === 3);
  check(values.is_empty());

  const widget = new Widget<int32>(7);
  check(widget.replace(9) === 7);
  widget.count = 2;
  check(widget.count === 2);
  check(widget.into_value() === 9);

  check(double(4) === 8);
  check(identity<int32>(5) === 5);
  const first: int32 = 6;
  const second: int32 = 7;
  check(load(choose_borrowed(ref(first), ref(second))) === 6);
  check(load(preserve_borrowed(ref(second))) === 7);
  require_local_future(completeLater());
  require_send_static_future(completeLater());
  check(featured(1) === 101);
  check(triple(3) === 9);
  check(maybe_positive(6) === 6);
  check(unsafeContext(dangerous(12)) === 12);
  check(readByte(byte_ptr()) === 23);

  const duplicated = duplicate(8);
  check(duplicated.pop() === 8);
  check(duplicated.pop() === 8);
  check(duplicated.is_empty());
  check(!singleton_map(10).is_empty());
}
