export function main(): void {
  let passed = false;
  try {
    const value = JSON.parse("{\"name\":\"tsonic\",\"count\":3}");
    const rendered = JSON.stringify(value) ?? "";
    const digits = new RegExp("\\d+", "g");
    const date = new Date(86400000);
    passed = rendered.includes("tsonic") && digits.test("a12") && date.getTime() === 86400000;
  } catch (error) {
    passed = false;
  }
  if (!passed) {
    throw new Error("JSON, RegExp, or Date proof failed");
  }
}
