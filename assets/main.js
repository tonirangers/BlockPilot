/* assets/main.js
   Fixes: links wiring, market charts (BTC/ETH/BNB) + long-run KPIs, yield calc (live prices).
*/
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const isFR = () => /\/fr\/($|index\.html)/.test(location.pathname);
  const prefix = (/\/(fr|en)\//.test(location.pathname)) ? "../" : "./";

  const CG_IDS = { btc:"bitcoin", eth:"ethereum", bnb:"binancecoin" };

  const fallback = {
    contact:{ book_call_url:"", email:"hello@blockpilot.capital", terms_pdf_url:"BPC_Terms.pdf", docs_url:"" },
    yield:{ apr:{ stable:.10, btc:.02, eth:.04, bnb:.13 } },
    market:{ days:1825, kpis:[365,1095,1825], show_total:false },
    defaults:{ amount_eur:10000, asset:"stable" },
    yield_notes:{
      fr:"Le yield s’accumule en tokens. Si le token prend de la valeur, la performance en € augmente en plus.",
      en:"Yield accrues in tokens. If the token appreciates, your € performance increases on top of yield."
    }
  };

  const fmtPct = (x) => (x==null || !isFinite(x)) ? "—" : `${x>=0?"+":""}${x.toFixed(1)}%`;
  const fmtNum = (x, d=2) => (x==null || !isFinite(x)) ? "—" : x.toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
  const fmtTok = (x, sym) => {
    if (x==null || !isFinite(x)) return "—";
    const d = sym==="btc" ? 6 : sym==="eth" ? 5 : sym==="bnb" ? 4 : 2;
    return x.toLocaleString(undefined,{maximumFractionDigits:d,minimumFractionDigits:d});
  };
  const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));

  const setDisabled = (el, disabled) => {
    if (!el) return;
    el.classList.toggle("isDisabled", !!disabled);
    if (el.tagName === "BUTTON") el.disabled = !!disabled;
    if (el.tagName === "A") {
      if (disabled) el.setAttribute("aria-disabled","true");
      else el.removeAttribute("aria-disabled");
    }
  };

  const fetchJSON = async (url) => {
    const r = await fetch(url, { cache:"no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  };

  const cfgURL = `${prefix}data/blockpilot.json`;

  const getCfg = async () => {
    try{
      const cfg = await fetchJSON(cfgURL);
      return {
        contact:{
          book_call_url: cfg.contact?.book_call_url ?? fallback.contact.book_call_url,
          email: cfg.contact?.email ?? fallback.contact.email,
          terms_pdf_url: cfg.contact?.terms_pdf_url ?? fallback.contact.terms_pdf_url,
          docs_url: cfg.contact?.docs_url ?? fallback.contact.docs_url
        },
        yield:{
          apr:{
            stable: cfg.yield?.apr?.stable ?? fallback.yield.apr.stable,
            btc: cfg.yield?.apr?.btc ?? fallback.yield.apr.btc,
            eth: cfg.yield?.apr?.eth ?? fallback.yield.apr.eth,
            bnb: cfg.yield?.apr?.bnb ?? fallback.yield.apr.bnb
          }
        },
        market:{
          days: cfg.market?.days ?? fallback.market.days,
          kpis: cfg.market?.kpis ?? fallback.market.kpis,
          show_total: cfg.market?.show_total ?? fallback.market.show_total
        },
        defaults:{
          amount_eur: cfg.defaults?.amount_eur ?? fallback.defaults.amount_eur,
          asset: cfg.defaults?.asset ?? fallback.defaults.asset
        },
        yield_notes:{
          fr: cfg.yield?.notes?.fr ?? fallback.yield_notes.fr,
          en: cfg.yield?.notes?.en ?? fallback.yield_notes.en
        }
      };
    }catch(e){
      return fallback;
    }
  };

  const wireLinks = (cfg) => {
    const book = cfg.contact.book_call_url || "";
    const email = cfg.contact.email ? `mailto:${cfg.contact.email}` : "";
    const terms = cfg.contact.terms_pdf_url ? `${prefix}${cfg.contact.terms_pdf_url}` : "";
    const docs = cfg.contact.docs_url || "";

    $$('[data-link="book"]').forEach(a => { a.href = book || "#"; setDisabled(a, !book); if (book) a.target="_blank"; });
    $$('[data-link="email"]').forEach(a => { a.href = email || "#"; setDisabled(a, !email); });
    $$('[data-link="terms"]').forEach(a => { a.href = terms || "#"; setDisabled(a, !terms); if (terms) a.target="_blank"; });
    $$('[data-link="docs"]').forEach(a => { a.href = docs || "#"; setDisabled(a, !docs); if (docs) a.target="_blank"; });
  };

  const setAPRs = (cfg) => {
    const pct = (x) => `${(x*100).toFixed(0)}%`;
    const map = {
      aprStable: pct(cfg.yield.apr.stable),
      aprBtc: pct(cfg.yield.apr.btc),
      aprEth: pct(cfg.yield.apr.eth),
      aprBnb: pct(cfg.yield.apr.bnb)
    };
    Object.entries(map).forEach(([id,val]) => { const el = $("#"+id); if (el) el.textContent = val; });
  };

  const setYieldCopy = (cfg) => {
    const el = $("#yieldExplain");
    if (!el) return;
    el.textContent = isFR() ? cfg.yield_notes.fr : cfg.yield_notes.en;
  };

  const chartSVG = (pts) => {
    if (!pts || pts.length < 2) return "";
    const w=1000,h=300,p=14;
    const vals = pts.map(x=>x.v);
    const min = Math.min(...vals), max = Math.max(...vals);
    const sx = (i)=> p + (w-2*p) * (i / (pts.length-1));
    const sy = (v)=> (h-p) - (h-2*p) * ((v-min) / ((max-min)||1));
    let d = `M ${sx(0)} ${sy(vals[0])}`;
    for (let i=1;i<vals.length;i++) d += ` L ${sx(i)} ${sy(vals[i])}`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" fill="none" stroke="rgba(15,111,102,.95)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  };

  const findPastValue = (series, daysAgo) => {
    if (!series?.length) return null;
    const target = series[series.length-1].t - daysAgo*86400000;
    let best = null, bestDiff = Infinity;
    for (let i=0;i<series.length;i++){
      const diff = Math.abs(series[i].t - target);
      if (diff < bestDiff){ bestDiff = diff; best = series[i].v; }
    }
    return best;
  };

  const pctChange = (series, daysAgo) => {
    const last = series?.length ? series[series.length-1].v : null;
    const past = findPastValue(series, daysAgo);
    if (last==null || past==null || past===0) return null;
    return ((last/past)-1)*100;
  };

  const cacheGet = (k, maxAgeMs) => {
    try{
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || !obj.t || !obj.v) return null;
      if (Date.now() - obj.t > maxAgeMs) return null;
      return obj.v;
    }catch(e){ return null; }
  };
  const cacheSet = (k, v) => { try{ localStorage.setItem(k, JSON.stringify({t:Date.now(), v})); }catch(e){} };

  const fetchMcap = async (market, days) => {
    if (market === "total") return null;
    const id = CG_IDS[market];
    if (!id) return null;
    const key = `bp_mcap_${id}_${days}`;
    const cached = cacheGet(key, 6*60*60*1000);
    if (cached) return cached;

    const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`;
    const j = await fetchJSON(url);
    const pts = (j.market_caps || []).map(([t,v]) => ({ t, v }));
    cacheSet(key, pts);
    return pts;
  };

  const paintKPI = (id, v) => {
    const el = $("#"+id);
    if (!el) return;
    el.textContent = fmtPct(v);
    el.classList.toggle("up", v!=null && v>=0);
    el.classList.toggle("down", v!=null && v<0);
  };

  const initMarket = async (cfg) => {
    const chart = $("#marketChart");
    const hint = $("#marketHint");
    if (!chart || !hint) return;

    const tabs = $$("#marketTabs .tab");
    let active = "btc";

    const setActive = (m) => {
      active = m;
      tabs.forEach(b => b.classList.toggle("active", b.dataset.market === m));
      update();
    };

    tabs.forEach(b => {
      const m = b.dataset.market;
      if (!m) return;
      b.addEventListener("click", () => !b.disabled && setActive(m));
    });

    const update = async () => {
      hint.textContent = isFR() ? "Chargement…" : "Loading…";
      chart.innerHTML = "";
      if (active === "total"){
        hint.textContent = isFR() ? "TOTAL indisponible (source)." : "TOTAL unavailable (source).";
        paintKPI("m1y", null); paintKPI("m3y", null); paintKPI("m5y", null);
        return;
      }
      try{
        const days = clamp(cfg.market.days || 1825, 30, 3650);
        const series = await fetchMcap(active, days);
        if (!series?.length){
          hint.textContent = isFR() ? "Données indisponibles." : "Data unavailable.";
          paintKPI("m1y", null); paintKPI("m3y", null); paintKPI("m5y", null);
          return;
        }
        chart.innerHTML = chartSVG(series);

        const [d1, d3, d5] = cfg.market.kpis?.length ? cfg.market.kpis : [365,1095,1825];
        paintKPI("m1y", pctChange(series, d1));
        paintKPI("m3y", pctChange(series, d3));
        paintKPI("m5y", pctChange(series, d5));

        const dt = new Date(series[series.length-1].t);
        hint.textContent = (isFR() ? "Source: CoinGecko · Maj: " : "Source: CoinGecko · Updated: ") + dt.toLocaleDateString();
      }catch(e){
        hint.textContent = isFR() ? "Flux marché indisponible pour le moment." : "Market feed temporarily unavailable.";
        paintKPI("m1y", null); paintKPI("m3y", null); paintKPI("m5y", null);
      }
    };

    await update();
  };

  const fetchPriceEUR = async (asset) => {
    if (asset === "stable") return 1;
    const id = CG_IDS[asset];
    if (!id) return null;
    const key = `bp_price_${id}_eur`;
    const cached = cacheGet(key, 10*60*1000);
    if (cached) return cached;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=eur`;
    const j = await fetchJSON(url);
    const p = j?.[id]?.eur;
    if (typeof p === "number" && isFinite(p) && p > 0){ cacheSet(key, p); return p; }
    return null;
  };

  const initYieldCalc = (cfg) => {
    const amountEl = $("#amount");
    const assetEl = $("#asset");
    const outDep = $("#depositTok");
    const outY = $("#yYear");
    const outM = $("#yMonth");
    const outCap = $("#capTok");
    const hint = $("#yieldHint");
    if (!amountEl || !assetEl || !outDep || !outY || !outM || !outCap || !hint) return;

    amountEl.value = String(cfg.defaults?.amount_eur ?? 10000);
    assetEl.value = cfg.defaults?.asset ?? "stable";

    const calc = async () => {
      const eur = Number(amountEl.value || 0);
      const a = assetEl.value;
      const apr = cfg.yield?.apr?.[a] ?? (a==="stable"?.10:0);
      if (!isFinite(eur) || eur <= 0){
        outDep.textContent = "—"; outY.textContent = "—"; outM.textContent = "—"; outCap.textContent = "—";
        hint.textContent = isFR() ? "Entrez un montant." : "Enter an amount.";
        return;
      }
      const price = await fetchPriceEUR(a);
      if (!price){
        outDep.textContent = "—"; outY.textContent = "—"; outM.textContent = "—"; outCap.textContent = "—";
        hint.textContent = isFR() ? "Prix indisponible (source)." : "Price unavailable (source).";
        return;
      }

      const depTok = eur / price;
      const yYear = depTok * apr;
      const yMonth = yYear / 12;
      const capTok = depTok * Math.pow(1 + apr/12, 12);

      outDep.textContent = `${fmtTok(depTok,a)} ${a.toUpperCase()}`;
      outY.textContent = `${fmtTok(yYear,a)} ${a.toUpperCase()}`;
      outM.textContent = `${fmtTok(yMonth,a)} ${a.toUpperCase()}`;
      outCap.textContent = `${fmtTok(capTok,a)} ${a.toUpperCase()}`;

      const eurStable = eur * Math.pow(1 + apr/12, 12);
      const eurUp25 = (capTok * price) * 1.25;

      hint.textContent = isFR()
        ? `Si le prix reste stable: ~${fmtNum(eurStable,0)}€. Si +25% sur le token: ~${fmtNum(eurUp25,0)}€ (illustratif).`
        : `If price stays flat: ~€${fmtNum(eurStable,0)}. If token +25%: ~€${fmtNum(eurUp25,0)} (illustrative).`;
    };

    amountEl.addEventListener("input", calc);
    assetEl.addEventListener("change", calc);
    calc();
  };

  document.addEventListener("DOMContentLoaded", async () => {
    const cfg = await getCfg();
    wireLinks(cfg);
    setAPRs(cfg);
    setYieldCopy(cfg);
    initMarket(cfg);
    initYieldCalc(cfg);
  });
})();
