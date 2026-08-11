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

async function* rows(): AsyncGenerator<int32, void, void> {
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

  let total: int32 = 0;
  for await (const row of rows()) {
    total += row;
  }
  if (total !== 5) {
    throw new Error("async iteration failed");
  }

  {
    using resource = new Resource();
  }
  if (currentDisposeCount() !== 1) {
    throw new Error("synchronous disposal failed");
  }

  {
    await using resource = new AsyncResource();
  }
  if (currentDisposeCount() !== 2) {
    throw new Error("asynchronous disposal failed");
  }
}
