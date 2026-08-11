import type { int32 } from "@tsonic/core/types.js";

let disposeCount: int32 = 0;

function currentDisposeCount(): int32 {
  return disposeCount;
}

class Resource {
  constructor() {}

  [Symbol.dispose](): void {
    disposeCount += 1;
  }
}

class AsyncResource {
  constructor() {}

  async [Symbol.asyncDispose](): Promise<void> {
    disposeCount += 1;
  }
}

function* exchange(seed: int32): Generator<int32, int32, int32> {
  const resumed: int32 = yield seed;
  return resumed + 1;
}

function* guarded(label: string): Generator<int32, string, int32> {
  try {
    yield 7;
    return "natural";
  } finally {
    disposeCount += label.length;
  }
}

function* inner(): Generator<int32, int32, int32> {
  const resumed: int32 = yield 3;
  yield resumed;
  return 9;
}

function* outer(): Generator<int32, int32, int32> {
  return yield* inner();
}

async function* rows(): AsyncGenerator<int32, int32, int32> {
  const resumed: int32 = yield 2;
  yield resumed;
  yield 3;
  return 12;
}

async function* iterableRows(): AsyncGenerator<int32, void, void> {
  yield 2;
  yield 3;
}

export async function main(): Promise<void> {
  const generator = exchange(7);
  const first = generator.next();
  if (first.done || first.value !== 7) {
    throw new Error("generator yield failed");
  }
  const completed = generator.next(41);
  if (!completed.done || completed.value !== 42) {
    throw new Error("generator next value failed");
  }

  const delegated = outer();
  const delegatedFirst = delegated.next();
  const delegatedSecond = delegated.next(7);
  const delegatedDone = delegated.next(0);
  if (delegatedFirst.done || delegatedFirst.value !== 3 ||
    delegatedSecond.done || delegatedSecond.value !== 7 ||
    !delegatedDone.done || delegatedDone.value !== 9) {
    throw new Error("generator delegation failed");
  }

  const returnedGenerator = guarded("r");
  returnedGenerator.next();
  const returned = returnedGenerator.return("stopped");
  if (!returned.done || returned.value !== "stopped" || currentDisposeCount() !== 1) {
    throw new Error("generator return cleanup failed");
  }

  const thrownGenerator = guarded("t");
  thrownGenerator.next();
  let generatorThrowObserved = false;
  try {
    thrownGenerator.throw(new Error("stop"));
  } catch {
    generatorThrowObserved = true;
  }
  if (!generatorThrowObserved || currentDisposeCount() !== 2) {
    throw new Error("generator throw cleanup failed");
  }

  const asyncGenerator = rows();
  const firstRequest = asyncGenerator.next();
  const secondRequest = asyncGenerator.next(7);
  const thirdRequest = asyncGenerator.next(9);
  const asyncFirst = await firstRequest;
  const asyncSecond = await secondRequest;
  const asyncThird = await thirdRequest;
  const asyncDone = await asyncGenerator.next(11);
  if (asyncFirst.done || asyncFirst.value !== 2 ||
    asyncSecond.done || asyncSecond.value !== 7 ||
    asyncThird.done || asyncThird.value !== 3 ||
    !asyncDone.done || asyncDone.value !== 12) {
    throw new Error("async generator request ordering failed");
  }

  let total: int32 = 0;
  for await (const row of iterableRows()) {
    total += row;
  }
  if (total !== 5) {
    throw new Error("async iteration failed");
  }

  {
    using resource = new Resource();
  }
  if (currentDisposeCount() !== 3) {
    throw new Error("synchronous disposal failed");
  }

  {
    await using resource = new AsyncResource();
  }
  if (currentDisposeCount() !== 4) {
    throw new Error("asynchronous disposal failed");
  }
}
