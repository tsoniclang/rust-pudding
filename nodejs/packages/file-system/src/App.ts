import { existsSync, readFileSync, statSync } from "node:fs";

export function main(): void {
  if (!existsSync("fixture.txt")) {
    throw new Error("fixture was not found");
  }
  const contents = readFileSync("fixture.txt", "utf8");
  const stats = statSync("fixture.txt");
  if (!contents.includes("Rust Pudding") || !stats.isFile() || stats.isDirectory() || stats.size <= 0) {
    throw new Error("file-system capability failed");
  }
}
