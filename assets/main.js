/* assets/main.js - BlockPilot Logic (Live & Clean) */

(async () => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  
  // CONFIGURATION DES RENDEMENTS & CROISSANCE
  // Yield = Intérêts composés (Votre perf)
  // CAGR = Croissance Prix Moyenne Historique (L'hypothèse figée)
  const CONFIG = {
    stables: { yield: 0.12, cagr: 0, refPrice: 1 },
    btc:     { yield: 0.04, cagr: 0.45, refPrice: 95000 },
    eth:     { yield: 0.05, cagr: 0.55, refPrice: 3300 },
    bnb:     { yield: 0.13, cagr: 0.45, refPrice: 650 }, // BNB Ajouté
    eur:     { yield: 0.04, cagr: 0, refPrice: 1.05 }
  };

  // Variable pour stocker les prix LIVE (init avec défauts au cas où)
  let LIVE_PRICES = { ...CONFIG }; 
  // On mappe juste les valeurs refPrice dans un format simple
  Object.keys(CONFIG).forEach(k => LIVE_PRICES[k] = CONFIG[k].refPrice);

  // --- 1. FETCH PRICES (BINANCE) ---
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
        updateSim(); // Recalcul dès qu'on a les vrais prix
      }
    } catch(e) { console.log("API Error, using defaults"); }
  }

  // --- 2. UPDATE SIMULATOR ---
  function updateSim() {
    const amountInput = $("#amountUSD");
    const assetSel = $("#assetSel");
    if(!amountInput || !assetSel) return;

    let startUSD = parseFloat(amountInput.value.replace(/\s/g, '')) || 0;
    const assetKey = assetSel.value;
    const cfg = CONFIG[assetKey];
    
    // Récupération Durée
    const activeChip = $("#durationChips .chip.active");
    const years = activeChip ? parseInt(activeChip.dataset.duration) : 3;

    // Récupération Prix Live
    const startPrice = (assetKey === 'stables') ? 1 : LIVE_PRICES[assetKey];

    // CALCULS DOUBLE COMPOSITION
    // 1. On convertit le capital en Tokens (au prix d'aujourd'hui)
    const startTokens = startUSD / startPrice;
    
    // 2. Le nombre de tokens augmente grâce au Yield (Intérêts composés)
    const finalTokens = startTokens * Math.pow(1 + cfg.yield, years);
    const generatedTokens = finalTokens - startTokens;

    // 3. Le prix du token augmente grâce au CAGR (Hypothèse marché)
    //    Si c'est du stable, le prix ne bouge pas.
    const finalPrice = startPrice * Math.pow(1 + cfg.cagr, years);

    // 4. Valeur Finale en USD
    const finalUSD = finalTokens * finalPrice;
    const totalGainUSD = finalUSD - startUSD;

    // --- AFFICHAGE ---
    
    // Cartes APR (Haut)
    $("#aprStables").innerText = (CONFIG.stables.yield * 100).toFixed(0) + "%";
    $("#aprBtc").innerText = ((CONFIG.btc.yield + CONFIG.btc.cagr)*100).toFixed(0) + "%";
    $("#aprEth").innerText = ((CONFIG.eth.yield + CONFIG.eth.cagr)*100).toFixed(0) + "%";
    $("#aprEur").innerText = (CONFIG.eur.yield * 100).toFixed(0) + "%";

    // Gros Chiffres
    $("#val12Scn").innerText = formatUSD(finalUSD);
    $("#gainText").innerText = "+" + formatUSD(totalGainUSD);
    $("#gainText").style.color = "#3C756E";

    // La Preuve (Tokens générés)
    const tokenArea = $("#tokenGainText");
    if(cfg.cagr > 0 && assetKey !== 'eur') {
        const symbol = assetKey.toUpperCase();
        tokenArea.innerHTML = `dont <strong>+ ${generatedTokens.toLocaleString('en-US', {maximumFractionDigits: 4})} ${symbol}</strong> générés par BlockPilot.`;
        tokenArea.style.display = 'block';
    } else {
        tokenArea.style.display = 'none';
    }

    // Explication Technique (Bas)
    const priceMeta = $("#priceMeta");
    if(cfg.cagr > 0) {
        priceMeta.innerHTML = `Prix réf (Live) : ~${Math.round(startPrice).toLocaleString()} $. Hypothèse : +${(cfg.cagr*100).toFixed(0)}%/an (Moyenne historique).`;
    } else {
        priceMeta.innerHTML = "Hypothèse : Valeur stable. Rendement pur.";
    }

    updateChart([startUSD], finalUSD, years, cfg);
  }

  // --- 3. CHART ---
  let myChart = null;
  function updateChart(startData, finalUSD, years, cfg) {
    const ctx = $("#compoundChart");
    if(!ctx) return;

    // Génération des points intermédiaires pour la courbe
    let dataActive = [];
    let dataPassive = [];
    let labels = [];
    
    // Point 0
    let currentVal = 10000; // Base 10k pour le graph (plus propre)
    let passiveVal = 10000;
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

    if(myChart) myChart.destroy();

    myChart = new Chart(ctx, {
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
  }

  // --- UTILS ---
  function formatUSD(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  }

  function initListeners() {
    const amount = $("#amountUSD");
    const asset = $("#assetSel");
    const chips = $$("#durationChips .chip");

    // Click Chips
    chips.forEach(btn => {
        btn.onclick = () => {
            chips.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            updateSim();
        }
    });
    // Default Active
    if(chips[1]) chips[1].classList.add('active');

    // Inputs
    amount.oninput = updateSim;
    asset.onchange = updateSim;
  }

  // START
  initListeners();
  loadPrices();
  updateSim(); // Premier calcul avec valeurs par défaut
})();
