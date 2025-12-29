/* assets/header.js - Injecteur de menu (Chemins relatifs dynamiques) */
document.addEventListener("DOMContentLoaded", () => {
  
  // Fonction pour trouver la racine du site (.., ou .)
  function getRootPath() {
    const path = window.location.pathname;
    // Si on est dans un sous-dossier de langue (fr/ ou en/)
    if (path.includes('/fr/') || path.includes('/en/')) {
      return '..'; 
    }
    // Sinon on est à la racine
    return '.';
  }

  const R = getRootPath(); // R = Racine (Root)

  const headerHTML = `
  <div class="container">
    <nav class="nav">
      <a class="brand" href="${R}/index.html" style="display: flex; align-items: center; gap: 12px; text-decoration: none;">
        <img class="brand__logo" src="${R}/logo.png" alt="BlockPilot" style="width: 40px; height: 40px; border-radius: 8px;">
        <span style="font-weight: 800; font-size: 20px; color: var(--bp-text-main); letter-spacing: -0.02em;">BlockPilot</span>
      </a>

      <button class="navToggle" id="navToggle" type="button">Menu</button>

      <div class="nav__links">
        <a href="${R}/fr/index.html#performance">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
          Performance
        </a>
        
        <a href="${R}/fr/index.html#security">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Sécurité
        </a>

        <a href="${R}/fr/docs.html">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          Docs
        </a>

        <a href="${R}/fr/signature.html">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34"></path><polygon points="18 2 22 6 12 16 8 16 8 12 18 2"></polygon></svg>
          Signature
        </a>
      </div>

      <div class="lang">
        <a class="pill" href="${R}/fr/index.html">FR</a>
        <a class="pill" href="${R}/en/index.html">EN</a>
      </div>
    </nav>
  </div>`;

  const headerEl = document.querySelector("header.header");
  if (headerEl) {
    headerEl.innerHTML = headerHTML;
    
    // Highlight lien actif
    const currentPath = window.location.pathname;
    const links = headerEl.querySelectorAll(".nav__links a");
    links.forEach(link => {
        // On compare la fin de l'URL pour être sûr
        const hrefFile = link.getAttribute("href").split('/').pop(); 
        if(hrefFile && currentPath.includes(hrefFile)) {
            link.classList.add("active");
        }
    });
    
    // Highlight langue active
    const langPills = headerEl.querySelectorAll(".lang .pill");
    langPills.forEach(p => {
        if(currentPath.includes("/" + p.textContent.toLowerCase() + "/")) {
            p.classList.add("is-active");
        } else {
            p.classList.remove("is-active");
        }
    });

    // Mobile Menu Logic
    const t = document.getElementById("navToggle");
    if(t) {
        t.onclick = () => {
            document.body.classList.toggle("menu-open");
            t.textContent = document.body.classList.contains("menu-open") ? "Fermer" : "Menu";
        };
        headerEl.querySelectorAll(".nav__links a").forEach(a => a.onclick = () => {
             document.body.classList.remove("menu-open");
             t.textContent = "Menu";
        });
    }
  }
});
