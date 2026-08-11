import { arch, cwd, env, pid, platform } from "node:process";
import { basename, dirname, extname, isAbsolute, join } from "node:path";

export function main(): void {
  const path = "/home/user/documents/file.txt";
  if (basename(path) !== "file.txt" || dirname(path) !== "/home/user/documents") {
    throw new Error("path decomposition failed");
  }
  if (extname(path) !== ".txt" || !isAbsolute(path) || join("home", "user", "docs") !== "home/user/docs") {
    throw new Error("path composition failed");
  }
  const pathVariable = env["PATH"] ?? "";
  if (cwd().length === 0 || platform.length === 0 || arch.length === 0 || pid <= 0 || pathVariable.length === 0) {
    throw new Error("process capability failed");
  }
}
