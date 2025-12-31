/* assets/main.js - Logic for BlockPilot (Simulator Only) */

(async () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  
  // CONFIGURATION
  const CONFIG = {
    stables: { yield: 0.12, cagr: 0, refPrice: 1 },
    btc:     { yield: 0.04, cagr: 0.45, refPrice: 95000 },
    eth:     { yield: 0.05, cagr: 0.55, refPrice: 3300 },
    bnb:     { yield: 0.13, cagr: 0.45, refPrice: 650 }, // BNB 13%
    eur:     { yield: 0.04, cagr: 0, refPrice: 1.05 }
  };

  let LIVE_PRICES = { ...CONFIG }; 
  Object.keys(CONFIG).forEach(k => LIVE_PRICES[k] = CONFIG[k].refPrice);

  // --- 1. FETCH PRICES ---
  async function loadPrices() {
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price");
      if(res.ok) {
        const data = await res.json();
        data.forEach(t => {
          if(t.symbol==="BTCUSDT") LIVE_PRICES.btc = parseFloat(t.price);
          if(t.symbol==="ETHUSDT") LIVE_PRICES.eth = parseFloat(t.price);
          if(t.symbol==="BNBUSDT") LIVE_PRICES.bnb = parseFloat(t.price);
          if(t.symbol==="EURUSDT") LIVE_PRICES.eur = parseFloat(t.price);
        });
        updateSim(); 
      }
    } catch(e) { console.log("API Error, using defaults"); }
  }

  // --- 2. UPDATE SIMULATOR ---
  function updateSim() {
    const amountInput = document.getElementById('amountUSD');
    const assetSel = document.getElementById('assetSel');
    if(!amountInput || !assetSel) return;

    let startUSD = parseFloat(amountInput.value.replace(/\s/g, '').replace(',', '.')) || 0;
    const assetKey = assetSel.value;
    const cfg = CONFIG[assetKey];
    
    // Durée
    const activeChip = document.querySelector("#durationChips .chip.active");
    const years = activeChip ? parseInt(activeChip.dataset.duration) : 3;

    // Prix Live
    const startPrice = (assetKey === 'stables') ? 1 : LIVE_PRICES[assetKey];

    // CALCULS DOUBLE COMPOSITION
    const startTokens = startUSD / startPrice;
    
    // Yield (Tokens augmentent)
    const finalTokens = startTokens * Math.pow(1 + cfg.yield, years);
    const generatedTokens = finalTokens - startTokens;

    // CAGR (Prix augmente)
    const finalPrice = startPrice * Math.pow(1 + cfg.cagr, years);

    // Valeur Finale
    const finalUSD = finalTokens * finalPrice;
    const totalGainUSD = finalUSD - startUSD;

    // --- AFFICHAGE ---
    
    // Cartes APR : On affiche le YIELD UNIQUEMENT (Pas l'addition)
    if($("#aprStables")) $("#aprStables").innerText = (CONFIG.stables.yield * 100).toFixed(0) + "%";
    if($("#aprBtc")) $("#aprBtc").innerText = (CONFIG.btc.yield * 100).toFixed(0) + "%";
    if($("#aprEth")) $("#aprEth").innerText = (CONFIG.eth.yield * 100).toFixed(0) + "%";
    if($("#aprBnb")) $("#aprBnb").innerText = (CONFIG.bnb.yield * 100).toFixed(0) + "%"; 
    if($("#aprEur")) $("#aprEur").innerText = (CONFIG.eur.yield * 100).toFixed(0) + "%";

    // Gros Chiffres
    $("#val12Scn").innerText = formatUSD(finalUSD);
    const elGain = $("#gainText");
    elGain.innerText = "+" + formatUSD(totalGainUSD);
    elGain.style.color = "#3C756E";

    // Preuve Tokens
    const tokenArea = $("#tokenGainText");
    if(tokenArea) {
        if(cfg.cagr > 0 && assetKey !== 'eur') {
            const symbol = assetKey.toUpperCase();
            tokenArea.innerHTML = `dont <strong>+ ${generatedTokens.toLocaleString('en-US', {maximumFractionDigits: 4})} ${symbol}</strong> générés par BlockPilot.`;
            tokenArea.style.display = 'block';
        } else {
            tokenArea.style.display = 'none';
        }
    }

    // Explication Technique
    const priceMeta = $("#priceMeta");
    if(priceMeta) {
        if(cfg.cagr > 0) {
            priceMeta.innerHTML = `Prix réf (Live) : ~${Math.round(startPrice).toLocaleString()} $. Hypothèse : +${(cfg.cagr*100).toFixed(0)}%/an (Moyenne historique).`;
        } else {
            priceMeta.innerHTML = "Hypothèse : Valeur stable. Rendement pur.";
        }
    }

    updateChart([startUSD], finalUSD, years, cfg);
  }

  // --- 3. CHART ---
  let myChart = null;
  function updateChart(startData, finalUSD, years, cfg) {
    const ctx = document.getElementById("compoundChart");
    if(!ctx) return;

    if(window.myChartInstance) window.myChartInstance.destroy();

    let dataActive = [];
    let dataPassive = [];
    let labels = [];
    
    let currentVal = startData[0]; 
    let passiveVal = startData[0];
    
    dataActive.push(currentVal);
    dataPassive.push(passiveVal);
    labels.push("Départ");

    for(let i=1; i<=years; i++) {
        currentVal = currentVal * (1 + cfg.yield) * (1 + cfg.cagr);
        passiveVal = passiveVal * (1 + cfg.cagr);
        dataActive.push(currentVal);
        dataPassive.push(passiveVal);
        labels.push("Année " + i);
    }

    window.myChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Avec BlockPilot (Yield + Prix)',
            data: dataActive,
            borderColor: '#3C756E',
            backgroundColor: 'rgba(60, 117, 110, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true
          },
          {
            label: 'Holding Passif (Prix seul)',
            data: dataPassive,
            borderColor: '#94A3B8',
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position:'bottom' } },
        scales: { y: { display: false }, x: { grid: {display: false} } }
      }
    });
    myChart = window.myChartInstance;
  }

  function formatUSD(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  }

  // LOGIQUE SIGNATURE
  function initSignature() {
    const btns = document.querySelectorAll('[data-signature-view]');
    const frames = { sign: document.getElementById("signatureSign"), verify: document.getElementById("signatureVerify") };
    if(!btns.length) return;
    
    function setView(v) {
        btns.forEach(b => b.classList.toggle("active", b.dataset.signatureView===v));
        if(frames.sign) frames.sign.style.display = v==="sign" ? "block" : "none";
        if(frames.verify) frames.verify.style.display = v==="verify" ? "block" : "none";
        const f = frames[v];
        if(f && !f.getAttribute("src")) {
            const lang = document.body.dataset.lang || "fr";
            f.src = `../${v==="verify"?"verify":"sign"}.html?embed=1&lang=${lang}`;
        }
    }
    btns.forEach(b => b.onclick=()=>setView(b.dataset.signatureView));
    if(frames.sign && frames.sign.style.display !== 'none') setView("sign");
  }

  // START LISTENERS
  const amount = document.getElementById("amountUSD");
  const asset = document.getElementById("assetSel");
  const chips = document.querySelectorAll("#durationChips .chip");

  if(amount) amount.oninput = updateSim;
  if(asset) {
      asset.onchange = updateSim;
      asset.value = "eth"; // MODIF : Start sur ETH
  }
  
  chips.forEach(btn => {
      btn.onclick = () => {
          chips.forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          updateSim();
      }
  });

  initSignature();
  loadPrices();
  if(amount && asset) updateSim(); 
})();
