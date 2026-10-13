// Shared helpers for the ritual runner (GitHub Actions).
import { appendFileSync } from "node:fs";

export async function rsi(path, data) {
  const res = await fetch(new URL(path, process.env.RSI_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RSI_RUNNER_TOKEN}` },
    body: JSON.stringify(data || {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${body.error || ""}`);
  return body;
}

export function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  else console.log(`[output] ${name}=${value}`);
}

// Anything that leaves the runner (PR body, Chronicle note) passes through this.
export function scrub(text) {
  return String(text || "").replace(/sk-ant-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 1500);
}
