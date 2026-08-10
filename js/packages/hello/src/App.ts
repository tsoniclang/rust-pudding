export function main(): void {
  const name = "tsonic";
  console.log(name, 6, true);
  if (name.length !== 6 || name.toUpperCase() !== "TSONIC" || !name.includes("son")) {
    throw new Error("JavaScript string surface failed");
  }
  console.info();
}
