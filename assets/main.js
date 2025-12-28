/* assets/main.js - Final Stable Version */
(async () => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  const fmtNum = (v, max=2) => !isFinite(v) ? "—" : new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  
  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      menu: "Menu", close: "Fermer", contactLabel: "Email",
      priceHint: (px, unit, scn) => `Prix : ~${px} $/${unit}. Scénario : ${scn ? "+" + (scn*100).toFixed(0) + "%" : "stable"}.`
    },
    en: {
      menu: "Menu", close: "Close", contactLabel: "Email",
      priceHint: (px, unit, scn) => `Price: ~$${px}/${unit}. Scenario: ${scn ? "+" + (scn*100).toFixed(0) + "%" : "stable"}.`
    }
  };
  const T = I18N[LANG] || I18N.fr;

  async function fetchJSON(url) {
    try { const r = await fetch(url); return r.ok ? await r.json() : null; } catch { return null; }
  }

  // --- SIMULATEUR ---
  function computeTokens(principalTokens, apr, years) {
    const n=12; const r=apr/n;
    return principalTokens*Math.pow(1+r, n*years);
  }

  function fillApr(cfg) {
    const yields = { stables:0.10, btc:0.02, eth:0.04, bnb:0.13, eur:0.04, ...(cfg?.yields||{}) };
    const set=(id, v)=>{ const el=$(id); if (el) el.textContent=(Number(v||0)*100).toFixed(0)+"%"; };
    set("#aprStables", yields.stables);
    set("#aprBtc", yields.btc);
    set("#aprEth", yields.eth);
    set("#aprBnb", yields.bnb);
    set("#aprEur", yields.eur);
    return yields;
  }

  async function loadPricesUSD() {
    // Valeurs par défaut solides (si l'API plante)
    const prices={ btc:96000, eth:3300, bnb:610, stables:1, eur:1.05 };
    try {
      // On tente de charger les prix live, mais on ne bloque pas si ça échoue
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
    } catch(e) { console.log("Price API failed, using defaults"); }
    return prices;
  }

  function initCalc(cfg, pricesUSD, yields) {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const scenarioWrap=$("#priceScenarios");
    const stableNote=$("#stableScenarioNote");
    const priceMeta=$("#priceMeta");

    const scenarios = [0, 0.2, 0.5];
    let scenario = 0.2;
    let durationYears = 1;

    // Création des puces (chips)
    if (scenarioWrap) {
        scenarioWrap.innerHTML="";
        scenarios.forEach(v => {
            const btn=document.createElement("button");
            btn.type="button"; btn.className="chip"; btn.dataset.scn=String(v);
            btn.textContent = v===0 ? (LANG==="fr"?"Prix plat":"Flat price") : `+${(v*100).toFixed(0)}%/an`;
            scenarioWrap.appendChild(btn);
        });
    }

    function recalc() {
      // Nettoyage de l'input (enlève espaces)
      const usdInput = Number((amount?.value ?? "").replace(/\s/g, "").replace(",", "."));
      const asset = assetSel?.value || "stables";
      const apr = Number(yields?.[asset] ?? 0);
      
      const isStable = asset==="stables" || asset==="eur";
      // Si asset=Eur, le prix est pricesUSD.eur (ex: 1.05). Sinon 1 pour stables, sinon prix crypto.
      const px = isStable ? (asset==="eur" ? pricesUSD.eur : 1) : pricesUSD[asset];

      if (isStable && scenario !== 0) scenario = 0;

      // Mise à jour visuelle des boutons
      $$("#priceScenarios .chip").forEach(c => {
          c.disabled = isStable && c.dataset.scn!=="0";
          c.classList.toggle("active", Number(c.dataset.scn)===scenario);
      });
      $$("#durationChips .chip").forEach(c => c.classList.toggle("active", Number(c.dataset.duration)===durationYears));
      
      if(stableNote) stableNote.style.display = isStable ? "block" : "none";
      if(scenarioWrap) scenarioWrap.style.display = isStable ? "none" : "flex";

      if (!usdInput) { 
        $$(".sim-val").forEach(e=>e.textContent="—"); 
        ["#val12Scn", "#val12Flat", "#gainText", "#depTok"].forEach(id=>{ const el=$(id); if(el) el.textContent="—"; });
        return; 
      }

      // --- LE CALCUL ---
      // 1. On convertit l'input ($) en Tokens
      const principalDollars = usdInput; 
      const tokenPrice = asset==="eur" ? pricesUSD.eur : (asset==="stables"?1:pricesUSD[asset]);
      const principalTokens = principalDollars / tokenPrice;

      // 2. Intérêts composés sur les tokens
      const finalTokens = computeTokens(principalTokens, apr, durationYears);
      
      // 3. Valeur finale en dollars (avec scénario de prix si crypto)
      const priceGrowth = Math.pow(1+scenario, durationYears);
      const finalPrice = tokenPrice * priceGrowth;
      
      const finalDollars = finalTokens * finalPrice;
      const flatDollars = finalTokens * tokenPrice;
      const gainDollars = finalDollars - principalDollars;

      // --- AFFICHAGE ---
      const fmt = (v) => new Intl.NumberFormat(undefined, { style:"currency", currency: "USD", maximumFractionDigits:0 }).format(v);

      const set=(id,t)=>{ const el=$(id); if(el) el.textContent=t; };
      
      set("#val12Scn", fmt(finalDollars));
      set("#val12Flat", isStable ? "" : `(${fmt(flatDollars)} si prix stable)`);
      
      // L'effet Wahou (Gain en vert)
      const gainEl = $("#gainText");
      if(gainEl) {
        gainEl.textContent = `+ ${fmt(gainDollars)} de gains`;
        gainEl.style.color = "#3C756E"; // Ta couleur
      }
      
      let unit = asset.toUpperCase();
      if(asset==="stables") unit="USDT";
      
      set("#depTok", `${fmtNum(principalTokens, asset==="btc"||asset==="eth"?6:2)} ${unit}`);
      
      if(priceMeta) priceMeta.textContent = isStable ? "" : T.priceHint(fmtNum(tokenPrice,0), unit, scenario);
    }

    $$(".chip").forEach(b => b.addEventListener("click", (e) => {
        if(b.parentElement.id==="priceScenarios") scenario=Number(b.dataset.scn);
        else durationYears=Number(b.dataset.duration);
        recalc();
    }));
    amount?.addEventListener("input", recalc);
    assetSel?.addEventListener("change", recalc);
    recalc();
  }

  // --- MENU MOBILE ---
  function initMobileMenu() {
    const t=$("#navToggle");
    if(t) t.onclick = () => {
       document.body.classList.toggle("menu-open");
       t.textContent = document.body.classList.contains("menu-open") ? T.close : T.menu;
    };
    $$(".nav__links a").forEach(a => a.onclick = () => { document.body.classList.remove("menu-open"); t.textContent=T.menu; });
  }

  // --- SIGNATURE (Iframes) ---
  function initSignature() {
    const btns=$$('[data-signature-view]');
    const frames={ sign: $("#signatureSign"), verify: $("#signatureVerify") };
    if(!btns.length) return;
    
    function setView(v) {
        btns.forEach(b => b.classList.toggle("active", b.dataset.signatureView===v));
        if(frames.sign) frames.sign.style.display = v==="sign" ? "block" : "none";
        if(frames.verify) frames.verify.style.display = v==="verify" ? "block" : "none";
        
        // Chargement différé pour perf
        const lang = (localStorage.getItem("bp_lang")||"fr").includes("en") ? "en" : "fr";
        const f = frames[v];
        if(f && !f.getAttribute("src")) {
            f.src = `../${v==="verify"?"verify":"sign"}.html?embed=1&lang=${lang}`;
        }
    }
    btns.forEach(b => b.onclick=()=>setView(b.dataset.signatureView));
    setView("sign");
  }

  // --- INITIALISATION ---
  async function init() {
    initMobileMenu();
    initSignature();
    const cfg = await fetchJSON("../data/blockpilot.json") || {};
    const yields = fillApr(cfg);
    const prices = await loadPricesUSD(); // Appel sans paramètre, valeurs par défaut incluses
    initCalc(cfg, prices, yields);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
