// Final status for a ritual: node ritual/report.mjs <id> <status> [noteFile] [prUrl]
// Failed/rejected rituals are refunded by the platform.
import { existsSync, readFileSync } from "node:fs";
import { rsi, scrub } from "./lib.mjs";

const [id, status, noteFile, prUrl] = process.argv.slice(2);
const note = noteFile && existsSync(noteFile) ? scrub(readFileSync(noteFile, "utf8").slice(-600)) : undefined;
const res = await rsi("/api/runner/report", { id: Number(id), status, note, prUrl: prUrl || undefined });
console.log(res);
