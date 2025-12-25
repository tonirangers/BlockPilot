const DEFAULTS={
  yields_avg:{BTC:0.02,ETH:0.04,STABLE:0.10,BNB:0.13},
  calculator_default_amount:50000,
  links:{call:"https://calendar.app.google/bQWcTHd22XDzuCt6A",email:"toni@blockpilot.capital",email_subject:"BlockPilot - Demande de call",terms:"../BPC_Terms.pdf"},
  market:{coingecko:{vs_currency:"usd",days:365,btc_id:"bitcoin",eth_id:"ethereum"},tradingview_symbols:{TOTAL:"CRYPTOCAP:TOTAL",BTC:"BINANCE:BTCUSDT",ETH:"BINANCE:ETHUSDT"}}
};
async function loadData(){
  try{
    const r=await fetch("../data/blockpilot.json",{cache:"no-store"});
    if(!r.ok) throw 0;
    const j=await r.json();
    return {...DEFAULTS,...j,
      links:{...DEFAULTS.links,...(j.links||{})},
      yields_avg:{...DEFAULTS.yields_avg,...(j.yields_avg||{})},
      market:{...DEFAULTS.market,...(j.market||{}),coingecko:{...DEFAULTS.market.coingecko,...(j.market?.coingecko||{})},tradingview_symbols:{...DEFAULTS.market.tradingview_symbols,...(j.market?.tradingview_symbols||{})}}
    };
  }catch(e){ return DEFAULTS; }
}
function fmtPct(p){if(!isFinite(p)) return "—"; const s=(p*100); return (s>=0?"+":"")+s.toFixed(1)+"%";}
function fmtMoney(x){if(!isFinite(x)) return "—"; const v=Math.round(x); return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g," ")+" €";}
function monthlyRate(apr){return Math.pow(1+apr,1/12)-1}
function wireCTAs(d){
  document.querySelectorAll("[data-cta='call']").forEach(a=>a.href=d.links.call);
  const mail=`mailto:${d.links.email}?subject=${encodeURIComponent(d.links.email_subject||"BlockPilot")}`;
  document.querySelectorAll("[data-cta='email']").forEach(a=>a.href=mail);
  document.querySelectorAll("[data-link='terms']").forEach(a=>a.href=d.links.terms);
}
function renderYields(d,lang){
  const el=document.getElementById("yield-cards"); if(!el) return;
  const avg=lang==="en"?"current average":"average actuel";
  const items=[["STABLE",lang==="en"?"Stablecoins":"Stable"],["BTC","BTC"],["ETH","ETH"],["BNB","BNB"]];
  el.innerHTML=items.map(([k,label])=>`
    <div class="card kpi">
      <div class="label">${label} — ${avg}</div>
      <div class="value">${(d.yields_avg[k]*100).toFixed(0)}%</div>
      <div class="small">APR</div>
    </div>`).join("");
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
  const outA=document.getElementById("out-annual"), outM=document.getElementById("out-monthly"), outC=document.getElementById("out-capital");
  const chart=document.getElementById("calc-chart");
  function draw(){
    const amt=Math.max(0,Number(amount.value||0));
    const k=asset.value, apr=Number(d.yields_avg[k]||0), m=monthlyRate(apr);
    const annual=amt*apr, monthly=amt*m;
    let cap=amt; const pts=[cap];
    for(let i=0;i<12;i++){cap*=1+m; pts.push(cap);}
    outA.textContent=fmtMoney(annual); outM.textContent=fmtMoney(monthly); outC.textContent=fmtMoney(pts[12]);
    if(chart){
      const w=560,h=140,p=14;
      const min=Math.min(...pts), max=Math.max(...pts);
      const xs=pts.map((_,i)=>p+(w-2*p)*(i/(pts.length-1||1)));
      const ys=pts.map(v=>h-p-(h-2*p)*((v-min)/(max-min||1)));
      const path=xs.map((x,i)=>(i?"L":"M")+x.toFixed(1)+","+ys[i].toFixed(1)).join(" ");
      chart.innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="140" role="img" aria-label="Yield simulation">
        <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
      </svg>`;
    }
  }
  amount.addEventListener("input", draw);
  asset.addEventListener("change", draw);
  draw();
}
async function fetchJSON(u){const r=await fetch(u,{cache:"no-store"}); if(!r.ok) throw 0; return await r.json();}
function pickChange(series, days){
  if(!series||series.length<2) return NaN;
  const last=series[series.length-1][1];
  const target=series[Math.max(0,series.length-1-days)][1];
  return (last-target)/(target||1);
}
function renderInlineChart(series){
  const el=document.getElementById("market-chart"); if(!el) return;
  const pts=series.slice(-180);
  const w=560,h=220,p=16;
  const vals=pts.map(x=>x[1]);
  const min=Math.min(...vals), max=Math.max(...vals);
  const xs=pts.map((_,i)=>p+(w-2*p)*(i/(pts.length-1||1)));
  const ys=vals.map(v=>h-p-(h-2*p)*((v-min)/(max-min||1)));
  const path=xs.map((x,i)=>(i?"L":"M")+x.toFixed(1)+","+ys[i].toFixed(1)).join(" ");
  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="220" role="img" aria-label="Market chart">
    <path d="${path}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linecap="round"/>
  </svg>`;
}
function tvEmbed(symbol){
  const el=document.getElementById("market-chart"); if(!el) return;
  el.innerHTML="";
  const s=document.createElement("script");
  s.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  s.async=true;
  s.innerHTML=JSON.stringify({autosize:true,symbol,interval:"D",timezone:"Etc/UTC",theme:"light",style:"1",locale:"en",hide_top_toolbar:true,allow_symbol_change:false});
  el.appendChild(s);
}
async function marketModule(d, lang){
  const tabs=[...document.querySelectorAll("[data-market-tab]")];
  if(!tabs.length) return;
  const label30=document.getElementById("m-30");
  const label90=document.getElementById("m-90");
  const label1y=document.getElementById("m-1y");
  const note=document.getElementById("market-note");
  async function loadSeries(key){
    if(key==="TOTAL"){
      const j=await fetchJSON(`https://api.coingecko.com/api/v3/global/market_cap_chart?vs_currency=${d.market.coingecko.vs_currency}&days=${d.market.coingecko.days}`);
      const s=j.market_cap_chart || j.market_caps || j.market_cap_chart?.market_caps || [];
      return s.map(p=>[p[0],p[1]]).filter(p=>p[0]&&p[1]);
    }
    const id = key==="BTC" ? d.market.coingecko.btc_id : d.market.coingecko.eth_id;
    const j=await fetchJSON(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=${d.market.coingecko.vs_currency}&days=${d.market.coingecko.days}`);
    const s=j.prices || [];
    return s.map(p=>[p[0],p[1]]).filter(p=>p[0]&&p[1]);
  }
  async function setActive(key){
    tabs.forEach(t=>t.classList.toggle("active",t.dataset.marketTab===key));
    try{
      const series=await loadSeries(key);
      label30.textContent=fmtPct(pickChange(series,30));
      label90.textContent=fmtPct(pickChange(series,90));
      label1y.textContent=fmtPct(pickChange(series,365));
      renderInlineChart(series);
      if(note) note.textContent = (lang==="en"
          ? (key==="TOTAL" ? "Total crypto market cap (includes stablecoins). Context only." : "Price context (public).")
          : (key==="TOTAL" ? "Market cap totale crypto (inclut stablecoins). Contexte uniquement." : "Contexte de prix (public)."));
    }catch(e){
      if(note) note.textContent = (lang==="en" ? "Market data fetch failed; using TradingView fallback." : "Échec de récupération des données; fallback TradingView.");
      if(key==="TOTAL") tvEmbed(d.market.tradingview_symbols.TOTAL);
      if(key==="BTC") tvEmbed(d.market.tradingview_symbols.BTC);
      if(key==="ETH") tvEmbed(d.market.tradingview_symbols.ETH);
      label30.textContent="—"; label90.textContent="—"; label1y.textContent="—";
    }
  }
  tabs.forEach(t=>t.addEventListener("click",()=>setActive(t.dataset.marketTab)));
  setActive("TOTAL");
}
function getLang(){return localStorage.getItem("bp_lang") || document.documentElement.dataset.lang || "fr";}
function setLang(l){localStorage.setItem("bp_lang",l);}
function setupLang(){
  const lang=getLang();
  document.querySelectorAll("[data-lang]").forEach(b=>{
    b.classList.toggle("active",b.dataset.lang===lang);
    b.addEventListener("click",()=>{
      const l=b.dataset.lang; setLang(l);
      window.location.href = l==="en" ? "../en/" : "../fr/";
    });
  });
}
(async function init(){
  const lang=getLang();
  setupLang();
  const d=await loadData();
  wireCTAs(d);
  renderYields(d, lang);
  renderCalculator(d, lang);
  await marketModule(d, lang);
})();