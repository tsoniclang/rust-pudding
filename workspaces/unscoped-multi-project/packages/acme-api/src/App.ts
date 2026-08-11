import { Counter } from "acme-domain/index.js";

export function main(): void {
  const counter = new Counter(40);
  if (counter.increment() !== 41 || counter.increment() !== 42 || counter.value !== 42) {
    throw new Error("unscoped source-package state failed");
  }
}
