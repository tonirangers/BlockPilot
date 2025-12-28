/* assets/main.js */
(async () => {
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
      calibrating: "Données en cours de calibration."
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
      calibrating: "Data being calibrated."
    }
  };
  const T = I18N[LANG] || I18N.fr;
  try { localStorage.setItem("bp_lang", LANG); } catch {}

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
    $$(groupSel).forEach(b => {
      const data = b.dataset.scn ?? b.dataset.periodCard ?? b.dataset.capCard ?? b.dataset.duration;
      b.classList.toggle("active", String(data) === String(key));
    });
  }
  function setActiveTab(groupSel, key) {
    $$(groupSel).forEach(b => b.classList.toggle("active", b.dataset.market === key));
  }

  const CHART_VIEW = { width:1000, height:300, pad:24 };

  function drawSvgLine(svgEl, points) {
    if (!svgEl) return;
    svgEl.innerHTML = "";
    if (!points || points.length < 2) return;

    const w=CHART_VIEW.width, h=CHART_VIEW.height, pad=CHART_VIEW.pad;
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
    if (!series || !series.length) return [];
    const target=Math.max(maxPoints, 20);
    if (series.length<=target) return series;
    const step=Math.max(1, Math.floor(series.length/target));
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

  function sanitizeSeriesUSD(series) {
    const clean = (series||[])
      .map(p=>[Number(p?.[0]), Number(p?.[1])])
      .filter(p=>isFinite(p[0]) && isFinite(p[1]))
      .sort((a,b)=>a[0]-b[0]);
    if (clean.length < 2) return [];
    const last = clean[clean.length-1][1];
    const tail = clean.slice(-6,-1).map(p=>p[1]).filter(v=>isFinite(v));
    const baselineArr = tail.length ? tail.slice().sort((a,b)=>a-b) : [clean[clean.length-2][1]];
    const mid = baselineArr[Math.floor((baselineArr.length-1)/2)] || baselineArr[0];
    if (isFinite(last) && isFinite(mid) && last > mid*4) return clean.slice(0,-1);
    return clean;
  }

  function isSeriesReliable(series, meta) {
    if (!Array.isArray(series) || series.length < 10) return false;
    if ((meta?.source||"").toLowerCase().includes("synthetic")) return false;
    return series.every(p=>Array.isArray(p) && p.length>=2 && isFinite(p[0]) && isFinite(p[1]));
  }

  function scaleSeriesToUSD(series){
    const vals=(series||[]).map(p=>Number(p?.[1])).filter(isFinite);
    const max = vals.length ? Math.max(...vals) : 0;
    const factor = max && max < 1e7 ? 1e9 : 1;
    return (series||[]).map(p=>[Number(p?.[0]), Number(p?.[1])*factor]);
  }

  function buildEqualWeightedIndex(seriesMap) {
    const keys=["btc","eth","bnb"];
    const maps = keys.map(k=>{
      const m=new Map();
      (seriesMap?.[k]||[]).forEach(p=>{
        const t=dayTs(p?.[0]);
        const v=Number(p?.[1]);
        if (isFinite(t) && isFinite(v) && v>0) m.set(t, v);
      });
      return m;
    });
    if (!maps.every(m=>m.size)) return [];
    const common=[...maps[0].keys()].filter(ts=>maps[1].has(ts)&&maps[2].has(ts)).sort((a,b)=>a-b);
    if (!common.length) return [];

    const baseTs=common[0];
    const base=maps.map(m=>Number(m.get(baseTs))).map(v=>isFinite(v)&&v>0?v:null);
    if (base.some(v=>v===null)) return [];

    const out=[];
    for (const ts of common) {
      const vals=maps.map(m=>Number(m.get(ts)));
      if (vals.some(v=>!isFinite(v)||v<=0)) continue;
      const norms=vals.map((v,i)=>v/base[i]*100);
      const idx=norms.reduce((a,v)=>a+v,0)/norms.length;
      out.push([ts, Number(idx.toFixed(2))]);
    }
    return out;
  }

  function latestTs(series){
    return Array.isArray(series) && series.length ? series[series.length-1][0] : Date.now();
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
    try {
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
    } catch {
      return [];
    }
  }

  async function loadAdoptionSeries() {
    const cacheBust=`?t=${Date.now()}`;
    const adoption = await firstJSON(
      [fromRoot(`data/adoption.json${cacheBust}`), `../data/adoption.json${cacheBust}`, `./data/adoption.json${cacheBust}`],
      null
    );
    const meta = adoption?.meta || {};
    const series = normalizeSeriesDaily((adoption?.series||[]).map(p=>[Number(p?.[0]), Number(p?.[1])]).filter(p=>isFinite(p[0]) && isFinite(p[1])));
    return { series, meta };
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

  function setAxisLabels(el, series, periodDays){
    if (!el) return;
    el.innerHTML="";
    if (!series || !series.length) return;
    const first=series[0][0], last=series[series.length-1][0];
    const span=last-first || 1;
    const padPct=(CHART_VIEW.pad/CHART_VIEW.width)*100;
    const usable=100-padPct*2;
    const ticks=[];
    const pushTick=(ts,label)=>{ if (ts>=first && ts<=last && !ticks.find(t=>t.ts===ts)) ticks.push({ ts, label }); };

    if (periodDays>=1825){
      const startYear=new Date(first).getFullYear();
      const endYear=new Date(last).getFullYear();
      for (let y=startYear; y<=endYear; y++) {
        pushTick(Date.UTC(y,0,1), String(y));
      }
    } else if (periodDays>=1095){
      const startYear=new Date(first).getFullYear();
      const endYear=new Date(last).getFullYear();
      for (let y=startYear; y<=endYear; y++) {
        pushTick(Date.UTC(y,0,1), String(y));
      }
    } else {
      const date=new Date(first);
      for (let i=0;i<13;i+=3){
        const ts=Date.UTC(date.getUTCFullYear(), date.getUTCMonth()+i, 1);
        const d=new Date(ts);
        pushTick(ts, d.toLocaleString(undefined,{month:'short'}));
      }
      pushTick(last, new Date(last).toLocaleString(undefined,{month:'short'}));
    }

    ticks.forEach(t=>{
      const spanEl=document.createElement("span");
      spanEl.textContent=t.label;
      spanEl.className="axisTick";
      spanEl.style.left = `${padPct + usable*((t.ts-first)/span)}%`;
      el.appendChild(spanEl);
    });
    el.style.display = ticks.length ? "block" : "none";
  }

  function installHover(boxSel, hoverSel, series, fmtVal=fmtNum, isIndex=false){
    const box=$(boxSel);
    const hover=$(hoverSel);
    const svg=box?.querySelector('svg');
    if (!box || !hover){ return; }
    if (!series || !series.length){ hover.style.display="none"; return; }
    const first=series[0][0];
    const last=series[series.length-1][0];
    const span=last-first || 1;
    const clamp=(v,min,max)=>Math.min(max, Math.max(min, v));
    const show=(p, clientX, clientY)=>{
      const val = fmtVal ? fmtVal(p[1]) : (isIndex ? fmtNum(p[1],0) : fmtUsd(p[1],0));
      const label=isIndex ? `${LANG==="fr"?"Indice":"Index"} ${val}` : val;
      hover.textContent = `${label} · ${fmtDate(p[0])}`;
      const rect=box.getBoundingClientRect();
      const leftBase = clientX !== undefined ? clientX-rect.left - hover.offsetWidth/2 : rect.width-hover.offsetWidth-10;
      const topBase  = clientY !== undefined ? clientY-rect.top - hover.offsetHeight-8 : 10;
      hover.style.left = `${clamp(leftBase, 6, rect.width - hover.offsetWidth - 6)}px`;
      hover.style.top = `${clamp(topBase, 6, rect.height - hover.offsetHeight - 6)}px`;
      hover.style.display="block";
      hover.style.right="auto";
    };

    const clear=()=>{ hover.style.display="none"; };
    const handlePoint=(clientX, clientY)=>{
      if (clientX===undefined || clientY===undefined) { clear(); return; }
      const plotRect=svg?.getBoundingClientRect?.();
      if (!plotRect) { clear(); return; }
      const padX=plotRect.width*(CHART_VIEW.pad/CHART_VIEW.width);
      const padY=plotRect.height*(CHART_VIEW.pad/CHART_VIEW.height);
      const innerLeft=plotRect.left+padX;
      const innerRight=plotRect.right-padX;
      const innerTop=plotRect.top+padY;
      const innerBottom=plotRect.bottom-padY;
      if (clientX<innerLeft || clientX>innerRight || clientY<innerTop || clientY>innerBottom) { clear(); return; }
      const ratioRaw=(clientX-innerLeft)/(innerRight-innerLeft);
      if (ratioRaw<0 || ratioRaw>1) { clear(); return; }
      const t = first + span*ratioRaw;
      const p = nearestByTime(series, t);
      if (p) show(p, clientX, clientY);
    };

    box.onmousemove = (e)=>handlePoint(e.clientX, e.clientY);
    box.addEventListener("touchmove", (e)=>{
      const t=e.touches?.[0];
      if (t) handlePoint(t.clientX, t.clientY);
    }, { passive:true });
    ["mouseleave","pointerleave"].forEach(evt=>box.addEventListener(evt, clear));
    box.addEventListener("touchend", clear);
    show(series[series.length-1]);
  }

  function setMarketUI({ series, source, isIndex, updatedAt, periodDays }) {
    const empty=$("#marketEmpty");
    const svg=$("#marketSvg");
    const k1=$("#kpi1y");
    const k3=$("#kpi3y");
    const k5=$("#kpi5y");
    const axis=$("#marketAxis");

    const safeSeries = sanitizeSeriesUSD(series);

    if (!safeSeries || safeSeries.length<2 || !isSeriesReliable(safeSeries)) {
      if (empty) { empty.style.display="flex"; empty.textContent=T.calibrating; }
      if (svg) svg.innerHTML="";
      [k1,k3,k5].forEach(el=>{ if (el) el.textContent="—"; });
      return;
    }

    if (empty) empty.style.display="none";

    const windowed = sliceWindow(safeSeries, periodDays || 365);
    let viewSeries = windowed.length >= 2 ? windowed : safeSeries;

    const base=safeSeries && safeSeries.length ? safeSeries : [];
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
      if (axis) setAxisLabels(axis, sampled, periodDays || 365);

      installHover("#marketChart", "#marketHover", sampled, (v)=>isIndex?fmtNum(v,0):fmtUsd(v,0), isIndex);

  }

  function setAdoptionUI(series, meta) {
    const empty=$("#adoptionEmpty");
    const svg=$("#adoptionSvg");
    const axis=$("#adoptionAxis");
    const k1=$("#adoption1y");
    const k5=$("#adoption5y");
    const hint=$("#adoptionMeta");

    const cleanSeries = normalizeSeriesDaily((series||[]).map(p=>[Number(p?.[0]), Number(p?.[1])]).filter(p=>isFinite(p[0]) && isFinite(p[1])));

    if (!cleanSeries.length) {
      if (empty) { empty.style.display="flex"; empty.textContent=T.calibrating; }
      if (svg) svg.innerHTML="";
      if (axis) { axis.innerHTML=""; axis.style.display="none"; }
      [k1,k5].forEach(el=>{ if (el) el.textContent="—"; });
      if (hint) hint.textContent="";
      return;
    }

    if (empty) empty.style.display="none";

    const r1=computeReturn(cleanSeries,365);
    const r5=computeReturn(cleanSeries,1825);
    if (k1) k1.textContent=fmtPct(r1);
    if (k5) k5.textContent=fmtPct(r5);

    if (hint) {
      const parts=[];
      const upd=Date.parse(meta?.last_updated);
      if (isFinite(upd)) parts.push(`${T.lastUpdated}: ${fmtDate(upd)}`);
      if (meta?.source) parts.push(meta.source);
      hint.textContent = parts.join(" · ");
    }

    const sampled = sampleSeries(cleanSeries);
    drawSvgLine(svg, sampled);
    if (axis) setAxisLabels(axis, sampled, Math.max(365, Math.round((cleanSeries[cleanSeries.length-1][0]-cleanSeries[0][0])/DAY)));
    installHover("#adoptionChart", "#adoptionHover", sampled, (v)=>fmtNum(v,2), true);
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
    const scenarioRow=scenarioWrap?.closest('.scenarios');
    const durationWrap=$("#durationChips");

    const depTok=$("#depTok");
    const cap12Tok=$("#cap12Tok");
    const val12Flat=$("#val12Flat");
    const val12Scn=$("#val12Scn");
    const valScenarioRow=$("#valScenarioRow");
    const valFlatRow=$("#valFlatRow");
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
      if (scenarioWrap) scenarioWrap.style.display = isStable ? "none" : "flex";
      if (scenarioRow) scenarioRow.classList.toggle("is-stable", !!isStable);
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

      const redundantPrice = isStable && Math.abs(scnVal - flatVal) < 1e-6;
      if (valScenarioRow) {
        valScenarioRow.classList.toggle("simRow--primaryValue", !redundantPrice);
        valScenarioRow.classList.toggle("is-redundant", !!redundantPrice);
      }
      if (valFlatRow) {
        valFlatRow.classList.toggle("simRow--primaryValue", !!redundantPrice);
        valFlatRow.classList.remove("is-redundant");
      }

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
    const withLang=(href)=>{
      try {
        const url=new URL(resolveHref(href));
        url.searchParams.set("lang", LANG);
        return url.toString();
      } catch {
        return resolveHref(href);
      }
    };
    const navSignature=$("#navSignature");
    const footerSignature=$("#footerSignature");
    if (navSignature && !navSignature.getAttribute("href")?.startsWith("#")) navSignature.href=withLang(signature);
    if (footerSignature && !footerSignature.getAttribute("href")?.startsWith("#")) footerSignature.href=withLang(signature);

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

    function initSignatureEmbeds(){
      const tabBtns=$$('[data-signature-view]');
      const frame=$("#signatureFrame");
      const frameSign=$("#signatureSign");
      const frameVerify=$("#signatureVerify");
      if (!tabBtns.length && !frame && !frameSign && !frameVerify) return;

      const getEmbedLang=()=>{
        const qsLang=new URLSearchParams(location.search).get("lang");
        const stored=localStorage.getItem("bp_lang") || LANG;
        const base=(qsLang||stored||"fr").toLowerCase();
        return base.startsWith("en")?"en":"fr";
      };
      let embedLang=getEmbedLang();

      const srcFor=(view)=>{
        const page=view==="verify" ? "verify" : "sign";
        return fromRoot(`${page}.html?embed=1&lang=${embedLang}`);
      };

      let current=location.hash==="#verify" ? "verify" : "sign";
      const applyTabs=()=>{
        tabBtns.forEach(b=>b.classList.toggle("active", (b.dataset.signatureView||"sign")===current));
      };
      const refreshFrames=()=>{
        applyTabs();
        if (frame) {
          frame.src=srcFor(current);
          frame.title = current==="verify" ? (embedLang==="fr"?"Vérifier":"Verify") : (embedLang==="fr"?"Signer":"Sign");
        }
        if (frameSign) frameSign.src=srcFor("sign");
        if (frameVerify) frameVerify.src=srcFor("verify");
      };

      const setActive=(view)=>{
        const v=view==="verify" ? "verify" : "sign";
        if (current===v) return;
        current=v;
        refreshFrames();
      };

      tabBtns.forEach(b=>b.addEventListener("click", (e)=>{
        e.preventDefault();
        setActive(b.dataset.signatureView||"sign");
      }));

      window.addEventListener("storage", (e)=>{
        if (e.key === "bp_lang") {
          const next=getEmbedLang();
          if (next !== embedLang) { embedLang = next; refreshFrames(); }
        }
      });

      refreshFrames();
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

    let marketBtns = $$('[data-market]');
    const periodCards = $$('[data-period-card]');
    const availableMarkets = marketBtns.map(b=>b.dataset.market).filter(Boolean);
    const defaultActive = "total";
    let active = localStorage.getItem("bp_market_sel") || defaultActive;
    if (!availableMarkets.includes(active)) active = availableMarkets.includes(defaultActive) ? defaultActive : (availableMarkets[0] || "btc");
    const defaultPeriod = 1825;
    const storedPeriod = Number(localStorage.getItem("bp_market_period")) || defaultPeriod;
    let periodDays = storedPeriod;
    setActiveTab("[data-market]", active);
    setActiveChip("[data-period-card]", String(periodDays));

    const cacheBust=`?t=${Date.now()}`;
    const cacheMarket = await firstJSON(
      [fromRoot(`data/market.json${cacheBust}`), `../data/market.json${cacheBust}`,`./data/market.json${cacheBust}`],
      null
    );
    const cacheSeries = (k) => normalizeSeriesDaily((cacheMarket?.[k]||[]).map(p=>[Number(p[0]),Number(p[1])]).filter(p=>isFinite(p[0])&&isFinite(p[1])));
    const priceSeries={
      btc: cacheSeries("btc"),
      eth: cacheSeries("eth"),
      bnb: cacheSeries("bnb")
    };
    const totalCacheSeries = cacheSeries("total");

    const seriesStore={
      btc: priceSeries.btc,
      eth: priceSeries.eth,
      bnb: priceSeries.bnb
    };

    async function fetchSeries(sym){
      const cache = cacheSeries(sym);
      seriesStore[sym]=cache.length ? cache : seriesStore[sym];
      let source = cacheMarket?.meta?.source || "cache";
      let updatedAt = Date.parse(cacheMarket?.meta?.updatedAt) || latestTs(seriesStore[sym]);

      const live = await loadMarketSeriesLive(sym);
      if (live.length) {
        seriesStore[sym]=live;
        source = "Binance (live)";
        updatedAt = live[live.length-1][0];
      }

      return { series: seriesStore[sym], source, updatedAt };
    }

    function buildTotalFromStore(){
      const idx = buildEqualWeightedIndex(seriesStore);
      if (idx && idx.length) return { series: idx, source: "Equal-weighted index", updatedAt: latestTs(idx) };
      const updatedAt = Date.parse(cacheMarket?.meta?.updatedAt) || latestTs(totalCacheSeries);
      return { series: totalCacheSeries, source: cacheMarket?.meta?.source?.total || cacheMarket?.meta?.source || "cache", updatedAt };
    }

    async function refresh(sym) {
      const empty=$("#marketEmpty");
      if (empty) { empty.style.display="flex"; empty.textContent=T.loading; }
      const isIndex=sym==="total";

      if (sym === "total") {
        const initial = buildTotalFromStore();
        setMarketUI({ ...initial, isIndex:true, periodDays });

        Promise.all([fetchSeries("btc"), fetchSeries("eth"), fetchSeries("bnb")]).then(() => {
          if (active !== "total") return;
          const next = buildTotalFromStore();
          setMarketUI({ ...next, isIndex:true, periodDays });
        });
        return;
      }

      const cacheResult = { series: cacheSeries(sym), source: cacheMarket?.meta?.source || "cache", updatedAt: Date.parse(cacheMarket?.meta?.updatedAt) || Date.now() };
      seriesStore[sym] = cacheResult.series.length ? cacheResult.series : seriesStore[sym];
      setMarketUI({ ...cacheResult, isIndex, periodDays });

      const liveResult = await fetchSeries(sym);
      if (liveResult?.series?.length) {
        setMarketUI({ ...liveResult, isIndex, periodDays });
      }
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

    await refresh(active);

    const adoptionToggle=$("#adoptionToggle");
    const adoptionCard=$("#adoptionCard");
    let adoptionLoaded=false;
    let adoptionSeries=[];
    let adoptionMeta={};

    const setAdoptionVisible=(show)=>{
      if (!adoptionCard) return;
      adoptionCard.hidden = !show;
      adoptionCard.setAttribute("aria-hidden", show ? "false" : "true");
    };

    const setAdoptionToggleUI=(show)=>{
      if (!adoptionToggle) return;
      adoptionToggle.classList.toggle("active", !!show);
      adoptionToggle.setAttribute("aria-pressed", show ? "true" : "false");
    };

    const ensureAdoption=async()=>{
      if (adoptionLoaded) return { series: adoptionSeries, meta: adoptionMeta };
      const res = await loadAdoptionSeries();
      adoptionSeries = res.series || [];
      adoptionMeta = res.meta || {};
      setAdoptionUI(adoptionSeries, adoptionMeta);
      adoptionLoaded=true;
      return res;
    };

    if (adoptionToggle && adoptionCard) {
      let pref=false;
      try { pref = localStorage.getItem("bp_show_adoption") === "1"; } catch {}
      setAdoptionToggleUI(pref);
      setAdoptionVisible(pref);
      if (pref) await ensureAdoption();

      adoptionToggle.addEventListener("click", async () => {
        pref = !pref;
        try { localStorage.setItem("bp_show_adoption", pref ? "1" : "0"); } catch {}
        setAdoptionToggleUI(pref);
        setAdoptionVisible(pref);
        if (pref && !adoptionLoaded) await ensureAdoption();
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  })();
