import { URL, URLSearchParams, canParse, fileURLToPath, pathToFileURL } from "node:url";

export function main(): void {
  let passed = false;
  try {
    const url = new URL("https://user.example.com:8443/docs/page?q=rust#top");
    const params = new URLSearchParams("a=1&b=2");
    params.set("a", "9");
    params.append("c", "3");
    const roundtrip = fileURLToPath(pathToFileURL("/tmp/rust-pudding"));
    passed =
      url.protocol === "https:" &&
      url.hostname === "user.example.com" &&
      url.port === "8443" &&
      url.pathname === "/docs/page" &&
      (params.get("a") ?? "") === "9" &&
      params.has("b") &&
      roundtrip === "/tmp/rust-pudding" &&
      canParse("https://example.com");
  } catch (error) {
    passed = false;
  }
  if (!passed) {
    throw new Error("URL capability failed");
  }
}
