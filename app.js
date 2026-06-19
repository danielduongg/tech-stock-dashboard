/* ============================================================
   Tech Stock Dashboard
   - Renders from a baked real snapshot (window.SNAPSHOT)
   - Attempts a live refresh from a no-key source with graceful
     fallback so the page is always populated and honest about
     data freshness.
   ============================================================ */
"use strict";

/* ---------- Brand colors for ticker logos ---------- */
const BRAND = {
  AAPL: "#9aa0a6", MSFT: "#00a4ef", GOOGL: "#4285f4", AMZN: "#ff9900",
  META: "#0866ff", NVDA: "#76b900", TSLA: "#e82127", AMD: "#1a9e3a", NFLX: "#e50914"
};

/* ---------- State ---------- */
const state = {
  stocks: [],          // working list of stock objects
  view: "cards",       // 'cards' | 'table'
  sort: "default",
  tableSort: { key: null, dir: 1 },
  filter: "",
  live: false,
  asOfLabel: window.SNAPSHOT ? window.SNAPSHOT.asOfLabel : "",
  dates: window.SNAPSHOT ? window.SNAPSHOT.dates.slice() : [],
  openSymbol: null,
  detailRange: 64
};

/* ---------- Helpers: formatting ---------- */
const fmtPrice = (n) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtAbs = (n) =>
  (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%";
function fmtCap(n) {
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  return "$" + n.toLocaleString("en-US");
}
function fmtVol(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}
function fmtShortDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ---------- Build working stocks from snapshot ---------- */
function buildStocks(snap) {
  return snap.order.map((sym) => {
    const s = snap.symbols[sym];
    const change = s.price - s.prev;
    const changePct = (change / s.prev) * 100;
    return {
      sym, name: s.name, exch: s.exch, cur: s.cur,
      price: s.price, prev: s.prev, change, changePct,
      vol: s.vol, mc: s.mc, pe: s.pe, so: s.so,
      wkHigh: s.wkHigh, wkLow: s.wkLow,
      series: s.series.slice(), dates: snap.dates.slice()
    };
  });
}

/* ---------- SVG sparkline ---------- */
function sparkSVG(series, id, h) {
  const w = 300; h = h || 52;
  const pad = 3;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const n = series.length;
  const x = (i) => pad + (i / (n - 1)) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  let line = "";
  for (let i = 0; i < n; i++) line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(series[i]).toFixed(1) + " ";
  const area = line + "L" + x(n - 1).toFixed(1) + " " + h + " L" + x(0).toFixed(1) + " " + h + " Z";
  const up = series[n - 1] >= series[0];
  const col = up ? "#16c784" : "#ea3943";
  const ex = x(n - 1).toFixed(1), ey = y(series[n - 1]).toFixed(1);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${ex}" cy="${ey}" r="3" fill="${col}" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* ---------- Logo element ---------- */
function logoHTML(sym, cls) {
  return `<div class="${cls}" style="background:${BRAND[sym] || "#5b8cff"}">${sym[0]}</div>`;
}

/* ---------- Change pill ---------- */
function pillHTML(changePct) {
  const up = changePct >= 0;
  return `<span class="change-pill ${up ? "up" : "down"}"><span class="arrow">${up ? "▲" : "▼"}</span>${fmtPct(changePct)}</span>`;
}

/* ---------- Sorting + filtering ---------- */
function visibleStocks() {
  let list = state.stocks.slice();
  const f = state.filter.trim().toLowerCase();
  if (f) list = list.filter((s) => s.sym.toLowerCase().includes(f) || s.name.toLowerCase().includes(f));
  const cmp = {
    changeDesc: (a, b) => b.changePct - a.changePct,
    changeAsc: (a, b) => a.changePct - b.changePct,
    priceDesc: (a, b) => b.price - a.price,
    priceAsc: (a, b) => a.price - b.price,
    mcDesc: (a, b) => b.mc - a.mc,
    volDesc: (a, b) => b.vol - a.vol,
    alpha: (a, b) => a.sym.localeCompare(b.sym)
  }[state.sort];
  if (cmp) list.sort(cmp);
  return list;
}

/* ---------- Render: market strip ---------- */
function renderStrip() {
  const list = state.stocks;
  const avg = list.reduce((s, x) => s + x.changePct, 0) / list.length;
  const up = list.filter((x) => x.changePct >= 0).length;
  const down = list.length - up;
  const top = [...list].sort((a, b) => b.changePct - a.changePct)[0];
  const bot = [...list].sort((a, b) => a.changePct - b.changePct)[0];
  const cls = (v) => (v >= 0 ? "t-up" : "t-down");
  document.getElementById("market-strip").innerHTML = `
    <div class="mstat"><div class="label">Avg. Day Change</div>
      <div class="value ${cls(avg)}">${fmtPct(avg)}</div>
      <div class="sub">${list.length} tech names tracked</div></div>
    <div class="mstat"><div class="label">Breadth</div>
      <div class="value"><span class="t-up">${up}</span> / <span class="t-down">${down}</span></div>
      <div class="sub">advancing / declining</div></div>
    <div class="mstat"><div class="label">Top Gainer</div>
      <div class="value ${cls(top.changePct)}">${top.sym}</div>
      <div class="sub ${cls(top.changePct)}">${fmtPct(top.changePct)}</div></div>
    <div class="mstat"><div class="label">Laggard</div>
      <div class="value ${cls(bot.changePct)}">${bot.sym}</div>
      <div class="sub ${cls(bot.changePct)}">${fmtPct(bot.changePct)}</div></div>`;
}

/* ---------- Render: cards ---------- */
function renderCards() {
  const list = visibleStocks();
  const el = document.getElementById("cards-view");
  if (!list.length) { el.innerHTML = `<div class="empty">No matches for &ldquo;${state.filter}&rdquo;.</div>`; return; }
  el.innerHTML = list.map((s) => {
    const up = s.change >= 0;
    return `<article class="card ${up ? "up" : "down"}" data-sym="${s.sym}" tabindex="0" role="button" aria-label="${s.sym} details">
      <div class="card-top">
        <div class="card-id">${logoHTML(s.sym, "logo")}
          <div class="meta"><div class="ticker">${s.sym}</div><div class="company">${s.name}</div></div>
        </div>
        ${pillHTML(s.changePct)}
      </div>
      <div class="card-price"><span class="now">${fmtPrice(s.price)}</span>
        <span class="abs ${up ? "up" : "down"}">${fmtAbs(s.change)}</span></div>
      ${sparkSVG(s.series, "sp-" + s.sym, 52)}
      <div class="card-foot">
        <div class="kv"><span class="k">Mkt Cap</span><span class="v">${fmtCap(s.mc)}</span></div>
        <div class="kv"><span class="k">Volume</span><span class="v">${fmtVol(s.vol)}</span></div>
        <div class="kv"><span class="k">52W High</span><span class="v">${fmtPrice(s.wkHigh)}</span></div>
      </div>
    </article>`;
  }).join("");
}

/* ---------- Render: table ---------- */
function renderTable() {
  let list = visibleStocks();
  const ts = state.tableSort;
  if (ts.key) {
    const get = {
      symbol: (s) => s.sym, name: (s) => s.name, price: (s) => s.price,
      change: (s) => s.change, changePct: (s) => s.changePct, mc: (s) => s.mc, vol: (s) => s.vol
    }[ts.key];
    list = [...list].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === "string") return va.localeCompare(vb) * ts.dir;
      return (va - vb) * ts.dir;
    });
  }
  document.querySelectorAll(".th-sortable").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.sort === ts.key);
    const base = th.textContent.replace(/[▲▼]\s*$/, "").trim();
    th.innerHTML = base + (th.dataset.sort === ts.key ? ` <span class="caret">${ts.dir > 0 ? "▲" : "▼"}</span>` : "");
  });
  const body = document.getElementById("table-body");
  if (!list.length) { body.innerHTML = `<tr><td colspan="8" class="empty">No matches.</td></tr>`; return; }
  body.innerHTML = list.map((s) => {
    const up = s.change >= 0;
    return `<tr data-sym="${s.sym}">
      <td><div class="t-ticker">${logoHTML(s.sym, "t-logo")}${s.sym}</div></td>
      <td class="t-name">${s.name}</td>
      <td class="td-num">${fmtPrice(s.price)}</td>
      <td class="td-num ${up ? "t-up" : "t-down"}">${fmtAbs(s.change)}</td>
      <td class="td-num ${up ? "t-up" : "t-down"}">${fmtPct(s.changePct)}</td>
      <td>${sparkSVG(s.series.slice(-30), "tr-" + s.sym, 30).replace('class="spark"', 'class="t-spark"')}</td>
      <td class="td-num">${fmtCap(s.mc)}</td>
      <td class="td-num">${fmtVol(s.vol)}</td>
    </tr>`;
  }).join("");
}

function render() {
  renderStrip();
  if (state.view === "cards") renderCards(); else renderTable();
}

/* ---------- Detail modal ---------- */
let detailCtx = null;

function openDetail(sym) {
  const s = state.stocks.find((x) => x.sym === sym);
  if (!s) return;
  state.openSymbol = sym;
  const up = s.change >= 0;
  const logoEl = document.getElementById("d-logo");
  logoEl.style.background = BRAND[sym] || "#5b8cff";
  logoEl.textContent = sym[0];
  document.getElementById("d-symbol").textContent = sym;
  document.getElementById("d-name").textContent = s.name;
  document.getElementById("d-exch").textContent = s.exch + " · " + s.cur;
  document.getElementById("d-price").textContent = fmtPrice(s.price);
  document.getElementById("d-change").outerHTML =
    `<div class="change-pill ${up ? "up" : "down"}" id="d-change"><span class="arrow">${up ? "▲" : "▼"}</span>${fmtAbs(s.change)} (${fmtPct(s.changePct)})</div>`;

  document.getElementById("d-stats").innerHTML = [
    ["Previous Close", fmtPrice(s.prev)],
    ["Day Change", fmtAbs(s.change)],
    ["Market Cap", fmtCap(s.mc)],
    ["Volume", fmtVol(s.vol)],
    ["P/E (TTM)", s.pe ? s.pe.toFixed(2) : "—"],
    ["Shares Out", fmtVol(s.so)],
    ["52-Week High", fmtPrice(s.wkHigh)],
    ["52-Week Low", fmtPrice(s.wkLow)],
    ["52W Range Pos", rangePos(s)]
  ].map(([k, v]) => `<div class="stat-cell"><div class="sk">${k}</div><div class="sv">${v}</div></div>`).join("");

  // reset range tabs to 6M
  state.detailRange = 64;
  document.querySelectorAll("#d-range button").forEach((b) => b.classList.toggle("active", +b.dataset.range === 64));
  drawDetail(s, 64);

  const ov = document.getElementById("detail-overlay");
  ov.hidden = false;
  document.body.style.overflow = "hidden";
}

function rangePos(s) {
  const span = s.wkHigh - s.wkLow || 1;
  const pct = ((s.price - s.wkLow) / span) * 100;
  return Math.max(0, Math.min(100, pct)).toFixed(0) + "%";
}

function closeDetail() {
  document.getElementById("detail-overlay").hidden = true;
  document.body.style.overflow = "";
  state.openSymbol = null;
  detailCtx = null;
  document.getElementById("d-tooltip").hidden = true;
}

/* ---------- Detail chart (interactive) ---------- */
function drawDetail(s, count) {
  const VBW = 1000, VBH = 320, padX = 8, padTop = 18, padBot = 26;
  const full = s.series;
  const series = full.slice(-count);
  const dates = s.dates.slice(-count);
  const n = series.length;
  const min = Math.min(...series), max = Math.max(...series);
  const span = max - min || 1;
  const x = (i) => padX + (i / (n - 1)) * (VBW - padX * 2);
  const y = (v) => padTop + (1 - (v - min) / span) * (VBH - padTop - padBot);
  let line = "";
  for (let i = 0; i < n; i++) line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(series[i]).toFixed(1) + " ";
  const area = line + `L${x(n - 1).toFixed(1)} ${VBH - padBot} L${x(0).toFixed(1)} ${VBH - padBot} Z`;
  const up = series[n - 1] >= series[0];
  const col = up ? "#16c784" : "#ea3943";

  // horizontal grid lines (4)
  const LBL = `font-size="13" style="fill:var(--text-faint)" font-family="'JetBrains Mono', monospace"`;
  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const gy = padTop + (g / 3) * (VBH - padTop - padBot);
    const gv = max - (g / 3) * span;
    grid += `<line x1="${padX}" y1="${gy.toFixed(1)}" x2="${VBW - padX}" y2="${gy.toFixed(1)}" style="stroke:var(--border-soft)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    grid += `<text x="${VBW - padX}" y="${(gy - 4).toFixed(1)}" text-anchor="end" ${LBL}>${fmtPrice(gv)}</text>`;
  }
  // x labels: first, mid, last
  let xlab = "";
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i) => {
    const anchor = i === 0 ? "start" : i === n - 1 ? "end" : "middle";
    xlab += `<text x="${x(i).toFixed(1)}" y="${VBH - 6}" text-anchor="${anchor}" ${LBL}>${fmtShortDate(dates[i])}</text>`;
  });

  const svg = document.getElementById("d-chart");
  svg.setAttribute("viewBox", `0 0 ${VBW} ${VBH}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.innerHTML = `<defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${col}" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#dg)"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <line id="d-cross" x1="0" y1="${padTop}" x2="0" y2="${VBH - padBot}" stroke="${col}" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
    <circle id="d-dot" r="4" fill="${col}" style="stroke:var(--surface)" stroke-width="2" vector-effect="non-scaling-stroke" opacity="0"/>
    ${xlab}`;

  detailCtx = { series, dates, n, x, y, VBW, VBH, col, padTop, padBot };
}

function onChartMove(e) {
  if (!detailCtx) return;
  const svg = document.getElementById("d-chart");
  const rect = svg.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const i = Math.round(ratio * (detailCtx.n - 1));
  const vbx = detailCtx.x(i), vby = detailCtx.y(detailCtx.series[i]);
  const px = (vbx / detailCtx.VBW) * rect.width;
  const py = (vby / detailCtx.VBH) * rect.height;
  const cross = document.getElementById("d-cross");
  const dot = document.getElementById("d-dot");
  cross.setAttribute("x1", vbx); cross.setAttribute("x2", vbx); cross.setAttribute("opacity", "0.4");
  dot.setAttribute("cx", vbx); dot.setAttribute("cy", vby); dot.setAttribute("opacity", "1");
  const tip = document.getElementById("d-tooltip");
  tip.hidden = false;
  tip.style.left = px + "px";
  tip.style.top = py + "px";
  tip.innerHTML = `<div class="tt-price">${fmtPrice(detailCtx.series[i])}</div><div class="tt-date">${fmtShortDate(detailCtx.dates[i])}</div>`;
}
function onChartLeave() {
  const c = document.getElementById("d-cross"), d = document.getElementById("d-dot");
  if (c) c.setAttribute("opacity", "0");
  if (d) d.setAttribute("opacity", "0");
  document.getElementById("d-tooltip").hidden = true;
}

/* ---------- Status badge + footer ---------- */
function setStatus(kind, text, title) {
  const badge = document.getElementById("status-badge");
  badge.className = "status-badge " + kind;
  document.getElementById("status-text").textContent = text;
  if (title) badge.title = title;
}
function setFooter() {
  const note = document.getElementById("footer-note");
  if (state.live) {
    note.innerHTML = `Live data &mdash; last refreshed ${new Date().toLocaleString("en-US")}. Source: Yahoo Finance (no-key, client-side).`;
  } else {
    note.innerHTML = `Showing a baked snapshot from <strong>${state.asOfLabel}</strong>. The app automatically tries a live, no-key refresh on load &mdash; when a feed is reachable from your browser the figures update and the badge turns green. Values shown are not live right now.`;
  }
}

/* ---------- Live refresh (progressive enhancement) ---------- */
const PROXIES = [
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://thingproxy.freeboard.io/fetch/" + u
];
const yahooURL = (sym) => `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=6mo&interval=1d`;

function downsample(arr, m) {
  const nn = arr.filter((v) => v != null);
  if (nn.length <= m) return nn;
  const out = [];
  for (let k = 0; k < m; k++) out.push(nn[Math.round(k * (nn.length - 1) / (m - 1))]);
  return out;
}

async function fetchJSON(url, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || 7000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function fetchLive(sym, proxyIdx) {
  const url = PROXIES[proxyIdx](yahooURL(sym));
  const j = await fetchJSON(url, 7000);
  const res = j.chart.result[0];
  const m = res.meta;
  const closesRaw = res.indicators.quote[0].close;
  const closes = closesRaw.filter((v) => v != null).map((v) => Math.round(v * 100) / 100);
  const prev = closes.length >= 2 ? closes[closes.length - 2] : m.chartPreviousClose;
  return {
    sym,
    price: m.regularMarketPrice,
    prev,
    vol: m.regularMarketVolume,
    wkHigh: m.fiftyTwoWeekHigh,
    wkLow: m.fiftyTwoWeekLow,
    series: downsample(closes, 64)
  };
}

async function refreshLive(manual) {
  setStatus("loading", "Checking live data…");
  const btn = document.getElementById("refresh-btn");
  btn.classList.add("spinning");

  // probe with the first symbol across proxies; if none work, bail to snapshot
  let workingProxy = -1;
  for (let p = 0; p < PROXIES.length; p++) {
    try { await fetchLive(state.stocks[0].sym, p); workingProxy = p; break; }
    catch (e) { /* try next */ }
  }
  if (workingProxy === -1) {
    state.live = false;
    setStatus("snapshot", "Snapshot · " + state.asOfLabel,
      "Live feed unreachable from your browser right now — showing the baked snapshot from " + state.asOfLabel + ".");
    setFooter();
    btn.classList.remove("spinning");
    return;
  }

  const results = await Promise.allSettled(state.stocks.map((s) => fetchLive(s.sym, workingProxy)));
  let okCount = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value && isFinite(r.value.price)) {
      const live = r.value, s = state.stocks[i];
      s.price = live.price;
      s.prev = live.prev;
      s.change = s.price - s.prev;
      s.changePct = (s.change / s.prev) * 100;
      if (isFinite(live.vol)) s.vol = live.vol;
      if (isFinite(live.wkHigh)) s.wkHigh = live.wkHigh;
      if (isFinite(live.wkLow)) s.wkLow = live.wkLow;
      if (live.series && live.series.length > 5) s.series = live.series;
      okCount++;
    }
  });

  if (okCount > 0) {
    state.live = true;
    const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setStatus("live", "Live · updated " + t, "Live data fetched from Yahoo Finance at " + t + ".");
    setFooter();
    render();
    if (state.openSymbol) {
      const s = state.stocks.find((x) => x.sym === state.openSymbol);
      if (s) { drawDetail(s, state.detailRange); refreshOpenStats(s); }
    }
  } else {
    state.live = false;
    setStatus("snapshot", "Snapshot · " + state.asOfLabel,
      "Live feed returned no usable data — showing the snapshot from " + state.asOfLabel + ".");
    setFooter();
  }
  btn.classList.remove("spinning");
}

function refreshOpenStats(s) {
  const up = s.change >= 0;
  document.getElementById("d-price").textContent = fmtPrice(s.price);
  const dc = document.getElementById("d-change");
  if (dc) {
    dc.className = "change-pill " + (up ? "up" : "down");
    dc.innerHTML = `<span class="arrow">${up ? "▲" : "▼"}</span>${fmtAbs(s.change)} (${fmtPct(s.changePct)})`;
  }
}

/* ---------- Theme ---------- */
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("tsd-theme"); } catch (e) {}
  if (saved) document.documentElement.setAttribute("data-theme", saved);
}
function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  try { localStorage.setItem("tsd-theme", next); } catch (e) {}
}

/* ---------- Events ---------- */
function wire() {
  document.getElementById("search").addEventListener("input", (e) => { state.filter = e.target.value; render(); });
  document.getElementById("sort-select").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  document.getElementById("refresh-btn").addEventListener("click", () => refreshLive(true));

  document.getElementById("view-cards").addEventListener("click", () => switchView("cards"));
  document.getElementById("view-table").addEventListener("click", () => switchView("table"));

  // delegated open-detail
  document.getElementById("cards-view").addEventListener("click", (e) => {
    const c = e.target.closest(".card"); if (c) openDetail(c.dataset.sym);
  });
  document.getElementById("cards-view").addEventListener("keydown", (e) => {
    if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) { e.preventDefault(); openDetail(e.target.dataset.sym); }
  });
  document.getElementById("table-body").addEventListener("click", (e) => {
    const r = e.target.closest("tr"); if (r && r.dataset.sym) openDetail(r.dataset.sym);
  });

  // table header sort
  document.querySelectorAll(".th-sortable").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    if (state.tableSort.key === k) state.tableSort.dir *= -1;
    else state.tableSort = { key: k, dir: k === "symbol" || k === "name" ? 1 : -1 };
    renderTable();
  }));

  // modal
  document.getElementById("detail-close").addEventListener("click", closeDetail);
  document.getElementById("detail-overlay").addEventListener("click", (e) => { if (e.target.id === "detail-overlay") closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.getElementById("detail-overlay").hidden) closeDetail(); });
  document.getElementById("d-range").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#d-range button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    state.detailRange = +b.dataset.range;
    const s = state.stocks.find((x) => x.sym === state.openSymbol);
    if (s) drawDetail(s, state.detailRange);
  });
  const svg = document.getElementById("d-chart");
  svg.addEventListener("mousemove", onChartMove);
  svg.addEventListener("mouseleave", onChartLeave);
}

function switchView(v) {
  state.view = v;
  document.getElementById("view-cards").classList.toggle("active", v === "cards");
  document.getElementById("view-table").classList.toggle("active", v === "table");
  document.getElementById("view-cards").setAttribute("aria-selected", v === "cards");
  document.getElementById("view-table").setAttribute("aria-selected", v === "table");
  document.getElementById("cards-view").hidden = v !== "cards";
  document.getElementById("table-view").hidden = v !== "table";
  render();
}

/* ---------- Boot ---------- */
let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  if (!window.SNAPSHOT) { document.getElementById("cards-view").innerHTML = '<div class="empty">Failed to load data.</div>'; return; }
  initTheme();
  state.stocks = buildStocks(window.SNAPSHOT);
  state.asOfLabel = window.SNAPSHOT.asOfLabel;
  wire();
  render();
  setStatus("snapshot", "Snapshot · " + state.asOfLabel,
    "Baked snapshot from " + state.asOfLabel + ". Attempting live refresh…");
  setFooter();
  // attempt live refresh shortly after first paint
  setTimeout(() => refreshLive(false), 400);
}

document.addEventListener("DOMContentLoaded", boot);
