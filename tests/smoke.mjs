// Headless smoke test for a built world (dist/). Runs in CI with no secrets.
// Serves dist/ with a stub API, loads the game in Chromium and checks that it
// boots, renders, survives some play without errors, and still calls the RSI hooks.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const dist = fileURLToPath(new URL("../dist", import.meta.url));
const csp = readFileSync(join(dist, "_headers"), "utf8").match(/Content-Security-Policy: (.+)/)[1];
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".gif": "image/gif",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json",
  ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg" };

const calls = [];
const stub = {
  "GET /api/world": { name: "Smoke Test", paused: false, freeRituals: [], ritualFavorCost: 100, maxPromptChars: 300,
    budget: { spentThisMonthUsd: 0, monthlyBudgetUsd: 10, ritualsToday: 0, maxRitualsPerDay: 2 } },
  "POST /api/players": { playerId: "p", token: "p.secret" },
  "GET /api/me": { playerId: "p", favor: 0, favorToday: 0, maxFavorPerDay: 150, pendingRitual: null },
  "GET /api/rituals": { rituals: [] },
  "POST /api/runs/start": { runId: "r" },
  "POST /api/runs/end": { favorEarned: 1, favor: 1 },
};

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.startsWith("/api/")) {
    calls.push(`${req.method} ${path}`);
    const body = stub[`${req.method} ${path}`];
    res.writeHead(body ? 200 : 404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(body || { error: "stub" }));
  }
  let file = join(dist, path === "/" ? "index.html" : path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Content-Security-Policy": csp });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}/`;

const failures = [];
const warnings = [];
const fail = (msg) => failures.push(msg);

// Static contract: the game must still report runs to the platform.
const gameJs = listFiles(dist).filter((f) => f.endsWith(".js") || f.endsWith(".html"))
  .filter((f) => !f.includes(join(dist, "rsi"))).map((f) => readFileSync(f, "utf8")).join("\n");
if (!gameJs.includes("RSI.runStarted")) fail("game no longer calls RSI.runStarted()");
if (!gameJs.includes("RSI.runEnded")) fail("game no longer calls RSI.runEnded()");

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 600, height: 860 } });
  page.on("pageerror", (err) => fail(`page error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(msg.text())) fail(`console error: ${msg.text()}`);
  });
  page.on("requestfailed", (req) => {
    if (!/fonts\.(googleapis|gstatic)/.test(req.url())) fail(`request failed: ${req.url()}`);
  });

  await page.goto(base, { waitUntil: "load", timeout: 20000 });
  await page.waitForTimeout(3000);

  if (!(await page.evaluate(() => typeof window.RSI === "object"))) fail("RSI overlay did not load");
  if (!calls.includes("POST /api/runs/start")) fail("game never started a run (RSI.runStarted not called)");

  const canvas = page.locator("canvas").first();
  if (!(await canvas.count())) {
    fail("no canvas");
  } else {
    const distinctColors = await canvas.evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      const seen = new Set();
      for (let i = 0; i < d.length && seen.size < 50; i += 4 * 97) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
      return seen.size;
    });
    if (distinctColors < 5) fail(`canvas looks blank (${distinctColors} distinct colours)`);

    // Launch Cthulhu into empty space: this should end the run and call RSI.runEnded.
    const box = await canvas.boundingBox();
    const sx = box.width / (await canvas.evaluate((c) => c.width));
    const at = (x, y) => [box.x + x * sx, box.y + y * sx];
    await page.mouse.move(...at(480, 700));
    await page.mouse.down();
    await page.waitForTimeout(330);
    await page.mouse.up();
    await page.waitForTimeout(4000);
    if (!calls.includes("POST /api/runs/end")) {
      warnings.push("scripted death did not end a run; mechanics may have changed (static hook check still passed)");
    }
    await page.waitForTimeout(2500); // game restarts

    // Aim at real planets so landing/eating code paths actually run. Peeks at the
    // game instance via Game.prototype.step; if a ritual restructured that, skip.
    const peeking = await page.evaluate(() => {
      const P = window.CthuluSpace && CthuluSpace.Game && CthuluSpace.Game.prototype;
      if (!P || typeof P.step !== "function") return false;
      const orig = P.step;
      P.step = function (d) { window.__rsiGame = this; return orig.call(this, d); };
      return true;
    });
    await page.waitForTimeout(200);
    let eaten = 0;
    for (let i = 0; peeking && i < 8; i++) {
      const s = await page.evaluate(() => {
        const g = window.__rsiGame, c = g && g.cthulu && g.cthulu[0];
        if (!c) return null;
        return { cx: c.pos[0], cy: c.pos[1], moving: !!c.moving, eaten: g.planetsEaten,
          planets: (g.planets || []).map((p) => [p.pos[0], p.pos[1]]) };
      });
      if (!s) break;
      eaten = s.eaten;
      if (s.moving) { await page.waitForTimeout(500); continue; }
      const target = s.planets.filter(([, y]) => y < s.cy - 130)
        .sort((a, b) => Math.hypot(a[0] - s.cx, a[1] - s.cy) - Math.hypot(b[0] - s.cx, b[1] - s.cy))[0];
      if (!target) { await page.waitForTimeout(500); continue; }
      const dx = target[0] - s.cx, dy = target[1] - s.cy, dist = Math.hypot(dx, dy);
      const speed = 10 + s.eaten / 40; // px per 60fps frame, from gameView.js
      await page.mouse.move(...at(s.cx - (dx / dist) * 80, s.cy - (dy / dist) * 80));
      await page.mouse.down();
      await page.waitForTimeout((dist / speed) * (1000 / 60));
      await page.mouse.up();
      await page.waitForTimeout(1500);
    }
    if (peeking) {
      eaten = await page.evaluate(() => (window.__rsiGame ? window.__rsiGame.planetsEaten : 0));
      if (eaten === 0) warnings.push("could not eat a planet; landing code was not exercised");
      else console.log(`Ate ${eaten} planet(s).`);
    } else {
      warnings.push("could not inspect the game; skipped aimed play");
    }

    // Flail around for a bit to shake out runtime errors.
    for (let i = 0; i < 12; i++) {
      const x = 100 + Math.random() * 400, y = 450 + Math.random() * 300;
      await page.mouse.move(...at(x, y));
      await page.mouse.down();
      await page.waitForTimeout(150 + Math.random() * 250);
      await page.mouse.up();
      await page.waitForTimeout(600);
    }
  }
} finally {
  await browser.close();
  server.close();
}

warnings.forEach((w) => console.warn("warning:", w));
if (failures.length) {
  console.error("Smoke test FAILED:\n- " + [...new Set(failures)].join("\n- "));
  process.exit(1);
}
console.log("Smoke test passed.");

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]);
}
