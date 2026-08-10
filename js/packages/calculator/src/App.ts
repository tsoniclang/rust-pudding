export function main(): void {
  if (Math.floor(2.7) !== 2 || Math.ceil(2.1) !== 3 || Math.sqrt(81) !== 9) {
    throw new Error("JavaScript Math surface failed");
  }
  if (Math.pow(2, 10) !== 1024 || Math.abs(-5) !== 5 || Math.trunc(-2.7) !== -2) {
    throw new Error("JavaScript Math result mismatch");
  }
}
