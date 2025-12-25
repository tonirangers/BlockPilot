// assets/main.js
const $=s=>document.querySelector(s);
const $$=s=>Array.from(document.querySelectorAll(s));
const fmt=(n,dp=2)=>Number.isFinite(n)?n.toLocaleString(undefined,{maximumFractionDigits:dp,minimumFractionDigits:dp}):"—";
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

const DEFAULT_CFG={
  brand:{name:"BlockPilot"},
  links:{book_call:"https://calendar.app.google/bQWcTHd22XDzuCt6A",email:"toni@blockpilot.capital",email_subject_fr:"BlockPilot — Demande d'information",email_subject_en:"BlockPilot — Inquiry",terms_pdf:"../BPC_Terms.pdf",docs_url:""},
  yields:{stable:.10,btc:.02,eth:.04,bnb:.13},
  assets:{
    stable:{label_fr:"Stable",label_en:"Stable",coingecko_id:null},
    btc:{label_fr:"BTC",label_en:"BTC",coingecko_id:"bitcoin"},
    eth:{label_fr:"ETH",label_en:"ETH",coingecko_id:"ethereum"},
    bnb:{label_fr:"BNB",label_en:"BNB",coingecko_id:"binancecoin"}
  },
  calculator:{default_amount_eur:10000,default_asset:"eth",price_scenarios:[
    {id:"flat",label_fr:"Prix constant",label_en:"Flat price",annual_rate:0},
    {id:"bull20",label_fr:"Prix +20%/an",label_en:"+20%/yr",annual_rate:.2},
    {id:"bull50",label_fr:"Prix +50%/an",label_en:"+50%/yr",annual_rate:.5}
  ]}
};

async function loadCfg(){
  try{
    const r=await fetch("../data/blockpilot.json",{cache:"no-store"});
    if(!r.ok) throw 0;
    const j=await r.json();
    return {...DEFAULT_CFG,...j,links:{...DEFAULT_CFG.links,...(j.links||{})},yields:{...DEFAULT_CFG.yields,...(j.yields||{})},assets:{...DEFAULT_CFG.assets,...(j.assets||{})},calculator:{...DEFAULT_CFG.calculator,...(j.calculator||{})}};
  }catch(e){return DEFAULT_CFG;}
}

function toast(msg){
  const t=$("#toast"); if(!t) return;
  t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1400);
}

function mailto(email,subject){
  const s=encodeURIComponent(subject||"");
  return `mailto:${email}?subject=${s}`;
}

function setNavLinks(cfg,lang){
  const aCall=$("#nav-book-call"); if(aCall) aCall.href=cfg.links.book_call||"#";
  const aDocs=$("#nav-docs"); 
  if(aDocs){
    const u=(cfg.links.docs_url||"").trim();
    if(!u){aDocs.href="#";aDocs.setAttribute("aria-disabled","true");aDocs.addEventListener("click",e=>{e.preventDefault();toast(lang==="fr"?"Docs bientôt.":"Docs soon.");});}
    else{aDocs.removeAttribute("aria-disabled");aDocs.href=u;}
  }
  const fDocs=$("#footer-docs");
  if(fDocs){
    const u=(cfg.links.docs_url||"").trim();
    if(!u){fDocs.style.display="none";}
    else{fDocs.style.display="inline"; fDocs.href=u;}
  }
  const t=$("#footer-terms"); if(t) t.href=cfg.links.terms_pdf||"../BPC_Terms.pdf";
  const e=$("#hero-email"); if(e) e.href=mailto(cfg.links.email,lang==="fr"?cfg.links.email_subject_fr:cfg.links.email_subject_en);
  const e2=$("#footer-email"); if(e2) e2.href=mailto(cfg.links.email,lang==="fr"?cfg.links.email_subject_fr:cfg.links.email_subject_en);
  const c=$("#hero-call"); if(c) c.href=cfg.links.book_call||"#";
  const c2=$("#footer-call"); if(c2) c2.href=cfg.links.book_call||"#";
}

function setLangActive(lang){
  const fr=$("#lang-fr"), en=$("#lang-en");
  if(fr){fr.classList.toggle("active",lang==="fr"); fr.setAttribute("aria-pressed",lang==="fr");}
  if(en){en.classList.toggle("active",lang==="en"); en.setAttribute("aria-pressed",lang==="en");}
}

function smoothAnchors(){
  $$('a[href^="#"]').forEach(a=>{
    a.addEventListener("click",e=>{
      const id=a.getAttribute("href");
      if(!id || id==="#" ) return;
      const el=$(id);
      if(!el) return;
      e.preventDefault();
      el.scrollIntoView({behavior:"smooth",block:"start"});
      history.replaceState(null,"",id);
    });
  });
}

function svgSparkline(values,w=520,h=110,pad=8){
  if(!values || values.length<2) return "";
  const xs=values.map((_,i)=>i);
  const minY=Math.min(...values), maxY=Math.max(...values);
  const span=maxY-minY || 1;
  const x=(i)=>pad+(i/(values.length-1))*(w-2*pad);
  const y=(v)=>pad+(1-(v-minY)/span)*(h-2*pad);
  let d=`M ${x(0)} ${y(values[0])}`;
  for(let i=1;i<values.length;i++) d+=` L ${x(i)} ${y(values[i])}`;
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="rgba(11,107,99,.95)" stroke-width="3" stroke-linecap="round"/>
    <path d="${d} L ${x(values.length-1)} ${h-pad} L ${x(0)} ${h-pad} Z" fill="rgba(11,107,99,.08)"/>
  </svg>`;
}

function pct(a,b){return b===0?0:(a/b-1);}

async function loadMarketFallback(){
  try{
    const r=await fetch("../data/market.json",{cache:"no-store"});
    if(!r.ok) throw 0;
    return await r.json();
  }catch(e){return null;}
}

async function fetchCoinGeckoMarketChart(id,days=365){
  const url=`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw 0;
  const j=await r.json();
  return (j.prices||[]).map(p=>({t:p[0],v:p[1]}));
}

async function fetchCoinGeckoTotalMcap(days=365){
  const url=`https://api.coingecko.com/api/v3/global/market_cap_chart?vs_currency=usd&days=${days}`;
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw 0;
  const j=await r.json();
  const arr=(j.market_cap_chart||j.market_caps||[]); // handle variants
  return (arr||[]).map(p=>({t:p[0],v:p[1]}));
}

function nearestIdxByDays(series,days){
  if(!series || series.length<2) return null;
  const last=series[series.length-1].t;
  const target=last - days*86400*1000;
  let best=0, bestd=Infinity;
  for(let i=0;i<series.length;i++){
    const d=Math.abs(series[i].t-target);
    if(d<bestd){bestd=d;best=i;}
  }
  return best;
}

function renderMarket(series,lang){
  const k30=$("#kpi-30"), k90=$("#kpi-90"), k365=$("#kpi-365"), box=$("#market-chart");
  if(!box) return;
  const vals=(series||[]).map(x=>x.v).filter(Number.isFinite);
  box.innerHTML=vals.length>=2?svgSparkline(vals.slice(-240)):"";
  const last=series && series.length?series[series.length-1].v:null;
  const i30=nearestIdxByDays(series,30), i90=nearestIdxByDays(series,90), i365=nearestIdxByDays(series,365);
  const r30=(i30!=null && last!=null)?pct(last,series[i30].v):null;
  const r90=(i90!=null && last!=null)?pct(last,series[i90].v):null;
  const r365=(i365!=null && last!=null)?pct(last,series[i365].v):null;

  const fmtPct=v=>v==null?"—":`${(v*100).toFixed(1)}%`;
  if(k30) k30.textContent=fmtPct(r30);
  if(k90) k90.textContent=fmtPct(r90);
  if(k365) k365.textContent=fmtPct(r365);

  const note=$("#market-note");
  if(note){
    if(vals.length<2) note.textContent=lang==="fr"?"Données marché indisponibles (affichage minimal).":"Market data unavailable (minimal view).";
    else note.textContent="";
  }
}

async function initMarket(cfg,lang){
  const tabBtns=$$(".tabbtn[data-market]");
  const fallback=await loadMarketFallback();

  async function load(kind){
    try{
      if(kind==="btc") return await fetchCoinGeckoMarketChart("bitcoin",365);
      if(kind==="eth") return await fetchCoinGeckoMarketChart("ethereum",365);
      if(kind==="total") return await fetchCoinGeckoTotalMcap(365);
      return null;
    }catch(e){
      if(fallback && fallback[kind] && Array.isArray(fallback[kind])) return fallback[kind].map(p=>({t:p[0],v:p[1]}));
      return null;
    }
  }

  let current="total";
  async function setTab(kind){
    current=kind;
    tabBtns.forEach(b=>b.classList.toggle("active",b.dataset.market===kind));
    const s=await load(kind);
    renderMarket(s||[],lang);
  }

  tabBtns.forEach(b=>{
    b.setAttribute("type","button");
    b.addEventListener("click",e=>{e.preventDefault();setTab(b.dataset.market);});
  });

  await setTab(current);
}

async function fetchPricesEUR(){
  const url="https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=eur";
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok) throw 0;
  const j=await r.json();
  return {
    btc: j.bitcoin?.eur||null,
    eth: j.ethereum?.eur||null,
    bnb: j.binancecoin?.eur||null,
    stable: 1
  };
}

function pow1p(r,n){return Math.pow(1+r,n);}

function renderCalc(cfg,lang,prices){
  const amountEl=$("#amount-eur"), assetEl=$("#asset"), outAnnual=$("#out-annual"), outMonthly=$("#out-monthly"), outCap=$("#out-cap"), outHint=$("#out-hint");
  const modeBtns=$$(".toggle[data-mode]"), scenBtns=$$(".toggle[data-scen]");
  if(!amountEl||!assetEl||!outAnnual||!outMonthly||!outCap) return;

  const scens=cfg.calculator.price_scenarios||[];
  let mode="compound";
  let scen=scens[0]?.id||"flat";

  function labelScenario(id){
    const s=scens.find(x=>x.id===id);
    if(!s) return id;
    return lang==="fr"?s.label_fr:s.label_en;
  }
  function rateScenario(id){
    const s=scens.find(x=>x.id===id);
    return s?Number(s.annual_rate||0):0;
  }

  function updateToggles(){
    modeBtns.forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));
    scenBtns.forEach(b=>b.classList.toggle("active",b.dataset.scen===scen));
  }

  function calc(){
    const eur=clamp(Number(String(amountEl.value||"").replace(",","."))||0,0,1e12);
    const a=assetEl.value;
    const apr=cfg.yields[a]||0;
    const p=prices[a]||null;
    const token=(a==="stable")?eur:(p?eur/p:0);
    const m=apr/12;
    const months12=12, months36=36, months60=60;

    const token12 = mode==="compound" ? token*pow1p(m,months12) : token;
    const token36 = mode==="compound" ? token*pow1p(m,months36) : token;
    const token60 = mode==="compound" ? token*pow1p(m,months60) : token;

    const yMonthly = token*apr/12;
    const yAnnual = token*apr;

    outMonthly.textContent = `${fmt(yMonthly,5)} ${a.toUpperCase()}`;
    outAnnual.textContent = `${fmt(yAnnual,5)} ${a.toUpperCase()}`;
    outCap.textContent = `${fmt(token12,5)} ${a.toUpperCase()}`;

    const g=rateScenario(scen);
    const eur12 = token12 * (a==="stable"?1:(p||0)) * pow1p(g,1);
    const eur36 = token36 * (a==="stable"?1:(p||0)) * pow1p(g,3);
    const eur60 = token60 * (a==="stable"?1:(p||0)) * pow1p(g,5);

    const eur12Flat = token12 * (a==="stable"?1:(p||0));
    const eurMFlat = yMonthly * (a==="stable"?1:(p||0));
    const eurAFlat = yAnnual * (a==="stable"?1:(p||0));

    if(outHint){
      if(!p && a!=="stable") outHint.textContent=lang==="fr"?"≈ prix indisponible":"≈ price unavailable";
      else{
        const scLabel=labelScenario(scen);
        const line1=lang==="fr"
          ? `≈ ${fmt(eurAFlat,0)} € / an · ≈ ${fmt(eurMFlat,0)} € / mois · ≈ ${fmt(eur12Flat,0)} € à 12 mois (prix constant)`
          : `≈ €${fmt(eurAFlat,0)} / yr · ≈ €${fmt(eurMFlat,0)} / mo · ≈ €${fmt(eur12Flat,0)} at 12m (flat price)`;
        const line2=lang==="fr"
          ? `Scénario prix: ${scLabel} → ≈ ${fmt(eur12,0)} € (12m), ≈ ${fmt(eur36,0)} € (3a), ≈ ${fmt(eur60,0)} € (5a)`
          : `Price scenario: ${scLabel} → ≈ €${fmt(eur12,0)} (12m), ≈ €${fmt(eur36,0)} (3y), ≈ €${fmt(eur60,0)} (5y)`;
        outHint.textContent = `${line1}\n${line2}`;
      }
    }

    const box=$("#compound-box");
    if(box){
      const tok=(x)=>`${fmt(x,5)} ${a.toUpperCase()}`;
      const eurf=(x)=>a==="stable"?`${fmt(x,0)} €`:`${fmt(x,0)} €`;
      box.querySelector('[data-h="12"] .b').textContent = tok(token12);
      box.querySelector('[data-h="12"] .s').textContent = (p||a==="stable")?eurf(eur12):"—";
      box.querySelector('[data-h="36"] .b').textContent = tok(token36);
      box.querySelector('[data-h="36"] .s').textContent = (p||a==="stable")?eurf(eur36):"—";
      box.querySelector('[data-h="60"] .b').textContent = tok(token60);
      box.querySelector('[data-h="60"] .s').textContent = (p||a==="stable")?eurf(eur60):"—";
      const head=box.querySelector(".head");
      if(head) head.textContent = lang==="fr"
        ? `Effet composé (tokens) + scénario prix (${labelScenario(scen)})`
        : `Compounding effect (tokens) + price scenario (${labelScenario(scen)})`;
    }
    const modeLbl=$("#mode-label");
    if(modeLbl) modeLbl.textContent = lang==="fr"
      ? (mode==="compound"?"Mode: Capitaliser (réinvestir le yield)":"Mode: Encaisser (revenu mensuel)")
      : (mode==="compound"?"Mode: Compound (reinvest yield)":"Mode: Payout (monthly income)");
  }

  modeBtns.forEach(b=>{
    b.addEventListener("click",e=>{e.preventDefault();mode=b.dataset.mode;updateToggles();calc();});
  });
  scenBtns.forEach(b=>{
    b.addEventListener("click",e=>{e.preventDefault();scen=b.dataset.scen;updateToggles();calc();});
  });

  amountEl.addEventListener("input",calc);
  assetEl.addEventListener("change",calc);

  updateToggles();
  calc();
}

async function init(){
  const lang=document.documentElement.getAttribute("lang")==="en"?"en":"fr";
  const cfg=await loadCfg();

  setLangActive(lang);
  setNavLinks(cfg,lang);
  smoothAnchors();

  const fr=$("#lang-fr"), en=$("#lang-en");
  if(fr) fr.addEventListener("click",()=>localStorage.setItem("bp_lang","fr"));
  if(en) en.addEventListener("click",()=>localStorage.setItem("bp_lang","en"));

  const prefer=localStorage.getItem("bp_lang");
  if(prefer && prefer!==lang){
    // soft: do nothing auto (avoid surprise redirect), user can click toggle
  }

  await initMarket(cfg,lang);

  let prices=null;
  try{prices=await fetchPricesEUR();}catch(e){prices={btc:null,eth:null,bnb:null,stable:1};}
  renderCalc(cfg,lang,prices);

  // Populate asset select labels
  const sel=$("#asset");
  if(sel){
    const a=cfg.assets;
    const map={stable:a.stable,btc:a.btc,eth:a.eth,bnb:a.bnb};
    sel.innerHTML="";
    ["stable","btc","eth","bnb"].forEach(k=>{
      const o=document.createElement("option");
      o.value=k;
      o.textContent=lang==="fr"?(map[k].label_fr):(map[k].label_en);
      sel.appendChild(o);
    });
    sel.value=cfg.calculator.default_asset||"eth";
  }
  const amount=$("#amount-eur");
  if(amount) amount.value=cfg.calculator.default_amount_eur||10000;

  // Scenario buttons text (lang)
  const scens=cfg.calculator.price_scenarios||[];
  scens.forEach(s=>{
    const b=$(`.toggle[data-scen="${s.id}"]`);
    if(b) b.textContent = lang==="fr"?s.label_fr:s.label_en;
  });
}

document.addEventListener("DOMContentLoaded",init);
