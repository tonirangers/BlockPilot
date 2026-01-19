/* assets/main.js - BlockPilot Pro (Private Banking Logic) */
(async () => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const fmtNum = (v, max=2) => !isFinite(v) ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  
  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      menu: "Menu", close: "Fermer", 
      priceHint: (px, unit, scn) => `Prix réf : ~${px} $/${unit}.`,
      chartLabel: "Stratégie BlockPilot (Yield + Prix)",
      chartHold: "Holding Passif (Prix seul)"
    },
    en: {
      menu: "Menu", close: "Close",
      priceHint: (px, unit, scn) => `Ref price: ~$${px}/${unit}.`,
      chartLabel: "BlockPilot Strategy (Yield + Price)",
      chartHold: "Passive Holding (Price only)"
    }
  };
  const T = I18N[LANG] || I18N.fr;

  // --- DATA DEFAULTS ---
  let CFG = { yields: { stables:0.12, btc:0.04, eth:0.05, bnb:0.13, eur:0.04 } };
  let PRICES = { btc:96000, eth:3300, bnb:610, stables:1, eur:1.05 };
  
  // HYPOTHÈSES CONSERVATRICES (20% pour tout le monde pour crédibilité)
  const CAGR = { stables: 0, eur: 0, btc: 0.20, eth: 0.20, bnb: 0.20 };

  async function fetchJSON(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // --- UI UPDATERS ---
  function fillApr(yields) {
    const set=(id, v)=>{ const el=$(id); if (el) el.textContent=(Number(v||0)*100).toFixed(0)+"%"; };
    set("#aprStables", yields.stables);
    set("#aprBtc", yields.btc);
    set("#aprEth", yields.eth);
    set("#aprBnb", yields.bnb);
    set("#aprEur", yields.eur);
  }

  async function loadPricesUSD() {
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price");
      if(res.ok) {
        const data = await res.json();
        data.forEach(t => {
            if(t.symbol==="BTCUSDT") PRICES.btc = Number(t.price);
            if(t.symbol==="ETHUSDT") PRICES.eth = Number(t.price);
            if(t.symbol==="BNBUSDT") PRICES.bnb = Number(t.price);
            if(t.symbol==="EURUSDT") PRICES.eur = Number(t.price);
        });
      }
    } catch(e) { console.log("Price fetch failed, using defaults"); }
  }

  // --- CHART ENGINE ---
  let growthChart = null;
  function computeTokens(principalTokens, apr, years) {
    const n=12; const r=apr/n;
    return principalTokens*Math.pow(1+r, n*years);
  }

  function initChart(ctx) {
    if(!ctx) return null;
    if(window.growthChartInstance) window.growthChartInstance.destroy(); 
    
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: T.chartLabel,
            data: [],
            borderColor: '#3C756E',
            backgroundColor: 'rgba(60, 117, 110, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointRadius: 0, 
            pointHitRadius: 10
          },
          {
            label: T.chartHold,
            data: [],
            borderColor: '#94A3B8',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 20, color: '#64748B' } },
          tooltip: { 
            mode: 'index', intersect: false, 
            backgroundColor: '#0F172A', titleColor: '#94A3B8', bodyFont: { weight: 'bold' },
            callbacks: { label: (c) => ` ${c.dataset.label}: $${Math.round(c.raw).toLocaleString()}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
          y: { grid: { color: '#F1F5F9' }, ticks: { callback: (v)=> '$' + (v/1000).toFixed(0) + 'k', color: '#64748B' } }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
      }
    });
  }

  function updateChartData(chart, principalUSD, apr, priceScenario, duration, asset) {
    if(!chart) return;
    const labels = [];
    const dataBP = [];
    const dataHold = [];
    const startPrice = asset==="eur" ? PRICES.eur : (asset==="stables"?1:PRICES[asset]);
    const tokenAmount = principalUSD / startPrice;

    for(let y=0; y<=duration; y++) {
      labels.push(LANG==="fr" ? `Année ${y}` : `Year ${y}`);
      const projectedPrice = startPrice * Math.pow(1 + priceScenario, y);
      const valHold = tokenAmount * projectedPrice;
      const tokensWithYield = computeTokens(tokenAmount, apr, y);
      const valStrat = tokensWithYield * projectedPrice;
      dataHold.push(valHold);
      dataBP.push(valStrat);
    }
    chart.data.labels = labels;
    chart.data.datasets[0].data = dataBP;
    chart.data.datasets[1].data = dataHold;
    chart.update();
  }

  // --- MAIN LOGIC ---
  let durationYears = 3;

  function recalculateAll() {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const priceMeta=$("#priceMeta");

    const rawVal = (amount?.value ?? "").replace(/\s/g, "").replace(",", ".");
    const usdInput = rawVal ? Number(rawVal) : 0;
    const asset = assetSel?.value || "eth"; 
    const apr = Number(CFG.yields?.[asset] ?? 0);
    
    // Smart Scenario
    const scenario = CAGR[asset] || 0;
    const isStable = asset==="stables" || asset==="eur";

    // UI State
    $$("#durationChips .chip").forEach(c => c.classList.toggle("active", Number(c.dataset.duration)===durationYears));

    if (!usdInput) { 
        ["#val12Scn", "#resPrincipal", "#resMarket", "#resYield"].forEach(id=>{ const el=$(id); if(el) el.textContent="—"; });
        return; 
    }

    // --- MATHS (The "Invoice" Logic) ---
    const tokenPrice = asset==="eur" ? PRICES.eur : (asset==="stables"?1:PRICES[asset]);
    const principalTokens = usdInput / tokenPrice;
    
    // 1. Scenario Holding (Passive)
    const priceGrowthFactor = Math.pow(1+scenario, durationYears);
    const finalPrice = tokenPrice * priceGrowthFactor;
    const valPassive = principalTokens * finalPrice;
    
    // 2. Scenario BlockPilot (Yield)
    const finalTokens = computeTokens(principalTokens, apr, durationYears);
    const valTotal = finalTokens * finalPrice;

    // 3. Deltas
    const marketEffect = valPassive - usdInput;
    const yieldEffect = valTotal - valPassive;
    
    // --- DISPLAY ---
    const fmtUSD = (v) => new Intl.NumberFormat(undefined, { style:"currency", currency: "USD", maximumFractionDigits:0 }).format(v);
    
    const set=(id,t)=>{ const el=$(id); if(el) el.textContent=t; };
    set("#val12Scn", fmtUSD(valTotal));
    set("#resPrincipal", fmtUSD(usdInput));
    
    // Affichage conditionnel positif/négatif pour le marché
    const mkEl = $("#resMarket");
    if(mkEl) {
        const sign = marketEffect >= 0 ? "+" : "";
        mkEl.textContent = `${sign} ${fmtUSD(marketEffect)}`;
        mkEl.style.color = marketEffect >= 0 ? "#64748B" : "#EF4444";
    }

    set("#resYield", `+ ${fmtUSD(yieldEffect)}`);
    
    // --- FOOTNOTE (Legal/Disclaimer) ---
    if(priceMeta) {
        let unit = asset.toUpperCase();
        if(asset==="stables") unit="USDT";

        if (isStable) {
             priceMeta.textContent = "";
        } else {
             const growthTxt = LANG==="fr" ? `Hypothèse : +${(scenario*100).toFixed(0)}%/an (Conservateur).` : `Assumption: +${(scenario*100).toFixed(0)}%/yr (Conservative).`;
             priceMeta.textContent = `${T.priceHint(fmtNum(tokenPrice,0), unit, scenario)} ${growthTxt}`;
        }
    }

    if(growthChart) updateChartData(growthChart, usdInput, apr, scenario, durationYears, asset);
  }

  function initSimulator() {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const chartCanvas = $("#compoundChart");

    if(chartCanvas && window.Chart) growthChart = initChart(chartCanvas);

    // Initial Default Values
    if(amount && !amount.value) amount.value = "10000";
    if(assetSel) assetSel.value = "eth"; 

    // Event Listeners
    $$("#durationChips .chip").forEach(b => b.addEventListener("click", (e) => {
        durationYears=Number(b.dataset.duration);
        recalculateAll();
    }));
    amount?.addEventListener("input", recalculateAll);
    assetSel?.addEventListener("change", recalculateAll);

    // Render immediately with defaults
    fillApr(CFG.yields);
    recalculateAll();
  }

  function initSignature() {
    const btns=$$('[data-signature-view]');
    const frames={ sign: $("#signatureSign"), verify: $("#signatureVerify") };
    if(!btns.length) return;
    function setView(v) {
        btns.forEach(b => b.classList.toggle("active", b.dataset.signatureView===v));
        if(frames.sign) frames.sign.style.display = v==="sign" ? "block" : "none";
        if(frames.verify) frames.verify.style.display = v==="verify" ? "block" : "none";
        const lang = (localStorage.getItem("bp_lang")||"fr").includes("en") ? "en" : "fr";
        const f = frames[v];
        if(f && !f.getAttribute("src")) f.src = `../${v==="verify"?"verify":"sign"}.html?embed=1&lang=${lang}`;
    }
    btns.forEach(b => b.onclick=()=>setView(b.dataset.signatureView));
    setView("sign");
  }

  async function init() {
    // initSignature(); // <--- DÉSACTIVÉ ICI (COMMENTÉ)
    initSimulator(); 

    // Async Fetch updates (Background)
    const newCfg = await fetchJSON("../data/blockpilot.json");
    if(newCfg?.yields) {
        CFG.yields = { ...CFG.yields, ...newCfg.yields };
        fillApr(CFG.yields); 
        recalculateAll(); 
    }
    
    await loadPricesUSD(); // Fetch real prices
    recalculateAll(); 
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
