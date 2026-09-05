import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, lstat, mkdir, readFile, readdir, realpath } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  localRepositories,
  packageSpecs,
  projectSpecs,
  repoRoot,
  workspaceSpecs,
} from "./config.mjs";
import { recordEvidence, runCommand, runLoggedTask } from "./runner.mjs";

const { bindPackedWorkspaceDependencies, verifyPackedWorkspaceDependencies } = await import(
  pathToFileURL(resolve(localRepositories.tsonic, "test/scripts/packed-workspace.mjs")).href
);

const ignoredDirectoryNames = new Set([
  ".git",
  ".temp",
  ".tests",
  "node_modules",
  "out",
  "target",
]);

export async function buildPrerequisites(context) {
  const steps = [
    {
      id: "build-tsonic",
      executable: "npm",
      args: ["run", "build"],
      cwd: localRepositories.tsonic,
      memoryMiB: 8_192,
      timeoutMinutes: 30,
      environment: {},
    },
    {
      id: "build-target-rust",
      executable: "npm",
      args: ["run", "build"],
      cwd: localRepositories.target,
      memoryMiB: 4_096,
      timeoutMinutes: 15,
      environment: { TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
    },
    {
      id: "build-rust-nodejs",
      executable: "npm",
      args: ["run", "build"],
      cwd: localRepositories.node,
      memoryMiB: 4_096,
      timeoutMinutes: 15,
      environment: { TSONIC_SKIP_DEPENDENCY_BUILDS: "1" },
    },
  ];
  for (const step of steps) {
    const result = await runLoggedTask(context, step.id, (task) => runCommand(context, task, step));
    assert.equal(result.status, "passed", `${step.id} failed.`);
  }
  await verifyRepositoryInputs(context);
}

export async function verifyRepositoryInputs(context) {
  const repositories = { ...localRepositories, proof: repoRoot };
  for (const [name, path] of Object.entries(repositories)) {
    const branch = git(path, ["branch", "--show-current"]);
    const head = git(path, ["rev-parse", "HEAD"]);
    const status = git(path, ["status", "--porcelain"]);
    assert.notEqual(branch, "", `${name} is detached.`);
    assert.equal(status, "", `${name} is dirty and cannot produce exact proof artifacts:\n${status}`);
    recordEvidence(context, `REPOSITORY ${name} branch=${branch} head=${head} dirty=no`);
  }
}

export async function packExactPackages(context) {
  const artifacts = new Map();
  for (const spec of packageSpecs) {
    const result = await runLoggedTask(context, `pack-${spec.id}`, async (task) => {
      const packageDirectory = resolve(spec.repository, spec.path);
      const packed = await runCommand(context, task, {
        id: `npm-pack-${spec.id}`,
        executable: "npm",
        args: ["pack", packageDirectory, "--pack-destination", context.packageRoot, "--silent"],
        cwd: spec.repository,
        memoryMiB: 1_024,
        timeoutMinutes: 5,
        environment: {},
      });
      const filename = packed.stdout.trim().split(/\r?\n/u).at(-1);
      assert.equal(filename?.endsWith(".tgz"), true, `${spec.id} produced no npm artifact.`);
      const artifactPath = resolve(context.packageRoot, filename);
      const manifest = JSON.parse(await readFile(resolve(packageDirectory, "package.json"), "utf8"));
      const artifact = {
        ...spec,
        name: manifest.name,
        version: manifest.version,
        path: artifactPath,
        sha256: await sha256(artifactPath),
      };
      artifacts.set(spec.id, artifact);
      recordEvidence(context, `PACKAGE ${artifact.name}@${artifact.version} file=${filename} sha256=${artifact.sha256}`);
    });
    assert.equal(result.status, "passed", `pack-${spec.id} failed.`);
  }
  assert.equal(artifacts.size, packageSpecs.length);
  return artifacts;
}

export async function createFreshStage(context) {
  await mkdir(context.stageRoot, { recursive: true });
  for (const entry of await readdir(repoRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) continue;
    const source = resolve(repoRoot, entry.name);
    await cp(source, resolve(context.stageRoot, entry.name), {
      recursive: true,
      filter(candidate) {
        const path = relative(repoRoot, candidate);
        return !path.split("/").some((part) => ignoredDirectoryNames.has(part));
      },
    });
  }
  recordEvidence(context, `STAGED_SOURCE ${context.stageRoot}`);
}

export async function installStagedWorkspaces(context, artifacts) {
  let nextIndex = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(3, workspaceSpecs.length) }, async () => {
    while (nextIndex < workspaceSpecs.length) {
      const workspace = workspaceSpecs[nextIndex++];
      const result = await runLoggedTask(context, `install-${workspace.path}`, async (task) => {
        const selected = [...artifacts.values()]
          .filter((artifact) => !artifact.nodeOnly || workspace.needsNodeCapability);
        const workspaceDirectory = resolve(context.stageRoot, workspace.path);
        const manifests = [
          resolve(workspaceDirectory, "package.json"),
          ...projectSpecs.filter((project) => project.workspacePath === workspace.path)
            .map((project) => resolve(context.stageRoot, project.path, "package.json")),
        ];
        const bindings = bindPackedWorkspaceDependencies(workspaceDirectory, manifests, selected);
        await runCommand(context, task, {
          id: `npm-install-${workspace.path}`,
          executable: "npm",
          args: [
            "install",
            "--offline",
            "--ignore-scripts",
            "--no-audit",
            "--no-fund",
            "--no-save",
            "--package-lock=false",
            "--include=dev",
            ...selected.map(({ path }) => path),
          ],
          cwd: workspaceDirectory,
          memoryMiB: 2_048,
          timeoutMinutes: 10,
          environment: {},
        });
        await verifyInstalledWorkspace(workspaceDirectory, workspace, selected);
        verifyPackedWorkspaceDependencies(workspaceDirectory, bindings);
      });
      results.push(result);
    }
  });
  await Promise.all(workers);
  assert.equal(results.length, workspaceSpecs.length);
  assert.equal(results.every(({ status }) => status === "passed"), true);
}

export async function verifySystemdBoundary(context) {
  const result = await runLoggedTask(context, "systemd-memory-boundary", (task) => runCommand(context, task, {
    id: "systemd-memory-boundary",
    executable: "true",
    args: [],
    cwd: repoRoot,
    memoryMiB: 256,
    timeoutMinutes: 1,
    environment: {},
  }));
  assert.equal(result.status, "passed");
}

async function verifyInstalledWorkspace(workspaceDirectory, workspace, selected) {
  const stageRealPath = await realpath(workspaceDirectory);
  for (const artifact of selected) {
    const installed = resolve(workspaceDirectory, "node_modules", ...artifact.name.split("/"));
    const stats = await lstat(installed);
    assert.equal(stats.isSymbolicLink(), false, `${artifact.name} is not a packed install.`);
    const installedRealPath = await realpath(installed);
    assert.equal(installedRealPath.startsWith(`${stageRealPath}/`), true, `${artifact.name} escaped the stage.`);
  }
  const nodePath = resolve(workspaceDirectory, "node_modules/@tsonic/rust-nodejs");
  if (!workspace.needsNodeCapability) {
    await assertMissing(nodePath, `${workspace.path} unexpectedly installed the Node capability.`);
  }
}

async function assertMissing(path, message) {
  try {
    await lstat(path);
    assert.fail(message);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function git(repository, args) {
  const result = spawnSync("git", ["-C", repository, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
