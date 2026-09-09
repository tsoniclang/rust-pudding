import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { projectSpecs, repoRoot } from "./config.mjs";
import { assertExecutionOutput } from "./projects.mjs";
import { writeConsolidatedReport } from "./runner.mjs";
import { createScenarioReport, inspectScenarios } from "./scenarios.mjs";

const inventory = await inspectScenarios();

test("all configured projects have evidence without treating support plugins as projects", () => {
  assert.deepEqual(inventory.projects.map(({ id }) => id), projectSpecs.map(({ id }) => id).sort());
  assert(!inventory.projects.some(({ path }) => path === "native/packages/memory-abi"));
  for (const project of projectSpecs.filter(({ kind }) => kind === "lib")) {
    assert.equal(inventory.projects.find(({ id }) => id === project.id).execution, "compile-only");
  }
});

test("successful library tasks never claim execution of uncalled async or native-pointer functions", () => {
  const results = projectSpecs.map(({ id }) => ({ id: `project-${id}`, status: "passed" }));
  const report = createScenarioReport(inventory, results);
  for (const project of ["native-async", "native-native-pointers", "node-async-fs"]) {
    const proofs = report.scenarios.flatMap(({ proofs }) => proofs).filter((proof) => proof.project === project);
    assert(proofs.length > 0);
    for (const proof of proofs) {
      assert.equal(proof.level, "compile-only");
      assert.equal(proof.execution, "passed");
      assert.equal(proof.verification, "compile-only");
      assert(proof.gap.length > 0);
    }
  }
  const signatures = report.scenarios.find(({ id }) => id === "rust/uncalled-lifetime-signatures").proofs[0];
  assert.equal(signatures.verification, "compile-only");
  assert.equal(signatures.tasks[0].mode, "runtime");
});

test("regex oracle accepts exactly empty stdout and rejects a failed condition's single newline", () => {
  const project = projectSpecs.find(({ id }) => id === "js-regexp-complete");
  assert.equal(project.expectedStdout, "");
  assertExecutionOutput(project, "");
  for (const stdout of ["\n", "\r\n", "\n\n", "failure", " "]) {
    assert.throws(() => assertExecutionOutput(project, stdout), /unexpected standard output/u);
  }
  assert.doesNotThrow(() => assertExecutionOutput({ ...project, expectedStdout: undefined }, "\n"));
});

test("existing nonempty stdout contracts also retain untrimmed comparison", () => {
  const project = projectSpecs.find(({ id }) => id === "js-hello");
  assertExecutionOutput(project, "tsonic 6 true\n\n");
  assert.throws(() => assertExecutionOutput(project, "tsonic 6 true\n"), /unexpected standard output/u);
});

test("regex overlap is bounded and asynchronous filesystem compilation stays unpaired", () => {
  const scenario = (id) => inventory.scenarios.find((entry) => entry.id === id);
  assert.equal(scenario("js/regexp/state-patterns-and-string-operations").classification, "paired");
  assert.equal(scenario("js/regexp/state-patterns-and-string-operations").proofs[0].level, "runtime");
  assert.equal(scenario("js/regexp/callback-results-and-matchall-letters").classification, "unpaired");
  assert.equal(scenario("node/fs/read-text-async").classification, "unpaired");
  assert.equal(scenario("node/fs/read-stat-sync").classification, "unpaired");
  assert.equal(scenario("workspace/unscoped-counter-increments").classification, "unpaired");
  assert.equal(scenario("rust/named-elided-and-retained-lifetimes").classification, "native-only");
});

test("consolidated report records compile-only success and never implies peer execution", async () => {
  const scratch = resolve(repoRoot, ".temp/scenario-report-tests");
  await mkdir(scratch, { recursive: true });
  const runRoot = await mkdtemp(resolve(scratch, "case-"));
  const logPath = resolve(runRoot, "task.log");
  await writeFile(logPath, "fixture task log\n");
  const context = {
    runRoot, reportPath: resolve(runRoot, "report.log"), workerLimit: 1, memoryBudgetMiB: 1024,
    started: 0, evidence: [], scenarios: inventory,
    results: [{ id: "project-node-async-fs", status: "passed", commands: [], started: 0, ended: 1, logPath }],
  };
  await writeConsolidatedReport(context, projectSpecs.length);
  const report = JSON.parse(await readFile(resolve(runRoot, "scenarios.json"), "utf8"));
  assert.deepEqual(report, createScenarioReport(inventory, context.results));
  const asyncRead = report.scenarios.find(({ id }) => id === "node/fs/read-text-async").proofs[0];
  assert.equal(asyncRead.execution, "passed");
  assert.equal(asyncRead.verification, "compile-only");
  assert.equal(report.pairing, "declaration-only; peer execution is not certified by this report");
  const log = await readFile(context.reportPath, "utf8");
  assert(log.includes(`SCENARIO_REPORT=${resolve(runRoot, "scenarios.json")}\n`));
  assert(!log.includes(JSON.stringify(report, null, 2)));
});
