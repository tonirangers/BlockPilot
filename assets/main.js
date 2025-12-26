/* assets/main.js */
(() => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const fmtPct = (v) => {
    if (!isFinite(v)) return "—";
    const sign = v > 0 ? "+" : "";
    return sign + (v * 100).toFixed(0) + "%";
  };
  const fmtNum = (v, max=2) => {
    if (!isFinite(v)) return "—";
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  };
  const fmtUsd = (v) => {
    if (!isFinite(v)) return "—";
    return new Intl.NumberFormat(undefined, { style:"currency", currency:"USD", maximumFractionDigits:0 }).format(v);
  };

  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      loading: "Chargement…",
      marketUnavailable: "Données marché indisponibles pour le moment.",
      lastValue: (v, dt, src) => `Dernière valeur : ${v} $ · maj ${dt}${src ? " · " + src : ""}`,
      lastIndexValue: (v, dt, src) => `Indice : ${v} (base 100) · maj ${dt}${src ? " · " + src : ""}`,
      stableHint: "Hypothèse : 1 $ ≈ 1 stable.",
      priceHint: (px, unit, scn) => `Prix utilisé : ~${px} $/${unit}. Scénario : ${scn ? "+" + (scn*100).toFixed(0) + "%" : "prix constant"}.`,
      stableScenarioNote: "Stables : pas de scénario de prix.",
      contactLabel: "Email",
      menu: "Menu",
      close: "Fermer"
    },
    en: {
      loading: "Loading…",
      marketUnavailable: "Market data is temporarily unavailable.",
      lastValue: (v, dt, src) => `Last value: $${v} · updated ${dt}${src ? " · " + src : ""}`,
      lastIndexValue: (v, dt, src) => `Index: ${v} (base 100) · updated ${dt}${src ? " · " + src : ""}`,
      stableHint: "Assumption: $1 ≈ 1 stable.",
      priceHint: (px, unit, scn) => `Price used: ~$${px}/${unit}. Scenario: ${scn ? "+" + (scn*100).toFixed(0) + "%" : "flat price"}.`,
      stableScenarioNote: "Stables: no price scenario.",
      contactLabel: "Email",
      menu: "Menu",
      close: "Close"
    }
  };
  const T = I18N[LANG] || I18N.fr;

  const SCRIPT_URL = (() => {
    try {
      if (document.currentScript?.src) return new URL(document.currentScript.src, location.href);
      const s = document.querySelector('script[src*="assets/main.js"],script[src$="/main.js"]');
      if (s?.src) return new URL(s.src, location.href);
    } catch {}
    return new URL(location.href);
  })();
  const ROOT = (() => {
    try { return new URL("../", SCRIPT_URL); } catch { return new URL("./", location.href); }
  })();
  const fromRoot = (p) => new URL(String(p).replace(/^\/+/,""), ROOT).toString();
  const resolveHref = (p) => { try { return new URL(p, location.href).toString(); } catch { return p; } };

  async function fetchJSON(url, timeoutMs=9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache:"no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  async function firstJSON(urls, fallback=null) {
    for (const u of urls) {
      try { return await fetchJSON(u); } catch {}
    }
    return fallback;
  }

  function setDisabledLink(a, disabled) {
    if (!a) return;
    if (disabled) {
      a.classList.add("disabled");
      a.setAttribute("aria-disabled","true");
      a.setAttribute("tabindex","-1");
      a.href = "#";
    } else {
      a.classList.remove("disabled");
      a.removeAttribute("aria-disabled");
      a.removeAttribute("tabindex");
    }
  }

  function setActiveChip(groupSel, key) {
    $$(groupSel).forEach(b => b.classList.toggle("active", String(b.dataset.scn) === String(key)));
  }
  function setActiveTab(groupSel, key) {
    $$(groupSel).forEach(b => b.classList.toggle("active", b.dataset.market === key));
  }

  function drawSvgLine(svgEl, points) {
    if (!svgEl) return;
    svgEl.innerHTML = "";
    if (!points || points.length < 2) return;

    const w=1000,h=300,pad=20;
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    const xMin=Math.min(...xs), xMax=Math.max(...xs);
    const yMin=Math.min(...ys), yMax=Math.max(...ys);
    const xSpan=(xMax-xMin)||1, ySpan=(yMax-yMin)||1;

    const mapX=x=>pad+(w-pad*2)*(x-xMin)/xSpan;
    const mapY=y=>(h-pad)-(h-pad*2)*(y-yMin)/ySpan;

    const d=points.map((p,i)=>(i?"L":"M")+mapX(p[0]).toFixed(2)+" "+mapY(p[1]).toFixed(2)).join(" ");

    const area=document.createElementNS("http://www.w3.org/2000/svg","path");
    const dArea=d+` L ${mapX(xMax).toFixed(2)} ${(h-pad).toFixed(2)} L ${mapX(xMin).toFixed(2)} ${(h-pad).toFixed(2)} Z`;
    area.setAttribute("d",dArea);
    area.setAttribute("fill","rgba(11,111,102,.10)");

    const path=document.createElementNS("http://www.w3.org/2000/svg","path");
    path.setAttribute("d",d);
    path.setAttribute("fill","none");
    path.setAttribute("stroke","rgba(11,111,102,.95)");
    path.setAttribute("stroke-width","3");
    path.setAttribute("stroke-linecap","round");
    path.setAttribute("stroke-linejoin","round");

    svgEl.appendChild(area);
    svgEl.appendChild(path);
  }

  function nearestByTime(series, targetTs) {
    if (!series || !series.length) return null;
    let best=series[0], bestD=Math.abs(series[0][0]-targetTs);
    for (let i=1;i<series.length;i++){
      const d=Math.abs(series[i][0]-targetTs);
      if (d<bestD){bestD=d; best=series[i];}
    }
    return best;
  }

  function sampleSeries(series, maxPoints=220) {
    if (!series || series.length<=maxPoints) return series;
    const step=Math.ceil(series.length/maxPoints);
    const out=[];
    for (let i=0;i<series.length;i+=step) out.push(series[i]);
    if (out[out.length-1]!==series[series.length-1]) out.push(series[series.length-1]);
    return out;
  }

  const DAY = 24*60*60*1000;
  const dayTs = (ts) => Math.floor(Number(ts)/DAY)*DAY;

  function normalizeSeriesDaily(series) {
    if (!Array.isArray(series)) return [];
    const m = new Map();
    for (const p of series) {
      const t = dayTs(p?.[0]);
      const v = Number(p?.[1]);
      if (!isFinite(t) || !isFinite(v)) continue;
      m.set(t, v);
    }
    return [...m.entries()].sort((a,b)=>a[0]-b[0]);
  }

  async function loadPricesUSD(cfg) {
    const cacheKey="bp_prices_usd_v1";
    const cachedRaw=localStorage.getItem(cacheKey);
    const now=Date.now();
    if (cachedRaw) {
      try {
        const c=JSON.parse(cachedRaw);
        if (c.ts && (now-c.ts)<10*60*1000 && c.prices) return c.prices;
      } catch {}
    }

    const fall = cfg?.fallbackPricesUSD || { btc:100000, eth:3500, bnb:650 };
    const ids="bitcoin,ethereum,binancecoin";
    const url=`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    let res=null;
    try { res=await fetchJSON(url, 8000); } catch {}

    const prices={
      btc: res?.bitcoin?.usd ?? fall.btc ?? 0,
      eth: res?.ethereum?.usd ?? fall.eth ?? 0,
      bnb: res?.binancecoin?.usd ?? fall.bnb ?? 0,
      stables: 1
    };
    localStorage.setItem(cacheKey, JSON.stringify({ ts:now, prices }));
    return prices;
  }

  async function loadMarketSeriesLive(sym) {
    if (location.protocol === "file:") return [];

    const cacheKey="bp_mkt_"+sym+"_usd_v1";
    const cachedRaw=localStorage.getItem(cacheKey);
    const now=Date.now();
    if (cachedRaw) {
      try {
        const c=JSON.parse(cachedRaw);
        if (c.ts && (now-c.ts)<12*60*60*1000 && Array.isArray(c.series) && c.series.length) return c.series;
      } catch {}
    }

    const idMap={ btc:"bitcoin", eth:"ethereum", bnb:"binancecoin" };
    const id=idMap[sym];
    if (!id) return [];

    const url=`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1825&interval=daily`;
    let res=null;
    try { res=await fetchJSON(url, 9000); } catch { res=null; }
    const series=normalizeSeriesDaily((res?.prices||[])
      .map(p=>[Number(p[0]),Number(p[1])])
      .filter(p=>isFinite(p[0]) && isFinite(p[1]))
    );

    if (series.length) localStorage.setItem(cacheKey, JSON.stringify({ ts:now, series }));
    return series;
  }

  function computeTotalEqualWeighted(btc, eth, bnb) {
    const b=normalizeSeriesDaily(btc||[]);
    const e=normalizeSeriesDaily(eth||[]);
    const n=normalizeSeriesDaily(bnb||[]);
    if (!b.length || !e.length || !n.length) return [];

    const m1=new Map(b.map(p=>[p[0],p[1]]));
    const m2=new Map(e.map(p=>[p[0],p[1]]));
    const m3=new Map(n.map(p=>[p[0],p[1]]));

    const ts=[...m1.keys()].filter(t=>m2.has(t) && m3.has(t)).sort((a,b)=>a-b);
    if (ts.length<50) return [];

    const t0=ts[0];
    const b0=m1.get(t0), e0=m2.get(t0), n0=m3.get(t0);
    if (!b0 || !e0 || !n0) return [];

    const out=[];
    for (const t of ts) {
      const bv=m1.get(t), ev=m2.get(t), nv=m3.get(t);
      if (!bv || !ev || !nv) continue;
      const level=100*((bv/b0)+(ev/e0)+(nv/n0))/3;
      out.push([t, level]);
    }
    return out;
  }

  function setMarketUI({ series, source, isIndex }) {
    const empty=$("#marketEmpty");
    const svg=$("#marketSvg");
    const meta=$("#marketMeta");
    const k1=$("#kpi1y");
    const k3=$("#kpi3y");
    const k5=$("#kpi5y");

    if (!series || series.length<2) {
      if (empty) { empty.style.display="flex"; empty.textContent=T.marketUnavailable; }
      if (meta) meta.textContent="";
      if (svg) svg.innerHTML="";
      if (k1) k1.textContent="—";
      if (k3) k3.textContent="—";
      if (k5) k5.textContent="—";
      return;
    }

    if (empty) empty.style.display="none";

    const last=series[series.length-1];
    const now=last[0];

    const p1=nearestByTime(series, now-365*DAY);
    const p3=nearestByTime(series, now-3*365*DAY);
    const p5=nearestByTime(series, now-5*365*DAY);

    const r1=p1 ? (last[1]/p1[1]-1) : NaN;
    const r3=p3 ? (last[1]/p3[1]-1) : NaN;
    const r5=p5 ? (last[1]/p5[1]-1) : NaN;

    if (k1) k1.textContent=fmtPct(r1);
    if (k3) k3.textContent=fmtPct(r3);
    if (k5) k5.textContent=fmtPct(r5);

    drawSvgLine(svg, sampleSeries(series));

    const d=new Date(last[0]);
    const dt=d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"2-digit" });

    if (meta) {
      const valTxt=fmtNum(last[1],0);
      meta.textContent = isIndex
        ? T.lastIndexValue(valTxt, dt, source)
        : T.lastValue(valTxt, dt, source);
    }
  }

  function computeTokens(principalTokens, apr, years) {
    const n=12;
    const r=apr/n;
    return principalTokens*Math.pow(1+r, n*years);
  }

  function fillApr(cfg) {
    const yields = {
      stables:0.10, btc:0.02, eth:0.04, bnb:0.13,
      ...(cfg?.yields||{})
    };
    const set=(id, v)=>{ const el=$(id); if (el) el.textContent=(Number(v||0)*100).toFixed(0)+"%"; };
    set("#aprStables", yields.stables);
    set("#aprBtc", yields.btc);
    set("#aprEth", yields.eth);
    set("#aprBnb", yields.bnb);
    return yields;
  }

  function initCalc(cfg, pricesUSD, yields) {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const chips=$$(".scenarios .chip");
    const chipWrap=$(".scenarios");
    const stableNote=$("#stableScenarioNote");

    const depTok=$("#depTok");
    const y1Tok=$("#y1Tok");
    const y3Tok=$("#y3Tok");
    const y5Tok=$("#y5Tok");
    const v1Usd=$("#v1Usd");
    const v3Usd=$("#v3Usd");
    const v5Usd=$("#v5Usd");
    const priceMeta=$("#priceMeta");

    let scenario=Number(cfg?.defaults?.scenario ?? 0.20);

    const symLabel=(a)=>a==="stables" ? "STABLE" : a.toUpperCase();

    function setChipsEnabled(isStable) {
      if (!chips.length) return;
      chips.forEach(ch => {
        const scn=Number(ch.dataset.scn ?? 0);
        const dis = isStable && scn !== 0;
        ch.disabled = !!dis;
        ch.classList.toggle("is-disabled", !!dis);
        if (dis) ch.setAttribute("aria-disabled","true");
        else ch.removeAttribute("aria-disabled");
      });
      if (stableNote) stableNote.style.display = isStable ? "block" : "none";
      if (chipWrap) chipWrap.classList.toggle("is-stable", !!isStable);
    }

    function recalc() {
      const usd=Number(String(amount?.value ?? "").replace(",", "."));
      const asset=assetSel?.value || "stables";
      const apr=Number(yields?.[asset] ?? 0);
      const px=asset==="stables" ? 1 : Number(pricesUSD?.[asset] ?? 0);

      const isStable = asset==="stables";
      if (isStable && scenario !== 0) scenario = 0;

      setChipsEnabled(isStable);
      setActiveChip(".scenarios .chip", String(scenario));

      if (!usd || usd<=0 || !isFinite(usd) || !isFinite(apr) || (asset!=="stables" && (!px || px<=0))) {
        [depTok,y1Tok,y3Tok,y5Tok,v1Usd,v3Usd,v5Usd].forEach(el => { if (el) el.textContent="—"; });
        if (priceMeta) priceMeta.textContent="";
        return;
      }

      const principalTok=usd/px;
      const tok1=computeTokens(principalTok, apr, 1);
      const tok3=computeTokens(principalTok, apr, 3);
      const tok5=computeTokens(principalTok, apr, 5);

      const i1=tok1-principalTok;
      const i3=tok3-principalTok;
      const i5=tok5-principalTok;

      const maxDec=asset==="stables" ? 2 : 6;
      const unit=symLabel(asset);

      if (depTok) depTok.textContent=`${fmtNum(principalTok, maxDec)} ${unit}`;
      if (y1Tok) y1Tok.textContent=`+${fmtNum(i1, maxDec)} ${unit}`;
      if (y3Tok) y3Tok.textContent=`+${fmtNum(i3, maxDec)} ${unit}`;
      if (y5Tok) y5Tok.textContent=`+${fmtNum(i5, maxDec)} ${unit}`;

      const pxScn=px*(1+scenario);
      if (v1Usd) v1Usd.textContent=fmtUsd(tok1*pxScn);
      if (v3Usd) v3Usd.textContent=fmtUsd(tok3*pxScn);
      if (v5Usd) v5Usd.textContent=fmtUsd(tok5*pxScn);

      const pxTxt = asset==="stables"
        ? T.stableHint
        : T.priceHint(fmtNum(px,0), unit, scenario);

      if (priceMeta) priceMeta.textContent=pxTxt;
    }

    if (amount) amount.value=String(cfg?.defaults?.amountUSD ?? 10000);
    if (assetSel) assetSel.value=cfg?.defaults?.asset ?? "stables";

    chips.forEach(ch => ch.addEventListener("click", () => {
      const asset=assetSel?.value || "stables";
      if (asset==="stables") return;
      scenario=Number(ch.dataset.scn ?? 0);
      setActiveChip(".scenarios .chip", String(scenario));
      recalc();
    }));

    if (amount) amount.addEventListener("input", recalc);
    if (assetSel) assetSel.addEventListener("change", recalc);

    recalc();
  }

  function applyLinks(cfg) {
    const email=cfg?.links?.email || "toni@blockpilot.capital";
    const subject=encodeURIComponent(cfg?.links?.emailSubject || "BlockPilot");
    const mailto=`mailto:${email}?subject=${subject}`;

    const ctaEmail=$("#ctaEmail");
    const footerEmail=$("#footerEmail");
    if (ctaEmail) ctaEmail.href=mailto;
    if (footerEmail) {
      footerEmail.href=mailto;
      footerEmail.textContent=T.contactLabel;
      footerEmail.title=email;
    }

    const callUrl=cfg?.links?.bookCall || "";
    const ctaCall=$("#ctaCall");
    if (ctaCall) {
      if (callUrl) ctaCall.href=callUrl, ctaCall.target="_blank", ctaCall.rel="noopener";
      else ctaCall.href=mailto;
    }

    const terms=cfg?.links?.termsPdf || "../BPC_Terms.pdf";
    const footerTerms=$("#footerTerms");
    if (footerTerms) footerTerms.href=resolveHref(terms);

    const signature=cfg?.links?.signature || "../sign.html";
    const navSignature=$("#navSignature");
    const footerSignature=$("#footerSignature");
    if (navSignature) navSignature.href=resolveHref(signature), navSignature.target="_blank", navSignature.rel="noopener";
    if (footerSignature) footerSignature.href=resolveHref(signature), footerSignature.target="_blank", footerSignature.rel="noopener";

    const docs=cfg?.links?.docs || "";
    const navDocs=$("#navDocs");
    const footerDocs=$("#footerDocs");

    if (docs) {
      setDisabledLink(navDocs, false);
      if (navDocs) navDocs.href=resolveHref(docs), navDocs.target="_blank", navDocs.rel="noopener";
      setDisabledLink(footerDocs, false);
      if (footerDocs) footerDocs.href=resolveHref(docs), footerDocs.target="_blank", footerDocs.rel="noopener";
    } else {
      setDisabledLink(navDocs, true);
      setDisabledLink(footerDocs, true);
    }
  }

  function enableSmoothScroll() {
    const header=$(".header");
    const offset=()=> (header?.offsetHeight || 0) + 12;

    $$('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const href=a.getAttribute("href");
        if (!href || href==="#") return;
        const el=document.getElementById(href.slice(1));
        if (!el) return;
        e.preventDefault();
        const top=el.getBoundingClientRect().top + window.scrollY - offset();
        window.scrollTo({ top, behavior:"smooth" });
        if (document.body.classList.contains("menu-open")) {
          document.body.classList.remove("menu-open");
          const t=$("#navToggle");
          if (t) t.setAttribute("aria-expanded","false");
        }
      });
    });
  }

  function initMobileMenu() {
    const toggle=$("#navToggle");
    if (!toggle) return;
    toggle.textContent = T.menu;
    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("menu-open");
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.textContent = open ? T.close : T.menu;
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 860 && document.body.classList.contains("menu-open")) {
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded","false");
        toggle.textContent = T.menu;
      }
    });
  }

  async function init() {
    enableSmoothScroll();
    initMobileMenu();

    const cfg = await firstJSON(
      [fromRoot("data/blockpilot.json"), "../data/blockpilot.json","./data/blockpilot.json"],
      {}
    );

    applyLinks(cfg);

    const yields = fillApr(cfg);
    const pricesUSD = await loadPricesUSD(cfg);
    initCalc(cfg, pricesUSD, yields);

    const marketBtns = $$("[data-market]");
    let active = (cfg?.defaults?.marketDefault || "total");
    setActiveTab("[data-market]", active);

    async function refresh(sym) {
      const empty=$("#marketEmpty");
      if (empty) empty.style.display="flex", empty.textContent=T.loading;

      let series=[], source="", isIndex=false;

      const cache = await firstJSON(
        [fromRoot("data/market.json"), "../data/market.json","./data/market.json"],
        null
      );

      const cacheSeries = (k) => normalizeSeriesDaily(
        (cache?.[k] || []).map(p => [Number(p[0]), Number(p[1])]).filter(p => isFinite(p[0]) && isFinite(p[1]))
      );

      if (sym === "total") {
        const ct = cacheSeries("total");
        if (ct.length) {
          series = ct;
          source = cache?.meta?.source ? "cache:"+cache.meta.source : "cache";
          isIndex = true;
        } else {
          const cb = cacheSeries("btc");
          const ce = cacheSeries("eth");
          const cn = cacheSeries("bnb");
          series = computeTotalEqualWeighted(cb, ce, cn);
          if (series.length) { source = cache?.meta?.source ? "cache:"+cache.meta.source : "cache"; isIndex=true; }
        }
      } else {
        series = cacheSeries(sym);
        if (series.length) source = cache?.meta?.source ? "cache:"+cache.meta.source : "cache";
      }

      if (!series.length) {
        if (sym === "total") {
          const [b,e,n] = await Promise.all([
            loadMarketSeriesLive("btc"),
            loadMarketSeriesLive("eth"),
            loadMarketSeriesLive("bnb")
          ]);
          series = computeTotalEqualWeighted(b,e,n);
          source = series.length ? "CoinGecko (live)" : "";
          isIndex = true;
        } else {
          series = await loadMarketSeriesLive(sym);
          source = series.length ? "CoinGecko (live)" : "";
        }
      }

      setMarketUI({ series, source, isIndex });
    }

    marketBtns.forEach(b => b.addEventListener("click", async () => {
      const sym=b.dataset.market;
      if (!sym || sym===active) return;
      active=sym;
      setActiveTab("[data-market]", active);
      await refresh(active);
    }));

    await refresh(active);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
