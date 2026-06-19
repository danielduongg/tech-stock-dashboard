# 📈 Tech Stock Dashboard

A professional-grade, single-page dashboard for the major technology stocks — combining live prices with the fundamentals, valuation, analyst coverage, technicals and financial statements that Wall Street and professional investors actually look at. Built as a dependency-free static site and deployed on GitHub Pages.

**🔗 Live demo:** https://danielduongg.github.io/tech-stock-dashboard/

---

## Coverage

Nine names: **AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, AMD, NFLX**.

Three top-level views:

- **Cards** — a clean visual summary: price, daily change, a 6-month sparkline, consensus rating + analyst upside, technical signal, market cap, forward P/E and revenue growth.
- **Screener** — a sortable, dense table (price, % change, forward P/E, PEG, revenue growth, net margin, analyst target, implied upside, consensus rating, technical signal, market cap).
- **Analytics** — a quant workspace (see below).

Click any stock to open a full **company tear sheet** with five tabs.

## Analytics workspace

A cross-sectional, quant-style view of the whole group:

- **Performance heatmap** — total return over 1W / 1M / 3M / 6M / YTD / 1Y, color-coded.
- **Relative performance** — all nine rebased to 100 on a **log scale** against the **Nasdaq-100 (QQQ)** and **S&P 500 (SPY)** benchmarks; click legend chips to isolate lines.
- **Risk & return** — annualized volatility, **beta vs QQQ**, **max drawdown**, and **Sharpe** (rf 4.5%), sorted by Sharpe.
- **Return correlation matrix** — 1-year daily-return correlations across all nine.
- **Valuation vs growth (GARP map)** — forward P/E vs revenue growth, bubble size = market cap, with peer-median crosshairs.
- **Risk vs return map** — annualized volatility vs 1-year return, bubble = market cap, with the QQQ/SPY benchmarks, the equal-weight portfolio, and a capital market line.
- **Underwater drawdowns** — each name's decline from its running peak over the year, with the equal-weight portfolio overlaid.
- **Equal-weight portfolio** — a 1/9-each basket that shows the diversification benefit (volatility well below the average single name), with return, Sharpe, Sortino, beta and max drawdown.
- **Advanced risk statistics** — Sortino & Calmar ratios, 1-day 95% Value-at-Risk, return skew, % positive days, and up/down capture vs QQQ.
- **Efficient frontier** — a Monte Carlo of ~3,500 random long-only portfolios of the nine, colored by Sharpe, with the minimum-variance and maximum-Sharpe (tangency) portfolios, the equal-weight point, and a capital allocation line.
- **Monthly returns (seasonality)** — calendar-month total returns for every name and the equal-weight portfolio.

## Advanced charting

In the tear sheet, toggle the price chart between a **line** view (with the illustrative trend projection) and **candlesticks** — daily OHLC with a **volume** sub-panel, **50/200-day moving averages**, and **Bollinger Bands (20, 2)**. Candlestick OHLC is fetched live on demand and falls back to the line chart if the feed is unavailable.

## The tear sheet — what professional investors look at

**Overview** — interactive price chart (1M / 3M / 6M) with hover tooltip and a clearly-labeled trend projection, an *Outlook* panel, and a key-stats snapshot (prev close, market cap, volume, P/E, forward P/E, beta, 52-week range, next earnings date).

**Fundamentals**
- *Valuation:* P/E (trailing & forward), PEG, Price/Sales, Price/Book, EV/EBITDA, EV/Revenue
- *Profitability & returns:* gross / operating / net margins, ROE, ROA
- *Growth:* revenue growth, earnings growth, trailing & forward EPS, dividend yield & payout
- *Balance sheet & cash:* revenue, EBITDA, free cash flow, total cash, total debt, debt/equity, current & quick ratios, shares outstanding

**Technicals** — a mechanical composite posture (Bullish / Neutral / Bearish) built from: price vs 50- & 200-day moving averages, golden/death cross, RSI(14) with a gauge, MACD, beta, relative volume, and 1-year range position.

**Analysts** — consensus rating with the full distribution (Strong Buy → Strong Sell), number of covering analysts, and the 12-month price-target range (low / mean / high) shown against the current price with implied upside.

**Financials** — last four fiscal years of revenue and net income as a chart and an income-statement table with net margin.

## How the "Outlook / prediction" works — and what it is **not**

This app is deliberately transparent about forecasting, which is hard and easily misused. The Outlook panel shows three *separate, clearly-labeled* things:

1. **Analyst consensus price target** — third-party estimates aggregated by Yahoo Finance, with implied upside vs the current price. This is the genuine "Street view," not the app's opinion.
2. **Mechanical technical posture** — a simple, rule-based score over moving averages, RSI, MACD and slope. It summarizes recent price *behaviour*; it is not a recommendation.
3. **Trend projection** — a naïve linear extrapolation of the last ~60 trading days, extended one month with a ±1σ band, drawn only to visualize momentum.

> **None of these predict actual future prices, and all can be wrong.** This is **not investment advice**. See the disclaimer in the app and below.

## Data & freshness

- Ships with a **baked snapshot of real data** captured at **market close on June 18, 2026** from Yahoo Finance (prices, full fundamentals, analyst data, 4-year financials, and 1-year-derived technicals). The "as of" date is shown in the header and footer.
- On load (and via the ↻ button) the app attempts a **live, no-key price refresh** from Yahoo's public endpoint through a CORS proxy. On success the badge turns **green ("Live")** and prices/implied-upside update; otherwise it falls back to the snapshot (amber **"Snapshot"**). Fundamentals/analyst/technical figures are point-in-time as of the snapshot date.

## Tech

- Plain **HTML + CSS + vanilla JavaScript**. No frameworks, no build step, no dependencies.
- All charts, gauges and bars are **hand-rolled SVG/CSS**, so nothing to bundle and nothing to break offline.
- Light & dark themes; fully responsive.

## Project structure

```
index.html    — markup, tear-sheet shell, screener
styles.css    — theming (CSS variables) + components
app.js        — rendering, screener/sort/filter, tear sheet, charts, technicals, live refresh
data.js       — baked real snapshot (window.SNAPSHOT): prices, fundamentals, analyst, financials, technicals
```

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy (GitHub Pages)

Push to the root of a public repo, then **Settings -> Pages -> Deploy from a branch -> `main` / `root`**. Publishes at `https://<user>.github.io/<repo>/`.

## Disclaimer

For informational and educational purposes only. **This is not investment advice**, and nothing here is a recommendation to buy or sell any security. Market data may be delayed or, when the live feed is unavailable, reflect the labeled snapshot date. Analyst targets are third-party estimates; technical signals, trend projections, portfolio figures and risk statistics are mechanical and illustrative. Always do your own research.

## License

[MIT](LICENSE) (c) 2026 Daniel Duong
