import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const siblingRoot = resolve(repoRoot, "..");

export const localRepositories = Object.freeze({
  tsonic: process.env.LOCAL_TSONIC ?? resolve(siblingRoot, "tsonic"),
  target: process.env.LOCAL_TSONIC_RUST ?? resolve(siblingRoot, "tsonic-rust"),
  runtime: process.env.LOCAL_RUST_RUNTIME ?? resolve(siblingRoot, "rust-runtime"),
  js: process.env.LOCAL_RUST_JS ?? resolve(siblingRoot, "rust-js"),
  node: process.env.LOCAL_RUST_NODEJS ?? resolve(siblingRoot, "rust-nodejs"),
});

export const workspaceSpecs = Object.freeze([
  workspace("native", false),
  workspace("js", false),
  workspace("nodejs", true),
  workspace("workspaces/scoped-multi-project", false),
  workspace("workspaces/unscoped-multi-project", false),
]);

export const packageSpecs = Object.freeze([
  packageSpec("tsts", localRepositories.tsonic, "packages/tsts"),
  packageSpec("source-core", localRepositories.tsonic, "packages/source-core"),
  packageSpec("target-api", localRepositories.tsonic, "packages/target-api"),
  packageSpec("host", localRepositories.tsonic, "packages/host"),
  packageSpec("cli", localRepositories.tsonic, "packages/cli"),
  packageSpec("rust-runtime", localRepositories.runtime, "."),
  packageSpec("rust-js", localRepositories.js, "."),
  packageSpec("target-rust", localRepositories.target, "."),
  packageSpec("rust-nodejs", localRepositories.node, ".", true),
]);

export const projectSpecs = Object.freeze([
  project("js-calculator", "js/packages/calculator", "js", "rust_proof_js_calculator", "bin", { surfaces: ["js"] }),
  project("js-callbacks", "js/packages/callbacks", "js", "rust_proof_js_callbacks", "bin", { surfaces: ["js"] }),
  project("js-collections", "js/packages/collections", "js", "rust_proof_js_collections", "bin", { surfaces: ["js"] }),
  project("js-fibonacci", "js/packages/fibonacci", "js", "rust_proof_js_fibonacci", "bin", { surfaces: ["js"] }),
  project("js-hello", "js/packages/hello", "js", "rust_proof_js_hello", "bin", { surfaces: ["js"] }),
  project("js-json-regexp-date", "js/packages/json-regexp-date", "js", "rust_proof_js_json_regexp_date", "bin", { surfaces: ["js"] }),
  project("native-async", "native/packages/async", "native", "rust_proof_native_async", "lib"),
  project("native-calculator", "native/packages/calculator", "native", "rust_proof_native_calculator", "bin"),
  project("native-fibonacci", "native/packages/fibonacci", "native", "rust_proof_native_fibonacci", "bin"),
  project("native-fixed-arrays", "native/packages/fixed-arrays", "native", "rust_proof_native_fixed_arrays", "bin"),
  project("native-hello", "native/packages/hello", "native", "rust_proof_native_hello", "bin"),
  project("native-models", "native/packages/models", "native", "rust_proof_native_models", "bin"),
  project("native-typed-locations", "native/packages/typed-locations", "native", "rust_proof_native_typed_locations", "bin"),
  project("node-assertions", "nodejs/packages/assertions", "nodejs", "rust_proof_node_assertions", "bin", { surfaces: ["js"], needsNodeCapability: true }),
  project("node-async-fs", "nodejs/packages/async-fs", "nodejs", "rust_proof_node_async_fs", "lib", { surfaces: ["js"], needsNodeCapability: true }),
  project("node-crypto-buffer", "nodejs/packages/crypto-buffer", "nodejs", "rust_proof_node_crypto_buffer", "bin", { surfaces: ["js"], needsNodeCapability: true }),
  project("node-env-path", "nodejs/packages/env-path", "nodejs", "rust_proof_node_env_path", "bin", { surfaces: ["js"], needsNodeCapability: true }),
  project("node-file-system", "nodejs/packages/file-system", "nodejs", "rust_proof_node_file_system", "bin", { surfaces: ["js"], needsNodeCapability: true }),
  project("node-url", "nodejs/packages/url", "nodejs", "rust_proof_node_url", "bin", { surfaces: ["js"], needsNodeCapability: true }),
  project("workspace-scoped-domain", "workspaces/scoped-multi-project/packages/domain", "workspaces/scoped-multi-project", "rust_proof_workspace_scoped_domain", "lib", {
    packageExports: {
      ".": "./src/index.ts",
      "./index.js": "./src/index.ts",
      "./package.json": "./package.json",
    },
  }),
  project("workspace-scoped-api", "workspaces/scoped-multi-project/packages/api", "workspaces/scoped-multi-project", "rust_proof_workspace_scoped_api", "bin", {
    dependencies: ["workspace-scoped-domain"],
    packageDependencies: { "@acme/domain": "*" },
  }),
  project("workspace-unscoped-domain", "workspaces/unscoped-multi-project/packages/acme-domain", "workspaces/unscoped-multi-project", "rust_proof_workspace_unscoped_domain", "lib", {
    packageExports: {
      ".": "./src/index.ts",
      "./index.js": "./src/index.ts",
      "./package.json": "./package.json",
    },
  }),
  project("workspace-unscoped-api", "workspaces/unscoped-multi-project/packages/acme-api", "workspaces/unscoped-multi-project", "rust_proof_workspace_unscoped_api", "bin", {
    dependencies: ["workspace-unscoped-domain"],
    packageDependencies: { "acme-domain": "*" },
  }),
]);

export const workerLimit = positiveInteger(
  process.env.RUST_PUDDING_JOBS,
  Math.min(4, availableParallelism()),
);
export const memoryBudgetMiB = positiveInteger(
  process.env.RUST_PUDDING_MEMORY_MIB,
  10_240,
);

function workspace(path, needsNodeCapability) {
  return Object.freeze({ path, needsNodeCapability });
}

function packageSpec(id, repository, path, nodeOnly = false) {
  return Object.freeze({ id, repository, path, nodeOnly });
}

function project(id, path, workspacePath, crateName, kind, options = {}) {
  return Object.freeze({
    id,
    path,
    workspacePath,
    crateName,
    kind,
    dependencies: Object.freeze(options.dependencies ?? []),
    packageDependencies: Object.freeze(options.packageDependencies ?? {}),
    packageExports: options.packageExports === undefined
      ? undefined
      : Object.freeze(options.packageExports),
    surfaces: Object.freeze(options.surfaces ?? []),
    needsNodeCapability: options.needsNodeCapability === true,
    memoryMiB: options.memoryMiB ?? 3_072,
    timeoutMinutes: options.timeoutMinutes ?? 10,
  });
}

function positiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received '${value}'.`);
  }
  return parsed;
}
