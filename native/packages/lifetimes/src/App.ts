import type { int32 } from "@tsonic/core/types.js";
import {
  load,
  mut,
  ref,
  store,
} from "@tsonic/rust/lang.js";
import type {
  Life,
  Mut,
  Outlives,
  Placeholder,
  Ref,
  Static,
  ValidFor,
} from "@tsonic/rust/types.js";

type Shared<L extends Life> = Ref<int32, L>;
type Reader = <L extends Life>(value: Ref<int32, L>) => int32;

function increment(value: Mut<int32>): void {
  store(value, load(value) + 1);
}

function read(value: Ref<int32>): int32 {
  return load(value);
}

function choose<A extends Life, B extends Life & Outlives<A>>(
  left: Ref<int32, A>,
  _right: Ref<int32, B>,
): Ref<int32, A> {
  return left;
}

function hold<L extends Life, T extends ValidFor<L>>(
  value: Ref<T, L>,
): Ref<T, L> {
  return value;
}

function nested<A extends Life, B extends Life>(
  value: Ref<Mut<int32, B>, A>,
): Ref<Mut<int32, B>, A> {
  return value;
}

function permanent(value: Ref<int32, Static>): Ref<int32, Static> {
  return value;
}

function inferred(
  value: Ref<int32, Placeholder>,
): Ref<int32, Placeholder> {
  return value;
}

function acceptReader(reader: Reader): void {
  const value: int32 = 9;
  if (reader(ref(value)) !== 9) {
    throw new Error("higher-ranked callback lifetime failed");
  }
}

function* borrowedValues<L extends Life>(
  value: Ref<int32, L>,
): Generator<int32, void, void> {
  yield load(value);
}

async function preserveAcrossAwait<L extends Life>(
  value: Ref<int32, L>,
): Promise<Ref<int32, L>> {
  await Promise.resolve(undefined);
  return value;
}

export async function main(): Promise<void> {
  let first: int32 = 40;
  const second: int32 = 50;
  increment(mut(first));
  if (read(ref(first)) !== 41) {
    throw new Error("elided native reference failed");
  }
  if (read(choose(ref(first), ref(second))) !== 41) {
    throw new Error("named outlives relation failed");
  }
  if (read(hold(ref(second))) !== 50) {
    throw new Error("type outlives relation failed");
  }

  acceptReader(<L extends Life>(value: Ref<int32, L>): int32 => load(value));

  const generator = borrowedValues(ref(second));
  const yielded = generator.next();
  if (yielded.done || yielded.value !== 50) {
    throw new Error("generator lifetime retention failed");
  }

  const preserved = await preserveAcrossAwait(ref(first));
  if (read(preserved) !== 41) {
    throw new Error("async lifetime retention failed");
  }
}
