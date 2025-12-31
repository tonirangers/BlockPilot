/* assets/main.js - Logic for BlockPilot (Simulator Only) */

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
    bnb:     { yield: 0.13, cagr: 0.45, refPrice: 650 }, // MODIF : BNB Ajouté
    eur:     { yield: 0.04, cagr: 0, refPrice: 1.05 }
  };

  // Variable pour stocker les prix LIVE (init avec défauts au cas où)
  let LIVE_PRICES = { ...CONFIG }; 
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
    const amountInput = document.getElementById('amountUSD');
    const assetSel = document.getElementById('assetSel');
    if(!amountInput || !assetSel) return;

    let startUSD = parseFloat(amountInput.value.replace(/\s/g, '').replace(',', '.')) || 0;
    const assetKey = assetSel.value;
    const cfg = CONFIG[assetKey];
    
    // Récupération Durée
    const activeChip = document.querySelector("#durationChips .chip.active");
    const years = activeChip ? parseInt(activeChip.dataset.duration) : 3;

    // Récupération Prix Live
    const startPrice = (assetKey === 'stables') ? 1 : LIVE_PRICES[assetKey];

    // CALCULS DOUBLE COMPOSITION
    const startTokens = startUSD / startPrice;
    
    // Le nombre de tokens augmente grâce au Yield
    const finalTokens = startTokens * Math.pow(1 + cfg.yield, years);
    const generatedTokens = finalTokens - startTokens;

    // Le prix du token augmente grâce au CAGR
    const finalPrice = startPrice * Math.pow(1 + cfg.cagr, years);

    // Valeur Finale en USD
    const finalUSD = finalTokens * finalPrice;
    const totalGainUSD = finalUSD - startUSD;

    // --- AFFICHAGE ---
    
    // Cartes APR
    const elStables = document.getElementById("aprStables");
    if(elStables) elStables.innerText = (CONFIG.stables.yield * 100).toFixed(0) + "%";
    
    const elBtc = document.getElementById("aprBtc");
    if(elBtc) elBtc.innerText = ((CONFIG.btc.yield + CONFIG.btc.cagr)*100).toFixed(0) + "%";
    
    const elEth = document.getElementById("aprEth");
    if(elEth) elEth.innerText = ((CONFIG.eth.yield + CONFIG.eth.cagr)*100).toFixed(0) + "%";
    
    const elEur = document.getElementById("aprEur");
    if(elEur) elEur.innerText = (CONFIG.eur.yield * 100).toFixed(0) + "%";

    // Gros Chiffres
    document.getElementById("val12Scn").innerText = formatUSD(finalUSD);
    const elGain = document.getElementById("gainText");
    elGain.innerText = "+" + formatUSD(totalGainUSD);
    elGain.style.color = "#3C756E";

    // La Preuve (Tokens générés)
    const tokenArea = document.getElementById("tokenGainText");
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
    const priceMeta = document.getElementById("priceMeta");
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

    // Sécurité : destroy l'ancien graph
    if(window.myChartInstance) window.myChartInstance.destroy();

    let dataActive = [];
    let dataPassive = [];
    let labels = [];
    
    // Point 0 (Base 10k pour le graph pour lisibilité relative, ou montant réel)
    // Ici on utilise le montant réel calculé dans updateSim pour cohérence
    // Pour simplifier le tracé, on simule l'évolution annuelle
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

  // --- UTILS ---
  function formatUSD(val) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  }

  // --- LOGIQUE SIGNATURE (Gardée pour ne pas casser la page signature) ---
  function initSignature() {
    const btns = document.querySelectorAll('[data-signature-view]');
    const frames = { sign: document.getElementById("signatureSign"), verify: document.getElementById("signatureVerify") };
    if(!btns.length) return;
    
    function setView(v) {
        btns.forEach(b => b.classList.toggle("active", b.dataset.signatureView===v));
        if(frames.sign) frames.sign.style.display = v==="sign" ? "block" : "none";
        if(frames.verify) frames.verify.style.display = v==="verify" ? "block" : "none";
        // Petit fix URL
        const f = frames[v];
        if(f && !f.getAttribute("src")) {
            const lang = document.body.dataset.lang || "fr";
            f.src = `../${v==="verify"?"verify":"sign"}.html?embed=1&lang=${lang}`;
        }
    }
    btns.forEach(b => b.onclick=()=>setView(b.dataset.signatureView));
    // Init par défaut
    if(frames.sign && frames.sign.style.display !== 'none') setView("sign");
  }

  // --- START LISTENERS ---
  const amount = document.getElementById("amountUSD");
  const asset = document.getElementById("assetSel");
  const chips = document.querySelectorAll("#durationChips .chip");

  if(amount) amount.oninput = updateSim;
  if(asset) asset.onchange = updateSim;
  chips.forEach(btn => {
      btn.onclick = () => {
          chips.forEach(c => c.classList.remove('active'));
          btn.classList.add('active');
          updateSim();
      }
  });

  // START
  initSignature(); // Important pour page signature
  // Note: On ne lance PAS initMobileMenu car header.js le fait.
  
  loadPrices();
  if(amount && asset) updateSim(); 
})();
