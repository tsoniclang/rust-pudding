export function main(): void {
  const name = "tsonic";
  if (name.length !== 6 || name.toUpperCase() !== "TSONIC" || !name.includes("son")) {
    throw new Error("JavaScript string surface failed");
  }
}
