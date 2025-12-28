/* assets/main.js - Cleaned for TradingView Integration */
(async () => {
  const $ = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  // --- FORMATTERS (Utilisés par le Simulateur) ---
  const fmtNum = (v, max=2) => {
    if (!isFinite(v)) return "—";
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: max }).format(v);
  };
  const fmtUsd = (v, max=0) => {
    if (!isFinite(v)) return "—";
    return new Intl.NumberFormat(undefined, { style:"currency", currency:"USD", maximumFractionDigits:max }).format(v);
  };
  const fmtDate = (ts) => {
    const d=new Date(ts);
    return d.toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});
  };

  // --- I18N & CONFIG ---
  const LANG = document.body?.dataset?.lang || "fr";
  const I18N = {
    fr: {
      menu: "Menu", close: "Fermer", contactLabel: "Email",
      stableHint: "Hypothèse : 1 $ ≈ 1 stable.",
      priceHint: (px, unit, scn) => `Prix utilisé : ~${px} $/${unit}. Scénario : ${scn ? "+" + (scn*100).toFixed(0) + "%" : "prix constant"}.`,
      stableScenarioNote: "Stables : pas de scénario de prix."
    },
    en: {
      menu: "Menu", close: "Close", contactLabel: "Email",
      stableHint: "Assumption: $1 ≈ 1 stable.",
      priceHint: (px, unit, scn) => `Price used: ~$${px}/${unit}. Scenario: ${scn ? "+" + (scn*100).toFixed(0) + "%" : "flat price"}.`,
      stableScenarioNote: "Stables: no price scenario."
    }
  };
  const T = I18N[LANG] || I18N.fr;
  try { localStorage.setItem("bp_lang", LANG); } catch {}

  // --- URL UTILS ---
  const SCRIPT_URL = (() => {
    try {
      if (document.currentScript?.src) return new URL(document.currentScript.src, location.href);
      const s = document.querySelector('script[src*="assets/main.js"],script[src$="/main.js"]');
      if (s?.src) return new URL(s.src, location.href);
    } catch {}
    return new URL(location.href);
  })();
  const ROOT = (() => {
    try { return new URL("../", SCRIPT_URL); } catch { return new URL("./", location.href); }
  })();
  const fromRoot = (p) => new URL(String(p).replace(/^\/+/,""), ROOT).toString();
  const resolveHref = (p) => { try { return new URL(p, location.href).toString(); } catch { return p; } };

  async function fetchJSON(url, timeoutMs=9000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache:"no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch { return null; } finally { clearTimeout(t); }
  }

  async function firstJSON(urls, fallback={}) {
    for (const u of urls) {
      const res = await fetchJSON(u);
      if (res) return res;
    }
    return fallback;
  }

  // --- UTILS UI ---
  function setDisabledLink(a, disabled) {
    if (!a) return;
    if (disabled) {
      a.classList.add("disabled"); a.setAttribute("aria-disabled","true"); a.setAttribute("tabindex","-1"); a.href = "#";
    } else {
      a.classList.remove("disabled"); a.removeAttribute("aria-disabled"); a.removeAttribute("tabindex");
    }
  }

  function setActiveChip(groupSel, key) {
    $$(groupSel).forEach(b => {
      const data = b.dataset.scn ?? b.dataset.periodCard ?? b.dataset.capCard ?? b.dataset.duration;
      b.classList.toggle("active", String(data) === String(key));
    });
  }

  // --- SIMULATOR LOGIC (Conservé) ---
  function computeTokens(principalTokens, apr, years) {
    const n=12; const r=apr/n;
    return principalTokens*Math.pow(1+r, n*years);
  }

  function fillApr(cfg) {
    const yields = { stables:0.10, btc:0.02, eth:0.04, bnb:0.13, ...(cfg?.yields||{}) };
    const set=(id, v)=>{ const el=$(id); if (el) el.textContent=(Number(v||0)*100).toFixed(0)+"%"; };
    set("#aprStables", yields.stables);
    set("#aprBtc", yields.btc);
    set("#aprEth", yields.eth);
    set("#aprBnb", yields.bnb);
    return yields;
  }

  async function loadPricesUSD(cfg) {
    // Version allégée: on fetch juste les prix actuels pour le simulateur
    const cacheKey="bp_prices_sim_v3";
    const cachedRaw=localStorage.getItem(cacheKey);
    const now=Date.now();
    if (cachedRaw) {
      try {
        const c=JSON.parse(cachedRaw);
        if (c.ts && (now-c.ts)<10*60*1000 && c.prices) return c.prices;
      } catch {}
    }
    const fall = cfg?.fallbackPricesUSD || { btc:95000, eth:3200, bnb:600 };
    const symbols={ btc:"BTCUSDT", eth:"ETHUSDT", bnb:"BNBUSDT" };
    const prices={ btc: fall.btc, eth: fall.eth, bnb: fall.bnb, stables:1 };

    for (const [k,symbol] of Object.entries(symbols)) {
      try {
        const res = await fetchJSON(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`, 5000);
        const px = Number(res?.price);
        if (isFinite(px) && px>0) prices[k]=px;
      } catch {}
    }
    localStorage.setItem(cacheKey, JSON.stringify({ ts:now, prices }));
    return prices;
  }

  function initCalc(cfg, pricesUSD, yields) {
    const amount=$("#amountUSD");
    const assetSel=$("#assetSel");
    const stableNote=$("#stableScenarioNote");
    const scenarioWrap=$("#priceScenarios");
    const durationWrap=$("#durationChips");
    const scenarioRow=scenarioWrap?.closest('.scenarios');
    const priceMeta=$("#priceMeta");

    const scenarios = Array.isArray(cfg?.price_scenarios) && cfg.price_scenarios.length ? cfg.price_scenarios : [0,0.2,0.5];
    let scenario=Number(cfg?.defaults?.scenario ?? scenarios[1] ?? 0.2);
    let durationYears=1;

    // Chips rendering
    if (scenarioWrap) {
        scenarioWrap.innerHTML="";
        scenarios.forEach(v => {
            const btn=document.createElement("button");
            btn.type="button"; btn.className="chip"; btn.dataset.scn=String(v);
            btn.textContent = v===0 ? (LANG==="fr"?"Prix plat":"Flat price") : `+${(v*100).toFixed(0)}%/an`;
            scenarioWrap.appendChild(btn);
        });
    }
    
    const chips = scenarioWrap ? Array.from(scenarioWrap.querySelectorAll(".chip")) : [];
    const durationChips = durationWrap ? Array.from(durationWrap.querySelectorAll(".chip")) : [];

    function setChipsEnabled(isStable) {
        chips.forEach(ch => {
            const scn=Number(ch.dataset.scn ?? 0);
            const dis = isStable && scn !== 0;
            ch.disabled = !!dis;
            ch.classList.toggle("is-disabled", !!dis);
        });
        if (stableNote) stableNote.style.display = isStable ? "block" : "none";
        if (scenarioWrap) scenarioWrap.style.display = isStable ? "none" : "flex";
        if (scenarioRow) scenarioRow.classList.toggle("is-stable", !!isStable);
    }

    function recalc() {
      const usd=Number(String(amount?.value ?? "").replace(",", "."));
      const asset=assetSel?.value || "stables";
      const apr=Number(yields?.[asset] ?? 0);
      const px=asset==="stables" ? 1 : Number(pricesUSD?.[asset] ?? 0);
      const isStable = asset==="stables";
      if (isStable && scenario !== 0) scenario = 0;

      setChipsEnabled(isStable);
      setActiveChip("#priceScenarios .chip", String(scenario));
      setActiveChip("#durationChips .chip", String(durationYears));

      if (!usd || usd<=0 || !isFinite(usd)) {
          // Reset UI
          $$(".sim-val").forEach(el => el.textContent = "—");
          return;
      }

      const principalTok=usd/px;
      const tokSel=computeTokens(principalTok, apr, durationYears);
      const unit=asset==="stables"?"STABLE":asset.toUpperCase();
      const maxDec=asset==="stables"?2:6;

      // Update UI Elements by ID (similaire à ton code original)
      const setTxt = (id, txt) => { const el=$(id); if(el) el.textContent=txt; };
      
      setTxt("#depTok", `${fmtNum(principalTok, maxDec)} ${unit}`);
      setTxt("#cap12Tok", `${fmtNum(tokSel, maxDec)} ${unit}`);
      
      const flatVal = tokSel*px;
      const growth = Math.pow(1+scenario, durationYears);
      const scnVal = tokSel*px*growth;
      
      setTxt("#val12Flat", fmtUsd(flatVal,0));
      setTxt("#val12Scn", fmtUsd(scnVal,0));

      const compToggle=$("#toggleDetails");
      const compBox=$("#compDetails");
      if (compToggle && compBox) {
         // Populate detail box
         const t1=computeTokens(principalTok, apr, 1);
         const t3=computeTokens(principalTok, apr, 3);
         const t5=computeTokens(principalTok, apr, 5);
         setTxt("#comp12Tok", `${fmtNum(t1, maxDec)} ${unit}`);
         setTxt("#comp3Tok", `${fmtNum(t3, maxDec)} ${unit}`);
         setTxt("#comp5Tok", `${fmtNum(t5, maxDec)} ${unit}`);
         setTxt("#comp12Usd", fmtUsd(t1*px*(Math.pow(1+scenario,1)),0));
         setTxt("#comp3Usd", fmtUsd(t3*px*(Math.pow(1+scenario,3)),0));
         setTxt("#comp5Usd", fmtUsd(t5*px*(Math.pow(1+scenario,5)),0));
      }

      if (priceMeta) priceMeta.textContent = isStable ? T.stableHint : T.priceHint(fmtNum(px,0), unit, scenario);
    }

    // Event Listeners
    chips.forEach(ch => ch.addEventListener("click", () => {
        if(assetSel?.value==="stables") return;
        scenario=Number(ch.dataset.scn); recalc();
    }));
    durationChips.forEach(ch => ch.addEventListener("click", () => {
        durationYears=Number(ch.dataset.duration); recalc();
    }));
    if (amount) amount.addEventListener("input", recalc);
    if (assetSel) assetSel.addEventListener("change", recalc);
    const compToggle=$("#toggleDetails");
    if(compToggle) compToggle.addEventListener("click", ()=> {
        $("#compDetails")?.classList.toggle("is-open");
        compToggle.setAttribute("aria-expanded", compToggle.getAttribute("aria-expanded")==="true"?"false":"true");
    });

    if (amount) amount.value=String(cfg?.defaults?.amountUSD ?? 10000);
    recalc();
  }

  // --- NAVIGATION & LINKS ---
  function applyLinks(cfg) {
    const email=cfg?.links?.email || "toni@blockpilot.capital";
    const subject=encodeURIComponent(cfg?.links?.emailSubject || "BlockPilot");
    const mailto=`mailto:${email}?subject=${subject}`;
    
    $$("#ctaEmail, #footerEmail").forEach(el => { el.href=mailto; if(el.id==="footerEmail") el.textContent=T.contactLabel; });
    const callUrl=cfg?.links?.bookCall || "";
    $$("#ctaCall, #navCall").forEach(el => el.href=callUrl || mailto);

    const docs=cfg?.links?.docs || "";
    $$("#navDocs, #footerDocs").forEach(el => {
        setDisabledLink(el, !docs);
        if(docs) { el.href=resolveHref(docs); el.target="_blank"; }
    });
    
    // Signatures link fix
    const signUrl = cfg?.links?.signature || "../signature.html";
    $$("#navSignature, #footerSignature").forEach(el => {
       try { const u=new URL(resolveHref(signUrl)); u.searchParams.set("lang", LANG); el.href=u.toString(); }
       catch { el.href=resolveHref(signUrl); }
    });
  }

  function initMobileMenu() {
    const toggle=$("#navToggle");
    if (!toggle) return;
    toggle.textContent = T.menu;
    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("menu-open");
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? T.close : T.menu;
    });
    // Close on click
    $$(".nav__links a").forEach(a => a.addEventListener("click", () => {
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.textContent = T.menu;
    }));
  }

  function enableSmoothScroll() {
    const header=$(".header");
    $$('a[href^="#"]').forEach(a => {
      a.addEventListener("click", (e) => {
        const h=a.getAttribute("href");
        if(h==="#" || !h) return;
        const el=$(h);
        if(!el) return;
        e.preventDefault();
        const top=el.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight||0) - 10;
        window.scrollTo({ top, behavior:"smooth" });
      });
    });
  }

  // --- SIGNATURE EMBEDS (Conservé) ---
  function initSignatureEmbeds(){
    const tabBtns=$$('[data-signature-view]');
    const frame=$("#signatureFrame");
    if (!tabBtns.length && !frame) return;

    let embedLang = (localStorage.getItem("bp_lang") || LANG).startsWith("en") ? "en" : "fr";
    let current = location.hash==="#verify" ? "verify" : "sign";

    const update = () => {
       tabBtns.forEach(b => b.classList.toggle("active", (b.dataset.signatureView||"sign") === current));
       if(frame) {
           const page = current==="verify" ? "verify" : "sign";
           frame.src = fromRoot(`${page}.html?embed=1&lang=${embedLang}`);
       }
    };
    
    tabBtns.forEach(b => b.addEventListener("click", (e)=>{
       e.preventDefault(); current = b.dataset.signatureView; update();
    }));
    update();
  }

  // --- MAIN INIT ---
  async function init() {
    enableSmoothScroll();
    initMobileMenu();
    initSignatureEmbeds();

    const cfg = await firstJSON([fromRoot("data/blockpilot.json"), "./data/blockpilot.json"]);
    applyLinks(cfg);

    // Initialisation du simulateur
    const yields = fillApr(cfg);
    const prices = await loadPricesUSD(cfg);
    initCalc(cfg, prices, yields);
    
    console.log("BlockPilot: UI loaded (TradingView handles charts now).");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
