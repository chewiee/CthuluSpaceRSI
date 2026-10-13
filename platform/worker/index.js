// CthuluSpaceRSI platform API. Protected: rituals may not edit anything in platform/.
//
// Players earn Favor by playing, spend it on rituals. Free rituals are pre-coded
// here and take effect instantly. AI rituals are queued and picked up by the
// GitHub Actions runner (.github/workflows/ritual.yml), which claims them through
// /api/runner/* using RUNNER_TOKEN.

const RENAME_OPTIONS = ["R'lyeh Rising"];
const STUCK_RITUAL_MS = 2 * 60 * 60 * 1000;
const MAX_RUN_MS = 60 * 60 * 1000;
const MS_PER_FAVOR = 1500; // you can't eat planets faster than this

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }
    try {
      return await route(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "The stars are not right (internal error)" }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function route(request, env, url) {
  const p = url.pathname;
  const m = request.method;

  if (m === "GET" && p === "/api/world") return getWorld(env);
  if (m === "GET" && p === "/api/rituals") return listRituals(env);
  if (m === "POST" && p === "/api/players") return createPlayer(env);

  if (m === "GET" && p === "/api/me") return getMe(env, await requirePlayer(request, env));
  if (m === "POST" && p === "/api/runs/start") return startRun(env, await requirePlayer(request, env));
  if (m === "POST" && p === "/api/runs/end") return endRun(env, await requirePlayer(request, env), await body(request));
  if (m === "POST" && p === "/api/rituals") return createRitual(env, await requirePlayer(request, env), await body(request));

  if (m === "POST" && p === "/api/runner/claim") {
    await requireSecret(request, env.RUNNER_TOKEN);
    return claimRitual(env);
  }
  if (m === "POST" && p === "/api/runner/report") {
    await requireSecret(request, env.RUNNER_TOKEN);
    return reportRitual(env, await body(request));
  }

  if (m === "POST" && p === "/api/admin/pause") {
    await requireSecret(request, env.ADMIN_TOKEN);
    const { paused } = await body(request);
    await setWorld(env, "paused", paused ? "1" : "0");
    return json({ paused: !!paused });
  }
  if (m === "POST" && p === "/api/admin/reject") {
    await requireSecret(request, env.ADMIN_TOKEN);
    const { id, note } = await body(request);
    return json(await finishRitual(env, id, "rejected", { note: note || "Rejected by the High Priest" }));
  }

  throw new HttpError(404, "No such incantation");
}

// ---------- world ----------

async function getWorld(env) {
  const world = await readWorld(env);
  const budget = await budgetStatus(env);
  return json({
    name: world.name,
    paused: world.paused === "1",
    ritualFavorCost: int(env.RITUAL_FAVOR_COST),
    maxPromptChars: int(env.MAX_PROMPT_CHARS),
    freeRituals: world.renamed === "1" ? [] : [
      { kind: "rename", title: "Rename the world", options: RENAME_OPTIONS },
    ],
    budget,
  });
}

async function readWorld(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM world").all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

function setWorld(env, key, value) {
  return env.DB.prepare("INSERT INTO world (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value).run();
}

async function budgetStatus(env) {
  const now = Date.now();
  const spent = await env.DB.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS s FROM rituals WHERE kind = 'ai' AND claimed_at >= ?"
  ).bind(monthStart(now)).first("s");
  const today = await env.DB.prepare(
    "SELECT COUNT(*) AS c FROM rituals WHERE kind = 'ai' AND claimed_at >= ?"
  ).bind(dayStart(now)).first("c");
  return {
    spentThisMonthUsd: round2(spent),
    monthlyBudgetUsd: num(env.MONTHLY_BUDGET_USD),
    ritualsToday: today,
    maxRitualsPerDay: int(env.MAX_RITUALS_PER_DAY),
  };
}

// ---------- players ----------

async function createPlayer(env) {
  const id = crypto.randomUUID();
  const secret = randomHex(32);
  await env.DB.prepare("INSERT INTO players (id, token_hash, created_at) VALUES (?, ?, ?)")
    .bind(id, await sha256(secret), Date.now()).run();
  return json({ playerId: id, token: `${id}.${secret}` });
}

async function requirePlayer(request, env) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const [id, secret] = token.split(".");
  if (!id || !secret) throw new HttpError(401, "Unknown cultist");
  const player = await env.DB.prepare("SELECT * FROM players WHERE id = ?").bind(id).first();
  if (!player || player.token_hash !== (await sha256(secret))) throw new HttpError(401, "Unknown cultist");
  return player;
}

async function getMe(env, player) {
  const pending = await env.DB.prepare(
    "SELECT id, prompt, status FROM rituals WHERE player_id = ? AND status IN ('queued', 'running') ORDER BY id DESC LIMIT 1"
  ).bind(player.id).first();
  return json({
    playerId: player.id,
    favor: player.favor,
    favorToday: player.favor_day === dayKey(Date.now()) ? player.favor_today : 0,
    maxFavorPerDay: int(env.MAX_FAVOR_PER_DAY),
    pendingRitual: pending || null,
  });
}

// ---------- runs -> Favor ----------

async function startRun(env, player) {
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO runs (id, player_id, started_at) VALUES (?, ?, ?)")
    .bind(id, player.id, Date.now()).run();
  return json({ runId: id });
}

// Favor is deliberately decoupled from the in-game score: rituals can change
// scoring, but they can't change how much Favor a run is worth.
async function endRun(env, player, { runId, planetsEaten }) {
  const now = Date.now();
  const run = await env.DB.prepare("SELECT * FROM runs WHERE id = ? AND player_id = ?").bind(runId, player.id).first();
  if (!run) throw new HttpError(404, "No such run");
  if (run.ended_at) throw new HttpError(409, "Run already ended");

  const elapsed = now - run.started_at;
  const planets = Math.max(0, Math.floor(Number(planetsEaten) || 0));
  let favor = elapsed > MAX_RUN_MS ? 0 : Math.min(planets, Math.floor(elapsed / MS_PER_FAVOR), int(env.MAX_FAVOR_PER_RUN));

  const today = dayKey(now);
  const favorToday = player.favor_day === today ? player.favor_today : 0;
  favor = Math.max(0, Math.min(favor, int(env.MAX_FAVOR_PER_DAY) - favorToday));

  await env.DB.batch([
    env.DB.prepare("UPDATE runs SET ended_at = ?, planets = ?, favor = ? WHERE id = ?").bind(now, planets, favor, run.id),
    env.DB.prepare("UPDATE players SET favor = favor + ?, favor_today = ?, favor_day = ? WHERE id = ?")
      .bind(favor, favorToday + favor, today, player.id),
  ]);
  return json({ favorEarned: favor, favor: player.favor + favor });
}

// ---------- rituals ----------

async function listRituals(env) {
  const { results } = await env.DB.prepare(
    "SELECT id, kind, prompt, status, pr_url, note, created_at, updated_at FROM rituals ORDER BY id DESC LIMIT 30"
  ).all();
  return json({ rituals: results });
}

async function createRitual(env, player, input) {
  const world = await readWorld(env);
  const now = Date.now();

  if (input.kind === "rename") {
    if (world.renamed === "1") throw new HttpError(409, "The world has already been renamed");
    if (!RENAME_OPTIONS.includes(input.name)) throw new HttpError(400, "That name is not written in the Necronomicon");
    // Guard against two players racing for the free rename.
    const res = await env.DB.prepare("UPDATE world SET value = '1' WHERE key = 'renamed' AND value = '0'").run();
    if (!res.meta.changes) throw new HttpError(409, "The world has already been renamed");
    await env.DB.batch([
      env.DB.prepare("UPDATE world SET value = ? WHERE key = 'name'").bind(input.name),
      env.DB.prepare(
        "INSERT INTO rituals (player_id, kind, prompt, status, note, created_at, updated_at) VALUES (?, 'rename', ?, 'deployed', 'Free ritual, no AI used', ?, ?)"
      ).bind(player.id, `Rename the world to ${input.name}`, now, now),
    ]);
    return json({ ok: true, name: input.name });
  }

  if (input.kind !== "ai") throw new HttpError(400, "Unknown ritual");
  if (world.paused === "1") throw new HttpError(503, "The Old Ones slumber. Rituals are paused.");

  const prompt = String(input.prompt || "").trim();
  if (prompt.length < 10) throw new HttpError(400, "Speak at greater length, cultist");
  if (prompt.length > int(env.MAX_PROMPT_CHARS)) throw new HttpError(400, `Rituals are limited to ${env.MAX_PROMPT_CHARS} characters`);

  const pending = await env.DB.prepare(
    "SELECT id FROM rituals WHERE player_id = ? AND status IN ('queued', 'running')"
  ).bind(player.id).first();
  if (pending) throw new HttpError(409, "You already have a ritual in progress");

  const cost = int(env.RITUAL_FAVOR_COST);
  const spend = await env.DB.prepare("UPDATE players SET favor = favor - ? WHERE id = ? AND favor >= ?")
    .bind(cost, player.id, cost).run();
  if (!spend.meta.changes) throw new HttpError(402, `A ritual costs ${cost} Favor`);

  const row = await env.DB.prepare(
    "INSERT INTO rituals (player_id, kind, prompt, favor_cost, status, created_at, updated_at) VALUES (?, 'ai', ?, ?, 'queued', ?, ?) RETURNING id"
  ).bind(player.id, prompt, cost, now, now).first();
  return json({ ok: true, id: row.id });
}

// ---------- runner (GitHub Actions) ----------

async function claimRitual(env) {
  const now = Date.now();

  // A runner that died without reporting is charged the full per-ritual budget.
  const { results: stuck } = await env.DB.prepare(
    "SELECT id FROM rituals WHERE status = 'running' AND claimed_at < ?"
  ).bind(now - STUCK_RITUAL_MS).all();
  for (const r of stuck) {
    await finishRitual(env, r.id, "failed", { costUsd: num(env.PER_RITUAL_BUDGET_USD), note: "Runner never reported back" });
  }

  const world = await readWorld(env);
  if (world.paused === "1") return json({ ritual: null, reason: "paused" });

  const running = await env.DB.prepare("SELECT id FROM rituals WHERE status = 'running'").first();
  if (running) return json({ ritual: null, reason: "another ritual is running" });

  const budget = await budgetStatus(env);
  if (budget.ritualsToday >= budget.maxRitualsPerDay) return json({ ritual: null, reason: "daily ritual limit reached" });
  // Leave headroom: the per-run cap is checked against an estimate and can overshoot.
  const perRitual = num(env.PER_RITUAL_BUDGET_USD);
  if (budget.spentThisMonthUsd + perRitual * 1.5 > budget.monthlyBudgetUsd) {
    return json({ ritual: null, reason: "monthly budget exhausted" });
  }

  const ritual = await env.DB.prepare(
    "UPDATE rituals SET status = 'running', claimed_at = ?, updated_at = ? WHERE id = (SELECT id FROM rituals WHERE status = 'queued' ORDER BY id LIMIT 1) AND status = 'queued' RETURNING id, prompt"
  ).bind(now, now).first();
  if (!ritual) return json({ ritual: null, reason: "queue empty" });

  return json({
    ritual,
    model: env.RITUAL_MODEL,
    budgetUsd: perRitual,
    maxTurns: int(env.RITUAL_MAX_TURNS),
  });
}

async function reportRitual(env, { id, status, costUsd, prUrl, note }) {
  if (!["running", "deployed", "failed", "rejected"].includes(status)) throw new HttpError(400, "Bad status");
  return json(await finishRitual(env, id, status, { costUsd, prUrl, note }));
}

// Records cost/status. Refunds Favor when a ritual doesn't make it to deploy.
async function finishRitual(env, id, status, { costUsd, prUrl, note } = {}) {
  const ritual = await env.DB.prepare("SELECT * FROM rituals WHERE id = ?").bind(id).first();
  if (!ritual) throw new HttpError(404, "No such ritual");
  if (["deployed", "failed", "rejected"].includes(ritual.status)) {
    throw new HttpError(409, `Ritual already ${ritual.status}`);
  }

  const stmts = [
    env.DB.prepare(
      "UPDATE rituals SET status = ?, cost_usd = MAX(cost_usd, ?), pr_url = COALESCE(?, pr_url), note = COALESCE(?, note), updated_at = ? WHERE id = ?"
    ).bind(status, Number(costUsd) || 0, prUrl || null, note ? String(note).slice(0, 500) : null, Date.now(), id),
  ];
  const refund = status === "failed" || status === "rejected";
  if (refund && ritual.favor_cost) {
    stmts.push(env.DB.prepare("UPDATE players SET favor = favor + ? WHERE id = ?").bind(ritual.favor_cost, ritual.player_id));
  }
  await env.DB.batch(stmts);
  return { ok: true, id, status, refunded: refund ? ritual.favor_cost : 0 };
}

// ---------- helpers ----------

async function requireSecret(request, expected) {
  const got = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!expected || !got) throw new HttpError(401, "Forbidden rite");
  const [a, b] = [await sha256(got), await sha256(expected)].map((h) => new TextEncoder().encode(h));
  if (!crypto.subtle.timingSafeEqual(a, b)) throw new HttpError(401, "Forbidden rite");
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Malformed offering (expected JSON)");
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomHex(bytes) {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const int = (v) => parseInt(v, 10);
const num = (v) => Number(v);
const round2 = (v) => Math.round(v * 100) / 100;
const dayKey = (t) => new Date(t).toISOString().slice(0, 10);
const dayStart = (t) => Date.parse(dayKey(t));
const monthStart = (t) => Date.parse(new Date(t).toISOString().slice(0, 7) + "-01");
