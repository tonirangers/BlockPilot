/* assets/main.js - BlockPilot Logic (Clean & Fixed) */

// --- CONFIGURATION ---

const ASSETS = {
  stables: {
    name: "Stables",
    type: "stable",
    yield: 0.13, // 13% Yield
    cagr: 0,     // Prix fixe
    color: "#2563EB"
  },
  btc: {
    name: "Bitcoin",
    type: "crypto",
    yield: 0.04, // 4% Yield
    cagr: 0.45,  // 45% Croissance Prix (Moyenne lissée)
    color: "#F7931A"
  },
  eth: {
    name: "Ethereum",
    type: "crypto",
    yield: 0.05, // 5% Yield
    cagr: 0.55,  // 55% Croissance Prix
    color: "#627EEA"
  },
  bnb: {
    name: "BNB",
    type: "crypto",
    yield: 0.03, // 3% Yield (Launchpool estimation lissée)
    cagr: 0.45,  // 45% Croissance Prix (Similaire BTC)
    color: "#F0B90B"
  },
  eur: {
    name: "Euro",
    type: "fiat",
    yield: 0.03, // 3% Yield
    cagr: 0,
    color: "#CBD5E1"
  }
};


// --- LOGIC ---

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
  
  // Chips Durée
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

  // Calculs : On prend juste le CAGR défini en haut (pas de multiplicateur compliqué)
  const annualYield = asset.yield; 
  const annualCagr = asset.cagr; 
  
  let currentVal = startAmount;
  let dataPoints = [startAmount];
  let passiveVal = startAmount;
  let passivePoints = [startAmount];

  for(let i=1; i<=years; i++) {
    currentVal = currentVal * (1 + annualYield) * (1 + annualCagr);
    dataPoints.push(currentVal);
    
    passiveVal = passiveVal * (1 + annualCagr);
    passivePoints.push(passiveVal);
  }

  // --- UI UPDATE ---
  
  // APR Cards
  document.getElementById('aprStables').innerText = (ASSETS.stables.yield * 100).toFixed(0) + "%";
  document.getElementById('aprBtc').innerText = ((ASSETS.btc.yield + ASSETS.btc.cagr)*100).toFixed(0) + "%";
  document.getElementById('aprEth').innerText = ((ASSETS.eth.yield + ASSETS.eth.cagr)*100).toFixed(0) + "%";

  // Resultats
  const finalVal = dataPoints[dataPoints.length - 1];
  const totalGain = finalVal - startAmount;
  
  document.getElementById('val12Scn').innerText = formatCurrency(finalVal, assetKey);
  document.getElementById('gainText').innerText = "+" + formatCurrency(totalGain, assetKey);
  
  // Explication Unique (Le fameux "doublon" corrigé)
  const gainPercent = ((finalVal / startAmount - 1) * 100).toFixed(0);
  
  let hypotheseText = "";
  if(asset.cagr > 0) {
    hypotheseText = `Hypothèse : +${(asset.cagr*100).toFixed(0)}%/an (Moyenne historique) + Yield composé.`;
  } else {
    hypotheseText = `Hypothèse : Valeur stable (1:1) + Yield composé.`;
  }

  document.getElementById('priceMeta').innerHTML = 
    `${hypotheseText}<br>` +
    `Gain estimé : <strong>+${gainPercent}%</strong> sur ${years} ans.`;

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
          label: 'Avec BlockPilot',
          data: [],
          borderColor: '#3C756E',
          backgroundColor: 'rgba(60, 117, 110, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true
        },
        {
          label: 'Holding Passif',
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
