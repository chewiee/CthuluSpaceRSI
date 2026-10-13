// Claims the next queued ritual, if the platform's guardrails allow one.
// Writes $RITUAL_DIR/claim.json and sets the `id` step output.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { rsi, setOutput } from "./lib.mjs";

const claim = await rsi("/api/runner/claim");
if (!claim.ritual) {
  console.log(`No ritual this time: ${claim.reason}`);
  process.exit(0);
}
mkdirSync(process.env.RITUAL_DIR, { recursive: true });
writeFileSync(join(process.env.RITUAL_DIR, "claim.json"), JSON.stringify(claim, null, 2));
console.log(`Claimed ritual #${claim.ritual.id} (model ${claim.model}, budget $${claim.budgetUsd}, ${claim.maxTurns} turns)`);
setOutput("id", claim.ritual.id);
