import { readFile, stat } from "node:fs/promises";

export async function readNonEmpty(path: string): Promise<boolean> {
  const contents = await readFile(path, "utf8");
  const information = await stat(path);
  return contents.length > 0 && information.isFile() && information.size > 0;
}
