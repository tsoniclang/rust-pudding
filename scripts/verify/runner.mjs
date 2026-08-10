import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const commandOutputLimit = 64 * 1024 * 1024;
const metricPrefix = "RUST_PUDDING_TIME|";
const unitPrefix = "rust-pudding-";

export async function createRunContext(repoRoot, workerLimit, memoryBudgetMiB) {
  const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
  const runId = `${stamp}-${process.pid}`;
  const runRoot = resolve(repoRoot, ".tests", `verify-${runId}`);
  const context = {
    repoRoot,
    runId,
    runRoot,
    logRoot: resolve(runRoot, "logs"),
    stageRoot: resolve(runRoot, "workspace"),
    packageRoot: resolve(runRoot, "packages"),
    reportPath: resolve(runRoot, "report.log"),
    workerLimit,
    memoryBudgetMiB,
    started: Date.now(),
    results: [],
    activeTasks: new Map(),
    activeUnits: new Set(),
    evidence: [],
    commandSequence: 0,
    schedulerMemoryMiB: 0,
  };
  await mkdir(context.logRoot, { recursive: true });
  await mkdir(context.packageRoot, { recursive: true });
  return context;
}

export function recordEvidence(context, line) {
  context.evidence.push(line);
}

export function startProgressTimer(context) {
  const timer = setInterval(() => {
    const now = Date.now();
    const active = [...context.activeTasks.entries()]
      .map(([id, started]) => `${id} (${formatDuration(now - started)})`)
      .join(", ");
    console.log(
      `[progress] completed=${context.results.length} active=${context.activeTasks.size} ` +
      `memory=${context.schedulerMemoryMiB}/${context.memoryBudgetMiB}MiB` +
      (active === "" ? "" : ` :: ${active}`),
    );
  }, 180_000);
  timer.unref();
  return timer;
}

export function recoverOrphanedUnits(context) {
  for (const unit of listUnits()) {
    const ownerPid = unitOwnerPid(unit);
    assert.equal(processExists(ownerPid), false, `Another Rust Pudding verifier owns ${unit}.`);
    stopUnit(unit);
    resetUnit(unit);
    recordEvidence(context, `RECOVERED_ORPHAN_UNIT ${unit}`);
  }
  assert.deepEqual(listUnits(), []);
}

export async function runLoggedTask(context, id, action) {
  const logPath = resolve(context.logRoot, `${safeName(id)}.log`);
  const started = Date.now();
  const task = { id, logPath, commands: [] };
  context.activeTasks.set(id, started);
  console.log(`[start] ${id}`);
  await writeFile(logPath, `TASK=${id}\nSTARTED_AT=${new Date(started).toISOString()}\n`, "utf8");
  let status = "passed";
  let error;
  try {
    await action(task);
  } catch (caught) {
    status = "failed";
    error = caught instanceof Error ? caught.stack ?? caught.message : String(caught);
    await appendFile(logPath, `\nERROR\n${error}\n`, "utf8");
  }
  const ended = Date.now();
  await appendFile(
    logPath,
    `\nSTATUS=${status}\nFINISHED_AT=${new Date(ended).toISOString()}\nDURATION_MS=${ended - started}\n`,
    "utf8",
  );
  const result = { id, status, error, logPath, commands: task.commands, started, ended };
  context.results.push(result);
  context.activeTasks.delete(id);
  console.log(`[${status}] ${id} :: ${formatDuration(ended - started)}`);
  return result;
}

export async function runCommand(context, task, spec) {
  const unit = nextUnitName(context, spec.id);
  const metricFormat = `${metricPrefix}elapsed=%e|user=%U|system=%S|cpu=%P|max_rss_kib=%M|exit=%x`;
  const args = [
    "--user",
    "--scope",
    "--quiet",
    `--unit=${unit}`,
    "-p",
    `MemoryMax=${spec.memoryMiB}M`,
    "-p",
    "MemorySwapMax=0",
    "-p",
    `TasksMax=${spec.tasksMax ?? 192}`,
    "/usr/bin/time",
    `--format=${metricFormat}`,
    spec.executable,
    ...spec.args,
  ];
  await appendFile(
    task.logPath,
    `\n===== COMMAND ${spec.id} =====\nCWD=${spec.cwd}\nMEMORY_MAX_MIB=${spec.memoryMiB}\n` +
    `TIMEOUT_MINUTES=${spec.timeoutMinutes}\nCOMMAND=${renderCommand("systemd-run", args)}\n`,
    "utf8",
  );
  const managed = startManagedProcess(context, unit, args, spec);
  const timeout = setTimeout(() => managed.forceTerminate("timeout"), spec.timeoutMinutes * 60_000);
  const outcome = await managed.closed;
  clearTimeout(timeout);
  await appendCommandOutput(task.logPath, outcome);
  const metrics = parseMetrics(outcome.stderr);
  task.commands.push({ id: spec.id, metrics, code: outcome.code, signal: outcome.signal });
  assert.equal(outcome.overflow, false, `${spec.id} exceeded the output limit.`);
  assert.equal(outcome.terminationReason, undefined, `${spec.id} was terminated: ${outcome.terminationReason}.`);
  assert.equal(outcome.signal, null, `${spec.id} terminated by ${outcome.signal}.`);
  assert.equal(outcome.code, 0, `${spec.id} exited with code ${outcome.code}.`);
  assert.notEqual(metrics, undefined, `${spec.id} emitted no resource metrics.`);
  return { stdout: outcome.stdout, stderr: outcome.stderr, metrics };
}

export async function runTaskGraph(context, items, execute) {
  const pending = new Map(items.map((item) => [item.id, item]));
  const completed = new Map();
  const running = new Map();
  for (const item of items) {
    assert(item.memoryMiB <= context.memoryBudgetMiB, `${item.id} exceeds the global memory budget.`);
    for (const dependency of item.dependencies) {
      assert(items.some(({ id }) => id === dependency), `${item.id} has unknown dependency ${dependency}.`);
    }
  }
  while (pending.size > 0 || running.size > 0) {
    let started = false;
    for (const item of items) {
      if (!pending.has(item.id)) continue;
      if (!item.dependencies.every((dependency) => completed.has(dependency))) continue;
      const failedDependency = item.dependencies.find((dependency) => completed.get(dependency) !== "passed");
      if (failedDependency !== undefined) {
        pending.delete(item.id);
        const result = await runLoggedTask(context, `project-${item.id}`, async () => {
          assert.fail(`Dependency ${failedDependency} did not pass.`);
        });
        completed.set(item.id, result.status);
        started = true;
        continue;
      }
      if (running.size >= context.workerLimit) continue;
      if (context.schedulerMemoryMiB + item.memoryMiB > context.memoryBudgetMiB) continue;
      pending.delete(item.id);
      context.schedulerMemoryMiB += item.memoryMiB;
      const promise = runLoggedTask(context, `project-${item.id}`, (task) => execute(task, item))
        .then((result) => completed.set(item.id, result.status))
        .finally(() => {
          context.schedulerMemoryMiB -= item.memoryMiB;
          running.delete(item.id);
        });
      running.set(item.id, promise);
      started = true;
    }
    if (running.size > 0) {
      await Promise.race(running.values());
    } else if (!started && pending.size > 0) {
      assert.fail(`Project graph cannot make progress: ${[...pending.keys()].join(", ")}.`);
    }
  }
  return completed;
}

export async function cleanupUnits(context) {
  for (const unit of [...context.activeUnits]) stopUnit(unit);
  context.activeUnits.clear();
  for (const unit of listUnits()) {
    if (unitOwnerPid(unit) !== process.pid) continue;
    stopUnit(unit);
    resetUnit(unit);
  }
}

export async function writeConsolidatedReport(context, expectedProjectCount) {
  const ended = Date.now();
  const passed = context.results.filter(({ status }) => status === "passed").length;
  const failed = context.results.length - passed;
  const projectResults = context.results.filter(({ id }) => id.startsWith("project-"));
  let report = [
    "RUST_PUDDING_VERIFICATION",
    `RUN_ROOT=${context.runRoot}`,
    `WORKERS=${context.workerLimit}`,
    `MEMORY_BUDGET_MIB=${context.memoryBudgetMiB}`,
    `TASKS=${context.results.length}`,
    `PASSED=${passed}`,
    `FAILED=${failed}`,
    `EXPECTED_PROJECTS=${expectedProjectCount}`,
    `COMPLETED_PROJECTS=${projectResults.length}`,
    "SKIPPED=0",
    "TODO=0",
    `DURATION_MS=${ended - context.started}`,
    "",
    ...context.evidence,
    "",
    "TASK_SUMMARY",
  ].join("\n");
  for (const result of [...context.results].sort((left, right) => left.id.localeCompare(right.id))) {
    report += `\n${result.status.toUpperCase()} ${result.id} ${formatDuration(result.ended - result.started)}`;
    for (const command of result.commands) {
      report += command.metrics === undefined
        ? `\n  COMMAND ${command.id} metrics=missing`
        : `\n  COMMAND ${command.id} elapsed=${command.metrics.elapsedSeconds}s ` +
          `cpu=${command.metrics.cpuPercent}% max_rss=${command.metrics.maxRssKiB}KiB`;
    }
  }
  report += "\n";
  await writeFile(context.reportPath, report, "utf8");
  for (const result of [...context.results].sort((left, right) => left.id.localeCompare(right.id))) {
    await appendFile(context.reportPath, `\n===== ${result.id} =====\n`, "utf8");
    await appendFile(context.reportPath, await readFile(result.logPath), "utf8");
  }
  console.log(`Rust Pudding: ${passed}/${context.results.length} tasks passed; ${failed} failed.`);
  console.log(`Consolidated report: ${context.reportPath}`);
  return { passed, failed, projectResults: projectResults.length };
}

function startManagedProcess(context, unit, args, spec) {
  const stdout = createCollector();
  const stderr = createCollector();
  let terminationReason;
  let overflow = false;
  const child = spawn("systemd-run", args, {
    cwd: spec.cwd,
    env: { ...process.env, ...spec.environment },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  context.activeUnits.add(unit);
  const onData = (collector) => (chunk) => {
    if (!collector.append(chunk)) {
      overflow = true;
      forceTerminate("output limit exceeded");
    }
  };
  child.stdout.on("data", onData(stdout));
  child.stderr.on("data", onData(stderr));
  const closed = new Promise((resolveClosed, rejectClosed) => {
    child.once("error", rejectClosed);
    child.once("close", (code, signal) => {
      context.activeUnits.delete(unit);
      resetUnit(unit);
      resolveClosed({
        code,
        signal,
        stdout: stdout.text(),
        stderr: stderr.text(),
        overflow,
        terminationReason,
      });
    });
  });
  function forceTerminate(reason) {
    if (terminationReason === undefined) terminationReason = reason;
    stopUnit(unit);
    if (child.exitCode === null) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    }
  }
  return { child, closed, forceTerminate };
}

function createCollector() {
  const chunks = [];
  let size = 0;
  return {
    append(chunk) {
      size += chunk.length;
      if (size > commandOutputLimit) return false;
      chunks.push(chunk);
      return true;
    },
    text() {
      return Buffer.concat(chunks).toString("utf8");
    },
  };
}

async function appendCommandOutput(logPath, outcome) {
  await appendFile(
    logPath,
    `\n--- STDOUT ---\n${outcome.stdout}\n--- STDERR ---\n${outcome.stderr}` +
    `\n--- OUTCOME ---\nCODE=${outcome.code}\nSIGNAL=${outcome.signal ?? "none"}\n` +
    `TERMINATION=${outcome.terminationReason ?? "none"}\nOUTPUT_OVERFLOW=${outcome.overflow ? "yes" : "no"}\n`,
    "utf8",
  );
}

function parseMetrics(stderr) {
  const line = stderr.split(/\r?\n/u).find((candidate) => candidate.startsWith(metricPrefix));
  if (line === undefined) return undefined;
  const values = Object.fromEntries(
    line.slice(metricPrefix.length).split("|").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index), part.slice(index + 1)];
    }),
  );
  return {
    elapsedSeconds: Number.parseFloat(values.elapsed),
    cpuPercent: Number.parseFloat(values.cpu.replace("%", "")),
    maxRssKiB: Number.parseInt(values.max_rss_kib, 10),
  };
}

function nextUnitName(context, id) {
  context.commandSequence += 1;
  return `${unitPrefix}${process.pid}-${context.commandSequence}-${safeName(id).slice(0, 48)}`;
}

function safeName(value) {
  return value.replaceAll(/[^a-zA-Z0-9_.-]/gu, "-");
}

function listUnits() {
  const result = spawnSync("systemctl", ["--user", "list-units", "--all", "--plain", "--no-legend", `${unitPrefix}*.scope`], { encoding: "utf8" });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/u).map((line) => line.trim().split(/\s+/u)[0]).filter(Boolean);
}

function unitOwnerPid(unit) {
  const match = unit.match(/^rust-pudding-(\d+)-/u);
  return match === null ? -1 : Number.parseInt(match[1], 10);
}

function processExists(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return false;
    throw error;
  }
}

function stopUnit(unit) {
  spawnSync("systemctl", ["--user", "stop", unit], { stdio: "ignore" });
}

function resetUnit(unit) {
  spawnSync("systemctl", ["--user", "reset-failed", unit], { stdio: "ignore" });
}

function renderCommand(command, args) {
  return [command, ...args].map((part) => JSON.stringify(part)).join(" ");
}

function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
}
