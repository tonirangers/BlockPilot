/* assets/main.js */
(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const rootPath = () => {
    // "/BlockPilot/fr/" -> "/BlockPilot/"
    const p = window.location.pathname;
    const m = p.match(/^(.*\/)(fr|en)\/(?:index\.html)?$/);
    if (m) return m[1];
    // fallback: repo root
    return p.endsWith('/') ? p : p.replace(/[^/]*$/, '');
  };

  const RP = rootPath(); // base for root-level assets
  const cfgDefaults = {
    brand: { name: "BlockPilot", logo: "logo.png" },
    links: {
      call: "https://calendar.app.google/bQWcTHd22XDzuCt6A",
      email: "toni@blockpilot.capital",
      terms_pdf: "BPC_Terms.pdf",
      docs: "",
      signature: "sign.html"
    },
    yields: { stables: 0.10, btc: 0.02, eth: 0.04, bnb: 0.13 },
    defaults: { amount_eur: 10000, asset: "stables", email_subject_fr: "BlockPilot — infos", email_subject_en: "BlockPilot — info" }
  };

  let CFG = cfgDefaults;

  async function loadCfg() {
    try {
      const res = await fetch(`${RP}data/blockpilot.json`, { cache: "no-store" });
      if (!res.ok) throw new Error("cfg");
      const j = await res.json();
      CFG = {
        ...cfgDefaults,
        ...j,
        brand: { ...cfgDefaults.brand, ...(j.brand||{}) },
        links: { ...cfgDefaults.links, ...(j.links||{}) },
        yields: { ...cfgDefaults.yields, ...(j.yields||{}) },
        defaults: { ...cfgDefaults.defaults, ...(j.defaults||{}) }
      };
    } catch (e) {
      CFG = cfgDefaults;
    }
  }

  function setLinks(lang) {
    const callA = $$('[data-link="call"]');
    const mailA = $$('[data-link="email"]');
    const termsA = $$('[data-link="terms"]');
    const docsA = $$('[data-link="docs"]');
    const sigA = $$('[data-link="signature"]');

    const subj = (lang === "fr") ? (CFG.defaults.email_subject_fr || "BlockPilot") : (CFG.defaults.email_subject_en || "BlockPilot");
    const mailto = `mailto:${CFG.links.email}?subject=${encodeURIComponent(subj)}`;

    callA.forEach(a => a.setAttribute("href", CFG.links.call));
    mailA.forEach(a => a.setAttribute("href", mailto));
    termsA.forEach(a => a.setAttribute("href", `${RP}${CFG.links.terms_pdf}`));
    sigA.forEach(a => {
      a.setAttribute("href", `${RP}${CFG.links.signature}`);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener");
    });

    const docsUrl = (CFG.links.docs || "").trim();
    docsA.forEach(a => {
      if (!docsUrl) {
        a.classList.add("disabled");
        a.removeAttribute("href");
        a.setAttribute("aria-disabled", "true");
      } else {
        a.classList.remove("disabled");
        a.setAttribute("href", docsUrl);
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
    });
  }

  function smoothAnchors() {
    const navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navH') || '86', 10);
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const id = a.getAttribute("href");
        const el = $(id);
        if (!el) return;
        e.preventDefault();
        const top = el.getBoundingClientRect().top + window.scrollY - (navH + 10);
        window.scrollTo({ top, behavior: "smooth" });
      });
    });
  }

  function langToggle(lang) {
    const frBtn = $('[data-lang="fr"]');
    const enBtn = $('[data-lang="en"]');

    if (frBtn && enBtn) {
      frBtn.classList.toggle("active", lang === "fr");
      enBtn.classList.toggle("active", lang === "en");

      frBtn.addEventListener("click", () => window.location.href = `${RP}fr/`);
      enBtn.addEventListener("click", () => window.location.href = `${RP}en/`);
    }
  }

  // ---------- Market (CoinGecko) ----------
  const CG = "https://api.coingecko.com/api/v3";
  const coinId = (sym) => ({ BTC:"bitcoin", ETH:"ethereum", BNB:"binancecoin" }[sym] || "bitcoin");

  const memCache = new Map(); // key -> series
  async function fetchSeries(sym, days) {
    const key = `${sym}:${days}`;
    if (memCache.has(key)) return memCache.get(key);

    const id = coinId(sym);
    const url = `${CG}/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("series");
    const j = await res.json();
    const series = (j.prices || []).map(([t,v]) => [t, v]).filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1]));
    memCache.set(key, series);
    return series;
  }

  function pct(a,b){ if(!isFinite(a)||!isFinite(b)||a===0) return null; return ((b-a)/a)*100; }

  function closestValue(series, targetTs) {
    if (!series.length) return null;
    let best = series[0], bestD = Math.abs(series[0][0] - targetTs);
    for (let i=1;i<series.length;i++){
      const d = Math.abs(series[i][0] - targetTs);
      if (d < bestD) { best = series[i]; bestD = d; }
    }
    return best[1];
  }

  function renderLine(svg, series) {
    const W = 900, H = 220, P = 10;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    if (!series || series.length < 2) return;

    const xs = series.map(p => p[0]);
    const ys = series.map(p => p[1]);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);

    const X = (x) => P + ( (x - xmin) / (xmax - xmin) ) * (W - P*2);
    const Y = (y) => (H - P) - ( (y - ymin) / (ymax - ymin) ) * (H - P*2);

    // area
    const area = document.createElementNS("http://www.w3.org/2000/svg","path");
    let dA = `M ${X(xs[0])} ${H-P} L ${X(xs[0])} ${Y(ys[0])}`;
    for (let i=1;i<series.length;i++) dA += ` L ${X(xs[i])} ${Y(ys[i])}`;
    dA += ` L ${X(xs[xs.length-1])} ${H-P} Z`;
    area.setAttribute("d", dA);
    area.setAttribute("fill", "rgba(11,107,99,.10)");
    svg.appendChild(area);

    // line
    const path = document.createElementNS("http://www.w3.org/2000/svg","path");
    let d = `M ${X(xs[0])} ${Y(ys[0])}`;
    for (let i=1;i<series.length;i++) d += ` L ${X(xs[i])} ${Y(ys[i])}`;
    path.setAttribute("d", d);
    path.setAttribute("fill","none");
    path.setAttribute("stroke","rgba(11,107,99,.95)");
    path.setAttribute("stroke-width","3");
    path.setAttribute("stroke-linecap","round");
    path.setAttribute("stroke-linejoin","round");
    svg.appendChild(path);
  }

  async function initMarket() {
    const wrap = $('[data-market="wrap"]');
    if (!wrap) return;

    const tabs = $$('[data-market-tab]');
    const svg = $('[data-market="svg"]');
    const title = $('[data-market="title"]');
    const status = $('[data-market="status"]');

    const k1 = $('[data-kpi="1y"]');
    const k3 = $('[data-kpi="3y"]');
    const k5 = $('[data-kpi="5y"]');

    let sym = "BTC";

    function setActive(symNew) {
      sym = symNew;
      tabs.forEach(t => t.classList.toggle("active", t.dataset.marketTab === sym));
    }

    tabs.forEach(t => {
      if (t.classList.contains("disabled")) return;
      t.addEventListener("click", async () => {
        setActive(t.dataset.marketTab);
        await refresh();
      });
    });

    async function refresh() {
      if (title) title.textContent = `Contexte marché — ${sym}`;
      if (status) status.textContent = "Chargement…";

      try {
        const series5y = await fetchSeries(sym, 1825);
        renderLine(svg, series5y);

        const nowTs = series5y[series5y.length-1][0];
        const vNow = series5y[series5y.length-1][1];

        const v1 = closestValue(series5y, nowTs - 365*24*3600*1000);
        const v3 = closestValue(series5y, nowTs - 1095*24*3600*1000);
        const v5 = series5y[0][1];

        const p1 = pct(v1, vNow);
        const p3 = pct(v3, vNow);
        const p5 = pct(v5, vNow);

        const setK = (el, val) => {
          if (!el) return;
          if (val == null) { el.textContent = "—"; el.classList.remove("pos","neg"); return; }
          el.textContent = `${val>=0?"+":""}${val.toFixed(1)}%`;
          el.classList.toggle("pos", val>=0);
          el.classList.toggle("neg", val<0);
        };

        setK(k1, p1);
        setK(k3, p3);
        setK(k5, p5);

        if (status) status.textContent = "Données publiques (USD).";
      } catch (e) {
        if (status) status.textContent = "Flux marché indisponible pour le moment.";
        if (svg) {
          while (svg.firstChild) svg.removeChild(svg.firstChild);
        }
        if (k1) k1.textContent = "—";
        if (k3) k3.textContent = "—";
        if (k5) k5.textContent = "—";
      }
    }

    // init
    setActive("BTC");
    await refresh();
  }

  // ---------- Yield calculator ----------
  async function fetchPricesEUR() {
    // fallback “safe” defaults
    const fallback = { BTC: 90000, ETH: 3200, BNB: 600 };
    try {
      const url = `${CG}/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=eur`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("prices");
      const j = await res.json();
      return {
        BTC: j.bitcoin?.eur || fallback.BTC,
        ETH: j.ethereum?.eur || fallback.ETH,
        BNB: j.binancecoin?.eur || fallback.BNB
      };
    } catch (e) {
      return fallback;
    }
  }

  function fmt(n, d=2){ return (Number.isFinite(n) ? n.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}) : "—"); }
  function fmt0(n){ return (Number.isFinite(n) ? Math.round(n).toLocaleString() : "—"); }

  function compoundTokens(principal, apr, years) {
    const m = 12;
    return principal * Math.pow(1 + apr/m, m*years);
  }

  async function initYield() {
    const amountEl = $('[data-sim="amount"]');
    const assetEl = $('[data-sim="asset"]');
    if (!amountEl || !assetEl) return;

    const outDeposit = $('[data-out="deposit"]');
    const outY1 = $('[data-out="y1"]');
    const outY3 = $('[data-out="y3"]');
    const outY5 = $('[data-out="y5"]');

    const outEurBase = $('[data-out="eurBase"]');
    const outEur25 = $('[data-out="eur25"]');
    const outEur50 = $('[data-out="eur50"]');

    const tokenLabel = $('[data-out="tokenLabel"]');

    amountEl.value = CFG.defaults.amount_eur || 10000;
    assetEl.value = CFG.defaults.asset || "stables";

    const prices = await fetchPricesEUR();

    function getAPR(asset){
      const y = CFG.yields || {};
      if (asset === "stables") return y.stables ?? 0.10;
      if (asset === "btc") return y.btc ?? 0.02;
      if (asset === "eth") return y.eth ?? 0.04;
      if (asset === "bnb") return y.bnb ?? 0.13;
      return 0.0;
    }

    function tokenOf(asset){
      if (asset === "stables") return "STABLE";
      if (asset === "btc") return "BTC";
      if (asset === "eth") return "ETH";
      if (asset === "bnb") return "BNB";
      return "TOKEN";
    }

    function priceEUR(asset){
      if (asset === "stables") return 1;
      if (asset === "btc") return prices.BTC;
      if (asset === "eth") return prices.ETH;
      if (asset === "bnb") return prices.BNB;
      return 1;
    }

    function update(){
      const amount = Math.max(0, Number(amountEl.value || 0));
      const asset = assetEl.value;
      const apr = getAPR(asset);
      const tok = tokenOf(asset);
      const px = priceEUR(asset);

      const depositTok = amount / px;
      const cap1 = compoundTokens(depositTok, apr, 1);
      const cap3 = compoundTokens(depositTok, apr, 3);
      const cap5 = compoundTokens(depositTok, apr, 5);

      if (tokenLabel) tokenLabel.textContent = tok;

      if (outDeposit) outDeposit.textContent = `${fmt(depositTok, tok==="BTC"?6:tok==="ETH"?5:tok==="BNB"?4:2)} ${tok}`;
      if (outY1) outY1.textContent = `${fmt(cap1, tok==="BTC"?6:tok==="ETH"?5:tok==="BNB"?4:2)} ${tok}`;
      if (outY3) outY3.textContent = `${fmt(cap3, tok==="BTC"?6:tok==="ETH"?5:tok==="BNB"?4:2)} ${tok}`;
      if (outY5) outY5.textContent = `${fmt(cap5, tok==="BTC"?6:tok==="ETH"?5:tok==="BNB"?4:2)} ${tok}`;

      // EUR scenarios at 12 months (keep simple + illustrative)
      const eurBase = cap1 * px;
      if (outEurBase) outEurBase.textContent = `${fmt0(eurBase)} €`;

      if (asset === "stables") {
        if (outEur25) outEur25.textContent = "—";
        if (outEur50) outEur50.textContent = "—";
      } else {
        if (outEur25) outEur25.textContent = `${fmt0(eurBase * 1.25)} €`;
        if (outEur50) outEur50.textContent = `${fmt0(eurBase * 1.50)} €`;
      }
    }

    amountEl.addEventListener("input", update);
    assetEl.addEventListener("change", update);
    update();
  }

  // init
  (async () => {
    const lang = document.documentElement.getAttribute("lang")?.startsWith("fr") ? "fr" : "en";
    await loadCfg();
    setLinks(lang);
    langToggle(lang);
    smoothAnchors();
    await initMarket();
    await initYield();
  })();
})();
