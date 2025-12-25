const DEFAULTS={
  yields_avg:{BTC:0.02,ETH:0.04,STABLE:0.10,BNB:0.13},
  calculator_default_amount:50000,
  links:{call:"https://calendar.app.google/bQWcTHd22XDzuCt6A",email:"toni@blockpilot.capital",email_subject:"BlockPilot — Demande de call",terms:"../BPC_Terms.pdf"},
  market:{vs_currency:"eur",days:365,coingecko_ids:{BTC:"bitcoin",ETH:"ethereum",BNB:"binancecoin"}}
};

async function loadData(){
  try{
    const r=await fetch("../data/blockpilot.json",{cache:"no-store"});
    if(!r.ok) throw 0;
    const j=await r.json();
    return {
      ...DEFAULTS, ...j,
      links:{...DEFAULTS.links,...(j.links||{})},
      yields_avg:{...DEFAULTS.yields_avg,...(j.yields_avg||{})},
      market:{...DEFAULTS.market,...(j.market||{}),coingecko_ids:{...DEFAULTS.market.coingecko_ids,...(j.market?.coingecko_ids||{})}}
    };
  }catch(e){ return DEFAULTS; }
}

function fmtPct(p){
  if(!isFinite(p)) return "—";
  const s=p*100;
  return (s>=0?"+":"")+s.toFixed(1)+"%";
}
function fmtNum(x,dec=6){
  if(!isFinite(x)) return "—";
  let s=x.toFixed(dec);
  s=s.replace(/0+$/,"").replace(/\.$/,"");
  return s;
}
function fmtEUR(x){
  if(!isFinite(x)) return "—";
  const v=Math.round(x);
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g," ")+" €";
}
function monthlyRate(apr){ return Math.pow(1+apr,1/12)-1; }

function wireCTAs(d){
  document.querySelectorAll("[data-cta='call']").forEach(a=>a.href=d.links.call);
  const mail=`mailto:${d.links.email}?subject=${encodeURIComponent(d.links.email_subject||"BlockPilot")}`;
  document.querySelectorAll("[data-cta='email']").forEach(a=>a.href=mail);
  document.querySelectorAll("[data-link='terms']").forEach(a=>a.href=d.links.terms||"#");
}

function computeBasePath(){
  const p=window.location.pathname;
  const m=p.match(/^(.*)\/(fr|en)\/?$/);
  if(m) return m[1]+"/";
  return p.endsWith("/") ? p : p+"/";
}

function setupLang(){
  const base=computeBasePath();
  const current=(window.location.pathname.match(/\/(fr|en)\/?$/)?.[1]) || "fr";
  localStorage.setItem("bp_lang", current);
  document.querySelectorAll("[data-lang]").forEach(b=>{
    const l=b.dataset.lang;
    b.classList.toggle("active", l===current);
    b.addEventListener("click",(e)=>{
      e.preventDefault();
      window.location.href = base + l + "/";
    });
  });
}

async function fetchJSON(url){
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw 0;
  return await r.json();
}

function pickChange(series, days){
  if(!series||series.length<2) return NaN;
  const last=series[series.length-1][1];
  const idx=Math.max(0, series.length-1-days);
  const base=series[idx][1];
  return (last-base)/(base||1);
}

function renderLine(series, targetId, label){
  const el=document.getElementById(targetId); if(!el) return;
  if(!series||series.length<2){ el.innerHTML=""; return; }
  const pts=series.slice(-240);
  const w=560,h=220,p=16;
  const vals=pts.map(x=>x[1]);
  const min=Math.min(...vals), max=Math.max(...vals);
  const xs=pts.map((_,i)=>p+(w-2*p)*(i/(pts.length-1||1)));
  const ys=vals.map(v=>h-p-(h-2*p)*((v-min)/(max-min||1)));
  const path=xs.map((x,i)=>(i?"L":"M")+x.toFixed(1)+","+ys[i].toFixed(1)).join(" ");
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="220" role="img" aria-label="${label}">
    <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}

async function loadMarketSeries(d, key){
  const vs=d.market.vs_currency||"eur";
  const days=d.market.days||365;

  if(key==="TOTAL"){
    const j=await fetchJSON(`https://api.coingecko.com/api/v3/global/market_cap_chart?vs_currency=${vs}&days=${days}`);
    const s=j.market_cap_chart || j.market_caps || j.market_cap_chart?.market_caps || [];
    return s.map(p=>[p[0],p[1]]).filter(p=>p[0]&&p[1]);
  }
  const id = d.market.coingecko_ids?.[key];
  if(!id) throw 0;
  const j=await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${vs}&days=${days}`);
  const s=j.prices || [];
  return s.map(p=>[p[0],p[1]]).filter(p=>p[0]&&p[1]);
}

async function marketModule(d, lang){
  const tabs=[...document.querySelectorAll("[data-market-tab]")];
  if(!tabs.length) return;

  const label30=document.getElementById("m-30");
  const label90=document.getElementById("m-90");
  const label1y=document.getElementById("m-1y");
  const note=document.getElementById("market-note");

  let fallback=null;
  try{ fallback=await fetchJSON("../data/market.json"); }catch(e){ fallback=null; }

  async function setActive(key){
    tabs.forEach(t=>t.classList.toggle("active",t.dataset.marketTab===key));
    tabs.forEach(t=>t.setAttribute("type","button")); // anti-reload même si un <form> traîne

    try{
      const series=await loadMarketSeries(d,key);
      label30.textContent=fmtPct(pickChange(series,30));
      label90.textContent=fmtPct(pickChange(series,90));
      label1y.textContent=fmtPct(pickChange(series,365));
      renderLine(series,"market-chart", key==="TOTAL" ? "Crypto market cap" : `${key} price`);
      note.textContent = (lang==="en"
        ? (key==="TOTAL" ? "Market context (public). Your results depend on your allocation." : "Price context (public).")
        : (key==="TOTAL" ? "Contexte marché (public). Vos résultats dépendent de votre allocation." : "Contexte de prix (public)."));
    }catch(e){
      const series=fallback?.series?.[key] || [];
      label30.textContent="—"; label90.textContent="—"; label1y.textContent="—";
      renderLine(series,"market-chart","Market");
      note.textContent = (lang==="en" ? "Market feed unavailable right now." : "Flux marché indisponible pour le moment.");
    }
  }

  tabs.forEach(t=>t.addEventListener("click",(e)=>{e.preventDefault(); setActive(t.dataset.marketTab);}));
  setActive("TOTAL");
}

function renderYields(d,lang){
  const el=document.getElementById("yield-cards"); if(!el) return;
  const avg=lang==="en"?"current average":"moyenne actuelle";
  const items=[["STABLE",lang==="en"?"Stablecoins":"Stable"],["BTC","BTC"],["ETH","ETH"],["BNB","BNB"]];
  el.innerHTML=items.map(([k,label])=>`
    <div class="card">
      <div class="small">${label} — ${avg}</div>
      <div class="kpi"><div class="value mono">${Math.round(d.yields_avg[k]*100)}%</div><div class="label">APR</div></div>
    </div>`).join("");
}

async function getPricesEUR(d){
  const cacheKey="bp_prices_eur_v1";
  const cached=localStorage.getItem(cacheKey);
  if(cached){
    try{
      const j=JSON.parse(cached);
      if(Date.now()-j.t < 10*60*1000) return j.v;
    }catch(e){}
  }
  const ids=[d.market.coingecko_ids.BTC, d.market.coingecko_ids.ETH, d.market.coingecko_ids.BNB].join(",");
  const vs=d.market.vs_currency||"eur";
  const j=await fetchJSON(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${vs}`);
  const v={
    BTC: j[d.market.coingecko_ids.BTC]?.[vs],
    ETH: j[d.market.coingecko_ids.ETH]?.[vs],
    BNB: j[d.market.coingecko_ids.BNB]?.[vs],
  };
  localStorage.setItem(cacheKey, JSON.stringify({t:Date.now(), v}));
  return v;
}

function renderCalculator(d,lang){
  const amount=document.getElementById("calc-amount");
  const asset=document.getElementById("calc-asset");
  if(!amount||!asset) return;

  amount.value=Number(d.calculator_default_amount||50000);

  const labels = lang==="en"
    ? {STABLE:"Stablecoins",BTC:"BTC",ETH:"ETH",BNB:"BNB"}
    : {STABLE:"Stable",BTC:"BTC",ETH:"ETH",BNB:"BNB"};
  asset.innerHTML=Object.keys(d.yields_avg).map(k=>`<option value="${k}">${labels[k]||k}</option>`).join("");

  const outY=document.getElementById("out-yield");
  const outM=document.getElementById("out-monthly");
  const outC=document.getElementById("out-capital");
  const outHint=document.getElementById("out-hint");
  const chart=document.getElementById("calc-chart");

  function drawChart(vals){
    if(!chart) return;
    if(!vals||vals.length<2){ chart.innerHTML=""; return; }
    const w=560,h=140,p=14;
    const min=Math.min(...vals), max=Math.max(...vals);
    const xs=vals.map((_,i)=>p+(w-2*p)*(i/(vals.length-1||1)));
    const ys=vals.map(v=>h-p-(h-2*p)*((v-min)/(max-min||1)));
    const path=xs.map((x,i)=>(i?"L":"M")+x.toFixed(1)+","+ys[i].toFixed(1)).join(" ");
    chart.innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="140" role="img" aria-label="Compounding">
      <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
  }

  async function compute(){
    const eur=Math.max(0,Number(amount.value||0));
    const k=asset.value;
    const apr=Number(d.yields_avg[k]||0);
    const m=monthlyRate(apr);

    let principalAsset=null, priceEUR=null;

    if(k==="STABLE"){
      principalAsset=eur; priceEUR=1;
    }else{
      try{
        const prices=await getPricesEUR(d);
        priceEUR=prices[k];
        if(isFinite(priceEUR) && priceEUR>0) principalAsset = eur/priceEUR;
      }catch(e){}
    }

    let capAsset=principalAsset;
    const caps=[];
    if(isFinite(capAsset)){
      caps.push(capAsset);
      for(let i=0;i<12;i++){ capAsset*=1+m; caps.push(capAsset); }
    }

    const annualAsset = isFinite(principalAsset) ? principalAsset*apr : NaN;
    const monthlyAsset = isFinite(principalAsset) ? principalAsset*m : NaN;
    const cap12Asset = isFinite(caps?.[12]) ? caps[12] : NaN;

    const sym = (k==="STABLE") ? (lang==="en"?"EUR stable":"€ stable") : k;

    outY.textContent = isFinite(annualAsset) ? `${fmtNum(annualAsset, k==="BTC"?6:5)} ${sym}` : "—";
    outM.textContent = isFinite(monthlyAsset) ? `${fmtNum(monthlyAsset, k==="BTC"?6:5)} ${sym}` : "—";
    outC.textContent = isFinite(cap12Asset) ? `${fmtNum(cap12Asset, k==="BTC"?6:5)} ${sym}` : "—";

    if(isFinite(priceEUR) && isFinite(annualAsset)){
      const annualEUR = annualAsset*priceEUR;
      const monthlyEUR = monthlyAsset*priceEUR;
      const cap12EUR = cap12Asset*priceEUR;
      outHint.textContent = (lang==="en"
        ? `≈ ${fmtEUR(annualEUR)} / year · ≈ ${fmtEUR(monthlyEUR)} / month · ≈ ${fmtEUR(cap12EUR)} after 12m`
        : `≈ ${fmtEUR(annualEUR)} / an · ≈ ${fmtEUR(monthlyEUR)} / mois · ≈ ${fmtEUR(cap12EUR)} à 12 mois`);
    }else{
      outHint.textContent = (lang==="en"
        ? "Euro equivalence depends on live prices."
        : "L’équivalent en euros dépend des prix en temps réel.");
    }

    if(isFinite(principalAsset)) drawChart(caps);
    else drawChart([]);
  }

  amount.addEventListener("input", ()=>compute());
  asset.addEventListener("change", ()=>compute());
  compute();
}

function langFromDoc(){ return document.documentElement.getAttribute("lang") || "fr"; }

(async function init(){
  setupLang();
  const lang=langFromDoc();
  const d=await loadData();
  wireCTAs(d);
  renderYields(d,lang);
  renderCalculator(d,lang);
  await marketModule(d,lang);
})();
