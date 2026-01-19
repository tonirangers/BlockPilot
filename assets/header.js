/* assets/header.js - Header Intelligent (Auto-traduction & Liens contextuels) */
document.addEventListener("DOMContentLoaded", () => {
  
  // 1. DÉTECTION DU CONTEXTE (Langue & Racine)
  const currentLang = document.documentElement.lang || "fr"; // 'fr' ou 'en'
  const isEn = currentLang === "en";
  
  const path = window.location.pathname;
  // Détermine si on doit remonter d'un dossier (..) ou rester (.)
  const root = (path.includes('/fr/') || path.includes('/en/')) ? ".." : ".";
  
  // Détermine le nom du fichier actuel pour le switch de langue (ex: docs.html)
  const currentFile = path.split("/").pop() || "index.html";

  // 2. DICTIONNAIRE DES TEXTES
const txt = {
    perf: isEn ? "Performance" : "Performance",
    sec: isEn ? "Security" : "Sécurité",
    docs: isEn ? "Docs" : "Docs",
    sign: isEn ? "Join" : "Souscrire", // <-- Changement ici (Souscrire / Join)
    menu: isEn ? "Menu" : "Menu",
    close: isEn ? "Close" : "Fermer"
  };

  // 3. CONSTRUCTION DES LIENS
  // Le logo et le menu doivent rester dans la langue actuelle
  const homeLink = `${root}/${currentLang}/index.html`;
  const docsLink = `${root}/${currentLang}/docs.html`;
// Avant c'était signature.html, maintenant :
  const signLink = `${root}/${currentLang}/onboarding.html`;

  // Le switcher de langue doit pointer vers le MÊME fichier mais dans l'autre dossier
  const linkFr = `${root}/fr/${currentFile}`;
  const linkEn = `${root}/en/${currentFile}`;

  // 4. HTML DU HEADER
  const headerHTML = `
  <div class="container">
    <nav class="nav">
      <a class="brand" href="${homeLink}" style="display: flex; align-items: center; gap: 12px; text-decoration: none;">
        <img class="brand__logo" src="${root}/logo.png" alt="BlockPilot" style="width: 40px; height: 40px; border-radius: 8px;">
        <span style="font-weight: 800; font-size: 20px; color: var(--bp-text-main); letter-spacing: -0.02em;">BlockPilot</span>
      </a>

      <button class="navToggle" id="navToggle" type="button">${txt.menu}</button>

      <div class="nav__links">
        <a href="${homeLink}#performance">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
          ${txt.perf}
        </a>
        
        <a href="${homeLink}#security">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          ${txt.sec}
        </a>

        <a href="${docsLink}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          ${txt.docs}
        </a>

        <a href="${signLink}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon></svg>
          ${txt.sign}
        </a>
      </div>

      <div class="lang">
        <a class="pill ${!isEn ? 'is-active' : ''}" href="${linkFr}">FR</a>
        <a class="pill ${isEn ? 'is-active' : ''}" href="${linkEn}">EN</a>
      </div>
    </nav>
  </div>`;

  // 5. INJECTION ET LOGIQUE
  const headerEl = document.querySelector("header.header");
  if (headerEl) {
    headerEl.innerHTML = headerHTML;
    
    // Highlight lien actif
    const links = headerEl.querySelectorAll(".nav__links a");
    links.forEach(link => {
        // On compare le nom du fichier (ex: signature.html)
        const hrefFile = link.getAttribute("href").split('/').pop(); 
        // Cas particulier : si on est sur index.html, on veut aussi activer les ancres #performance etc
        if(currentFile === hrefFile || (currentFile === "index.html" && hrefFile.startsWith("index.html"))) {
             // Petit hack : ne pas activer "Performance" si on est sur "Signature"
             if(!window.location.hash && hrefFile.includes("#")) return; 
             // Logic simple : si l'URL contient le href, c'est actif (pour docs et signature)
             if(currentFile === hrefFile.split('#')[0]) link.classList.add("active");
        }
    });

    // Mobile Menu
    const t = document.getElementById("navToggle");
    if(t) {
        t.onclick = () => {
            document.body.classList.toggle("menu-open");
            t.textContent = document.body.classList.contains("menu-open") ? txt.close : txt.menu;
        };
        headerEl.querySelectorAll(".nav__links a").forEach(a => a.onclick = () => {
             document.body.classList.remove("menu-open");
             t.textContent = txt.menu;
        });
    }
  }
});
