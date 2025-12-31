/* assets/main.js - BlockPilot Pro (Robust Instant Load) */
(async () => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const fmtNum = (v, max=2) => !isFinite(v) ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  
  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      menu: "Menu", close: "Fermer", 
      priceHint: (px, unit, scn) => `Prix réf : ~${px} $/${unit}. Hypothèse : +${(scn*100).toFixed(0)}%/an (Moyenne historique).`,
      chartLabel: "Stratégie BlockPilot (Yield + Prix)",
      chartHold: "Holding Passif (Prix seul)"
    },
    en: {
      menu: "Menu", close: "Close",
      priceHint: (px, unit, scn) => `Ref price: ~$${px}/${unit}. Assumption: +${(scn*100).toFixed(0)}%/yr (Historical avg).`,
      chartLabel: "BlockPilot Strategy (Yield + Price)",
      chartHold: "Passive Holding (Price only)"
    }
  };
  const T = I18N[LANG] || I18N.fr;

  // --- DATA DEFAULTS (Hardcoded for instant render) ---
  let CFG = { yields: { stables:0.12, btc:0.04, eth:0.05, bnb:0.13, eur:0.04 } };
  let PRICES = { btc:96000, eth:3300, bnb:610, stables:1, eur:1.05 };
  
  const CAGR = { stables: 0, eur: 0, btc: 0.45, eth: 0.55, bnb: 0.40 };

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
    if(window.growthChartInstance) window.growthChartInstance.destroy(); // Safety cleanup
    
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
    const scenarioWrap=$("#priceScenarios");
    const stableNote=$("#stableScenarioNote");
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
    
    if(scenarioWrap) {
        if(isStable) {
            scenarioWrap.innerHTML = `<span class="chip active" style="cursor:default; opacity:0.8;">${LANG==="fr"?"Prix Fixe":"Fixed Price"}</span>`;
            if(stableNote) stableNote.style.display="none";
        } else {
            const txt = `+${(scenario*100).toFixed(0)}%/an (Avg)`;
            scenarioWrap.innerHTML = `<span class="chip active" style="cursor:default; border-color:var(--bp-primary); color:var(--bp-primary); background:var(--bp-primary-soft);">${txt}</span>`;
            if(stableNote) stableNote.style.display="none";
        }
    }

    if (!usdInput) { 
        $$(".sim-val").forEach(e=>e.textContent="—"); 
        ["#val12Scn", "#gainText", "#tokenGainText"].forEach(id=>{ const el=$(id); if(el) el.textContent=""; });
        return; 
    }

    // Maths
    const tokenPrice = asset==="eur" ? PRICES.eur : (asset==="stables"?1:PRICES[asset]);
    const principalTokens = usdInput / tokenPrice;
    const finalTokens = computeTokens(principalTokens, apr, durationYears);
    const gainedTokens = finalTokens - principalTokens;
    const priceGrowth = Math.pow(1+scenario, durationYears);
    const finalPrice = tokenPrice * priceGrowth;
    const finalDollars = finalTokens * finalPrice;
    const gainDollars = finalDollars - usdInput;

    // Text Updates
    const fmtUSD = (v) => new Intl.NumberFormat(undefined, { style:"currency", currency: "USD", maximumFractionDigits:0 }).format(v);
    const fmtTok = (v) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(v);
    
    const set=(id,t)=>{ const el=$(id); if(el) el.textContent=t; };
    set("#val12Scn", fmtUSD(finalDollars));
    
    const gainEl = $("#gainText");
    if(gainEl) {
        const profitLabel = LANG==="fr" ? "de profit total" : "total profit";
        gainEl.textContent = `+ ${fmtUSD(gainDollars)} ${profitLabel}`;
        gainEl.style.color = "#3C756E"; 
    }

    const tokenGainEl = $("#tokenGainText");
    let unit = asset.toUpperCase();
    if(asset==="stables") unit="USDT";
    
    if(tokenGainEl) {
        if(!isStable) {
            tokenGainEl.style.display = "block";
            const txt = LANG==="fr" ? `dont + ${fmtTok(gainedTokens)} ${unit} générés par BlockPilot` : `incl. + ${fmtTok(gainedTokens)} ${unit} generated by BlockPilot`;
            tokenGainEl.textContent = txt;
        } else {
            tokenGainEl.style.display = "none";
        }
    }
    
    if(priceMeta) priceMeta.textContent = isStable ? "" : T.priceHint(fmtNum(tokenPrice,0), unit, scenario);

    if(growthChart) updateChartData(growthChart, usdInput, apr, scenario, durationYears, asset);
  }

  function initSimulator() {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const chartCanvas = $("#compoundChart");

    if(chartCanvas && window.Chart) growthChart = initChart(chartCanvas);

    // Initial Default Values
    if(amount && !amount.value) amount.value = "10000";
    if(assetSel) assetSel.value = "eth"; // Force ETH Default

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

  function initMobileMenu() {
    const t=$("#navToggle"); // Le bouton est maintenant géré par header.js mais on garde une sécurité
    // Le vrai initMenu est dans header.js, mais si main.js charge après, on s'assure qu'il ne casse rien
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
    // initMobileMenu(); // Désactivé ici car géré par header.js pour éviter les conflits
    initSignature();
    initSimulator(); // Render UI immediately with hardcoded defaults

    // Async Fetch updates (Background)
    const newCfg = await fetchJSON("../data/blockpilot.json");
    if(newCfg?.yields) {
        CFG.yields = { ...CFG.yields, ...newCfg.yields };
        fillApr(CFG.yields); // Update Yield cards
        recalculateAll(); // Update Sim
    }
    
    await loadPricesUSD(); // Fetch real prices
    recalculateAll(); // Update Sim with real prices
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
