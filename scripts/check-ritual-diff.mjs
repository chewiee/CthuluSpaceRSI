// Gatekeeper for ritual patches. Run against a unified diff:
//   node scripts/check-ritual-diff.mjs ritual.patch
// Exits non-zero (with reasons) if the ritual reaches outside game/, is too
// large, or adds network/eval access to game code.
import { readFileSync } from "node:fs";

const MAX_FILES = 15;
const MAX_CHANGED_LINES = 600;
const MAX_ADDED_LINE_LENGTH = 2000;

// The game may only talk to the platform through window.RSI, and the CSP blocks
// other hosts anyway; these catch it earlier with a readable reason.
const FORBIDDEN = [
  [/\bfetch\s*\(/, "network access (fetch)"],
  [/XMLHttpRequest/, "network access (XMLHttpRequest)"],
  [/\bWebSocket\b/, "network access (WebSocket)"],
  [/\bEventSource\b/, "network access (EventSource)"],
  [/sendBeacon/, "network access (sendBeacon)"],
  [/\beval\s*\(/, "eval"],
  [/new\s+Function\s*\(/, "new Function"],
  [/\bimport\s*\(/, "dynamic import"],
  [/document\.cookie/, "cookies"],
  [/localStorage|sessionStorage|indexedDB/, "browser storage (holds the player's identity)"],
  [/rsi\.token/, "the player's identity token"],
  [/https?:\/\/(?!fonts\.googleapis\.com)/, "external URL"],
  [/sk-ant-/, "something that looks like an API key"],
];

const patch = readFileSync(process.argv[2], "utf8");
const problems = [];
const files = new Set();
let changed = 0;
let current = null;

for (const line of patch.split("\n")) {
  const header = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
  if (header) {
    for (const f of [header[1], header[2]]) {
      files.add(f);
      if (!f.startsWith("game/")) problems.push(`touches protected path: ${f}`);
      if (/^game\/(rsi|api)(\/|$)|^game\/_headers$/.test(f)) problems.push(`uses reserved path: ${f}`);
    }
    current = header[2];
    continue;
  }
  if (/^(GIT binary patch|Binary files )/.test(line)) problems.push(`binary change in ${current}`);
  if (line.startsWith("+++") || line.startsWith("---")) continue;
  if (line.startsWith("+") || line.startsWith("-")) changed++;
  if (!line.startsWith("+")) continue;

  const added = line.slice(1);
  if (added.length > MAX_ADDED_LINE_LENGTH) problems.push(`very long line in ${current}`);
  for (const [re, why] of FORBIDDEN) {
    if (re.test(added)) problems.push(`${current}: adds ${why}: ${added.trim().slice(0, 120)}`);
  }
}

if (files.size === 0) problems.push("empty ritual: no changes");
if (files.size > MAX_FILES) problems.push(`too many files (${files.size} > ${MAX_FILES})`);
if (changed > MAX_CHANGED_LINES) problems.push(`too many changed lines (${changed} > ${MAX_CHANGED_LINES})`);

if (problems.length) {
  console.error("Ritual rejected:\n- " + [...new Set(problems)].join("\n- "));
  process.exit(1);
}
console.log(`Ritual diff OK: ${files.size} file(s), ${changed} changed line(s).`);
