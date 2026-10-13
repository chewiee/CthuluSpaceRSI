// Runs Claude Code headless inside game/ with hard caps, then records the cost.
// The agent gets file tools only (no shell, no web), confined to game/ by
// --restricted. The player's prompt is passed as an argument, never via a shell.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { rsi, scrub } from "./lib.mjs";

const dir = process.env.RITUAL_DIR;
const claim = JSON.parse(readFileSync(join(dir, "claim.json"), "utf8"));
const rules = fileURLToPath(new URL("./agent-rules.md", import.meta.url));
const gameDir = fileURLToPath(new URL("../game", import.meta.url));

const prompt = [
  "A player has performed this ritual:",
  "<player_ritual>",
  claim.ritual.prompt.replace(/<\/?player_ritual>/gi, ""),
  "</player_ritual>",
  "Change the game accordingly, following your rules.",
].join("\n");

const args = [
  "-p", prompt,
  "--bare",
  "--restricted",
  "--model", claim.model,
  "--effort", "medium",
  "--max-budget-usd", String(claim.budgetUsd),
  "--max-turns", String(claim.maxTurns),
  "--tools", "Read,Edit,Write,Glob,Grep",
  "--allowedTools", "Read,Edit,Write,Glob,Grep",
  "--permission-mode", "dontAsk",
  "--permission-prompts", "none",
  "--no-session-persistence",
  "--append-system-prompt-file", rules,
  "--output-format", "json",
];

const run = spawnSync("claude", args, {
  cwd: gameDir,
  encoding: "utf8",
  timeout: 15 * 60 * 1000,
  maxBuffer: 50 * 1024 * 1024,
});

let out = {};
try { out = JSON.parse(run.stdout); } catch { /* reported below */ }
// If the run died before reporting cost, assume the whole budget was spent.
const costUsd = typeof out.total_cost_usd === "number" ? out.total_cost_usd : claim.budgetUsd;
const summary = scrub(out.result || run.stderr || "The ritual produced no words.");

writeFileSync(join(dir, "summary.txt"), summary);
await rsi("/api/runner/report", { id: claim.ritual.id, status: "running", costUsd });

console.log(`Exit ${run.status}, subtype ${out.subtype}, turns ${out.num_turns}, cost $${costUsd.toFixed(4)}`);
console.log(summary);
