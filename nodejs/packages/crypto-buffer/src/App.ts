import { Buffer, atob, btoa, isEncoding } from "node:buffer";
import { createHash, createHmac } from "node:crypto";

export function main(): void {
  let passed = false;
  try {
    const buffer = Buffer.from("abc", "utf8");
    const hash = createHash("sha256");
    hash.update("abc");
    const digest = hash.digest("hex");
    const hmac = createHmac("sha256", "key");
    hmac.update("abc");
    const mac = hmac.digest("hex");
    passed =
      buffer.length === 3 &&
      buffer.readUInt8(0) === 97 &&
      buffer.toString("utf8") === "abc" &&
      digest.startsWith("ba7816bf") &&
      digest.length === 64 &&
      mac.length === 64 &&
      btoa("abc") === "YWJj" &&
      atob("YWJj") === "abc" &&
      isEncoding("utf8");
  } catch (error) {
    passed = false;
  }
  if (!passed) {
    throw new Error("crypto or buffer capability failed");
  }
}
