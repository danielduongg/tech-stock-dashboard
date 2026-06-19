# 📈 Tech Stock Dashboard

A clean, responsive single-page dashboard that tracks the major technology stocks — prices, daily change, market cap, volume, sparklines, and an interactive detail chart. Built as a dependency-free static site and deployed on GitHub Pages.

**🔗 Live demo:** https://danielduongg.github.io/tech-stock-dashboard/

---

## Features

- **Nine major tech names** — AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, plus AMD and NFLX.
- **Summary cards + sortable table** — switch between a card grid and a sortable data table; sort by % change, price, market cap, or volume, and filter by ticker/company.
- **Color-coded gains/losses** — green/red throughout, with a market-breadth summary strip (average change, advancers/decliners, top gainer & laggard).
- **Sparklines on every row** — a 6-month price trend rendered as a hand-built SVG (no chart library).
- **Click into any stock** — opens a larger interactive chart with a hover tooltip, 1M / 3M / 6M range toggles, and a full stats grid (previous close, market cap, volume, P/E, shares outstanding, 52-week range).
- **Light & dark themes** — toggle in the header; preference is remembered.
- **Fully responsive** — works from wide desktop down to mobile.

## Data & freshness

This app is **transparent about where its numbers come from**:

- It ships with a **baked snapshot of real market data** captured at **market close on June 18, 2026** from Yahoo Finance. The "as of" date is shown in the header badge and the footer, so a snapshot is never presented as if it were live.
- On load (and via the ↻ refresh button) the app **attempts a live, no-key refresh** straight from the browser using Yahoo Finance's public chart endpoint through a public CORS proxy. If that succeeds, prices and charts update and the badge turns **green ("Live")**.
- If a live feed isn't reachable from your browser (proxies are rate-limited and not guaranteed on static hosting), the app **gracefully falls back to the snapshot** and the badge stays **amber ("Snapshot")** — so what you see is always clearly labeled.

This hybrid approach keeps the site working and good-looking everywhere, while never misrepresenting stale numbers as live.

## Tech

- Plain **HTML + CSS + vanilla JavaScript** — no frameworks, no build step, no dependencies.
- Charts and sparklines are **hand-rolled SVG**, so there's nothing to bundle and nothing to break offline.
- The only external resource is the Inter / JetBrains Mono webfont (with a full system-font fallback).

## Project structure

```
index.html    — markup and layout
styles.css    — theming (CSS variables), responsive styles
app.js        — rendering, sorting/filtering, charts, live-refresh logic
data.js       — baked real snapshot (window.SNAPSHOT)
```

## Run locally

It's a static site, so any static server works:

```bash
# from the project folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly via `file://` also works, though the live-refresh step may be blocked by the browser in that mode — the snapshot will still render.

## Deploy (GitHub Pages)

1. Push these files to the **root** of a public repository.
2. In **Settings → Pages**, set **Source: Deploy from a branch**, **Branch: `main` / `root`**.
3. Wait for the build; the site publishes at `https://<user>.github.io/<repo>/`.

## Disclaimer

For informational and educational purposes only. This is not investment advice. Market data may be delayed or, when the live feed is unavailable, reflect the labeled snapshot date.

## License

[MIT](LICENSE) © 2026 Daniel Duong
