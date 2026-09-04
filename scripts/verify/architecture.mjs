import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { projectSpecs, repoRoot, workspaceSpecs } from "./config.mjs";

const ignored = new Set([".git", ".temp", ".tests", "node_modules", "out", "target"]);

export async function verifyArchitecture(root = repoRoot) {
  const files = await collectFiles(root);
  const configs = files.filter((path) => path.endsWith("/tsonic.json")).sort();
  assert.deepEqual(
    configs,
    projectSpecs.map(({ path }) => `${path}/tsonic.json`).sort(),
    "Every Rust proof project must have exactly one verifier record.",
  );
  for (const workspace of workspaceSpecs) {
    const manifest = await readJson(resolve(root, workspace.path, "package.json"));
    assert.deepEqual(manifest.workspaces, ["packages/*"]);
    assert.deepEqual(manifest.scripts, { build: "npm -ws --if-present run build" });
    assert.equal(manifest.dependencies, undefined);
    assert.equal(manifest.devDependencies, undefined);
  }
  for (const project of projectSpecs) {
    const directory = resolve(root, project.path);
    const manifest = await readJson(resolve(directory, "package.json"));
    const config = await readJson(resolve(directory, "tsonic.json"));
    const source = await readProjectSource(directory);
    const expectedDevDependencies = {
      "@tsonic/cli": "0.1.0",
      "@tsonic/target-rust": "0.1.0",
      ...(project.needsNodeCapability ? { "@tsonic/rust-nodejs": "0.1.0" } : {}),
    };
    assert.equal(manifest.private, true);
    assert.equal(manifest.type, "module");
    assert.deepEqual(manifest.scripts, { build: "tsonic build --project tsonic.json" });
    assert.deepEqual(manifest.dependencies ?? {}, project.packageDependencies);
    assert.deepEqual(manifest.devDependencies, expectedDevDependencies);
    assert.deepEqual(manifest.exports, project.packageExports);
    assert.equal(config.targets?.length, 1);
    assert.equal(config.targets[0].id, "rust");
    assert.equal(config.targets[0].options?.crateName, project.crateName);
    assert.equal(config.targets[0].options?.outputType, project.kind);
    assert.equal(config.targets[0].options?.edition, "2024");
    assert.equal(
      project.unsafeContract === undefined ||
        project.unsafeContract === "lexical" ||
        project.unsafeContract === "lexical-and-declaration",
      true,
      `${project.id} has an unsupported unsafe proof contract.`,
    );
    assert.equal(
      config.targets[0].options?.projectFile,
      project.userOwnedCargo ? "Cargo.toml" : undefined,
    );
    assert.deepEqual(config.targets[0].surfaces ?? [], project.surfaces);
    if (project.userOwnedCargo) {
      const cargoManifest = await readFile(resolve(directory, "Cargo.toml"), "utf8");
      assert.match(cargoManifest, /\[dependencies\]/u);
      assert.match(cargoManifest, /path = "out\/rust\/src\/lib\.rs"/u);
      assert.match(cargoManifest, /path = "out\/rust\/src\/main\.rs"/u);
    }
    assert.equal(source.includes("typescriptCompatibility"), false);
    if (project.unsafeContract !== undefined) {
      assert.match(source, /\bunsafeContext\b/u, `${project.id} declares unsafe output without an explicit source context.`);
    }
    if (project.unsafeContract === "lexical-and-declaration") {
      assert.match(source, /\.requiresUnsafe\(\)/u, `${project.id} does not declare its unsafe callable contract.`);
    }
    assertSourceImports(project.path, source);
  }
  return { files: files.length, projects: projectSpecs.length, workspaces: workspaceSpecs.length };
}

async function collectFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name)) continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) files.push(relative(root, path));
    }
  }
  await visit(root);
  return files.sort();
}

async function readProjectSource(directory) {
  const files = await collectFiles(resolve(directory, "src"));
  return (await Promise.all(files.filter((path) => path.endsWith(".ts")).map((path) => readFile(resolve(directory, "src", path), "utf8")))).join("\n");
}

function assertSourceImports(path, source) {
  const imports = [...source.matchAll(/\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/gu)]
    .map((match) => match[1]);
  for (const specifier of imports) {
    if (specifier.startsWith(".")) {
      assert.equal(specifier.endsWith(".js"), true, `${path} local import '${specifier}' is not ESM-explicit.`);
    }
    assert.equal(specifier.startsWith("@tsonic/dotnet/"), false, `${path} imports a C# provider module.`);
    assert.equal(specifier.startsWith("@tsonic/csharp/"), false, `${path} imports a C# marker module.`);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
