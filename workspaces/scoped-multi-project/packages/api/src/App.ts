import { TodoItem } from "@acme/domain/index.js";

export function main(): void {
  const item = new TodoItem(7, "prove scoped source packages");
  if (item.id !== 7 || item.title !== "prove scoped source packages" || item.isComplete()) {
    throw new Error("scoped source-package construction failed");
  }
  item.toggle();
  if (!item.isComplete()) {
    throw new Error("scoped source-package method dispatch failed");
  }
}
