/* assets/main.js */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const fmt = {
    eur: new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    eur2: new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 2 }),
    pct: new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1, signDisplay: "always" }),
    num6: new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }),
  };

  const state = {
    cfg: null,
    market: { symbol: "btc", series: null, cache: {} },
    pricesEur: { btc: null, eth: null, bnb: null },
  };

  const safeJson = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  const setHref = (sel, href, text) => {
    const el = $(sel);
    if (!el) return;
    el.href = href;
    if (text != null) el.textContent = text;
  };

  const initLinks = () => {
    const isFr = document.documentElement.lang === "fr";
    const { contact, links, docs } = state.cfg;

    $$("[data-email]").forEach((a) => {
      const subj = isFr ? contact.email_subject_fr : contact.email_subject_en;
      a.href = `mailto:${contact.email}?subject=${encodeURIComponent(subj)}`;
      if (a.textContent.includes("@") || a.textContent.includes("Email")) a.textContent = isFr ? "Email" : "Email";
    });

    $$("[data-book-call]").forEach((a) => (a.href = links.book_call_url || "#"));

    $$("[data-terms]").forEach((a) => {
      a.href = links.terms_pdf_url || "#";
      a.style.pointerEvents = links.terms_pdf_url ? "auto" : "none";
      a.style.opacity = links.terms_pdf_url ? "1" : ".5";
    });

    $$("[data-docs]").forEach((a) => {
      const url = docs?.url || "";
      if (!url) {
        a.href = "#docs";
        a.target = "";
        a.rel = "";
        return;
      }
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
    });
  };

  const initApr = () => {
    const grid = $("#aprGrid");
    if (!grid) return;
    const isFr = document.documentElement.lang === "fr";
    const items = [
      { k: isFr ? "Stable — moyenne actuelle" : "Stable — current average", v: state.cfg.yields.stable_apr },
      { k: isFr ? "BTC — moyenne actuelle" : "BTC — current average", v: state.cfg.yields.btc_apr },
      { k: isFr ? "ETH — moyenne actuelle" : "ETH — current average", v: state.cfg.yields.eth_apr },
      { k: isFr ? "BNB — moyenne actuelle" : "BNB — current average", v: state.cfg.yields.bnb_apr },
    ];
    grid.innerHTML = items
      .map(
        (x) => `
          <div class="apr">
            <div class="t">${x.k}</div>
            <div class="v">${Math.round(x.v * 100)}%</div>
            <div class="muted small">APR</div>
          </div>
        `
      )
      .join("");
  };

  const nearestByTime = (series, targetT) => {
    if (!series?.length) return null;
    let lo = 0, hi = series.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (series[mid].t < targetT) lo = mid + 1;
      else hi = mid;
    }
    const i = clamp(lo, 0, series.length - 1);
    return series[i];
  };

  const pctChangeOverDays = (series, days) => {
    if (!series?.length) return null;
    const last = series[series.length - 1];
    const targetT = last.t - days * 864e5;
    const p0 = nearestByTime(series, targetT) || series[0];
    if (!p0 || !p0.v || !last.v) return null;
    return last.v / p0.v - 1;
  };

  const toSvgPath = (series, w = 600, h = 200, pad = 18) => {
    if (!series?.length) return "";
    const xs = series.map((p) => p.t);
    const ys = series.map((p) => p.v);
    let minY = Math.min(...ys), maxY = Math.max(...ys);
    if (!(isFinite(minY) && isFinite(maxY))) return "";
    if (minY === maxY) maxY = minY + 1;
    const minX = xs[0], maxX = xs[xs.length - 1];

    const x = (t) => pad + ((t - minX) / (maxX - minX || 1)) * (w - pad * 2);
    const y = (v) => pad + (1 - (v - minY) / (maxY - minY || 1)) * (h - pad * 2);

    let d = "";
    for (let i = 0; i < series.length; i++) {
      const px = x(series[i].t);
      const py = y(series[i].v);
      d += (i ? "L" : "M") + px.toFixed(2) + " " + py.toFixed(2) + " ";
    }
    return d.trim();
  };

  const downsample = (series, maxPoints = 520) => {
    if (!series?.length) return [];
    if (series.length <= maxPoints) return series;
    const stride = Math.ceil(series.length / maxPoints);
    const out = [];
    for (let i = 0; i < series.length; i += stride) out.push(series[i]);
    if (out[out.length - 1] !== series[series.length - 1]) out.push(series[series.length - 1]);
    return out;
  };

  const fetchCoinGeckoMarketChart = async (id, days = 1825, vs = "usd") => {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=${encodeURIComponent(vs)}&days=${encodeURIComponent(days)}&interval=daily`;
    const j = await safeJson(url);
    const arr = j?.prices || [];
    return arr.map((p) => ({ t: p[0], v: p[1] })).filter((p) => typeof p.t === "number" && typeof p.v === "number");
  };

  const loadMarketCache = async () => {
    try {
      const j = await safeJson("../data/market.json");
      state.market.cache = j || {};
    } catch {
      state.market.cache = {};
    }
  };

  const marketId = (symbol) => ({ btc: "bitcoin", eth: "ethereum", bnb: "binancecoin" }[symbol] || "bitcoin");

  const renderMarket = async (symbol) => {
    const status = $("[data-market-status]");
    const pathEl = $("[data-market-path]");
    if (!pathEl) return;

    status.textContent = document.documentElement.lang === "fr" ? "Chargement…" : "Loading…";

    let series = null;

    if (symbol === "total") {
      const cached = state.market.cache?.total;
      if (Array.isArray(cached) && cached.length > 10) {
        series = cached.map((p) => ({ t: p[0], v: p[1] }));
      } else {
        status.textContent =
          document.documentElement.lang === "fr"
            ? "TOTAL indisponible (ajoutez un cache data/market.json)."
            : "TOTAL unavailable (add a cache data/market.json).";
        pathEl.setAttribute("d", "");
        ["1y", "3y", "5y"].forEach((k) => ($(`[data-kpi="${k}"]`).textContent = "—"));
        return;
      }
    } else {
      try {
        const days = state.cfg.market?.coingecko_days || 1825;
        series = await fetchCoinGeckoMarketChart(marketId(symbol), days, "usd");
      } catch (e) {
        const cached = state.market.cache?.[symbol];
        if (Array.isArray(cached) && cached.length > 10) series = cached.map((p) => ({ t: p[0], v: p[1] }));
        else series = null;
      }
    }

    if (!series?.length) {
      status.textContent =
        document.documentElement.lang === "fr" ? "Flux marché indisponible pour le moment." : "Market data unavailable right now.";
      pathEl.setAttribute("d", "");
      ["1y", "3y", "5y"].forEach((k) => ($(`[data-kpi="${k}"]`).textContent = "—"));
      return;
    }

    const change1y = pctChangeOverDays(series, 365);
    const change3y = pctChangeOverDays(series, 365 * 3);
    const change5y = pctChangeOverDays(series, 365 * 5);

    const setKpi = (k, v) => {
      const el = $(`[data-kpi="${k}"]`);
      if (!el) return;
      el.textContent = v == null ? "—" : fmt.pct.format(v);
    };

    setKpi("1y", change1y);
    setKpi("3y", change3y);
    setKpi("5y", change5y);

    const viewDays = clamp(state.cfg.market?.chart_days || 1825, 90, 365 * 8);
    const lastT = series[series.length - 1].t;
    const cutoff = lastT - viewDays * 864e5;
    const sliced = series.filter((p) => p.t >= cutoff);
    const ds = downsample(sliced, 520);

    pathEl.setAttribute("d", toSvgPath(ds));
    status.textContent =
      document.documentElement.lang === "fr"
        ? "Données publiques, indicatives."
        : "Public data, indicative.";
  };

  const initMarketTabs = () => {
    const tabs = $("[data-market-tabs]");
    if (!tabs) return;

    const setActive = (symbol) => {
      state.market.symbol = symbol;
      $$("button[data-symbol]", tabs).forEach((b) => b.classList.toggle("active", b.dataset.symbol === symbol));
    };

    tabs.addEventListener("click", async (e) => {
      const btn = e.target.closest("button[data-symbol]");
      if (!btn || btn.disabled) return;
      const sym = btn.dataset.symbol;
      setActive(sym);
      await renderMarket(sym);
    });

    setActive("btc");
  };

  const fetchPricesEur = async () => {
    const url =
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=eur";
    const j = await safeJson(url);
    state.pricesEur.btc = j?.bitcoin?.eur || null;
    state.pricesEur.eth = j?.ethereum?.eur || null;
    state.pricesEur.bnb = j?.binancecoin?.eur || null;
  };

  const tokLabel = (asset) => ({ stable: "Stable", btc: "BTC", eth: "ETH", bnb: "BNB" }[asset] || asset.toUpperCase());

  const calcYield = () => {
    const isFr = document.documentElement.lang === "fr";
    const amountEl = $("#amountEur");
    const assetEl = $("#assetSel");
    if (!amountEl || !assetEl) return;

    const amount = Number(String(amountEl.value || "").replace(",", "."));
    const asset = assetEl.value;

    const apr = state.cfg.yields?.[`${asset}_apr`] ?? state.cfg.yields?.stable_apr ?? 0.1;

    let price = 1;
    if (asset === "btc") price = state.pricesEur.btc || null;
    if (asset === "eth") price = state.pricesEur.eth || null;
    if (asset === "bnb") price = state.pricesEur.bnb || null;
    if (asset === "stable") price = 1;

    const outCapTok = $('[data-out="capTok"]');
    const outYTokYear = $('[data-out="yTokYear"]');
    const outYTokMonth = $('[data-out="yTokMonth"]');
    const outEurLine = $('[data-out="eurLine"]');
    const story = $("#yieldStory");

    const setText = (el, txt) => el && (el.textContent = txt);

    if (!isFinite(amount) || amount <= 0) {
      setText(outCapTok, "—");
      setText(outYTokYear, "—");
      setText(outYTokMonth, "—");
      setText(outEurLine, isFr ? "Entrez un montant pour voir l’estimation." : "Enter an amount to see the estimate.");
      if (story) story.innerHTML = "";
      return;
    }

    if (!price || !isFinite(price)) {
      setText(outCapTok, "—");
      setText(outYTokYear, "—");
      setText(outYTokMonth, "—");
      setText(outEurLine, isFr ? "Prix indisponible pour le moment." : "Price unavailable right now.");
      if (story) story.innerHTML = "";
      return;
    }

    const depositTok = amount / price;
    const yTokYear = depositTok * apr;
    const yTokMonth = yTokYear / 12;
    const capTok = depositTok * Math.pow(1 + apr / 12, 12);

    const capEurNow = capTok * price;
    const capEurUp = capTok * price * 1.3; // +30% scenario
    const capEurDown = capTok * price * 0.7; // -30% scenario

    setText(outCapTok, `${fmt.num6.format(capTok)} ${tokLabel(asset)}`);
    setText(outYTokYear, `${fmt.num6.format(yTokYear)} ${tokLabel(asset)}`);
    setText(outYTokMonth, `${fmt.num6.format(yTokMonth)} ${tokLabel(asset)}`);

    const eurLine = isFr
      ? `≈ ${fmt.eur.format(capEurNow)} à 12 mois (prix constant). Si le prix fait +30% : ≈ ${fmt.eur.format(capEurUp)} (si -30% : ≈ ${fmt.eur.format(capEurDown)}).`
      : `≈ ${fmt.eur.format(capEurNow)} after 12 months (price unchanged). If price is +30%: ≈ ${fmt.eur.format(capEurUp)} (if -30%: ≈ ${fmt.eur.format(capEurDown)}).`;
    setText(outEurLine, eurLine);

    if (story) {
      const m6 = depositTok * Math.pow(1 + apr / 12, 6);
      const mkRow = (label, tok, eur) =>
        `<div class="storyRow"><b>${label}</b><span>${fmt.num6.format(tok)} ${tokLabel(asset)} • ${fmt.eur2.format(eur)}</span></div>`;
      story.innerHTML =
        mkRow(isFr ? "Départ" : "Start", depositTok, amount) +
        mkRow(isFr ? "À 6 mois" : "At 6 months", m6, m6 * price) +
        mkRow(isFr ? "À 12 mois" : "At 12 months", capTok, capTok * price);
    }
  };

  const initCalculator = async () => {
    const amountEl = $("#amountEur");
    const assetEl = $("#assetSel");
    if (!amountEl || !assetEl) return;

    amountEl.value = String(state.cfg.yields?.default_amount_eur ?? 10000);

    try {
      await fetchPricesEur();
    } catch {}

    const on = () => calcYield();
    amountEl.addEventListener("input", on);
    assetEl.addEventListener("change", on);
    on();
  };

  const init = async () => {
    state.cfg = await safeJson("../data/blockpilot.json");
    initLinks();
    initApr();
    initMarketTabs();
    await loadMarketCache();
    await renderMarket("btc");
    await initCalculator();
  };

  init().catch(() => {
    const status = $("[data-market-status]");
    if (status) status.textContent = document.documentElement.lang === "fr" ? "Erreur de chargement." : "Load error.";
  });
})();
