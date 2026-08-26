import type { int32 } from "@tsonic/core/types.js";
import {
  captureMove,
  clone,
  move,
  mut,
  own,
  ref,
  replace,
  take,
} from "@tsonic/rust/lang.js";
import type {
  Life,
  Owned,
  Outlives,
  Ref,
  ValidFor,
} from "@tsonic/rust/types.js";
import type { FnOnce } from "@tsonic/rust/std/ops.js";

function duplicate(value: Owned<string>): Owned<string> {
  return clone(value);
}

function detach(value: Owned<string>): Owned<string> {
  return own(ref(value));
}

function exchange(value: Owned<string>, replacement: string): Owned<string> {
  return replace(mut(value), replacement);
}

function reset(value: Owned<string>): Owned<string> {
  return take(mut(value));
}

function choose<A extends Life, B extends Life & Outlives<A>>(
  left: Ref<string, A>,
  _right: Ref<string, B>,
): Ref<string, A> {
  return left;
}

function hold<L extends Life, T extends ValidFor<L>>(
  value: Ref<T, L>,
): Ref<T, L> {
  return value;
}

function consume(_value: Owned<string>): void {}

function invoke(callback: () => void): void {
  callback();
}

function moveTupleFields(pair: Owned<[string, string]>): Owned<string> {
  consume(move(pair[0]));
  return move(pair[1]);
}

function makeOnce(value: Owned<string>): Owned<FnOnce<[], string>> {
  const callback = captureMove((): string => move(value));
  return move(callback);
}

function invokeOnce(callback: Owned<FnOnce<[], string>>): string {
  return callback();
}

function* borrowedValues<L extends Life>(
  value: Ref<string, L>,
): Generator<Ref<string, L>, void, void> {
  yield value;
}

async function preserveAcrossAwait<L extends Life>(
  value: Ref<string, L>,
): Promise<Ref<string, L>> {
  await Promise.resolve();
  return value;
}

export async function main(): Promise<void> {
  let original = "first";
  if (duplicate(move(original)) !== "first") {
    throw new Error("explicit clone failed");
  }

  let borrowedSource = "borrowed";
  if (detach(move(borrowedSource)) !== "borrowed") {
    throw new Error("borrow-to-owned conversion failed");
  }

  let exchangeSource = "before";
  if (exchange(move(exchangeSource), "after") !== "before") {
    throw new Error("mutable replacement failed");
  }

  let resetSource = "reset";
  if (reset(move(resetSource)) !== "reset") {
    throw new Error("native take failed");
  }

  let pair: [string, string] = ["left", "right"];
  if (moveTupleFields(move(pair)) !== "right") {
    throw new Error("field-sensitive move failed");
  }

  const first = "first lifetime";
  const second = "second lifetime";
  if (own(choose(ref(first), ref(second))) !== "first lifetime") {
    throw new Error("named lifetime selection failed");
  }
  if (own(hold(ref(second))) !== "second lifetime") {
    throw new Error("type outlives selection failed");
  }

  let captured = "captured";
  const callback = makeOnce(move(captured));
  if (invokeOnce(move(callback)) !== "captured") {
    throw new Error("explicit move capture failed");
  }

  let capturedLocation = 0;
  invoke(captureMove((): void => {
    capturedLocation += 1;
  }));
  if (capturedLocation !== 1) {
    throw new Error("move-captured location identity failed");
  }

  let nestedLocation = 0;
  invoke(captureMove((): void => {
    invoke(captureMove((): void => {
      nestedLocation += 1;
    }));
  }));
  if (nestedLocation !== 1) {
    throw new Error("nested move-captured location identity failed");
  }

  const borrowedGenerator = borrowedValues(ref(first));
  const yielded = borrowedGenerator.next();
  if (yielded.done || own(yielded.value) !== "first lifetime") {
    throw new Error("borrowed generator lifetime failed");
  }

  const preserved = await preserveAcrossAwait(ref(first));
  if (own(preserved) !== "first lifetime") {
    throw new Error("borrowed async lifetime failed");
  }

  const values: int32[] = [1, 2];
  values.push(values.length);
  if (values[2] !== 2) {
    throw new Error("two-phase receiver borrow failed");
  }
}
