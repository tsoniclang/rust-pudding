import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { runCommand } from "./runner.mjs";

const bannedGeneratedPatterns = [
  /\bunsafe\b/u,
  /std::mem::transmute/u,
  /std::ptr::/u,
  /\bdyn\s+Any\b/u,
];

export async function executeProject(context, task, project) {
  const projectDirectory = resolve(context.stageRoot, project.path);
  const cli = resolve(
    context.stageRoot,
    project.workspacePath,
    "node_modules/@tsonic/cli/dist/src/index.js",
  );
  const commonEnvironment = {
    CARGO_BUILD_JOBS: "2",
    CARGO_NET_OFFLINE: "true",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
  };
  await compile(context, task, project, projectDirectory, cli, commonEnvironment);
  const outputDirectory = resolve(projectDirectory, "out/rust");
  const firstDigest = await verifyGeneratedOutput(outputDirectory, project);
  await compile(context, task, project, projectDirectory, cli, commonEnvironment, "repeat");
  const secondDigest = await verifyGeneratedOutput(outputDirectory, project);
  assert.equal(secondDigest, firstDigest, `${project.id} output is nondeterministic.`);

  const manifest = resolve(outputDirectory, "Cargo.toml");
  await runCommand(context, task, command(project, "cargo-lock", "cargo", [
    "generate-lockfile",
    "--manifest-path",
    manifest,
    "--offline",
  ], projectDirectory, commonEnvironment));
  await runCommand(context, task, command(project, "cargo-fmt", "cargo", [
    "fmt",
    "--manifest-path",
    manifest,
    "--check",
  ], projectDirectory, commonEnvironment));
  await runCommand(context, task, command(project, "cargo-check", "cargo", [
    "check",
    "--manifest-path",
    manifest,
    "--locked",
  ], projectDirectory, commonEnvironment));
  await runCommand(context, task, command(project, "cargo-clippy", "cargo", [
    "clippy",
    "--manifest-path",
    manifest,
    "--locked",
    "--",
    "-D",
    "warnings",
  ], projectDirectory, commonEnvironment));
  const execution = await runCommand(context, task, command(project, project.kind === "bin" ? "cargo-run" : "cargo-test", "cargo", [
    project.kind === "bin" ? "run" : "test",
    "--manifest-path",
    manifest,
    "--locked",
    "--quiet",
  ], projectDirectory, commonEnvironment));
  if (project.expectedStdout !== undefined) {
    assert.equal(execution.stdout, project.expectedStdout, `${project.id} emitted unexpected standard output.`);
  }
}

async function compile(context, task, project, projectDirectory, cli, environment, suffix = "initial") {
  await runCommand(context, task, {
    id: `${project.id}-tsonic-${suffix}`,
    executable: "node",
    args: ["--max-old-space-size=2304", cli, "build", "--project", "tsonic.json"],
    cwd: projectDirectory,
    memoryMiB: project.memoryMiB,
    timeoutMinutes: project.timeoutMinutes,
    environment,
  });
}

function command(project, suffix, executable, args, cwd, environment) {
  return {
    id: `${project.id}-${suffix}`,
    executable,
    args,
    cwd,
    memoryMiB: 2_048,
    timeoutMinutes: project.timeoutMinutes,
    tasksMax: 192,
    environment,
  };
}

async function verifyGeneratedOutput(outputDirectory, project) {
  const files = await collectFiles(outputDirectory);
  assert.equal(files.includes("Cargo.toml"), true, `${project.id} emitted no Cargo manifest.`);
  assert.equal(files.includes("src/lib.rs"), true, `${project.id} emitted no library root.`);
  assert.equal(files.includes("src/main.rs"), project.kind === "bin", `${project.id} emitted the wrong output kind.`);
  const manifest = await readFile(resolve(outputDirectory, "Cargo.toml"), "utf8");
  assert.match(manifest, new RegExp(`name = ${JSON.stringify(project.crateName)}`, "u"));
  const hash = createHash("sha256");
  for (const file of files.filter((path) => path !== "Cargo.lock" && !path.startsWith("target/"))) {
    const content = await readFile(resolve(outputDirectory, file));
    hash.update(file);
    hash.update("\0");
    hash.update(content);
    if (file.endsWith(".rs")) {
      const text = content.toString("utf8");
      for (const pattern of bannedGeneratedPatterns) {
        assert.doesNotMatch(text, pattern, `${project.id} emitted banned Rust mechanism ${pattern}.`);
      }
    }
  }
  return hash.digest("hex");
}

async function collectFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === "target") continue;
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      if (entry.isFile()) files.push(relative(root, path));
    }
  }
  assert.equal((await stat(root)).isDirectory(), true);
  await visit(root);
  return files.sort();
}
