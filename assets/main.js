(() => {
  const isEN = location.pathname.includes('/en/');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const fmtPct = (x) => {
    if (!isFinite(x)) return "—";
    return (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
  };
  const fmtNum = (n, digits = 2) => {
    if (!isFinite(n)) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: digits });
  };
  const fmtTok = (n) => {
    if (!isFinite(n)) return "—";
    const abs = Math.abs(n);
    const d = abs >= 100 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
    return n.toLocaleString(undefined, { maximumFractionDigits: d });
  };

  const fetchJSON = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.json();
  };
  const binanceJSON = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("Binance HTTP " + r.status);
    return r.json();
  };

  const loadConfig = async () => {
    try { return await fetchJSON("../data/blockpilot.json"); }
    catch (e) { console.warn("config load failed", e); return null; }
  };

  const setHref = (el, href) => { if (el && href) el.setAttribute("href", href); };

  const wireCTAs = (cfg) => {
    const bookUrl = cfg?.contact?.book_call_url || "";
    const email = cfg?.contact?.email || "";
    const termsUrl = cfg?.contact?.terms_url || "";
    const docsUrl = cfg?.contact?.docs_url || "";

    setHref($("#ctaBook"), bookUrl);
    setHref($("#ctaEmail"), email ? `mailto:${email}` : "");

    const footerEmail = $("#footerEmail");
    if (footerEmail && email) footerEmail.textContent = email;
    setHref($("#footerTerms"), termsUrl);

    const docsEls = $$("#navDocs, [data-docs-link], #footerDocs").filter(Boolean);
    docsEls.forEach((el) => {
      if (docsUrl) {
        el.classList.remove("is-disabled");
        el.removeAttribute("aria-disabled");
        el.setAttribute("href", docsUrl);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      } else {
        el.classList.add("is-disabled");
        el.setAttribute("aria-disabled", "true");
        el.setAttribute("title", isEN ? "Docs coming soon" : "Docs bientôt disponibles");
        el.setAttribute("href", "#");
      }
    });
  };

  const wireLangSwitch = () => {
    const fr = $("#lang-fr"), en = $("#lang-en");
    if (!fr || !en) return;
    const path = location.pathname;
    const pageEN = path.includes("/en/");
    fr.classList.toggle("is-active", !pageEN);
    en.classList.toggle("is-active", pageEN);
    const go = (lang) => {
      try { localStorage.setItem("bp_lang", lang); } catch (_) {}
      location.href = lang === "fr" ? "../fr/" : "../en/";
    };
    fr.addEventListener("click", () => { if (pageEN) go("fr"); });
    en.addEventListener("click", () => { if (!pageEN) go("en"); });
  };

  const svgLineChart = (series, w = 720, h = 220) => {
    const pad = 10;
    const xs = series.map(p => p[0]), ys = series.map(p => p[1]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const yr = (ymax - ymin) || 1;
    const x = (v) => pad + (v - xmin) * (w - pad * 2) / (xmax - xmin || 1);
    const y = (v) => pad + (h - pad * 2) * (1 - (v - ymin) / yr);
    let d = "";
    for (let i = 0; i < series.length; i++) {
      const [tx, ty] = series[i];
      d += (i === 0 ? "M" : "L") + x(tx).toFixed(1) + " " + y(ty).toFixed(1) + " ";
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img"><path d="${d.trim()}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></path></svg>`;
  };

  const msDay = 86400000;

  const fetchKlinesDaily = async (symbol, days) => {
    const end = Date.now();
    let start = end - days * msDay;
    const out = [];
    for (let guard = 0; guard < 6; guard++) {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1d&startTime=${start}&limit=1000`;
      const rows = await binanceJSON(url);
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const r of rows) {
        const t = +r[0], close = +r[4];
        if (isFinite(t) && isFinite(close)) out.push([t, close]);
      }
      const lastT = +rows[rows.length - 1][0];
      const next = lastT + msDay;
      if (next >= end || rows.length < 1000) break;
      start = next;
    }
    out.sort((a, b) => a[0] - b[0]);
    const uniq = [];
    let lastT = -1;
    for (const p of out) { if (p[0] !== lastT) uniq.push(p); lastT = p[0]; }
    return uniq;
  };

  const pickValueAtOrBefore = (series, t) => {
    let lo = 0, hi = series.length - 1, ans = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const tm = series[mid][0];
      if (tm <= t) { ans = series[mid][1]; lo = mid + 1; }
      else hi = mid - 1;
    }
    return ans;
  };

  const computeReturns = (series, daysList) => {
    const endT = series[series.length - 1]?.[0];
    const endV = series[series.length - 1]?.[1];
    const out = {};
    for (const d of daysList) {
      const v0 = pickValueAtOrBefore(series, endT - d * msDay);
      out[d] = (v0 && endV) ? (endV / v0 - 1) : NaN;
    }
    return out;
  };

  const buildIndex = (btc, eth, bnb, weights) => {
    const wb = weights?.btc ?? 0.6, we = weights?.eth ?? 0.3, wn = weights?.bnb ?? 0.1;
    const map = new Map();
    for (const [t, v] of btc) map.set(t, { t, btc: v });
    for (const [t, v] of eth) { const o = map.get(t) || { t }; o.eth = v; map.set(t, o); }
    for (const [t, v] of bnb) { const o = map.get(t) || { t }; o.bnb = v; map.set(t, o); }
    const rows = Array.from(map.values()).filter(r => r.btc && r.eth && r.bnb).sort((a,b)=>a.t-b.t);
    if (!rows.length) return [];
    const b0 = rows[0].btc, e0 = rows[0].eth, n0 = rows[0].bnb;
    return rows.map(r => [r.t, 100 * (wb * (r.btc / b0) + we * (r.eth / e0) + wn * (r.bnb / n0))]);
  };

  const initMarket = async (cfg) => {
    const chartEl = $("#marketChart");
    const hintEl = $("#marketHint");
    const tabs = $$(".tab[data-market]");
    if (!chartEl || tabs.length === 0) return;

    const days = clamp(cfg?.market?.days || 1825, 365, 1825);
    const kpisDays = cfg?.market?.kpis_days || [365, 1095, 1825];
    const weights = cfg?.market?.index_weights;
    const symbols = cfg?.market?.symbols || { btc: "BTCUSDT", eth: "ETHUSDT", bnb: "BNBUSDT" };

    const seriesCache = {};
    const ensureSeries = async (key) => {
      if (seriesCache[key]) return seriesCache[key];
      if (key === "btc" || key === "eth" || key === "bnb") {
        seriesCache[key] = await fetchKlinesDaily(symbols[key], days);
        return seriesCache[key];
      }
      const [b, e, n] = await Promise.all([ensureSeries("btc"), ensureSeries("eth"), ensureSeries("bnb")]);
      seriesCache.total = buildIndex(b, e, n, weights);
      return seriesCache.total;
    };

    const setActive = (key) => {
      tabs.forEach(btn => {
        const k = btn.getAttribute("data-market");
        const on = k === key;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    };

    const render = async (key) => {
      setActive(key);
      if (hintEl) hintEl.textContent = (key === "total")
        ? (isEN ? "TOTAL = BTC/ETH/BNB index (market proxy)." : "TOTAL = indice BTC/ETH/BNB (proxy de marché).")
        : "";

      try {
        chartEl.innerHTML = `<div class="skeleton" style="height:220px"></div>`;
        const series = await ensureSeries(key);
        if (!series || series.length < 10) throw new Error("empty series");
        chartEl.innerHTML = svgLineChart(series);

        const r = computeReturns(series, kpisDays);
        const m1 = $("#m1y"), m3 = $("#m3y"), m5 = $("#m5y");
        if (m1) m1.textContent = fmtPct(r[365]);
        if (m3) m3.textContent = fmtPct(r[1095]);
        if (m5) m5.textContent = fmtPct(r[1825]);
        [m1, m3, m5].forEach((el, i) => {
          if (!el) return;
          const v = [r[365], r[1095], r[1825]][i];
          el.classList.toggle("pos", v > 0);
          el.classList.toggle("neg", v < 0);
        });
      } catch (e) {
        console.warn("market render failed", e);
        chartEl.innerHTML = `<div class="muted small">${isEN ? "Data unavailable right now." : "Données indisponibles pour le moment."}</div>`;
      }
    };

    tabs.forEach(btn => btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      const key = btn.getAttribute("data-market");
      if (key) render(key);
    }));

    await render("total");
  };

  const fetchTickerPrice = async (symbol) => {
    const o = await binanceJSON(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    const p = +o.price;
    if (!isFinite(p) || p <= 0) throw new Error("bad price " + symbol);
    return p;
  };

  const initYield = async (cfg) => {
    const amountEl = $("#amount");
    const assetEl = $("#asset");
    const scenEl = $("#priceScenario");
    if (!amountEl || !assetEl) return;

    const apr = cfg?.yield?.apr || { stable: 0.10, btc: 0.02, eth: 0.04, bnb: 0.13 };
    const outDeposit = $("#depositTok"), outYYear = $("#yYear"), outYMonth = $("#yMonth"), outCapTok = $("#capTok");
    const outExplain = $("#yieldExplain"), outCapScenario = $("#capEurScenario");

    const symbols = cfg?.market?.symbols || { btc: "BTCUSDT", eth: "ETHUSDT", bnb: "BNBUSDT", eur: "EURUSDT" };
    let prices = null;
    const ensurePrices = async () => {
      if (prices) return prices;
      const [eurUsdt, btc, eth, bnb] = await Promise.all([
        fetchTickerPrice(symbols.eur || "EURUSDT"),
        fetchTickerPrice(symbols.btc || "BTCUSDT"),
        fetchTickerPrice(symbols.eth || "ETHUSDT"),
        fetchTickerPrice(symbols.bnb || "BNBUSDT"),
      ]);
      prices = { eurUsdt, btc, eth, bnb };
      return prices;
    };

    const calc = async () => {
      const eur = +amountEl.value;
      const key = (assetEl.value || "eth").toLowerCase();
      const a = apr[key] ?? 0;
      const scen = scenEl ? +scenEl.value : 0;

      if (!isFinite(eur) || eur <= 0) {
        if (outDeposit) outDeposit.textContent = "—";
        if (outYYear) outYYear.textContent = "—";
        if (outYMonth) outYMonth.textContent = "—";
        if (outCapTok) outCapTok.textContent = "—";
        if (outCapScenario) outCapScenario.textContent = "—";
        if (outExplain) outExplain.textContent = "";
        return;
      }

      try {
        const p = await ensurePrices();
        const usdt = eur * p.eurUsdt;
        const priceUSDT = key === "stable" ? 1 : (key === "btc" ? p.btc : key === "bnb" ? p.bnb : p.eth);
        const depositTok = usdt / priceUSDT;
        const yYear = depositTok * a;
        const yMonth = depositTok * (a / 12);
        const capTok = depositTok * Math.pow(1 + a / 12, 12);

        const capUSDT_now = capTok * priceUSDT;
        const capEUR_now = capUSDT_now / p.eurUsdt;
        const capUSDT_scen = capTok * priceUSDT * (1 + scen);
        const capEUR_scen = capUSDT_scen / p.eurUsdt;

        const sym = key === "stable" ? "USDT" : key.toUpperCase();
        if (outDeposit) outDeposit.textContent = `${fmtTok(depositTok)} ${sym}`;
        if (outYYear) outYYear.textContent = `${fmtTok(yYear)} ${sym}`;
        if (outYMonth) outYMonth.textContent = `${fmtTok(yMonth)} ${sym}`;
        if (outCapTok) outCapTok.textContent = `${fmtTok(capTok)} ${sym}`;
        if (outCapScenario) outCapScenario.textContent = `≈ ${fmtNum(capEUR_scen, 0)} €`;

        if (outExplain) {
          const yEUR = (yYear * priceUSDT) / p.eurUsdt;
          outExplain.textContent = isEN
            ? `≈ ${fmtNum(yEUR, 0)} € / year (yield) • ≈ ${fmtNum(capEUR_now, 0)} € at 12 months (compounded)`
            : `≈ ${fmtNum(yEUR, 0)} € / an (yield) • ≈ ${fmtNum(capEUR_now, 0)} € à 12 mois (capitalisation)`;
        }
      } catch (e) {
        console.warn("yield calc failed", e);
        if (outExplain) outExplain.textContent = isEN ? "Prices unavailable right now." : "Prix indisponibles pour le moment.";
      }
    };

    amountEl.addEventListener("input", calc);
    assetEl.addEventListener("change", calc);
    if (scenEl) scenEl.addEventListener("change", calc);
    await calc();
  };

  const init = async () => {
    const cfg = await loadConfig();
    wireLangSwitch();
    if (cfg) wireCTAs(cfg);
    if (cfg) await initMarket(cfg);
    if (cfg) await initYield(cfg);
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
