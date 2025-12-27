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
  const fmtUsd = (v, max=0) => {
    if (!isFinite(v)) return "—";
    return new Intl.NumberFormat(undefined, { style:"currency", currency:"USD", maximumFractionDigits:max }).format(v);
  };
  const fmtDate = (ts) => {
    const d=new Date(ts);
    return d.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});
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
      close: "Fermer",
      lastUpdated: "Dernière mise à jour",
      adoptionUnavailable: "Données adoption indisponibles."
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
      close: "Close",
      lastUpdated: "Last updated",
      adoptionUnavailable: "Adoption data unavailable."
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
    const yPad=Math.max(0.05*ySpan, 1);
    const yMinPad=yMin - yPad;
    const yMaxPad=yMax + yPad;

    const mapX=x=>pad+(w-pad*2)*(x-xMin)/xSpan;
    const mapY=y=>{
      const clamped=Math.min(yMaxPad, Math.max(yMinPad, y));
      const span=(yMaxPad-yMinPad)||1;
      return (h-pad)-(h-pad*2)*(clamped-yMinPad)/span;
    };

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
    const cacheKey="bp_prices_usd_v2";
    const cachedRaw=localStorage.getItem(cacheKey);
    const now=Date.now();
    if (cachedRaw) {
      try {
        const c=JSON.parse(cachedRaw);
        if (c.ts && (now-c.ts)<10*60*1000 && c.prices) return c.prices;
      } catch {}
    }

    const fall = cfg?.fallbackPricesUSD || { btc:100000, eth:3500, bnb:650 };
    const symbols={ btc:"BTCUSDT", eth:"ETHUSDT", bnb:"BNBUSDT" };
    const prices={ btc: fall.btc ?? 0, eth: fall.eth ?? 0, bnb: fall.bnb ?? 0, stables:1 };

    for (const [k,symbol] of Object.entries(symbols)) {
      try {
        const res = await fetchJSON(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, 8000);
        const px = Number(res?.price);
        if (isFinite(px) && px>0) prices[k]=px;
      } catch {}
    }

    localStorage.setItem(cacheKey, JSON.stringify({ ts:now, prices }));
    return prices;
  }

  async function loadMarketSeriesLive(sym) {
    if (location.protocol === "file:") return [];

    const cacheKey="bp_mkt_"+sym+"_usd_v2";
    const cachedRaw=localStorage.getItem(cacheKey);
    const now=Date.now();
    if (cachedRaw) {
      try {
        const c=JSON.parse(cachedRaw);
        if (c.ts && (now-c.ts)<12*60*60*1000 && Array.isArray(c.series) && c.series.length) return c.series;
      } catch {}
    }

    const symbolMap={ btc:"BTCUSDT", eth:"ETHUSDT", bnb:"BNBUSDT" };
    const ticker=symbolMap[sym];
    if (!ticker) return [];

    async function fetchKlines(startTime){
      const url=`https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=1d&startTime=${startTime}&endTime=${Date.now()}&limit=1000`;
      const res=await fetchJSON(url, 9000);
      return Array.isArray(res) ? res : [];
    }

    const days=1825;
    const start=now - days*DAY;
    let cursor=start;
    let all=[];
    try {
      while (cursor < now) {
        const chunk=await fetchKlines(cursor);
        if (!chunk.length) break;
        all = all.concat(chunk);
        const last=Number(chunk[chunk.length-1]?.[0]);
        if (!isFinite(last) || chunk.length < 1000) break;
        cursor = last + DAY;
      }
    } catch { all=[]; }

    const series=normalizeSeriesDaily(all.map(k=>[Number(k?.[0]), Number(k?.[4])]).filter(p=>isFinite(p[0]) && isFinite(p[1])));

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

  function computeReturn(series, days){
    if (!series || !series.length) return NaN;
    const last=series[series.length-1];
    const p=nearestByTime(series, last[0]-days*DAY);
    if (!p) return NaN;
    return (last[1]/p[1])-1;
  }

  function sliceWindow(series, days){
    if (!series || !series.length) return [];
    const last=series[series.length-1]?.[0] || Date.now();
    const min=last - days*DAY;
    return series.filter(p=>p[0]>=min);
  }

  function setAxisLabels(el, series){
    if (!el) return;
    el.innerHTML="";
    if (!series || !series.length) return;
    const first=series[0][0], last=series[series.length-1][0];
    const mid=first + (last-first)/2;
    [first,mid,last].forEach((ts,i)=>{
      const span=document.createElement("span");
      span.textContent=fmtDate(ts);
      span.className="axisTick";
      span.style.left = (i===0?0:i===1?50:100)+"%";
      el.appendChild(span);
    });
  }

  function installHover(boxSel, hoverSel, series, fmtVal=fmtNum, isIndex=false){
    const box=$(boxSel);
    const hover=$(hoverSel);
    if (!box || !hover){ return; }
    if (!series || !series.length){ hover.style.display="none"; return; }
    const first=series[0][0];
    const last=series[series.length-1][0];
    const span=last-first || 1;
    const show=(p)=>{
      const label=isIndex ? fmtNum(p[1],0) : fmtUsd(p[1],0);
      hover.textContent = `${label} · ${fmtDate(p[0])}`;
      hover.style.display="block";
    };
    box.onmousemove = (e)=>{
      const rect=box.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (e.clientX-rect.left)/rect.width));
      const t = first + span*ratio;
      const p = nearestByTime(series, t);
      if (p) show(p);
    };
    box.onmouseleave = ()=>{ hover.style.display="none"; };
    show(series[series.length-1]);
  }

  function setMarketUI({ series, source, isIndex, updatedAt, periodDays }) {
    const empty=$("#marketEmpty");
    const svg=$("#marketSvg");
    const k1=$("#kpi1y");
    const k3=$("#kpi3y");
    const k5=$("#kpi5y");
    const axis=$("#marketAxis");

    if (!series || series.length<2) {
      if (empty) { empty.style.display="flex"; empty.textContent=T.marketUnavailable; }
      if (svg) svg.innerHTML="";
      if (axis) axis.innerHTML="";
      [k1,k3,k5].forEach(el=>{ if (el) el.textContent="—"; });
      return;
    }

    if (empty) empty.style.display="none";

    const windowed = sliceWindow(series, periodDays || 365);
    let viewSeries = windowed.length >= 2 ? windowed : series;

    const base=series && series.length ? series : [];
    const r1=computeReturn(base,365);
    const r3=computeReturn(base,1095);
    const r5=computeReturn(base,1825);
    if (k1) k1.textContent=fmtPct(r1);
    if (k3) k3.textContent=fmtPct(r3);
    if (k5) k5.textContent=fmtPct(r5);

    if (axis) { axis.innerHTML=""; axis.style.display="none"; }

    if (viewSeries.length > 5) {
      const last=viewSeries[viewSeries.length-1][1];
      const prev=viewSeries[viewSeries.length-2][1] || last;
      if (isFinite(last) && isFinite(prev) && last > prev*4) viewSeries = viewSeries.slice(0,-1);
    }

    const sampled = sampleSeries(viewSeries);
    drawSvgLine(svg, sampled);

    installHover("#marketChart", "#marketHover", sampled, (v)=>isIndex?fmtNum(v,0):fmtUsd(v,0), isIndex);
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
    const stableNote=$("#stableScenarioNote");
    const scenarioWrap=$("#priceScenarios");
    const durationWrap=$("#durationChips");

    const depTok=$("#depTok");
    const cap12Tok=$("#cap12Tok");
    const val12Flat=$("#val12Flat");
    const val12Scn=$("#val12Scn");
    const comp12Tok=$("#comp12Tok");
    const comp3Tok=$("#comp3Tok");
    const comp5Tok=$("#comp5Tok");
    const comp12Usd=$("#comp12Usd");
    const comp3Usd=$("#comp3Usd");
    const comp5Usd=$("#comp5Usd");
    const compBox=$("#compDetails");
    const compToggle=$("#toggleDetails");
    const priceMeta=$("#priceMeta");

    const scenarios = Array.isArray(cfg?.price_scenarios) && cfg.price_scenarios.length ? cfg.price_scenarios : [0,0.2,0.5];
    let scenario=Number(cfg?.defaults?.scenario ?? scenarios[1] ?? 0.2);
    let durationYears=1;

    function renderScenarioChips(){
      if (!scenarioWrap) return [];
      scenarioWrap.innerHTML="";
      return scenarios.map(v=>{
        const btn=document.createElement("button");
        btn.type="button";
        btn.className="chip";
        btn.dataset.scn=String(v);
        btn.textContent = v===0 ? (LANG==="fr"?"Prix plat":"Flat price") : `+${(v*100).toFixed(0)}%/an`;
        scenarioWrap.appendChild(btn);
        return btn;
      });
    }

    const chips = renderScenarioChips();
    const durationChips = durationWrap ? Array.from(durationWrap.querySelectorAll(".chip")) : [];

    function setChipsEnabled(isStable) {
      chips.forEach(ch => {
        const scn=Number(ch.dataset.scn ?? 0);
        const dis = isStable && scn !== 0;
        ch.disabled = !!dis;
        ch.classList.toggle("is-disabled", !!dis);
        if (dis) ch.setAttribute("aria-disabled","true");
        else ch.removeAttribute("aria-disabled");
      });
      if (stableNote) stableNote.style.display = isStable ? "block" : "none";
      if (scenarioWrap) scenarioWrap.classList.toggle("is-stable", !!isStable);
    }

    function priceGrowth(years){
      return Math.pow(1+scenario, years);
    }

    function recalc() {
      const usd=Number(String(amount?.value ?? "").replace(",", "."));
      const asset=assetSel?.value || "stables";
      const apr=Number(yields?.[asset] ?? 0);
      const px=asset==="stables" ? 1 : Number(pricesUSD?.[asset] ?? 0);

      const isStable = asset==="stables";
      if (isStable && scenario !== 0) scenario = 0;

      setChipsEnabled(isStable);
      setActiveChip("#priceScenarios .chip", String(scenario));

      if (!usd || usd<=0 || !isFinite(usd) || !isFinite(apr) || (asset!=="stables" && (!px || px<=0))) {
        [depTok,cap12Tok,val12Flat,val12Scn,comp12Tok,comp3Tok,comp5Tok,comp12Usd,comp3Usd,comp5Usd].forEach(el => { if (el) el.textContent="—"; });
        if (priceMeta) priceMeta.textContent="";
        return;
      }

      const principalTok=usd/px;
      const tok1=computeTokens(principalTok, apr, 1);
      const tok3=computeTokens(principalTok, apr, 3);
      const tok5=computeTokens(principalTok, apr, 5);
      const tokSel=computeTokens(principalTok, apr, durationYears);

      const unit=asset==="stables"?"STABLE":asset.toUpperCase();
      const maxDec=asset==="stables"?2:6;

      if (depTok) depTok.textContent=`${fmtNum(principalTok, maxDec)} ${unit}`;
      if (cap12Tok) cap12Tok.textContent=`${fmtNum(tokSel, maxDec)} ${unit}`;

      const flatVal = tokSel*px;
      const scnVal = tokSel*px*priceGrowth(durationYears);
      if (val12Flat) val12Flat.textContent=fmtUsd(flatVal,0);
      if (val12Scn) val12Scn.textContent=fmtUsd(scnVal,0);

      if (comp12Tok) comp12Tok.textContent=`${fmtNum(tok1, maxDec)} ${unit}`;
      if (comp3Tok) comp3Tok.textContent=`${fmtNum(tok3, maxDec)} ${unit}`;
      if (comp5Tok) comp5Tok.textContent=`${fmtNum(tok5, maxDec)} ${unit}`;

      if (comp12Usd) comp12Usd.textContent=fmtUsd(tok1*px*priceGrowth(1),0);
      if (comp3Usd) comp3Usd.textContent=fmtUsd(tok3*px*priceGrowth(3),0);
      if (comp5Usd) comp5Usd.textContent=fmtUsd(tok5*px*priceGrowth(5),0);

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
      setActiveChip("#priceScenarios .chip", String(scenario));
      recalc();
    }));

    durationChips.forEach(ch => ch.addEventListener("click", () => {
      const d=Number(ch.dataset.duration||0);
      if (!d || d===durationYears) return;
      durationYears=d;
      setActiveChip("#durationChips .chip", String(durationYears));
      recalc();
    }));

    if (amount) amount.addEventListener("input", recalc);
    if (assetSel) assetSel.addEventListener("change", recalc);

    if (compToggle && compBox){
      compToggle.addEventListener("click", () => {
        const open = compBox.classList.toggle("is-open");
        compToggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }

    setActiveChip("#durationChips .chip", String(durationYears));
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
      if (callUrl) ctaCall.href=callUrl;
      else ctaCall.href=mailto;
    }

    const terms=cfg?.links?.termsPdf || "../BPC_Terms.pdf";
    const footerTerms=$("#footerTerms");
    if (footerTerms) footerTerms.href=resolveHref(terms);

    const signature=cfg?.links?.signature || "../signature.html";
    const navSignature=$("#navSignature");
    const footerSignature=$("#footerSignature");
    if (navSignature && !navSignature.getAttribute("href")?.startsWith("#")) navSignature.href=resolveHref(signature);
    if (footerSignature && !footerSignature.getAttribute("href")?.startsWith("#")) footerSignature.href=resolveHref(signature);

    const docs=cfg?.links?.docs || "";
    const navDocs=$("#navDocs");
    const footerDocs=$("#footerDocs");
    const navCall=$("#navCall");

    if (navCall) {
      if (callUrl) navCall.href=callUrl;
      else navCall.href=mailto;
    }

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

  async function loadMarketCapSnapshot(){
    if (location.protocol === "file:") return null;
    try {
      const snap = await fetchJSON("https://api.coingecko.com/api/v3/global", 9000);
      const total = Number(snap?.data?.total_market_cap?.usd);
      const change = Number(snap?.data?.market_cap_change_percentage_24h_usd);
      if (!isFinite(total) || total<=0) return null;
      const updatedAt = Number(snap?.data?.updated_at)*1000 || Date.now();
      return { value: total, change24h: change, updatedAt, source:"CoinGecko" };
    } catch { return null; }
  }

  function setAdoptionUI(series, meta, periodDays){
    const empty=$("#adoptionEmpty");
    const svg=$("#adoptionSvg");
    const axis=$("#adoptionAxis");
    const upd=$("#adoptionUpdated");
    const range=$("#adoptionRange");
    const k1=$("#adopt1y");
    const k3=$("#adopt3y");
    const k5=$("#adopt5y");
    const hover=$("#adoptionHover");
    if (!series || series.length<2){
      if (empty){ empty.style.display="flex"; empty.textContent=T.adoptionUnavailable; }
      if (svg) svg.innerHTML="";
      if (axis) axis.innerHTML="";
      if (upd) upd.textContent="";
      if (range) range.textContent="";
      [k1,k3,k5].forEach(el=>{ if (el) el.textContent="—"; });
      if (hover) hover.style.display="none";
      return;
    }
    if (empty) empty.style.display="none";
    const viewSeries = sliceWindow(series, periodDays||1825);
    const vs = viewSeries.length?viewSeries:series;
    drawSvgLine(svg, sampleSeries(vs));
    setAxisLabels(axis, vs);
    const base = vs.length ? vs : series;
    const r1=computeReturn(base,365);
    const r3=computeReturn(base,1095);
    const r5=computeReturn(base,1825);
    if (k1) k1.textContent=fmtPct(r1);
    if (k3) k3.textContent=fmtPct(r3);
    if (k5) k5.textContent=fmtPct(r5);
    if (upd){
      const ts = Date.parse(meta?.last_updated) || series[series.length-1][0];
      upd.textContent = `${T.lastUpdated || "Last updated"}: ${fmtDate(ts)}`;
    }
    if (range && vs.length){
      const lbl = LANG === "fr" ? "Période" : "Range";
      range.textContent = `${lbl}: ${fmtDate(vs[0][0])} – ${fmtDate(vs[vs.length-1][0])}`;
    }
    installHover("#adoptionChart", "#adoptionHover", vs, (v)=>fmtUsd(v,0), false);
  }

  function initSignatureEmbeds(){
    const tabBtns=$$('[data-signature-view]');
    const signFrame=$("#signatureSign");
    const verifyFrame=$("#signatureVerify");
    if (!tabBtns.length || !signFrame || !verifyFrame) return;

    const inLocale=/\/(en|fr)\/signature\.html$/i.test(location.pathname);
    const basePath=inLocale ? "../" : "./";
    const signSrc=resolveHref(basePath+"sign.html");
    const verifySrc=resolveHref(basePath+"verify.html");

    let signLoaded=false, verifyLoaded=false;
    const setActive=(view)=>{
      tabBtns.forEach(b=>b.classList.toggle("active", b.dataset.signatureView===view));
      signFrame.classList.toggle("active", view==="sign");
      verifyFrame.classList.toggle("active", view==="verify");
      if (view==="sign" && !signLoaded){ signFrame.src=signSrc; signLoaded=true; }
      if (view==="verify" && !verifyLoaded){ verifyFrame.src=verifySrc; verifyLoaded=true; }
    };

    tabBtns.forEach(b=>b.addEventListener("click", (e)=>{
      e.preventDefault();
      const view=b.dataset.signatureView||"sign";
      setActive(view);
    }));

    setActive(location.hash==="#signature" ? "sign" : "sign");
  }

  async function init() {
    enableSmoothScroll();
    initMobileMenu();

    const cfg = await firstJSON(
      [fromRoot("data/blockpilot.json"), "../data/blockpilot.json","./data/blockpilot.json"],
      {}
    );

    applyLinks(cfg);
    initSignatureEmbeds();

    const yields = fillApr(cfg);
    const pricesUSD = await loadPricesUSD(cfg);
    initCalc(cfg, pricesUSD, yields);

    const marketBtns = $$('[data-market]');
    const periodCards = $$('[data-period-card]');
    let adoptionBtns = $$('[data-adoption-card]');
    let availableMarkets = marketBtns.map(b=>b.dataset.market).filter(Boolean);
    let active = localStorage.getItem("bp_market_sel") || cfg?.defaults?.marketDefault || availableMarkets[0] || "btc";
    if (!availableMarkets.includes(active)) active = availableMarkets[0] || "btc";
    const defaultPeriod = Number(cfg?.defaults?.marketPeriod || 1825);
    const storedPeriod = Number(localStorage.getItem("bp_market_period")) || defaultPeriod;
    const defaultAdopt = Number(cfg?.defaults?.adoptionPeriod || 1825);
    const storedAdoption = Number(localStorage.getItem("bp_adoption_period")) || defaultAdopt;
    let periodDays = storedPeriod;
    let adoptionPeriod = storedAdoption;
    setActiveTab("[data-market]", active);
    setActiveChip("[data-period-card]", String(periodDays));
    setActiveChip("[data-adoption-card]", String(adoptionPeriod));

    const cacheMarket = await firstJSON(
      [fromRoot("data/market.json"), "../data/market.json","./data/market.json"],
      null
    );
    const cacheCap = await firstJSON(
      [fromRoot("data/market_total_ex_stables.json"), "../data/market_total_ex_stables.json","./data/market_total_ex_stables.json"],
      { series:[] }
    );
    const adoptionCache = await firstJSON(
      [fromRoot("data/adoption.json"), "../data/adoption.json","./data/adoption.json"],
      { series:[], meta:{} }
    );
    const marketCapIndex = (cacheMarket?.meta?.totalKind === "index") || String(cacheCap?.meta?.source||"").includes("synthetic");
    if (marketCapIndex) {
      const totalBtn = document.querySelector('[data-market="total"]');
      if (totalBtn) totalBtn.remove();
      marketBtns = $$('[data-market]');
      availableMarkets = marketBtns.map(b=>b.dataset.market).filter(Boolean);
      if (active === "total") active = availableMarkets[0] || "btc";
      setActiveTab("[data-market]", active);
    }

    const adoptionSection=document.querySelector(".adoptionBox");
    const adoptionNotice=$("#adoptionNotice");
    function cacheSeries(k){
      return normalizeSeriesDaily((cacheMarket?.[k]||[]).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>isFinite(p[0])&&isFinite(p[1])));
    }
    const adoptionSeries = normalizeSeriesDaily((adoptionCache?.series||[]).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>isFinite(p[0])&&isFinite(p[1])));
    const adoptionMeta = adoptionCache?.meta || {};
    const adoptionCount = adoptionSeries.length;
    const adoptionMax = adoptionCount ? Math.max(...adoptionSeries.map(p=>p[1]).filter(v=>isFinite(v))) : 0;
    const adoptionHasNaN = (adoptionCache?.series||[]).some(p=>!isFinite(Number(p?.[1])));
    const adoptionReliable = adoptionCount >= 30 && adoptionMax >= 1e6 && !adoptionHasNaN && !String(adoptionMeta?.source||"").includes("synthetic");
    if (!adoptionReliable) {
      if (adoptionSection) adoptionSection.style.display="none";
      if (adoptionNotice) {
        adoptionNotice.style.display="block";
        adoptionNotice.textContent = LANG === "fr" ? "Données en cours de calibration." : "Data being calibrated.";
      }
    }

    async function refresh(sym) {
      const empty=$("#marketEmpty");
      if (empty) { empty.style.display="flex"; empty.textContent=T.loading; }
      let series=[], source="", isIndex=sym==="total", updatedAt=Date.now();

      if (sym === "total") {
        const fallbackSeries = normalizeSeriesDaily((cacheCap?.series||[]).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>isFinite(p[0])&&isFinite(p[1])));
        series = fallbackSeries;
        source = cacheCap?.meta?.source || "cache";
        updatedAt = Date.parse(cacheCap?.meta?.last_updated) || updatedAt;

        const snap = await loadMarketCapSnapshot();
        if (snap && isFinite(snap.value)) {
          const lastTs = series[series.length-1]?.[0] || 0;
          const point=[Date.now(), Number((snap.value/1e9).toFixed(2))];
          if (point[0] > lastTs) series = series.concat([point]);
          source = snap.source || "live";
          updatedAt = snap.updatedAt || point[0];
        }
        isIndex=false;
      } else {
        const cache = cacheSeries(sym);
        series = cache;
        source = cacheMarket?.meta?.source || "cache";
        updatedAt = Date.parse(cacheMarket?.meta?.updatedAt) || updatedAt;

        const live = await loadMarketSeriesLive(sym);
        if (live.length) {
          series = live;
          source = "Binance (live)";
          updatedAt = live[live.length-1][0];
        }
      }

      setMarketUI({ series, source, isIndex, updatedAt, periodDays });
    }

    marketBtns.forEach(b => b.addEventListener("click", async () => {
      const sym=b.dataset.market;
      if (!sym || sym===active) return;
      active=sym;
      localStorage.setItem("bp_market_sel", sym);
      setActiveTab("[data-market]", active);
      await refresh(active);
    }));

    periodCards.forEach(b => b.addEventListener("click", async () => {
      const d=Number(b.dataset.periodCard||0);
      if (!d || d===periodDays) return;
      periodDays=d;
      localStorage.setItem("bp_market_period", String(periodDays));
      setActiveChip("[data-period-card]", String(periodDays));
      await refresh(active);
    }));

    async function refreshAdoption(){
      setAdoptionUI(adoptionSeries, adoptionMeta, adoptionPeriod);
    }

    adoptionBtns.forEach(b => b.addEventListener("click", () => {
      const d=Number(b.dataset.adoptionCard||0);
      if (!d || d===adoptionPeriod) return;
      adoptionPeriod=d;
      localStorage.setItem("bp_adoption_period", String(adoptionPeriod));
      setActiveChip("[data-adoption-card]", String(adoptionPeriod));
      refreshAdoption();
    }));

    await refresh(active);
    if (adoptionReliable) await refreshAdoption();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  })();
