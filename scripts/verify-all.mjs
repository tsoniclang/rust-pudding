import assert from "node:assert/strict";
import { verifyArchitecture } from "./verify/architecture.mjs";
import {
  memoryBudgetMiB,
  projectSpecs,
  repoRoot,
  workerLimit,
} from "./verify/config.mjs";
import {
  buildPrerequisites,
  createFreshStage,
  installStagedWorkspaces,
  packExactPackages,
  verifySystemdBoundary,
} from "./verify/preflight.mjs";
import { executeProject } from "./verify/projects.mjs";
import {
  cleanupUnits,
  createRunContext,
  recoverOrphanedUnits,
  recordEvidence,
  runLoggedTask,
  runTaskGraph,
  startProgressTimer,
  writeConsolidatedReport,
} from "./verify/runner.mjs";

const context = await createRunContext(repoRoot, workerLimit, memoryBudgetMiB);
recoverOrphanedUnits(context);
const progressTimer = startProgressTimer(context);
let fatalError;

try {
  const architecture = await runLoggedTask(context, "architecture-contract", async () => {
    const counts = await verifyArchitecture();
    recordEvidence(context, `ARCHITECTURE files=${counts.files} workspaces=${counts.workspaces} projects=${counts.projects}`);
  });
  assert.equal(architecture.status, "passed");
  await verifySystemdBoundary(context);
  await buildPrerequisites(context);
  const artifacts = await packExactPackages(context);
  await createFreshStage(context);
  await installStagedWorkspaces(context, artifacts);
  await runTaskGraph(context, projectSpecs, (task, project) => executeProject(context, task, project));
} catch (error) {
  fatalError = error instanceof Error ? error.stack ?? error.message : String(error);
  recordEvidence(context, `FATAL ${fatalError.replaceAll("\n", " | ")}`);
} finally {
  clearInterval(progressTimer);
  await cleanupUnits(context);
}

const report = await writeConsolidatedReport(context, projectSpecs.length);
if (fatalError !== undefined || report.failed !== 0 || report.projectResults !== projectSpecs.length) {
  process.exitCode = 1;
}
