// CthuluSpaceRSI overlay: Favor, the Altar (rituals) and the Chronicle.
// Protected platform code, injected into the game's <head> by scripts/build.mjs.
// The game talks to it only through window.RSI.runStarted() / runEnded().
(function () {
  var TOKEN_KEY = "rsi.token";
  var state = { world: null, me: null, runId: null, rituals: [] };

  // ---------- storage (may be unavailable in private windows) ----------
  function loadToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }
  function saveToken(t) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch (e) { /* session-only identity */ }
  }
  var token = loadToken();

  // ---------- API ----------
  function api(method, path, data) {
    var headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    return fetch(path, {
      method: method,
      headers: headers,
      body: data ? JSON.stringify(data) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) throw new Error(body.error || ("HTTP " + res.status));
        return body;
      });
    });
  }

  function ensurePlayer() {
    if (token) {
      return api("GET", "/api/me").catch(function () {
        token = null;
        return ensurePlayer();
      });
    }
    return api("POST", "/api/players").then(function (p) {
      token = p.token;
      saveToken(token);
      return api("GET", "/api/me");
    });
  }

  var ready = ensurePlayer().then(function (me) {
    state.me = me;
    render();
  }).catch(function (e) { console.warn("RSI offline:", e.message); });

  function refresh() {
    return Promise.all([
      api("GET", "/api/world").then(function (w) { state.world = w; }),
      token ? api("GET", "/api/me").then(function (me) { state.me = me; }) : null,
      api("GET", "/api/rituals").then(function (r) { state.rituals = r.rituals; })
    ]).then(render).catch(function (e) { console.warn("RSI refresh failed:", e.message); });
  }

  // ---------- game hooks ----------
  window.RSI = {
    runStarted: function () {
      state.runId = null;
      ready.then(function () {
        return api("POST", "/api/runs/start");
      }).then(function (r) { state.runId = r.runId; })
        .catch(function () {});
    },
    runEnded: function (result) {
      var runId = state.runId;
      state.runId = null;
      if (!runId) return;
      api("POST", "/api/runs/end", { runId: runId, planetsEaten: result && result.planetsEaten })
        .then(function (r) {
          if (state.me) state.me.favor = r.favor;
          if (r.favorEarned > 0) toast("+" + r.favorEarned + " Favor");
          else if (result && result.planetsEaten > 0) toast("The Old Ones are sated for today");
          render();
        }).catch(function () {});
    }
  };

  // ---------- UI ----------
  var bar, nameEl, favorEl, panel, toastEl;

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else if (k === "onclick") node.addEventListener("click", attrs[k]);
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(c); });
    return node;
  }

  function mount() {
    nameEl = el("span", { "class": "rsi-name", text: "CthuluSpaceRSI" });
    favorEl = el("span", { "class": "rsi-favor", text: "… Favor" });
    bar = el("div", { "class": "rsi-bar" }, [
      nameEl,
      el("span", { "class": "rsi-spacer" }),
      favorEl,
      el("button", { "class": "rsi-btn", text: "Altar", onclick: openAltar })
    ]);
    panel = el("div", { "class": "rsi-panel", hidden: "" });
    toastEl = el("div", { "class": "rsi-toast", hidden: "" });
    document.body.appendChild(bar);
    document.body.appendChild(panel);
    document.body.appendChild(toastEl);
    refresh();
  }

  function render() {
    if (!bar) return;
    if (state.world) {
      nameEl.textContent = state.world.name;
      document.title = state.world.name;
    }
    if (state.me) favorEl.textContent = state.me.favor + " Favor";
    if (!panel.hasAttribute("hidden")) renderAltar();
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.removeAttribute("hidden");
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.setAttribute("hidden", ""); }, 2500);
  }

  function openAltar() {
    panel.removeAttribute("hidden");
    renderAltar();
    refresh();
  }

  function closeAltar() { panel.setAttribute("hidden", ""); }

  function renderAltar() {
    var w = state.world, me = state.me;
    panel.innerHTML = "";
    var card = el("div", { "class": "rsi-card" });
    panel.appendChild(card);

    card.appendChild(el("div", { "class": "rsi-head" }, [
      el("h2", { text: "The Altar" }),
      el("button", { "class": "rsi-btn rsi-ghost", text: "Close", onclick: closeAltar })
    ]));

    if (!w || !me) {
      card.appendChild(el("p", { text: "Communing with the void…" }));
      return;
    }

    card.appendChild(el("p", { "class": "rsi-muted",
      text: "Earn Favor by devouring planets (up to " + me.maxFavorPerDay + " a day). " +
        "Spend it on rituals that rewrite this world." }));

    // Free rituals
    w.freeRituals.forEach(function (fr) {
      var section = el("section", { "class": "rsi-section" }, [
        el("h3", { text: fr.title + " · free" })
      ]);
      fr.options.forEach(function (opt) {
        section.appendChild(el("button", { "class": "rsi-btn", text: "Rename to " + opt, onclick: function () {
          api("POST", "/api/rituals", { kind: "rename", name: opt })
            .then(function () { toast("The world is now " + opt); return refresh(); })
            .catch(function (e) { toast(e.message); });
        } }));
      });
      card.appendChild(section);
    });

    // AI ritual
    var section = el("section", { "class": "rsi-section" }, [
      el("h3", { text: "Perform a ritual · " + w.ritualFavorCost + " Favor" })
    ]);
    if (w.paused) {
      section.appendChild(el("p", { "class": "rsi-muted", text: "The Old Ones slumber. Rituals are paused." }));
    } else if (me.pendingRitual) {
      section.appendChild(el("p", { "class": "rsi-muted",
        text: "Your ritual is " + me.pendingRitual.status + ": “" + me.pendingRitual.prompt + "”" }));
    } else {
      var input = el("textarea", { "class": "rsi-input", maxlength: String(w.maxPromptChars), rows: "3",
        placeholder: "Describe a change to the game, e.g. “add a moon that orbits Saturn”" });
      var go = el("button", { "class": "rsi-btn rsi-primary", text: "Begin the ritual", onclick: function () {
        go.disabled = true;
        api("POST", "/api/rituals", { kind: "ai", prompt: input.value })
          .then(function () { toast("Your ritual joins the queue"); return refresh(); })
          .catch(function (e) { toast(e.message); go.disabled = false; });
      } });
      if (me.favor < w.ritualFavorCost) go.disabled = true;
      section.appendChild(input);
      section.appendChild(go);
    }
    var b = w.budget;
    section.appendChild(el("p", { "class": "rsi-muted",
      text: "Rituals are slow: at most " + b.maxRitualsPerDay + " a day, each checked automatically before it ships. " +
        "This month: $" + b.spentThisMonthUsd.toFixed(2) + " of $" + b.monthlyBudgetUsd + " of eldritch energy used." }));
    card.appendChild(section);

    // Chronicle
    var list = el("ol", { "class": "rsi-chronicle" });
    state.rituals.forEach(function (r) {
      var li = el("li", {}, [
        el("span", { "class": "rsi-status rsi-" + r.status, text: r.status }),
        el("span", { text: " " + r.prompt })
      ]);
      if (r.pr_url) li.appendChild(el("a", { href: r.pr_url, target: "_blank", rel: "noopener", text: " (diff)" }));
      if (r.note && r.status !== "deployed") li.appendChild(el("div", { "class": "rsi-muted", text: r.note }));
      list.appendChild(li);
    });
    card.appendChild(el("section", { "class": "rsi-section" }, [
      el("h3", { text: "The Chronicle" }),
      state.rituals.length ? list : el("p", { "class": "rsi-muted", text: "No rituals yet. Be the first." })
    ]));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
