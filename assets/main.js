/* assets/main.js - BlockPilot Pro (V2 w/ Chart) */
(async () => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const fmtNum = (v, max=2) => !isFinite(v) ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  
  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      menu: "Menu", close: "Fermer", 
      priceHint: (px, unit, scn) => `Prix réf : ~${px} $/${unit}. Scénario : ${scn ? "+" + (scn*100).toFixed(0) + "%" : "stable"}.`,
      chartLabel: "Stratégie BlockPilot (Yield + Prix)",
      chartHold: "Holding simple (Prix seul)"
    },
    en: {
      menu: "Menu", close: "Close",
      priceHint: (px, unit, scn) => `Ref price: ~$${px}/${unit}. Scenario: ${scn ? "+" + (scn*100).toFixed(0) + "%" : "stable"}.`,
      chartLabel: "BlockPilot Strategy (Yield + Price)",
      chartHold: "Simple Holding (Price only)"
    }
  };
  const T = I18N[LANG] || I18N.fr;

  async function fetchJSON(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // --- CALC ---
  function computeTokens(principalTokens, apr, years) {
    // Composition mensuelle pour être précis
    const n=12; const r=apr/n;
    return principalTokens*Math.pow(1+r, n*years);
  }

  function fillApr(cfg) {
    const yields = { stables:0.12, btc:0.04, eth:0.05, bnb:0.13, eur:0.04, ...(cfg?.yields||{}) };
    const set=(id, v)=>{ const el=$(id); if (el) el.textContent=(Number(v||0)*100).toFixed(0)+"%"; };
    set("#aprStables", yields.stables);
    set("#aprBtc", yields.btc);
    set("#aprEth", yields.eth);
    set("#aprBnb", yields.bnb);
    set("#aprEur", yields.eur);
    return yields;
  }

  async function loadPricesUSD() {
    const prices={ btc:96000, eth:3300, bnb:610, stables:1, eur:1.05 };
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price");
      if(res.ok) {
        const data = await res.json();
        data.forEach(t => {
            if(t.symbol==="BTCUSDT") prices.btc = Number(t.price);
            if(t.symbol==="ETHUSDT") prices.eth = Number(t.price);
            if(t.symbol==="BNBUSDT") prices.bnb = Number(t.price);
            if(t.symbol==="EURUSDT") prices.eur = Number(t.price);
        });
      }
    } catch(e) {}
    return prices;
  }

  // --- CHART ENGINE ---
  let growthChart = null;
  
  function initChart(ctx) {
    if(!ctx) return null;
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: T.chartLabel,
            data: [],
            borderColor: '#3C756E', // Brand Primary
            backgroundColor: 'rgba(60, 117, 110, 0.1)',
            borderWidth: 3,
            tension: 0.4, // Courbe lisse
            fill: true,
            pointRadius: 0, // Clean look
            pointHitRadius: 10
          },
          {
            label: T.chartHold,
            data: [],
            borderColor: '#CBD5E1', // Slate 300
            borderWidth: 2,
            borderDash: [5, 5], // Pointillés pour le benchmark
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
          legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
          tooltip: { 
            mode: 'index', intersect: false, 
            callbacks: { label: (c) => ` ${c.dataset.label}: $${Math.round(c.raw).toLocaleString()}` }
          }
        },
        scales: {
          x: { grid: { display: false } }, // Moins de bruit
          y: { grid: { color: '#F1F5F9' }, ticks: { callback: (v)=> '$' + (v/1000).toFixed(0) + 'k' } }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
      }
    });
  }

  function updateChartData(chart, principalUSD, apr, priceScenario, duration, asset, prices) {
    if(!chart) return;
    
    const labels = [];
    const dataBP = []; // BlockPilot
    const dataHold = []; // Holding
    
    const startPrice = asset==="eur" ? prices.eur : (asset==="stables"?1:prices[asset]);
    const tokenAmount = principalUSD / startPrice;

    // Génération des points (Année 0 à Duration)
    for(let y=0; y<=duration; y++) {
      labels.push(LANG==="fr" ? `Année ${y}` : `Year ${y}`);
      
      // Prix de l'actif à l'année Y
      const projectedPrice = startPrice * Math.pow(1 + priceScenario, y);
      
      // Option 1 : HOLD (Quantité fixe * Prix qui monte)
      const valHold = tokenAmount * projectedPrice;
      dataHold.push(valHold);
      
      // Option 2 : STRAT (Quantité qui monte * Prix qui monte)
      // On utilise la même logique que computeTokens (composition mensuelle)
      const tokensWithYield = computeTokens(tokenAmount, apr, y);
      const valStrat = tokensWithYield * projectedPrice;
      dataBP.push(valStrat);
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = dataBP;
    chart.data.datasets[1].data = dataHold;
    chart.update();
  }

  function initCalc(cfg, pricesUSD, yields) {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const scenarioWrap=$("#priceScenarios");
    const stableNote=$("#stableScenarioNote");
    const priceMeta=$("#priceMeta");

    const chartCanvas = $("#compoundChart");
    if(chartCanvas && window.Chart) growthChart = initChart(chartCanvas);

    const scenarios = [0, 0.2, 0.5];
    let scenario = 0.2;
    let durationYears = 3; // Default 3y pour que le graphe soit joli par défaut

    if(amount && !amount.value) amount.value = "10000";

    if (scenarioWrap) {
        scenarioWrap.innerHTML="";
        scenarios.forEach(v => {
            const btn=document.createElement("button");
            btn.type="button"; btn.className="chip"; btn.dataset.scn=String(v);
            btn.textContent = v===0 ? (LANG==="fr"?"Prix plat":"Flat") : `+${(v*100).toFixed(0)}%/an`;
            scenarioWrap.appendChild(btn);
        });
    }

    function recalc() {
      const rawVal = (amount?.value ?? "").replace(/\s/g, "").replace(",", ".");
      const usdInput = rawVal ? Number(rawVal) : 0;
      const asset = assetSel?.value || "stables";
      const apr = Number(yields?.[asset] ?? 0);
      
      const isStable = asset==="stables" || asset==="eur";
      
      // Force scenario 0 pour stables
      if (isStable && scenario !== 0) scenario = 0;

      $$("#priceScenarios .chip").forEach(c => {
          c.disabled = isStable && c.dataset.scn!=="0";
          c.classList.toggle("active", Number(c.dataset.scn)===scenario);
      });
      // Update chips duration active state
      $$("#durationChips .chip").forEach(c => {
        const d = Number(c.dataset.duration);
        c.classList.toggle("active", d===durationYears);
      });
      
      if(stableNote) stableNote.style.display = isStable ? "block" : "none";
      if(scenarioWrap) scenarioWrap.style.display = isStable ? "none" : "flex";

      if (!usdInput) { 
        $$(".sim-val").forEach(e=>e.textContent="—"); 
        ["#val12Scn", "#gainText", "#tokenGainText"].forEach(id=>{ const el=$(id); if(el) el.textContent=""; });
        return; 
      }

      // CALC (Final numbers text)
      const tokenPrice = asset==="eur" ? pricesUSD.eur : (asset==="stables"?1:pricesUSD[asset]);
      const principalTokens = usdInput / tokenPrice;
      const finalTokens = computeTokens(principalTokens, apr, durationYears);
      const gainedTokens = finalTokens - principalTokens;
      
      const priceGrowth = Math.pow(1+scenario, durationYears);
      const finalPrice = tokenPrice * priceGrowth;
      const finalDollars = finalTokens * finalPrice;
      const gainDollars = finalDollars - usdInput;

      // TEXT UPDATE
      const fmtUSD = (v) => new Intl.NumberFormat(undefined, { style:"currency", currency: "USD", maximumFractionDigits:0 }).format(v);
      const fmtTok = (v) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(v);
      const set=(id,t)=>{ const el=$(id); if(el) el.textContent=t; };
      
      set("#val12Scn", fmtUSD(finalDollars));
      
      const gainEl = $("#gainText");
      if(gainEl) {
        gainEl.textContent = LANG==="fr" ? `+ ${fmtUSD(gainDollars)} de gains` : `+ ${fmtUSD(gainDollars)} profit`;
        gainEl.style.color = "#3C756E"; 
      }

      const tokenGainEl = $("#tokenGainText");
      let unit = asset.toUpperCase();
      if(asset==="stables") unit="USDT";
      
      if(tokenGainEl) {
        if(!isStable) {
            tokenGainEl.style.display = "block";
            const txt = LANG==="fr" ? `dont + ${fmtTok(gainedTokens)} ${unit} accumulés` : `incl. + ${fmtTok(gainedTokens)} ${unit} accumulated`;
            tokenGainEl.textContent = txt;
        } else {
            tokenGainEl.style.display = "none";
        }
      }
      
      if(priceMeta) priceMeta.textContent = isStable ? "" : T.priceHint(fmtNum(tokenPrice,0), unit, scenario);

      // CHART UPDATE
      updateChartData(growthChart, usdInput, apr, scenario, durationYears, asset, pricesUSD);
    }

    // Listeners
    $$(".chip").forEach(b => b.addEventListener("click", (e) => {
        if(b.parentElement.id==="priceScenarios") scenario=Number(b.dataset.scn);
        else durationYears=Number(b.dataset.duration);
        recalc();
    }));
    amount?.addEventListener("input", recalc);
    assetSel?.addEventListener("change", recalc);
    
    // Initial call
    // Petit delay pour être sûr que ChartJS est prêt si chargé en async
    setTimeout(recalc, 100);
  }

  function initMobileMenu() {
    const t=$("#navToggle");
    if(t) t.onclick = () => {
       document.body.classList.toggle("menu-open");
       t.textContent = document.body.classList.contains("menu-open") ? T.close : T.menu;
    };
    $$(".nav__links a").forEach(a => a.onclick = () => { document.body.classList.remove("menu-open"); t.textContent=T.menu; });
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
    initMobileMenu();
    initSignature();
    const cfg = await fetchJSON("../data/blockpilot.json") || {};
    const yields = fillApr(cfg);
    const prices = await loadPricesUSD();
    initCalc(cfg, prices, yields);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
