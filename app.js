/* ============================================================
   Tech Stock Dashboard — professional edition
   Renders from a baked real snapshot (window.SNAPSHOT) with deep
   fundamentals, analyst data, financials and computed technicals.
   Attempts a live price refresh with graceful snapshot fallback.
   For information/education only — NOT investment advice.
   ============================================================ */
"use strict";

const BRAND = {
  AAPL: "#9aa0a6", MSFT: "#00a4ef", GOOGL: "#4285f4", AMZN: "#ff9900",
  META: "#0866ff", NVDA: "#76b900", TSLA: "#e82127", AMD: "#1a9e3a", NFLX: "#e50914"
};
const RATING_LABEL = {
  strong_buy: "Strong Buy", buy: "Buy", hold: "Hold", sell: "Sell",
  strong_sell: "Strong Sell", underperform: "Underperform", outperform: "Outperform"
};

const state = {
  stocks: [], view: "cards", sort: "default",
  tableSort: { key: null, dir: 1 }, filter: "",
  live: false,
  asOfLabel: window.SNAPSHOT ? window.SNAPSHOT.asOfLabel : "",
  fundAsOf: window.SNAPSHOT ? window.SNAPSHOT.fundamentalsAsOf : "",
  openSymbol: null, detailTab: "overview", detailRange: 64
};

/* ---------- formatting ---------- */
const fmtPrice = (n) => n == null ? "—" : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtAbs = (n) => (n >= 0 ? "+" : "−") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (n) => n == null ? "—" : (n >= 0 ? "+" : "−") + Math.abs(n).toFixed(2) + "%";
const fmtPctS = (n) => n == null ? "—" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%";   // signed, 1dp (growth)
const fmtPctP = (n) => n == null ? "—" : n.toFixed(1) + "%";                            // plain (margins)
const fmtRatio = (n) => n == null ? "—" : n.toFixed(2);
const fmtBeta = (n) => n == null ? "—" : n.toFixed(2);
function fmtCap(n) {
  if (n == null) return "—";
  if (n >= 1e12) return "$" + (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  return "$" + n.toLocaleString("en-US");
}
function fmtVol(n) {
  if (n == null) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}
function fmtMil(m) { // value already in $ millions
  if (m == null) return "—";
  const a = Math.abs(m), s = m < 0 ? "−" : "";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(2) + "T";
  if (a >= 1e3) return s + "$" + (a / 1e3).toFixed(1) + "B";
  return s + "$" + a.toFixed(0) + "M";
}
function fmtShortDate(iso) { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
function fmtLongDate(iso) { const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

/* ---------- derived ---------- */
function posture(score) { return score >= 3 ? { k: "bull", t: "Bullish" } : score <= -3 ? { k: "bear", t: "Bearish" } : { k: "neutral", t: "Neutral" }; }

function buildStocks(snap) {
  return snap.order.map((sym) => {
    const s = snap.symbols[sym];
    const change = s.price - s.prev;
    const changePct = (change / s.prev) * 100;
    const upside = s.an && s.an.mean ? (s.an.mean / s.price - 1) * 100 : null;
    return {
      sym, name: s.name, exch: s.exch, cur: s.cur,
      price: s.price, prev: s.prev, change, changePct,
      vol: s.vol, mc: s.mc, pe: s.pe, so: s.so, wkHigh: s.wkHigh, wkLow: s.wkLow,
      series: s.series.slice(), dates: snap.dates.slice(),
      val: s.val, prof: s.prof, grow: s.grow, health: s.health, div: s.div,
      eps: s.eps, beta: s.beta, an: s.an, tech: s.tech, nextEarn: s.nextEarn, fin: s.fin,
      upside
    };
  });
}

/* ---------- small html builders ---------- */
function logoHTML(sym, cls) { return `<div class="${cls}" style="background:${BRAND[sym] || "#5b8cff"}">${sym[0]}</div>`; }
function pillHTML(p) { const up = p >= 0; return `<span class="change-pill ${up ? "up" : "down"}"><span class="arrow">${up ? "▲" : "▼"}</span>${fmtPct(p)}</span>`; }
function ratingBadge(key) { const k = key || "hold"; return `<span class="rating ${k}">${RATING_LABEL[k] || "—"}</span>`; }
function signalBadge(score) { const p = posture(score); return `<span class="sig ${p.k}"><span class="sig-dot"></span>${p.t}</span>`; }

/* ---------- sparkline ---------- */
function sparkSVG(series, id, h) {
  const w = 300; h = h || 52; const pad = 3;
  const min = Math.min(...series), max = Math.max(...series), span = max - min || 1, n = series.length;
  const x = (i) => pad + (i / (n - 1)) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  let line = ""; for (let i = 0; i < n; i++) line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(series[i]).toFixed(1) + " ";
  const area = line + "L" + x(n - 1).toFixed(1) + " " + h + " L" + x(0).toFixed(1) + " " + h + " Z";
  const up = series[n - 1] >= series[0], col = up ? "#16c784" : "#ea3943";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.28"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(series[n - 1]).toFixed(1)}" r="3" fill="${col}" vector-effect="non-scaling-stroke"/>
  </svg>`;
}

/* ---------- sorting & filtering ---------- */
function visibleStocks() {
  let list = state.stocks.slice();
  const f = state.filter.trim().toLowerCase();
  if (f) list = list.filter((s) => s.sym.toLowerCase().includes(f) || s.name.toLowerCase().includes(f));
  const cmp = {
    upsideDesc: (a, b) => (b.upside ?? -1e9) - (a.upside ?? -1e9),
    changeDesc: (a, b) => b.changePct - a.changePct,
    changeAsc: (a, b) => a.changePct - b.changePct,
    fpeAsc: (a, b) => (a.val.fpe ?? 1e9) - (b.val.fpe ?? 1e9),
    pegAsc: (a, b) => (a.val.peg ?? 1e9) - (b.val.peg ?? 1e9),
    revgDesc: (a, b) => (b.grow.rev ?? -1e9) - (a.grow.rev ?? -1e9),
    signalDesc: (a, b) => b.tech.score - a.tech.score,
    mcDesc: (a, b) => b.mc - a.mc,
    alpha: (a, b) => a.sym.localeCompare(b.sym)
  }[state.sort];
  if (cmp) list.sort(cmp);
  return list;
}

/* ---------- market strip ---------- */
function renderStrip() {
  const list = state.stocks;
  const avg = list.reduce((s, x) => s + x.changePct, 0) / list.length;
  const up = list.filter((x) => x.changePct >= 0).length;
  const avgUp = list.reduce((s, x) => s + (x.upside ?? 0), 0) / list.length;
  const bulls = list.filter((x) => x.tech.score >= 3).length;
  const bears = list.filter((x) => x.tech.score <= -3).length;
  const top = [...list].sort((a, b) => b.changePct - a.changePct)[0];
  const cls = (v) => (v >= 0 ? "t-up" : "t-down");
  document.getElementById("market-strip").innerHTML = `
    <div class="mstat"><div class="label">Avg. Day Change</div><div class="value ${cls(avg)}">${fmtPct(avg)}</div><div class="sub">${up}/${list.length} advancing</div></div>
    <div class="mstat"><div class="label">Avg. Analyst Upside</div><div class="value ${cls(avgUp)}">${fmtPctS(avgUp)}</div><div class="sub">to mean price target</div></div>
    <div class="mstat"><div class="label">Technical Posture</div><div class="value"><span class="t-up">${bulls}</span> · <span class="t-down">${bears}</span></div><div class="sub">bullish · bearish signals</div></div>
    <div class="mstat"><div class="label">Top Gainer</div><div class="value ${cls(top.changePct)}">${top.sym}</div><div class="sub ${cls(top.changePct)}">${fmtPct(top.changePct)}</div></div>`;
}

/* ---------- cards ---------- */
function renderCards() {
  const list = visibleStocks();
  const el = document.getElementById("cards-view");
  if (!list.length) { el.innerHTML = `<div class="empty">No matches for &ldquo;${state.filter}&rdquo;.</div>`; return; }
  el.innerHTML = list.map((s) => {
    const up = s.change >= 0;
    const uc = (s.upside ?? 0) >= 0 ? "up-pos" : "up-neg";
    return `<article class="card ${up ? "up" : "down"}" data-sym="${s.sym}" tabindex="0" role="button" aria-label="${s.sym} details">
      <div class="card-top">
        <div class="card-id">${logoHTML(s.sym, "logo")}<div class="meta"><div class="ticker">${s.sym}</div><div class="company">${s.name}</div></div></div>
        ${pillHTML(s.changePct)}
      </div>
      <div class="card-price"><span class="now">${fmtPrice(s.price)}</span><span class="abs ${up ? "up" : "down"}">${fmtAbs(s.change)}</span></div>
      ${sparkSVG(s.series, "sp-" + s.sym, 50)}
      <div class="card-analyst">
        <span class="ca-left">${ratingBadge(s.an.key)} ${signalBadge(s.tech.score)}</span>
        <span class="ca-up ${uc}">${fmtPctS(s.upside)} <span style="color:var(--text-faint)">vs tgt</span></span>
      </div>
      <div class="card-foot">
        <div class="kv"><span class="k">Mkt Cap</span><span class="v">${fmtCap(s.mc)}</span></div>
        <div class="kv"><span class="k">Fwd P/E</span><span class="v">${fmtRatio(s.val.fpe)}</span></div>
        <div class="kv"><span class="k">Rev Gr</span><span class="v">${fmtPctS(s.grow.rev)}</span></div>
      </div>
    </article>`;
  }).join("");
}

/* ---------- screener table ---------- */
function renderTable() {
  let list = visibleStocks();
  const ts = state.tableSort;
  if (ts.key) {
    const get = {
      symbol: (s) => s.sym, price: (s) => s.price, changePct: (s) => s.changePct,
      fpe: (s) => s.val.fpe ?? 1e9, peg: (s) => s.val.peg ?? 1e9, revg: (s) => s.grow.rev ?? -1e9,
      margin: (s) => s.prof.pm ?? -1e9, target: (s) => s.an.mean ?? -1e9, upside: (s) => s.upside ?? -1e9,
      rating: (s) => s.an.rm ?? 9, signal: (s) => s.tech.score, mc: (s) => s.mc
    }[ts.key];
    list = [...list].sort((a, b) => { const va = get(a), vb = get(b); return (typeof va === "string" ? va.localeCompare(vb) : va - vb) * ts.dir; });
  }
  document.querySelectorAll(".th-sortable").forEach((th) => {
    th.classList.toggle("sorted", th.dataset.sort === ts.key);
    const base = th.textContent.replace(/[▲▼]\s*$/, "").trim();
    th.innerHTML = base + (th.dataset.sort === ts.key ? ` <span class="caret">${ts.dir > 0 ? "▲" : "▼"}</span>` : "");
  });
  const body = document.getElementById("table-body");
  if (!list.length) { body.innerHTML = `<tr><td colspan="12" class="empty">No matches.</td></tr>`; return; }
  body.innerHTML = list.map((s) => {
    const up = s.change >= 0, uc = (s.upside ?? 0) >= 0 ? "up-pos" : "up-neg";
    return `<tr data-sym="${s.sym}">
      <td><div class="t-ticker">${logoHTML(s.sym, "t-logo")}${s.sym}</div></td>
      <td class="td-num">${fmtPrice(s.price)}</td>
      <td class="td-num ${up ? "t-up" : "t-down"}">${fmtPct(s.changePct)}</td>
      <td class="td-num">${fmtRatio(s.val.fpe)}</td>
      <td class="td-num">${fmtRatio(s.val.peg)}</td>
      <td class="td-num ${(s.grow.rev ?? 0) >= 0 ? "t-up" : "t-down"}">${fmtPctS(s.grow.rev)}</td>
      <td class="td-num">${fmtPctP(s.prof.pm)}</td>
      <td class="td-num">${fmtPrice(s.an.mean)}</td>
      <td class="td-num ${uc}">${fmtPctS(s.upside)}</td>
      <td class="td-tag">${ratingBadge(s.an.key)}</td>
      <td class="td-tag">${signalBadge(s.tech.score)}</td>
      <td class="td-num">${fmtCap(s.mc)}</td>
    </tr>`;
  }).join("");
}

function render() { renderStrip(); if (state.view === "cards") renderCards(); else renderTable(); }

/* ============================================================
   Detail tear sheet
   ============================================================ */
let detailCtx = null;

function openDetail(sym) {
  const s = state.stocks.find((x) => x.sym === sym);
  if (!s) return;
  state.openSymbol = sym; state.detailTab = "overview"; state.detailRange = 64;
  const up = s.change >= 0;
  const logoEl = document.getElementById("d-logo");
  logoEl.style.background = BRAND[sym] || "#5b8cff"; logoEl.textContent = sym[0];
  document.getElementById("d-symbol").textContent = sym;
  document.getElementById("d-name").textContent = s.name;
  document.getElementById("d-exch").textContent = s.exch + " · " + s.cur;
  document.getElementById("d-price").textContent = fmtPrice(s.price);
  const dc = document.getElementById("d-change");
  dc.className = "change-pill " + (up ? "up" : "down");
  dc.innerHTML = `<span class="arrow">${up ? "▲" : "▼"}</span>${fmtAbs(s.change)} (${fmtPct(s.changePct)})`;
  const uc = (s.upside ?? 0) >= 0 ? "up-pos" : "up-neg";
  document.getElementById("d-rating").innerHTML =
    `${ratingBadge(s.an.key)} ${signalBadge(s.tech.score)} <span class="up-tag ${uc}">${fmtPctS(s.upside)} to tgt</span>`;
  document.querySelectorAll("#d-tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === "overview"));
  renderTab(s, "overview");
  const ov = document.getElementById("detail-overlay");
  ov.hidden = false; document.body.style.overflow = "hidden";
}
function closeDetail() {
  document.getElementById("detail-overlay").hidden = true;
  document.body.style.overflow = ""; state.openSymbol = null; detailCtx = null;
}

function renderTab(s, tab) {
  state.detailTab = tab;
  const c = document.getElementById("tab-content");
  if (tab === "overview") c.innerHTML = tplOverview(s);
  else if (tab === "fundamentals") c.innerHTML = tplFundamentals(s);
  else if (tab === "technicals") c.innerHTML = tplTechnicals(s);
  else if (tab === "analysts") c.innerHTML = tplAnalysts(s);
  else if (tab === "financials") c.innerHTML = tplFinancials(s);
  if (tab === "overview") {
    document.querySelectorAll("#d-range button").forEach((b) => b.classList.toggle("active", +b.dataset.range === state.detailRange));
    drawPriceChart(s, state.detailRange);
    const svg = document.getElementById("d-chart");
    svg.addEventListener("mousemove", onChartMove); svg.addEventListener("mouseleave", onChartLeave);
  }
  if (tab === "financials") drawFinChart(s);
}

/* ----- Overview ----- */
function tplOverview(s) {
  const p = posture(s.tech.score);
  const sig = [];
  sig.push(s.price > s.tech.sma50 ? "above 50-day avg" : "below 50-day avg");
  sig.push(s.tech.sma50 > s.tech.sma200 ? "50d &gt; 200d (golden)" : "50d &lt; 200d (death)");
  sig.push(s.tech.rsi >= 70 ? "RSI overbought" : s.tech.rsi <= 30 ? "RSI oversold" : "RSI neutral");
  sig.push(s.tech.macdHist > 0 ? "MACD positive" : "MACD negative");
  const uc = (s.upside ?? 0) >= 0 ? "up-pos" : "up-neg";
  return `
    <div class="range-tabs" id="d-range">
      <button data-range="21">1M</button><button data-range="32">3M</button><button data-range="64" class="active">6M</button>
    </div>
    <div class="chart-box">
      <svg id="d-chart" class="detail-chart" preserveAspectRatio="none"></svg>
      <div id="d-tooltip" class="chart-tooltip" hidden></div>
    </div>
    <div class="ts-section">
      <div class="ts-head">Outlook <span class="hint">— what the Street &amp; the tape say (not advice)</span></div>
      <div class="outlook">
        <div class="outlook-row">
          <span class="ol-label">📊 Analyst consensus target (${s.an.n || 0} analysts)</span>
          <span class="ol-val">${fmtPrice(s.an.mean)} · <span class="${uc}">${fmtPctS(s.upside)}</span></span>
        </div>
        <div class="outlook-row">
          <span class="ol-label">📈 Mechanical technical posture</span>
          <span class="ol-val">${signalBadge(s.tech.score)} <span style="color:var(--text-faint)">(${sig.join(", ")})</span></span>
        </div>
        <div class="outlook-row">
          <span class="ol-label">📐 60-day trend, extended 1 month (illustrative)</span>
          <span class="ol-val">${fmtPrice(s.tech.proj)} <span style="color:var(--text-faint)">±${fmtPrice(s.tech.projSd)}</span></span>
        </div>
        <div class="disclaimer"><strong>Not investment advice.</strong> The analyst target is third-party consensus; the technical posture is a mechanical rule-based signal; the trend line is a naïve linear extrapolation of recent prices shown only to illustrate momentum. None of these predict actual future prices and all can be wrong.</div>
      </div>
    </div>
    <div class="ts-section">
      <div class="ts-head">Snapshot</div>
      <div class="metric-grid">
        ${metric("Prev Close", fmtPrice(s.prev))}
        ${metric("Market Cap", fmtCap(s.mc))}
        ${metric("Volume", fmtVol(s.vol))}
        ${metric("P/E (TTM)", fmtRatio(s.pe))}
        ${metric("Fwd P/E", fmtRatio(s.val.fpe))}
        ${metric("Beta", fmtBeta(s.beta))}
        ${metric("52-Wk High", fmtPrice(s.wkHigh))}
        ${metric("52-Wk Low", fmtPrice(s.wkLow))}
        ${metric("Next Earnings", s.nextEarn ? fmtLongDate(s.nextEarn) : "—")}
      </div>
    </div>`;
}

function metric(k, v, cls, sub) {
  return `<div class="metric"><div class="mk">${k}</div><div class="mv ${cls || ""}">${v}</div>${sub ? `<div class="msub">${sub}</div>` : ""}</div>`;
}

/* ----- Fundamentals ----- */
function tplFundamentals(s) {
  const v = s.val, pr = s.prof, g = s.grow, h = s.health, d = s.div, e = s.eps;
  const gcls = (x) => x == null ? "" : x >= 0 ? "good" : "bad";
  return `
    <div class="ts-section"><div class="ts-head">Valuation</div><div class="metric-grid">
      ${metric("P/E (TTM)", fmtRatio(v.tpe))}
      ${metric("Forward P/E", fmtRatio(v.fpe))}
      ${metric("PEG Ratio", fmtRatio(v.peg))}
      ${metric("Price / Sales", fmtRatio(v.ps))}
      ${metric("Price / Book", fmtRatio(v.pb))}
      ${metric("EV / EBITDA", fmtRatio(v.ev2e))}
    </div></div>
    <div class="ts-section"><div class="ts-head">Profitability &amp; Returns</div><div class="metric-grid">
      ${metric("Gross Margin", fmtPctP(pr.gm))}
      ${metric("Operating Margin", fmtPctP(pr.om))}
      ${metric("Net Margin", fmtPctP(pr.pm))}
      ${metric("Return on Equity", fmtPctP(pr.roe), "good")}
      ${metric("Return on Assets", fmtPctP(pr.roa))}
      ${metric("EV / Revenue", fmtRatio(v.ev2r))}
    </div></div>
    <div class="ts-section"><div class="ts-head">Growth (YoY)</div><div class="metric-grid">
      ${metric("Revenue Growth", fmtPctS(g.rev), gcls(g.rev))}
      ${metric("Earnings Growth", fmtPctS(g.earn), gcls(g.earn))}
      ${metric("EPS (TTM)", e.t == null ? "—" : "$" + e.t.toFixed(2))}
      ${metric("EPS (Fwd)", e.f == null ? "—" : "$" + e.f.toFixed(2))}
      ${metric("Dividend Yield", d.y == null ? "None" : fmtPctP(d.y))}
      ${metric("Payout Ratio", d.po == null ? "—" : fmtPctP(d.po))}
    </div></div>
    <div class="ts-section"><div class="ts-head">Balance Sheet &amp; Cash <span class="hint">— TTM / latest</span></div><div class="metric-grid">
      ${metric("Total Revenue", fmtMil(h.rev))}
      ${metric("EBITDA", fmtMil(h.ebitda))}
      ${metric("Free Cash Flow", fmtMil(h.fcf), gcls(h.fcf))}
      ${metric("Total Cash", fmtMil(h.cash))}
      ${metric("Total Debt", fmtMil(h.debt))}
      ${metric("Debt / Equity", h.d2e == null ? "—" : (h.d2e / 100).toFixed(2), h.d2e > 150 ? "warn" : "")}
      ${metric("Current Ratio", fmtRatio(h.cr), h.cr < 1 ? "warn" : "good")}
      ${metric("Quick Ratio", fmtRatio(h.qr))}
      ${metric("Shares Out", fmtVol(s.so))}
    </div></div>`;
}

/* ----- Technicals ----- */
function tplTechnicals(s) {
  const t = s.tech, p = posture(t.score);
  const vsSma50 = ((s.price / t.sma50 - 1) * 100);
  const vsSma200 = ((s.price / t.sma200 - 1) * 100);
  const relVol = t.avgVol ? s.vol / t.avgVol : null;
  const rangePos = ((s.price - t.lo1y) / ((t.hi1y - t.lo1y) || 1) * 100);
  return `
    <div class="ts-section"><div class="ts-head">Composite signal <span class="hint">— mechanical, rule-based</span></div>
      <div class="outlook">
        <div class="outlook-row"><span class="ol-label">Overall posture (score ${t.score >= 0 ? "+" : ""}${t.score} of ±6)</span><span class="ol-val">${signalBadge(t.score)}</span></div>
        <div class="disclaimer"><strong>Not advice.</strong> Posture combines price vs moving averages, golden/death cross, RSI zone, MACD and 60-day slope into a simple score. It describes recent price behaviour, not a recommendation.</div>
      </div>
    </div>
    <div class="ts-section"><div class="ts-head">Trend &amp; momentum</div><div class="metric-grid">
      ${metric("50-Day SMA", fmtPrice(t.sma50), "", fmtPctS(vsSma50) + " vs price")}
      ${metric("200-Day SMA", fmtPrice(t.sma200), "", fmtPctS(vsSma200) + " vs price")}
      ${metric("Cross", t.sma50 > t.sma200 ? "Golden ▲" : "Death ▼", t.sma50 > t.sma200 ? "good" : "bad")}
      ${metric("MACD", fmtRatio(t.macd), t.macdHist > 0 ? "good" : "bad", "hist " + (t.macdHist >= 0 ? "+" : "") + t.macdHist)}
      ${metric("Beta (volatility)", fmtBeta(s.beta), "")}
      ${metric("Rel. Volume", relVol == null ? "—" : relVol.toFixed(2) + "×", relVol > 1.2 ? "warn" : "")}
    </div></div>
    <div class="ts-section"><div class="ts-head">RSI (14)</div>
      ${rsiGauge(t.rsi)}
    </div>
    <div class="ts-section"><div class="ts-head">1-Year range</div>
      <div class="metric-grid">
        ${metric("1Y High", fmtPrice(t.hi1y))}
        ${metric("1Y Low", fmtPrice(t.lo1y))}
        ${metric("Range Position", rangePos.toFixed(0) + "%", "", "0% = low · 100% = high")}
      </div>
    </div>`;
}
function rsiGauge(rsi) {
  const x = Math.max(0, Math.min(100, rsi));
  const zone = rsi >= 70 ? "Overbought" : rsi <= 30 ? "Oversold" : "Neutral";
  const zc = rsi >= 70 ? "t-down" : rsi <= 30 ? "t-up" : "";
  return `<div class="gauge"><div class="gauge-track"><div class="gauge-marker" style="left:${x}%"></div></div>
    <div class="gauge-scale"><span>0</span><span>30 oversold</span><span>70 overbought</span><span>100</span></div>
    <div style="margin-top:8px;font-size:13px"><span class="mono" style="font-weight:700">${rsi == null ? "—" : rsi.toFixed(1)}</span> <span class="${zc}" style="font-weight:600">${zone}</span></div></div>`;
}

/* ----- Analysts ----- */
function tplAnalysts(s) {
  const a = s.an;
  const total = (a.sb || 0) + (a.b || 0) + (a.h || 0) + (a.se || 0) + (a.ss || 0);
  const seg = (n, cls, label) => { const w = total ? (n / total * 100) : 0; return w > 0 ? `<div class="dist-seg ${cls}" style="width:${w}%" title="${label}: ${n}">${w > 9 ? n : ""}</div>` : ""; };
  const uc = (s.upside ?? 0) >= 0 ? "up-pos" : "up-neg";
  return `
    <div class="ts-section"><div class="ts-head">Consensus rating <span class="hint">— ${a.n || 0} analysts</span></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        ${ratingBadge(a.key)}<span class="mono" style="color:var(--text-dim);font-size:12px">mean rating ${a.rm == null ? "—" : a.rm.toFixed(2)} / 5 (1=Strong Buy)</span>
      </div>
      <div class="dist-bar">${seg(a.sb, "sb", "Strong Buy")}${seg(a.b, "b", "Buy")}${seg(a.h, "h", "Hold")}${seg(a.se, "se", "Sell")}${seg(a.ss, "ss", "Strong Sell")}</div>
      <div class="dist-legend">
        <span><i style="background:#0bbf6a"></i>Strong Buy ${a.sb || 0}</span><span><i style="background:#16c784"></i>Buy ${a.b || 0}</span>
        <span><i style="background:#f0b429"></i>Hold ${a.h || 0}</span><span><i style="background:#ff8a3d"></i>Sell ${a.se || 0}</span>
        <span><i style="background:#ea3943"></i>Strong Sell ${a.ss || 0}</span>
      </div>
    </div>
    <div class="ts-section"><div class="ts-head">12-month price targets</div>
      ${targetRange(a.low, a.mean, a.high, s.price)}
      <div class="metric-grid" style="margin-top:14px">
        ${metric("Low Target", fmtPrice(a.low))}
        ${metric("Mean Target", fmtPrice(a.mean), "", `<span class="${uc}">${fmtPctS(s.upside)}</span> vs price`)}
        ${metric("High Target", fmtPrice(a.high))}
      </div>
      <div class="disclaimer" style="background:var(--surface-2);border-color:var(--border-soft);color:var(--text-dim)">Targets are third-party analyst estimates aggregated by Yahoo Finance and are <strong>not</strong> predictions or recommendations from this app.</div>
    </div>`;
}
function targetRange(low, mean, high, price) {
  if (low == null || high == null) return "";
  const lo = Math.min(low, price) * 0.97, hi = Math.max(high, price) * 1.03, span = hi - lo || 1;
  const pos = (v) => ((v - lo) / span * 100).toFixed(1);
  const fillL = pos(low), fillW = (pos(high) - pos(low)).toFixed(1);
  return `<div class="tgt-track">
    <div class="tgt-fill" style="left:${fillL}%;width:${fillW}%"></div>
    <div class="tgt-pt low" style="left:${pos(low)}%"><span class="dot"></span><span class="lbl bot">${fmtPrice(low)}</span></div>
    <div class="tgt-pt high" style="left:${pos(high)}%"><span class="dot"></span><span class="lbl bot">${fmtPrice(high)}</span></div>
    <div class="tgt-pt mean" style="left:${pos(mean)}%"><span class="dot"></span><span class="lbl top">mean ${fmtPrice(mean)}</span></div>
    <div class="tgt-pt cur" style="left:${pos(price)}%"><span class="dot"></span><span class="lbl top">now ${fmtPrice(price)}</span></div>
  </div>`;
}

/* ----- Financials ----- */
function tplFinancials(s) {
  const f = s.fin.slice().reverse(); // oldest -> newest
  const rows = s.fin.map((y) => {
    const nm = y.rev ? (y.ni / y.rev * 100) : null;
    return `<tr><td>${y.d}</td><td>${fmtMil(y.rev)}</td><td>${fmtMil(y.ni)}</td><td class="${(nm ?? 0) >= 0 ? "t-up" : "t-down"}">${nm == null ? "—" : nm.toFixed(1) + "%"}</td></tr>`;
  }).join("");
  return `
    <div class="ts-section"><div class="ts-head">Revenue &amp; net income <span class="hint">— last 4 fiscal years, USD</span></div>
      <div class="fin-legend"><span><i style="background:var(--accent)"></i>Revenue</span><span><i style="background:#16c784"></i>Net income</span></div>
      <svg id="d-finchart" class="fin-chart" preserveAspectRatio="none"></svg>
    </div>
    <div class="ts-section"><div class="ts-head">Income statement</div>
      <table class="fin-table"><thead><tr><th>Fiscal Yr</th><th>Revenue</th><th>Net Income</th><th>Net Margin</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}
function drawFinChart(s) {
  const f = s.fin.slice().reverse();
  const svg = document.getElementById("d-finchart"); if (!svg) return;
  const W = 600, H = 170, padB = 22, padT = 16, padX = 10;
  const maxV = Math.max(...f.map((y) => y.rev || 0));
  const minV = Math.min(0, ...f.map((y) => y.ni || 0));
  const span = (maxV - minV) || 1;
  const zeroY = padT + (maxV / span) * (H - padT - padB);
  const y = (v) => padT + ((maxV - v) / span) * (H - padT - padB);
  const groupW = (W - padX * 2) / f.length;
  const bw = Math.min(34, groupW * 0.3);
  let bars = "", labels = "";
  f.forEach((yr, i) => {
    const cx = padX + groupW * (i + 0.5);
    const rh = Math.abs(y(yr.rev) - zeroY), ih = Math.abs(y(yr.ni) - zeroY);
    const rY = yr.rev >= 0 ? y(yr.rev) : zeroY, iY = yr.ni >= 0 ? y(yr.ni) : zeroY;
    bars += `<rect x="${(cx - bw - 2).toFixed(1)}" y="${rY.toFixed(1)}" width="${bw}" height="${Math.max(1, rh).toFixed(1)}" rx="2" fill="var(--accent)"/>`;
    bars += `<rect x="${(cx + 2).toFixed(1)}" y="${iY.toFixed(1)}" width="${bw}" height="${Math.max(1, ih).toFixed(1)}" rx="2" fill="#16c784"/>`;
    labels += `<text x="${cx.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="12" style="fill:var(--text-faint)" font-family="'JetBrains Mono',monospace">${yr.d}</text>`;
    labels += `<text x="${(cx - bw / 2 - 2).toFixed(1)}" y="${(rY - 4).toFixed(1)}" text-anchor="middle" font-size="10.5" style="fill:var(--text-dim)" font-family="'JetBrains Mono',monospace">${(yr.rev / 1000).toFixed(0)}B</text>`;
  });
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = `<line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${W - padX}" y2="${zeroY.toFixed(1)}" style="stroke:var(--border)" stroke-width="1" vector-effect="non-scaling-stroke"/>${bars}${labels}`;
}

/* ---------- price chart with projection ---------- */
function drawPriceChart(s, count) {
  const VBW = 1000, VBH = 300, padTop = 18, padBot = 26, padL = 8;
  const series = s.series.slice(-count), dates = s.dates.slice(-count), n = series.length;
  const withProj = count >= 32 && s.tech && s.tech.proj != null;
  const projSpan = withProj ? Math.round((n - 1) * 0.26) : 0;
  const xMax = (n - 1) + projSpan;
  const proj = s.tech.proj, projSd = s.tech.projSd || 0;
  let lo = Math.min(...series), hi = Math.max(...series);
  if (withProj) { lo = Math.min(lo, proj - projSd); hi = Math.max(hi, proj + projSd); }
  const span = (hi - lo) || 1;
  const x = (i) => padL + (i / xMax) * (VBW - padL * 2);
  const y = (v) => padTop + (1 - (v - lo) / span) * (VBH - padTop - padBot);
  let line = ""; for (let i = 0; i < n; i++) line += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(series[i]).toFixed(1) + " ";
  const area = line + `L${x(n - 1).toFixed(1)} ${VBH - padBot} L${x(0).toFixed(1)} ${VBH - padBot} Z`;
  const up = series[n - 1] >= series[0], col = up ? "#16c784" : "#ea3943";
  const LBL = `font-size="13" style="fill:var(--text-faint)" font-family="'JetBrains Mono', monospace"`;
  let grid = "";
  for (let g = 0; g <= 3; g++) {
    const gy = padTop + (g / 3) * (VBH - padTop - padBot), gv = hi - (g / 3) * span;
    grid += `<line x1="${padL}" y1="${gy.toFixed(1)}" x2="${VBW - padL}" y2="${gy.toFixed(1)}" style="stroke:var(--border-soft)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    grid += `<text x="${VBW - padL}" y="${(gy - 4).toFixed(1)}" text-anchor="end" ${LBL}>${fmtPrice(gv)}</text>`;
  }
  let xlab = "";
  [0, Math.floor((n - 1) / 2), n - 1].forEach((i) => {
    const anchor = i === 0 ? "start" : "middle";
    xlab += `<text x="${x(i).toFixed(1)}" y="${VBH - 6}" text-anchor="${anchor}" ${LBL}>${fmtShortDate(dates[i])}</text>`;
  });
  let projEls = "";
  if (withProj) {
    const lx = x(n - 1), ly = y(series[n - 1]), px = x(xMax), pyV = y(proj), pyHi = y(proj + projSd), pyLo = y(proj - projSd);
    projEls = `
      <polygon points="${lx.toFixed(1)},${ly.toFixed(1)} ${px.toFixed(1)},${pyHi.toFixed(1)} ${px.toFixed(1)},${pyLo.toFixed(1)}" fill="${col}" opacity="0.12"/>
      <line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${px.toFixed(1)}" y2="${pyV.toFixed(1)}" stroke="${col}" stroke-width="1.6" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>
      <line x1="${lx.toFixed(1)}" y1="${padTop}" x2="${lx.toFixed(1)}" y2="${VBH - padBot}" style="stroke:var(--border)" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>
      <circle cx="${px.toFixed(1)}" cy="${pyV.toFixed(1)}" r="3.5" fill="${col}" vector-effect="non-scaling-stroke"/>
      <text x="${px.toFixed(1)}" y="${(pyV - 8).toFixed(1)}" text-anchor="end" font-size="12" style="fill:var(--text-faint)" font-family="'JetBrains Mono',monospace">trend</text>`;
  }
  const svg = document.getElementById("d-chart");
  svg.setAttribute("viewBox", `0 0 ${VBW} ${VBH}`); svg.setAttribute("preserveAspectRatio", "none");
  svg.innerHTML = `<defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${col}" stop-opacity="0.3"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${area}" fill="url(#dg)"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2.2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>
    ${projEls}
    <line id="d-cross" x1="0" y1="${padTop}" x2="0" y2="${VBH - padBot}" stroke="${col}" stroke-width="1" vector-effect="non-scaling-stroke" opacity="0"/>
    <circle id="d-dot" r="4" fill="${col}" style="stroke:var(--surface)" stroke-width="2" vector-effect="non-scaling-stroke" opacity="0"/>
    ${xlab}`;
  detailCtx = { series, dates, n, x, y, VBW, VBH, padL, xMax };
}
function onChartMove(e) {
  if (!detailCtx) return;
  const svg = document.getElementById("d-chart"); if (!svg) return;
  const rect = svg.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const xvb = ratio * detailCtx.VBW;
  let k = Math.round((xvb - detailCtx.padL) * detailCtx.xMax / (detailCtx.VBW - detailCtx.padL * 2));
  k = Math.max(0, Math.min(detailCtx.n - 1, k));
  const vbx = detailCtx.x(k), vby = detailCtx.y(detailCtx.series[k]);
  const px = (vbx / detailCtx.VBW) * rect.width, py = (vby / detailCtx.VBH) * rect.height;
  const cr = document.getElementById("d-cross"), dot = document.getElementById("d-dot");
  if (cr) { cr.setAttribute("x1", vbx); cr.setAttribute("x2", vbx); cr.setAttribute("opacity", "0.4"); }
  if (dot) { dot.setAttribute("cx", vbx); dot.setAttribute("cy", vby); dot.setAttribute("opacity", "1"); }
  const tip = document.getElementById("d-tooltip");
  if (tip) { tip.hidden = false; tip.style.left = px + "px"; tip.style.top = py + "px";
    tip.innerHTML = `<div class="tt-price">${fmtPrice(detailCtx.series[k])}</div><div class="tt-date">${fmtShortDate(detailCtx.dates[k])}</div>`; }
}
function onChartLeave() {
  const c = document.getElementById("d-cross"), d = document.getElementById("d-dot"), t = document.getElementById("d-tooltip");
  if (c) c.setAttribute("opacity", "0"); if (d) d.setAttribute("opacity", "0"); if (t) t.hidden = true;
}

/* ---------- status / footer ---------- */
function setStatus(kind, text, title) {
  const b = document.getElementById("status-badge"); b.className = "status-badge " + kind;
  document.getElementById("status-text").textContent = text; if (title) b.title = title;
}
function setFooter() {
  const note = document.getElementById("footer-note");
  if (state.live) note.innerHTML = `Live prices &mdash; refreshed ${new Date().toLocaleString("en-US")}. Fundamentals, analyst data &amp; technicals are as of ${state.fundAsOf}. Source: Yahoo Finance.`;
  else note.innerHTML = `Showing a baked snapshot from <strong>${state.asOfLabel}</strong>; the app tries a live no-key refresh on load. Fundamentals/analyst/technicals as of ${state.fundAsOf}.`;
}

/* ---------- live refresh ---------- */
const PROXIES = [
  (u) => "https://corsproxy.io/?url=" + encodeURIComponent(u),
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://thingproxy.freeboard.io/fetch/" + u
];
const yahooURL = (sym) => `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=6mo&interval=1d`;
function downsample(arr, m) { const nn = arr.filter((v) => v != null); if (nn.length <= m) return nn; const out = []; for (let k = 0; k < m; k++) out.push(nn[Math.round(k * (nn.length - 1) / (m - 1))]); return out; }
async function fetchJSON(url, ms) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 7000); try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error("HTTP " + r.status); return await r.json(); } finally { clearTimeout(t); } }
async function fetchLive(sym, pIdx) {
  const j = await fetchJSON(PROXIES[pIdx](yahooURL(sym)), 7000);
  const res = j.chart.result[0], m = res.meta;
  const closes = res.indicators.quote[0].close.filter((v) => v != null).map((v) => Math.round(v * 100) / 100);
  return { sym, price: m.regularMarketPrice, prev: closes.length >= 2 ? closes[closes.length - 2] : m.chartPreviousClose, vol: m.regularMarketVolume, series: downsample(closes, 64) };
}
async function refreshLive() {
  setStatus("loading", "Checking live data…");
  const btn = document.getElementById("refresh-btn"); btn.classList.add("spinning");
  let proxy = -1;
  for (let p = 0; p < PROXIES.length; p++) { try { await fetchLive(state.stocks[0].sym, p); proxy = p; break; } catch (e) {} }
  if (proxy === -1) { state.live = false; setStatus("snapshot", "Snapshot · " + state.asOfLabel, "Live feed unreachable — showing snapshot from " + state.asOfLabel + "."); setFooter(); btn.classList.remove("spinning"); return; }
  const results = await Promise.allSettled(state.stocks.map((s) => fetchLive(s.sym, proxy)));
  let ok = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value && isFinite(r.value.price)) {
      const L = r.value, s = state.stocks[i];
      s.price = L.price; s.prev = L.prev; s.change = s.price - s.prev; s.changePct = s.change / s.prev * 100;
      if (isFinite(L.vol)) s.vol = L.vol; if (L.series && L.series.length > 5) s.series = L.series;
      s.upside = s.an && s.an.mean ? (s.an.mean / s.price - 1) * 100 : null; ok++;
    }
  });
  if (ok > 0) {
    state.live = true;
    const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    setStatus("live", "Live · updated " + t, "Live prices from Yahoo Finance at " + t + "."); setFooter(); render();
    if (state.openSymbol) { const s = state.stocks.find((x) => x.sym === state.openSymbol); if (s) renderTab(s, state.detailTab); }
  } else { state.live = false; setStatus("snapshot", "Snapshot · " + state.asOfLabel, "Live feed returned no usable data — showing snapshot."); setFooter(); }
  btn.classList.remove("spinning");
}

/* ---------- theme ---------- */
function initTheme() { let v = null; try { v = localStorage.getItem("tsd-theme"); } catch (e) {} if (v) document.documentElement.setAttribute("data-theme", v); }
function toggleTheme() { const cur = document.documentElement.getAttribute("data-theme"), next = cur === "dark" ? "light" : "dark"; document.documentElement.setAttribute("data-theme", next); try { localStorage.setItem("tsd-theme", next); } catch (e) {} }

/* ---------- events ---------- */
function wire() {
  document.getElementById("search").addEventListener("input", (e) => { state.filter = e.target.value; render(); });
  document.getElementById("sort-select").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  document.getElementById("theme-btn").addEventListener("click", toggleTheme);
  document.getElementById("refresh-btn").addEventListener("click", refreshLive);
  document.getElementById("view-cards").addEventListener("click", () => switchView("cards"));
  document.getElementById("view-table").addEventListener("click", () => switchView("table"));
  document.getElementById("cards-view").addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) openDetail(c.dataset.sym); });
  document.getElementById("cards-view").addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("card")) { e.preventDefault(); openDetail(e.target.dataset.sym); } });
  document.getElementById("table-body").addEventListener("click", (e) => { const r = e.target.closest("tr"); if (r && r.dataset.sym) openDetail(r.dataset.sym); });
  document.querySelectorAll(".th-sortable").forEach((th) => th.addEventListener("click", () => {
    const k = th.dataset.sort;
    if (state.tableSort.key === k) state.tableSort.dir *= -1;
    else state.tableSort = { key: k, dir: (k === "symbol" || k === "rating") ? 1 : -1 };
    renderTable();
  }));
  document.getElementById("detail-close").addEventListener("click", closeDetail);
  document.getElementById("detail-overlay").addEventListener("click", (e) => { if (e.target.id === "detail-overlay") closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !document.getElementById("detail-overlay").hidden) closeDetail(); });
  document.getElementById("d-tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll("#d-tabs button").forEach((x) => x.classList.remove("active")); b.classList.add("active");
    const s = state.stocks.find((x) => x.sym === state.openSymbol); if (s) renderTab(s, b.dataset.tab);
  });
  document.getElementById("tab-content").addEventListener("click", (e) => {
    const b = e.target.closest("#d-range button"); if (!b) return;
    document.querySelectorAll("#d-range button").forEach((x) => x.classList.remove("active")); b.classList.add("active");
    state.detailRange = +b.dataset.range;
    const s = state.stocks.find((x) => x.sym === state.openSymbol); if (s) drawPriceChart(s, state.detailRange);
  });
}
function switchView(v) {
  state.view = v;
  document.getElementById("view-cards").classList.toggle("active", v === "cards");
  document.getElementById("view-table").classList.toggle("active", v === "table");
  document.getElementById("cards-view").hidden = v !== "cards";
  document.getElementById("table-view").hidden = v !== "table";
  render();
}

/* ---------- boot ---------- */
let booted = false;
function boot() {
  if (booted) return; booted = true;
  if (!window.SNAPSHOT) { document.getElementById("cards-view").innerHTML = '<div class="empty">Failed to load data.</div>'; return; }
  initTheme();
  state.stocks = buildStocks(window.SNAPSHOT);
  state.asOfLabel = window.SNAPSHOT.asOfLabel; state.fundAsOf = window.SNAPSHOT.fundamentalsAsOf;
  wire(); render();
  setStatus("snapshot", "Snapshot · " + state.asOfLabel, "Baked snapshot from " + state.asOfLabel + ". Attempting live refresh…");
  setFooter();
  setTimeout(refreshLive, 400);
}
document.addEventListener("DOMContentLoaded", boot);
