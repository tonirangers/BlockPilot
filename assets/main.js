/* assets/main.js - Logic for BlockPilot (Double Compounding) */

// --- CONFIGURATION ---

const ASSETS = {
  stables: {
    name: "Stables",
    type: "stable",
    refPrice: 1, // $1
    yield: 0.13, // 13% APY
    cagr: 0,     // Prix stable
    color: "#2563EB"
  },
  btc: {
    name: "Bitcoin",
    type: "crypto",
    refPrice: 95000, // Prix Réf pour le calcul des tokens
    yield: 0.04, // 4% Yield (Token qui s'accumule)
    cagr: 0.45,  // 45% Croissance Prix (Moyenne historique)
    color: "#F7931A"
  },
  eth: {
    name: "Ethereum",
    type: "crypto",
    refPrice: 3300, 
    yield: 0.05, // 5% Yield
    cagr: 0.55,  // 55% Croissance Prix
    color: "#627EEA"
  },
  bnb: {
    name: "BNB",
    type: "crypto",
    refPrice: 650, 
    yield: 0.03, // 3% Yield
    cagr: 0.45,  // 45% Croissance Prix
    color: "#F0B90B"
  },
  eur: {
    name: "Euro",
    type: "fiat",
    refPrice: 1.05,
    yield: 0.03, 
    cagr: 0,
    color: "#CBD5E1"
  }
};

// --- INIT ---

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initSimulator();
  initChart();
});

/* --- HEADER --- */
function initHeader() {
  const headerEl = document.querySelector('.header');
  if(headerEl) {
    headerEl.innerHTML = `
    <div class="container nav">
      <a href="index.html" class="brand">
        <img src="../logo.png" width="32" height="32" alt="Logo" style="border-radius:6px;">
        <span>BlockPilot</span>
      </a>
      <div class="nav__links">
        <a href="#overview" class="active">Overview</a>
        <a href="#performance">Performance</a>
        <a href="#security">Sécurité</a>
        <a href="https://calendar.app.google/bQWcTHd22XDzuCt6A" target="_blank" style="color:var(--bp-primary); font-weight:700;">Audit</a>
      </div>
      <div class="lang">
        <a href="../fr/index.html" class="pill ${document.body.dataset.lang === 'fr' ? 'is-active' : ''}">FR</a>
        <a href="../en/index.html" class="pill ${document.body.dataset.lang === 'en' ? 'is-active' : ''}">EN</a>
      </div>
      <button class="navToggle" onclick="document.body.classList.toggle('menu-open')">☰</button>
    </div>`;
  }
}

/* --- SIMULATOR --- */
let myChart = null;

function initSimulator() {
  const amountInput = document.getElementById('amountUSD');
  const assetSel = document.getElementById('assetSel');
  
  // Durée Chips
  const durationChips = document.querySelectorAll('#durationChips .chip');
  durationChips.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#durationChips .chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSim();
    });
  });
  // Active "3 ans" par défaut
  if(durationChips[1]) durationChips[1].classList.add('active');

  if(amountInput) amountInput.addEventListener('input', updateSim);
  if(assetSel) assetSel.addEventListener('change', updateSim);

  updateSim();
}

function updateSim() {
  const amountInput = document.getElementById('amountUSD');
  const assetSel = document.getElementById('assetSel');
  if(!amountInput || !assetSel) return;

  let startAmount = parseFloat(amountInput.value) || 0;
  const assetKey = assetSel.value;
  const asset = ASSETS[assetKey];
  
  const activeDur = document.querySelector('#durationChips .chip.active');
  const years = activeDur ? parseInt(activeDur.dataset.duration) : 3;

  // Calculs Double Composition
  // 1. Croissance du STOCK de tokens (Yield)
  // 2. Croissance du PRIX du token (CAGR)
  
  let currentVal = startAmount;
  let dataPoints = [startAmount];
  let passiveVal = startAmount;
  let passivePoints = [startAmount];

  // Pour le calcul des tokens générés
  const startTokens = startAmount / asset.refPrice;
  let currentTokens = startTokens;

  for(let i=1; i<=years; i++) {
    // BlockPilot : Le nombre de tokens augmente (Yield) ET le prix augmente (CAGR)
    currentTokens = currentTokens * (1 + asset.yield); // Le stock grossit
    currentVal = currentVal * (1 + asset.yield) * (1 + asset.cagr); // La valeur grossit doublement
    dataPoints.push(currentVal);
    
    // Passif : Le stock est fixe, seul le prix augmente
    passiveVal = passiveVal * (1 + asset.cagr);
    passivePoints.push(passiveVal);
  }

  // --- UI UPDATE ---
  
  // APR Cards (Haut)
  document.getElementById('aprStables').innerText = (ASSETS.stables.yield * 100).toFixed(0) + "%";
  document.getElementById('aprBtc').innerText = ((ASSETS.btc.yield + ASSETS.btc.cagr)*100).toFixed(0) + "%";
  document.getElementById('aprEth').innerText = ((ASSETS.eth.yield + ASSETS.eth.cagr)*100).toFixed(0) + "%";

  // Résultats (Bas)
  const finalVal = dataPoints[dataPoints.length - 1];
  const totalGain = finalVal - startAmount;
  
  // Affichage Valeur Future
  document.getElementById('val12Scn').innerText = formatCurrency(finalVal, assetKey);
  
  // Affichage Gain Total $
  document.getElementById('gainText').innerText = "+" + formatCurrency(totalGain, assetKey);

  // Affichage Tokens Générés ("dont + 0.45 ETH...")
  const tokenGainEl = document.getElementById('tokenGainText');
  if(asset.cagr > 0 && assetKey !== 'eur' && assetKey !== 'stables') {
    const generatedTokens = currentTokens - startTokens;
    const tokenSymbol = (assetKey === 'btc') ? 'BTC' : (assetKey === 'eth') ? 'ETH' : 'BNB';
    tokenGainEl.innerHTML = `dont <strong>+ ${generatedTokens.toLocaleString('en-US', {maximumFractionDigits: 4})} ${tokenSymbol}</strong> générés par les intérêts.`;
    tokenGainEl.style.display = 'block';
  } else {
    // Pour Stables/Euro, on affiche juste le gain en cash
    tokenGainEl.style.display = 'none';
  }
  
  // Explication Technique (Footer du bloc)
  let hypotheseText = "";
  if(asset.cagr > 0) {
     hypotheseText = `Prix réf : ~${asset.refPrice.toLocaleString()} $. Hypothèse : +${(asset.cagr*100).toFixed(0)}%/an (Moyenne historique).`;
  } else {
     hypotheseText = `Hypothèse : Valeur stable. Rendement pur.`;
  }

  document.getElementById('priceMeta').innerHTML = hypotheseText;

  updateChart(dataPoints, passivePoints, years);
}

/* --- CHART --- */
function initChart() {
  const ctx = document.getElementById('compoundChart');
  if(!ctx) return;

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Start', 'Y1', 'Y2', 'Y3'],
      datasets: [
        {
          label: 'Avec BlockPilot (Prix + Yield)',
          data: [],
          borderColor: '#3C756E',
          backgroundColor: 'rgba(60, 117, 110, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Holding Passif (Prix seul)',
          data: [],
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
      plugins: {
        legend: { display: true, position:'bottom' },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + Math.round(context.raw).toLocaleString() + ' $';
            }
          }
        }
      },
      scales: {
        y: { display: false },
        x: { grid: {display: false} }
      }
    }
  });
}

function updateChart(dataActive, dataPassive, years) {
  if(!myChart) return;
  const labels = ['Départ'];
  for(let i=1; i<=years; i++) labels.push('Année '+i);
  myChart.data.labels = labels;
  myChart.data.datasets[0].data = dataActive;
  myChart.data.datasets[1].data = dataPassive;
  myChart.update();
}

function formatCurrency(val, type) {
  const currency = (type === 'eur') ? 'EUR' : 'USD';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, maximumFractionDigits: 0 }).format(val);
}
