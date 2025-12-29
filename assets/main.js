/* assets/main.js - BlockPilot Pro (Smart CAGR) */
(async () => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));
  const fmtNum = (v, max=2) => !isFinite(v) ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  
  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      menu: "Menu", close: "Fermer", 
      priceHint: (px, unit, scn) => `Prix réf : ~${px} $/${unit}. Hypothèse : +${(scn*100).toFixed(0)}%/an (Moyenne historique).`,
      chartLabel: "Surperformance BlockPilot (Alpha)",
      chartSub: "Gain net vs Holding Passif"
    },
    en: {
      menu: "Menu", close: "Close",
      priceHint: (px, unit, scn) => `Ref price: ~$${px}/${unit}. Assumption: +${(scn*100).toFixed(0)}%/yr (Historical avg).`,
      chartLabel: "BlockPilot Alpha (Outperformance)",
      chartSub: "Net gain vs Passive Holding"
    }
  };
  const T = I18N[LANG] || I18N.fr;

  async function fetchJSON(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // --- CONFIG CAGR (Croissance Moyenne Historique) ---
  const CAGR = {
    stables: 0,
    eur: 0,
    btc: 0.45, // +45% annuel (Conservateur vs historique 5 ans)
    eth: 0.55, // +55% annuel
    bnb: 0.40  // +40% annuel
  };

  // --- CALC ---
  function computeTokens(principalTokens, apr, years) {
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

  // --- CHART ENGINE (ALPHA VIEW) ---
  let growthChart = null;
  
  function initChart(ctx) {
    if(!ctx) return null;
    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: T.chartLabel,
          data: [],
          borderColor: '#3C756E',
          backgroundColor: (context) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, 'rgba(60, 117, 110, 0.4)');
            gradient.addColorStop(1, 'rgba(60, 117, 110, 0.0)');
            return gradient;
          },
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#3C756E',
          pointBorderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { 
            mode: 'index', intersect: false, 
            callbacks: { 
                label: (c) => ` + $${Math.round(c.raw).toLocaleString()} (Alpha)`,
                title: (t) => t[0].label
            },
            backgroundColor: '#0F172A', titleColor: '#94A3B8', bodyFont: { weight: 'bold', size: 14 },
            padding: 12, cornerRadius: 8, displayColors: false
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8' } },
          y: { beginAtZero: true, grid: { color: '#F1F5F9', borderDash: [5, 5] }, ticks: { callback: (v)=> '+$' + (v/1).toLocaleString(), color: '#64748B' } }
        },
        interaction: { mode: 'nearest', axis: 'x', intersect: false }
      }
    });
  }

  function updateChartData(chart, principalUSD, apr, priceScenario, duration, asset, prices) {
    if(!chart) return;
    const labels = [];
    const dataAlpha = [];
    const startPrice = asset==="eur" ? prices.eur : (asset==="stables"?1:prices[asset]);
    const tokenAmount = principalUSD / startPrice;

    for(let y=0; y<=duration; y++) {
      labels.push(LANG==="fr" ? `Année ${y}` : `Year ${y}`);
      const projectedPrice = startPrice * Math.pow(1 + priceScenario, y);
      
      // Val Hold (Benchmark)
      const valHold = tokenAmount * projectedPrice;
      
      // Val Strat (BlockPilot)
      const tokensWithYield = computeTokens(tokenAmount, apr, y);
      const valStrat = tokensWithYield * projectedPrice;

      // ALPHA = La différence créée par BlockPilot
      dataAlpha.push(valStrat - valHold);
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = dataAlpha;
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

    let durationYears = 3;

    if(amount && !amount.value) amount.value = "10000";

    function recalc() {
      const rawVal = (amount?.value ?? "").replace(/\s/g, "").replace(",", ".");
      const usdInput = rawVal ? Number(rawVal) : 0;
      const asset = assetSel?.value || "stables";
      const apr = Number(yields?.[asset] ?? 0);
      
      // --- SMART SCENARIO (AUTO) ---
      // On récupère le CAGR défini plus haut, ou 0 par défaut
      const scenario = CAGR[asset] || 0;
      
      const isStable = asset==="stables" || asset==="eur";

      // Mise à jour UI des chips Durée
      $$("#durationChips .chip").forEach(c => {
        c.classList.toggle("active", Number(c.dataset.duration)===durationYears);
      });
      
      // Affichage de l'hypothèse utilisée (remplace les boutons)
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

      // CALC
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
        // En mode Alpha View, on montre toujours le gain token si pertinent
        if(!isStable) {
            tokenGainEl.style.display = "block";
            const txt = LANG==="fr" ? `dont + ${fmtTok(gainedTokens)} ${unit} accumulés` : `incl. + ${fmtTok(gainedTokens)} ${unit} accumulated`;
            tokenGainEl.textContent = txt;
        } else {
            tokenGainEl.style.display = "none";
        }
      }
      
      if(priceMeta) priceMeta.textContent = isStable ? "" : T.priceHint(fmtNum(tokenPrice,0), unit, scenario);

      updateChartData(growthChart, usdInput, apr, scenario, durationYears, asset, pricesUSD);
    }

    $$("#durationChips .chip").forEach(b => b.addEventListener("click", (e) => {
        durationYears=Number(b.dataset.duration);
        recalc();
    }));
    amount?.addEventListener("input", recalc);
    assetSel?.addEventListener("change", recalc);
    
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
