// ============================================================
// app.js — orchestrateur principal de l'interface (page index)
// ------------------------------------------------------------
// Tout le rendu HTML du CV se fait ici côté navigateur ; le
// backend Flask ne fait que convertir en PDF et appeler l'IA.
//
// Grandes zones (chercher les bannières « ===== » ci-dessous) :
//   - Éditeur Monaco + templates HTML/CSS intégrés + aperçu live
//   - Persistance : localStorage (brouillons) + IndexedDB (snapshots)
//   - Conversion PDF (POST /convert) et compteur de pages A4
//   - Chat IA, imports texte/PDF, streaming SSE -> Monaco
//   - Tailoring (adaptation à une offre), pack candidature, score ATS
//   - Extracteur d'offre par URL, photo Base64, clé API utilisateur
//
// Le mode formulaire structuré vit dans resume-form.js (source de
// vérité JSON) ; l'export JSON Resume dans export-jsonresume.js.
// ============================================================

// ============================================================
// Utilitaires de base
// ============================================================
const $ = (id) => document.getElementById(id);

function showToast(msg, cls, persist) {
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.textContent = msg;
  c.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  if (!persist) {
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 3500);
  }
  return t;
}

let _activeToast = null;
function setStatus(msg, cls) {
  if (_activeToast) {
    _activeToast.classList.remove('show');
    setTimeout(() => { if (_activeToast) { _activeToast.remove(); _activeToast = null; } }, 250);
  }
  if (!msg) return;
  _activeToast = showToast(msg, cls, cls === 'err');
}

let _autosaveTimer = null;
function flashAutosave() {
  const el = $('autosave');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(_autosaveTimer);
  _autosaveTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

// ============================================================
// Constantes de stockage
// ============================================================
const STORAGE_KEY_HTML = 'html-to-pdf:draft:html';
const STORAGE_KEY_CSS = 'html-to-pdf:draft:css';
const STORAGE_KEY_TAB = 'html-to-pdf:draft:tab';
const HISTORY_KEY = 'cv-history';

// Jeton CSRF (pour les requêtes multipart/form-data)
const CSRF_TOKEN = document.querySelector('meta[name="csrf-token"]')?.content || '';

// ============================================================
// Templates HTML/CSS intégrés
// ============================================================
const TEMPLATES = {
  sobre: {
    html: `<div class="resume-template-1 resume-template-renderer">

  <section class="resume-template-renderer-section personal-data">
    <h2 class="resume-template-renderer-section__title">Informations personnelles</h2>
    <div class="personal-data__photo" style="background:#eee;">
      <!-- URL_DE_VOTRE_PHOTO_ICI -->
    </div>
    <div class="personal-data__title-row">
      <span class="personal-data__name">Prenom Nom</span><span class="personal-data__desired-job-title">Titre du poste</span>
    </div>
    <div class="personal-data__contact-row">
      Ville, Pays &middot; email@example.com &middot; +33 6 00 00 00 00 &middot; linkedin.com/in/profil
    </div></section>

  <section class="resume-template-renderer-section summary-objective">
    <h2 class="resume-template-renderer-section__title summary-objective__title">A propos</h2>
    <div class="summary-objective__content">
      Bref resume professionnel : 2 a 3 phrases qui presentent votre profil, votre experience et ce que vous recherchez.
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Experience</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Poste occupe</span>
      <span class="entry-list__date">Jan 2024 - Present</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Entreprise</span> &mdash; <span class="entry-list__contract" style="color: #787673;">Stage</span> &mdash; <span class="entry-list__location" style="margin-left: 0;">Ville</span>
      </div>
      <div class="entry-list__description">
        <ul>
          <li>Realisation marquante avec metrique chiffree.</li>
          <li>Autre realisation pertinente pour le poste vise.</li>
        </ul>
      </div>
    </div>
    <div class="entry-list__item">
      <span class="entry-list__title">Poste precedent</span>
      <span class="entry-list__date">2022 - 2023</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Autre entreprise</span> &mdash; <span class="entry-list__location" style="margin-left: 0;">Ville</span>
      </div>
      <div class="entry-list__description">
        <ul>
          <li>Description courte de la mission.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Formation</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Diplome</span>
      <span class="entry-list__date">2020 - 2022</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Etablissement</span><span class="entry-list__location">Ville</span>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Competences</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Competence 1</span>
      <span class="plain-list__item">Competence 2</span>
      <span class="plain-list__item">Competence 3</span>
      <span class="plain-list__item">Competence 4</span>
      <span class="plain-list__item">Competence 5</span>
      <span class="plain-list__item">Competence 6</span>
    </div>
  </section>

  <section class="resume-template-renderer-section languages">
    <h2 class="resume-template-renderer-section__title">Langues</h2>
    <div class="languages__items">
      <div class="languages__item">
        <span class="languages__name">Francais</span>
        <span class="languages__description">Natif</span>
      </div>
      <div class="languages__item">
        <span class="languages__name">Anglais</span>
        <span class="languages__description">Courant</span>
      </div>
    </div>
  </section>

</div>`,
    css: `@page { size: A4; margin: 0; }

:root { --resume-template-customization-color: #c9c6c1; }

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  font-family: "Helvetica", "Arial", sans-serif;
  color: #555;
  font-size: 9.5pt;
  line-height: 1.25;
}

ul { list-style: none; }
a { color: inherit; text-decoration: underline; }

.resume-template-1.resume-template-renderer { padding: 16px 36px 12px; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section { border-top: 2px solid var(--resume-template-customization-color); padding-top: 5px; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section .resume-template-renderer-section__title { margin-bottom: 6px; text-transform: uppercase; font-size: 8pt; letter-spacing: 0.5px; color: #555; font-weight: 500; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section.personal-data { border-top: none; padding-top: 0; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section.personal-data .resume-template-renderer-section__title { display: none; }
.resume-template-1.resume-template-renderer .personal-data { display: block; margin-bottom: 10px; min-height: 80px; padding-left: calc(25% + 0px); position: relative; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__photo { aspect-ratio: 1; left: 0; position: absolute; width: 80px; top: 0; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__photo img { width: 100%; height: 100%; border-radius: 6px; object-fit: cover; display: block; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__title-row { margin-bottom: 4px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name,
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #000; font-size: 14pt; font-weight: 500; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title::before { content: ", "; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__contact-row { font-size: 9.5pt; color: #555; }
.resume-template-1.resume-template-renderer .summary-objective { display: flex; margin-bottom: 6px; }
.resume-template-1.resume-template-renderer .summary-objective .summary-objective__title { flex-shrink: 0; width: 25%; margin-bottom: 0; }
.resume-template-1.resume-template-renderer .summary-objective .summary-objective__content { flex: 1; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item { display: block; padding-bottom: 7px; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__title { color: #000; font-weight: 500; display: inline; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__date { float: right; color: #555; font-weight: 400; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__subtitle { color: #000; font-weight: 600; display: inline; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__location { color: #787673; font-weight: 400; display: inline; margin-left: 4px; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__company-row { display: block; margin-top: 1px; clear: both; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__description { margin-top: 3px; clear: both; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__description ul { list-style-type: disc; padding-left: 14px; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__description li { margin-bottom: 1px; }
.resume-template-1.resume-template-renderer .plain-list { display: flex; margin-bottom: 6px; }
.resume-template-1.resume-template-renderer .plain-list .resume-template-renderer-section__title { flex-shrink: 0; width: 25%; margin-bottom: 0; }
.resume-template-1.resume-template-renderer .plain-list .plain-list__items { display: flex; flex-direction: column; gap: 4px 0; flex: 1; }
.resume-template-1.resume-template-renderer .plain-list .plain-list__items .plain-list__item { color: #555; font-weight: 400; padding-right: 12px; width: 100%; }
.resume-template-1.resume-template-renderer .plain-list .plain-list__items .plain-list__item strong { color: #000; font-weight: 600; }
.resume-template-1.resume-template-renderer .section-skills { display: block; margin-bottom: 20px; }
.resume-template-1.resume-template-renderer .section-skills .resume-template-renderer-section__title { width: 100%; margin-bottom: 10px; }
.resume-template-1.resume-template-renderer .section-skills .plain-list__items { display: block; padding-left: 15px; margin-top: 10px; }
.resume-template-1.resume-template-renderer .section-skills .plain-list__items .plain-list__item { display: list-item; list-style-type: disc; width: 100%; margin-bottom: 8px; color: #111; line-height: 1.4; padding-right: 0; font-weight: normal; }
.resume-template-1.resume-template-renderer .languages { display: flex; margin-bottom: 6px; }
.resume-template-1.resume-template-renderer .languages .resume-template-renderer-section__title { flex-shrink: 0; width: 25%; margin-bottom: 0; }
.resume-template-1.resume-template-renderer .languages .languages__items { display: flex; flex-grow: 1; flex-wrap: wrap; gap: 6px 0; }
.resume-template-1.resume-template-renderer .languages .languages__items .languages__item { display: flex; flex-wrap: wrap; padding-right: 12px; width: 33.33%; }
.resume-template-1.resume-template-renderer .languages .languages__items .languages__item .languages__name { color: #000; font-weight: 500; margin-right: 4px; }
.resume-template-1.resume-template-renderer .languages .languages__items .languages__item .languages__description { color: #787673; }
.resume-template-1.resume-template-renderer .languages .languages__items .languages__item .languages__description::before { content: "("; }
.resume-template-1.resume-template-renderer .languages .languages__items .languages__item .languages__description::after { content: ")"; }`,
  },
  moderne: {
    html: `<header class="cv-head">
  <!-- URL_DE_VOTRE_PHOTO_ICI -->
  <h1>Prenom Nom</h1>
  <p class="role">Titre du poste recherche</p>
  <p class="contact">email@example.com &middot; +33 6 00 00 00 00 &middot; linkedin.com/in/profil &middot; Ville</p>
</header>

<section class="cv-section">
  <h2>A propos</h2>
  <p>Bref resume professionnel : 2 a 3 phrases qui presentent votre profil et ce que vous recherchez.</p>
</section>

<section class="cv-section">
  <h2>Experience</h2>
  <div class="job">
    <div class="job-head">
      <span><strong>Poste occupe</strong> &middot; Entreprise</span>
      <span class="date">Jan 2024 - Present</span>
    </div>
    <ul>
      <li>Realisation marquante avec metrique chiffree.</li>
      <li>Autre realisation pertinente pour le poste vise.</li>
    </ul>
  </div>
  <div class="job">
    <div class="job-head">
      <span><strong>Poste precedent</strong> &middot; Autre entreprise</span>
      <span class="date">2022 - 2023</span>
    </div>
    <ul>
      <li>Description courte de la mission.</li>
    </ul>
  </div>
</section>

<section class="cv-section">
  <h2>Formation</h2>
  <div class="job">
    <div class="job-head">
      <span><strong>Diplome</strong> &middot; Etablissement</span>
      <span class="date">2020 - 2022</span>
    </div>
  </div>
</section>

<section class="cv-section">
  <h2>Competences</h2>
  <ul class="skills">
    <li>JavaScript</li><li>TypeScript</li><li>Python</li><li>React</li><li>Node.js</li><li>SQL</li>
  </ul>
</section>`,
    css: `@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1e293b; line-height: 1.4; font-size: 9.5pt; padding: 12mm 14mm; }
h1 { color: #2563eb; font-size: 18pt; font-weight: 700; margin-bottom: 2px; }
.role { color: #475569; font-size: 10.5pt; margin-bottom: 4px; }
.contact { color: #64748b; font-size: 9pt; }
.cv-head { padding-bottom: 8px; border-bottom: 2px solid #2563eb; margin-bottom: 10px; }
.cv-section { margin-bottom: 10px; }
.cv-section h2 { color: #2563eb; font-size: 11pt; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.6px; }
.cv-section p { margin-bottom: 4px; }
.job { margin-bottom: 8px; }
.job-head { display: flex; justify-content: space-between; margin-bottom: 2px; }
.date { color: #94a3b8; font-weight: 400; font-size: 9pt; }
.job ul { list-style: disc; padding-left: 16px; }
.job ul li { margin-bottom: 2px; }
ul.skills { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
ul.skills li { background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 12px; font-size: 9pt; font-weight: 500; }`,
  },
  minimal: {
    html: `<!-- URL_DE_VOTRE_PHOTO_ICI -->
<h1>Prenom Nom</h1>
<p class="meta">Titre du poste &middot; email@example.com &middot; +33 6 00 00 00 00</p>

<h2>Experience</h2>
<p><strong>Poste occupe</strong>, Entreprise &mdash; Jan 2024 - Present</p>
<p>Description courte de ce que vous avez accompli.</p>

<p><strong>Poste precedent</strong>, Autre entreprise &mdash; 2022 - 2023</p>
<p>Autre description courte.</p>

<h2>Formation</h2>
<p><strong>Diplome</strong>, Etablissement &mdash; 2020 - 2022</p>

<h2>Competences</h2>
<p>Competence 1, Competence 2, Competence 3, Competence 4, Competence 5.</p>`,
    css: `@page { size: A4; margin: 0; }
body { font: 10pt/1.4 Georgia, "Times New Roman", serif; color: #222; padding: 16mm; }
h1 { font-size: 18pt; font-weight: normal; margin: 0 0 2px; }
h2 { font-size: 12pt; font-weight: normal; margin: 12px 0 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
p { margin: 0 0 4px; }
.meta { color: #666; margin-bottom: 12px; }
strong { font-weight: 600; }`,
  },
};

// Modèle « Moderne » : même structure que « sobre » (donc mêmes données rendues),
// avec une variante visuelle (accent bleu, titres colorés). Réutilise le CSS sobre
// + un bloc d'overrides ciblant les mêmes classes, pour zéro risque structurel.
TEMPLATES.moderne = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css + `

/* === Modele Moderne (overrides) === */
:root { --resume-template-customization-color: #2563eb; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section .resume-template-renderer-section__title { color: #2563eb; font-weight: 700; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name { color: #1e3a8a; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #2563eb; }`,
};

// Modèle « Classique » : serif élégant, accent brun sobre. Même structure que sobre.
TEMPLATES.classique = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css + `

/* === Modele Classique (overrides) === */
:root { --resume-template-customization-color: #7a5c3e; }
.resume-template-1.resume-template-renderer { font-family: Georgia, "Times New Roman", serif; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section .resume-template-renderer-section__title { color: #5a3e28; letter-spacing: 1px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name { color: #2a2a2a; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #5a3e28; }`,
};

// Modèle « Minimal » : épuré, sans bordures de section, titres discrets. Même structure que sobre.
TEMPLATES.minimal = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css + `

/* === Modele Minimal (overrides) === */
.resume-template-1.resume-template-renderer .resume-template-renderer-section { border-top: none; padding-top: 14px; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section .resume-template-renderer-section__title { color: #999; letter-spacing: 2px; font-weight: 400; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name { color: #111; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #666; }`,
};

// Modèle « Graphique » : inspiré du CV de Hariss (Timeline, en-tête flex)
TEMPLATES.graphique = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css + `

/* === Modele Graphique (overrides) === */
:root { --resume-template-customization-color: #0078d4; }
.resume-template-1.resume-template-renderer { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
.resume-template-1.resume-template-renderer .personal-data { display: flex !important; align-items: center; justify-content: space-between; min-height: auto; padding-left: 0 !important; margin-bottom: 10px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__photo { position: static !important; width: 100px !important; height: 100px !important; border-radius: 4px; overflow: hidden; margin-right: 20px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__title-row { flex: 1; display: flex; flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; margin-bottom: 0; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name { font-size: 14pt; font-weight: 700; text-transform: uppercase; color: #111; line-height: 1.2; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #555; font-size: 12pt; font-weight: 600; margin-top: 0; display: inline; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title::before { content: "·"; display: inline; margin-right: 4px; color: #0078d4; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__contact-row { flex: 0 0 250px; text-align: right; font-size: 9.5pt; color: #444; line-height: 1.5; margin-left: 20px; }
.resume-template-1.resume-template-renderer .resume-template-renderer-section .resume-template-renderer-section__title { color: #0078d4; font-size: 10pt; border-bottom: none; font-weight: 700; margin-bottom: 10px; margin-top: 10px; text-transform: uppercase; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item { position: relative; padding-left: 20px; border-left: 2px solid #555; margin-left: 10px; margin-bottom: 0; padding-bottom: 12px; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item:last-child { border-left-color: transparent; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item::before { content: ""; position: absolute; left: -6px; top: 0px; width: 10px; height: 10px; border-radius: 50%; background-color: #555; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__date { float: right; color: #888; font-size: 10pt; font-weight: normal; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__title { font-weight: 700; font-size: 10pt; color: #111; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__subtitle { font-weight: 700; color: #111; font-size:9pt}
.resume-template-1.resume-template-renderer .summary-objective { display: block; }
.resume-template-1.resume-template-renderer .summary-objective .summary-objective__title { display: none; }
.resume-template-1.resume-template-renderer .summary-objective .summary-objective__content { font-size: 10pt; text-align: justify; margin-bottom: 10px; }
.resume-template-1.resume-template-renderer .entry-list .entry-list__item .entry-list__description ul { padding-left: 15px; }

/* === Layout overrides for Plain Lists (Skills, Certs, etc) === */
.resume-template-1.resume-template-renderer .plain-list,
.resume-template-1.resume-template-renderer .languages { display: block !important; margin-bottom: 10px !important; }

.resume-template-1.resume-template-renderer .section-skills { border-top: 2px solid var(--resume-template-customization-color) !important; border-bottom: 2px solid var(--resume-template-customization-color) !important; padding-top: 5px !important; padding-bottom: 8px !important; }

.resume-template-1.resume-template-renderer .plain-list .resume-template-renderer-section__title,
.resume-template-1.resume-template-renderer .languages .resume-template-renderer-section__title { display: block !important; width: 100% !important; margin-bottom: 8px !important; }

.resume-template-1.resume-template-renderer .section-skills .plain-list__items { display: block !important; padding-left: 15px !important; margin-top: 6px !important; }
.resume-template-1.resume-template-renderer .section-skills .plain-list__items .plain-list__item { display: list-item !important; list-style-type: disc !important; width: 100% !important; margin-bottom: 4px !important; color: #111 !important; line-height: 1.4 !important; padding-right: 0 !important; font-weight: normal !important; }

/* Side-by-side Langues & Centres d'interets */
.resume-template-1.resume-template-renderer .section-languages,
.resume-template-1.resume-template-renderer .section-interests { display: inline-block !important; width: 48% !important; vertical-align: top !important; margin-bottom: 0 !important; border-top: none !important; padding-top: 0 !important; }
.resume-template-1.resume-template-renderer .section-languages { margin-right: 2% !important; }

.resume-template-1.resume-template-renderer .section-languages .languages__items,
.resume-template-1.resume-template-renderer .section-interests .plain-list__items { display: block !important; padding-left: 15px !important; margin-top: 6px !important; }

.resume-template-1.resume-template-renderer .section-languages .languages__items .languages__item,
.resume-template-1.resume-template-renderer .section-interests .plain-list__items .plain-list__item { display: list-item !important; list-style-type: disc !important; width: 100% !important; margin-bottom: 4px !important; padding-right: 0 !important; font-weight: normal !important; color: #111 !important; }

.resume-template-1.resume-template-renderer .section-languages .languages__items .languages__item .languages__name { font-weight: normal !important; color: #111 !important; display: inline !important; }
.resume-template-1.resume-template-renderer .section-languages .languages__items .languages__item .languages__description { color: #555 !important; display: inline !important; }
.resume-template-1.resume-template-renderer .section-languages .languages__items .languages__item .languages__description::before { content: " : " !important; }
.resume-template-1.resume-template-renderer .section-languages .languages__items .languages__item .languages__description::after { content: "" !important; }`,
};

const _TYPE_STORE_PREFIX = 'html-to-pdf:type:';
function _docTypeKey(type) { return _TYPE_STORE_PREFIX + type.toLowerCase(); }
const STORAGE_KEY_LAST_TYPE = 'html-to-pdf:last-doc-type';
let _activeDocType = 'CV';

const _LETTRE_SKELETON = `<div style="font-family: 'Inter', sans-serif; max-width: 680px; margin: 40px auto; color: #222; line-height: 1.7; font-size: 14px;">

  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px;">
    <!-- Infos de l'entreprise à gauche -->
    <div style="flex: 1; padding-right: 20px;">
      <p style="margin: 0;"><strong>Nom de l'entreprise</strong><br>
      Service Recrutement<br>
      Adresse de l'entreprise</p>
    </div>
    
    <!-- Infos personnelles à droite -->
    <div style="text-align: right; flex: 1; padding-left: 20px;">
      <p style="margin: 0;"><strong>Prénom Nom</strong><br>
      Adresse, Ville<br>
      email@example.com &middot; +33 6 00 00 00 00</p>
      <p style="margin: 16px 0 0; color: #555;">Ville, le JJ/MM/AAAA</p>
    </div>
  </div>

  <p style="margin-bottom: 32px;"><strong>Objet : Candidature au poste de [Intitulé du poste]</strong></p>

  <p>Madame, Monsieur,</p>

  <p>[Accroche : présentez-vous brièvement et expliquez pourquoi ce poste et cette entreprise vous intéressent particulièrement.]</p>

  <p>[Argumentaire : décrivez vos compétences et expériences les plus pertinentes, avec des exemples concrets.]</p>

  <p>[Conclusion : réaffirmez votre motivation, mentionnez votre disponibilité pour un entretien et remerciez pour l'attention portée à votre candidature.]</p>

  <p>Dans l'attente de votre réponse, je reste à votre disposition pour tout échange.</p>

  <p>Veuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.</p>

  <br><br>
  <p style="text-align: right; padding-right: 40px;"><strong>Prénom Nom</strong></p>

</div>`;

// ============================================================
// Variables globales Monaco
// ============================================================
let editor = null;
let htmlModel;
let cssModel;
let activeTab = 'html';
let _isPreviewPrintMode = false;
let _atsMissingKeywords = [];
let _atsBoostEnabled = false;
let _isSwitchingDoc = false;
let _monacoLoading = false;
let _monacoLoadPromise = null;
let _initialFormJsonForBoot = null;

// Modèle stub (avant chargement Monaco) : même interface getValue/setValue/onDidChangeContent.
function _makeModelStub(initialValue) {
  let _v = initialValue || '';
  const _listeners = [];
  return {
    _stub: true,
    getValue() { return _v; },
    setValue(v) { _v = String(v); _listeners.forEach(fn => fn()); },
    onDidChangeContent(fn) { _listeners.push(fn); return { dispose() { } }; },
  };
}

// Sauvegarde l'état courant dans localStorage.
function _saveCurrentState() {
  if (_isSwitchingDoc || !htmlModel) return;
  try {
    let formJson = null;
    if (window.ResumeForm && window.ResumeForm.matchesEditor && window.ResumeForm.matchesEditor()) {
      formJson = window.ResumeForm.getData();
    }
    localStorage.setItem(_docTypeKey(_activeDocType), JSON.stringify({
      html: htmlModel.getValue(),
      css: cssModel ? cssModel.getValue() : '',
      json: formJson,
    }));
    localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType);
    flashAutosave();
  } catch (_) { }
}

function _loadMonacoLoader() {
  if (window.require && window.require.config) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-monaco-loader="true"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs/loader.js';
    script.async = true;
    script.dataset.monacoLoader = 'true';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Chargement de Monaco impossible.'));
    document.head.appendChild(script);
  });
}

// Charge Monaco à la demande (premier onglet html/css).
function _ensureMonaco() {
  if (editor) return Promise.resolve(editor);
  if (_monacoLoadPromise) return _monacoLoadPromise;
  _monacoLoading = true;

  _monacoLoadPromise = _loadMonacoLoader()
    .then(() => new Promise((resolve, reject) => {
      require.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' } });
      require(['vs/editor/editor.main'], resolve, reject);
    }))
    .then(() => {
      const h = htmlModel.getValue();
      const c = cssModel.getValue();
      htmlModel = monaco.editor.createModel(h, 'html');
      cssModel = monaco.editor.createModel(c, 'css');
      editor = monaco.editor.create($('editor'), {
        model: htmlModel,
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: 'on',
        fontSize: 13,
        tabSize: 2,
        scrollBeyondLastLine: false,
        scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
        overviewRulerLanes: 0,
      });
      editor.setModel(activeTab === 'css' ? cssModel : htmlModel);
      setTimeout(function () {
        if (htmlModel.getValue().includes('<!-- #region Photo_Base64 -->')) {
          editor.trigger('fold', 'editor.foldAllMarkerRegions');
        }
        _foldStyleBlocks();
      }, 400);
      htmlModel.onDidChangeContent(() => { _saveCurrentState(); schedulePreview(); });
      cssModel.onDidChangeContent(() => { _saveCurrentState(); schedulePreview(); });
      _monacoLoading = false;
      return editor;
    })
    .catch((err) => {
      _monacoLoading = false;
      _monacoLoadPromise = null;
      showToast(err.message || 'Chargement de Monaco impossible.', 'err');
      throw err;
    });

  return _monacoLoadPromise;
}

function _bootResumeFormIfReady() {
  if (!window.ResumeForm || !htmlModel) return;
  if (window.ResumeForm.setDocType) window.ResumeForm.setDocType(_activeDocType);
  if (window.ResumeForm.init) window.ResumeForm.init();
  if (_initialFormJsonForBoot && window.ResumeForm.loadData) {
    window.ResumeForm.loadData(_initialFormJsonForBoot, true);
    _initialFormJsonForBoot = null;
  }
}

window.__bootResumeFormIfReady = _bootResumeFormIfReady;

// ============================================================
// Fusion HTML + CSS avec échappement anti-injection de balise
// ============================================================
function mergedHtml() {
  const html = htmlModel ? htmlModel.getValue() : '';
  let css = cssModel ? cssModel.getValue() : '';

  if (_isPreviewPrintMode) {
    css = css.replace(/@media\s+print\b/gi, '@media screen');
  }

  let result;
  if (!css.trim()) {
    result = html;
  } else {
    // Empêcher la fermeture prématurée du bloc <style> par du CSS malformé.
    const safeCss = css.replace(/<\/style\s*>/gi, '<\\/style>');
    if (/<\/head>/i.test(html)) {
      result = html.replace(/<\/head>/i, `<style>\n${safeCss}\n</style>\n</head>`);
    } else if (/<html[\s>]/i.test(html)) {
      result = html.replace(/<html([^>]*)>/i, `<html$1>\n<head><meta charset="utf-8"><style>\n${safeCss}\n</style></head>`);
    } else {
      result = `<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<style>\n${safeCss}\n</style>\n</head>\n<body>\n${html}\n</body>\n</html>`;
    }
  }

  if (_atsBoostEnabled && _atsMissingKeywords.length > 0) {
    const boostText = _atsMissingKeywords
      .join(' ')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const boostSpan = `<span style="font-size:1px;color:#ffffff;line-height:0;">${boostText}</span>`;
    result = /<\/body>/i.test(result)
      ? result.replace(/<\/body>/i, boostSpan + '</body>')
      : result + boostSpan;
  }

  return result;
}

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  const importPane = $('import-pane');
  const editorDiv = $('editor');
  const formPane = $('form-pane');
  if (importPane) importPane.classList.remove('active');
  if (formPane) formPane.classList.remove('active');
  // Les outils d'édition de code ne servent que dans les onglets HTML / CSS.
  const editorTools = $('editor-tools');
  if (editorTools) editorTools.style.display = (tab === 'html' || tab === 'css') ? '' : 'none';
  if (tab === 'import') {
    if (editorDiv) editorDiv.style.display = 'none';
    if (importPane) importPane.classList.add('active');
  } else if (tab === 'form') {
    if (editorDiv) editorDiv.style.display = 'none';
    if (formPane) formPane.classList.add('active');
    if (window.ResumeForm && window.ResumeForm.onShow) window.ResumeForm.onShow();
  } else {
    if (editorDiv) editorDiv.style.display = '';
    _ensureMonaco().catch(() => { });
    if (editor) editor.setModel(tab === 'css' ? cssModel : htmlModel);
  }
  try { localStorage.setItem(STORAGE_KEY_TAB, tab); } catch (_) { }
}

// Affiche/masque les outils du mode Expert (onglets code, snippets, options PDF).
function applyExpertMode(exp) {
  const expertTabs = $('expert-tabs');
  const expertTools = $('expert-tools-snippets');
  const advancedOpts = $('advanced-pdf-opts');
  if (expertTabs) expertTabs.style.display = exp ? 'flex' : 'none';
  if (expertTools) expertTools.style.display = exp ? 'inline-flex' : 'none';
  if (advancedOpts) advancedOpts.style.display = exp ? 'block' : 'none';
  if (!exp && ['html', 'css', 'import'].includes(activeTab)) {
    switchTab('form');
  }
}

// Force l'état du mode Expert (case à cocher + persistance + affichage).
function setExpertMode(exp) {
  const cb = $('expert-mode-checkbox');
  if (cb) cb.checked = exp;
  try { localStorage.setItem('html-to-pdf:expert-mode', exp); } catch (_) { }
  applyExpertMode(exp);
}

// ============================================================
// Utilitaires nommage (aligné Python)
// ============================================================
function slug(s) {
  if (!s) return '';
  return s.normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '_')
    .replace(/[^\w\s-]/gu, '')
    .trim()
    .replace(/[\s_]+/g, '_');
}

function autoFilename() {
  const today = new Date().toISOString().slice(0, 10);
  const docType = $('doc_type').value || 'Document';
  const company = slug($('company').value);
  const role = slug($('role').value);
  const tail = company || role || '';
  return tail ? `${docType}_${tail}_${today}.pdf` : `${docType}_${today}.pdf`;
}

function refreshFilenamePreview() {
  const custom = $('filename').value.trim();
  const auto = autoFilename();
  $('filename_preview').textContent = custom ? `Nom : ${custom}` : `Nom auto : ${auto}`;
  const pill = $('topbar-filename');
  if (pill) pill.textContent = custom || auto;
}

['doc_type', 'company', 'role', 'filename'].forEach(id =>
  $(id).addEventListener('input', refreshFilenamePreview)
);
refreshFilenamePreview();

// ============================================================
// Indicateur de pages A4
// ============================================================
function updatePageCount() {
  const iframe = $('preview');
  const badge = $('page-count-badge');
  if (!badge || !iframe) return;
  try {
    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;
    // A4 à 96 dpi ≈ 1122px (297mm × 96 / 25.4)
    const A4_H = 1122;
    const h = doc.body.scrollHeight;
    const pages = Math.max(1, Math.ceil(h / A4_H));
    if (pages === 1) {
      badge.textContent = '1 page ✓';
      badge.className = 'page-badge ok';
    } else {
      badge.textContent = `${pages} pages ⚠`;
      badge.className = pages === 2 ? 'page-badge warn' : 'page-badge over';
    }
  } catch (_) { }
}

// ============================================================
// Prévisualisation et estimation de tokens avec debounce
// ============================================================
function estimateTokens() {
  if (typeof htmlModel === 'undefined' || !htmlModel) return;
  let html = htmlModel.getValue() || '';
  html = html.replace(/src="data:image\/[^"]{20,}"/g, 'src="[IMAGE_BASE64]"');
  const css = typeof cssModel !== 'undefined' && cssModel ? (cssModel.getValue() || '') : '';

  const jobEl = $('job-desc-input');
  const jobDesc = jobEl ? jobEl.value.trim() : '';
  const tailorTokens = Math.ceil((html.length + css.length + jobDesc.length) / 4);

  const elTailor = $('token-count-tailor');
  if (elTailor) elTailor.textContent = `≈ ${tailorTokens.toLocaleString('fr-FR')} tokens`;
  const elPack = $('token-count-pack');
  if (elPack) elPack.textContent = `≈ ${tailorTokens.toLocaleString('fr-FR')} tokens`;

  const chatEl = $('chat-input');
  const chatInput = chatEl ? chatEl.value.trim() : '';
  const chatTokens = Math.ceil((html.length + css.length + chatInput.length) / 4);

  const elChat = $('token-count-chat');
  if (elChat) elChat.textContent = `≈ ${chatTokens.toLocaleString('fr-FR')} tokens`;
}

['job-desc-input', 'chat-input'].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', estimateTokens);
});

let previewTimer;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    $('preview').srcdoc = mergedHtml();
    // Mettre à jour le compteur après un délai pour laisser l'iframe charger
    setTimeout(updatePageCount, 600);
    estimateTokens();
  }, 400);
}

$('preview').addEventListener('load', () => {
  updatePageCount();
  estimateTokens();
});

if ($('btn-print-mode')) {
  $('btn-print-mode').addEventListener('click', (e) => {
    _isPreviewPrintMode = !_isPreviewPrintMode;
    e.currentTarget.classList.toggle('active', _isPreviewPrintMode);
    schedulePreview();
  });
}

// ============================================================
// Snapshots IndexedDB
// ============================================================
const IDB_DB = 'html-to-pdf-snapshots';
const IDB_STORE = 'snapshots';
const MAX_SNAPS = 20;

const IDB_HTML_STORE = 'cv-html-store';

function _openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'ts' });
      }
      if (!db.objectStoreNames.contains(IDB_HTML_STORE)) {
        db.createObjectStore(IDB_HTML_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function saveHtmlToIDB(id, html, css, json, templateId) {
  try {
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_HTML_STORE, 'readwrite');
      tx.objectStore(IDB_HTML_STORE).put({ id, html, css, json: json || null, templateId: templateId || null });
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
  } catch (_) { }
}

async function loadHtmlFromIDB(id) {
  try {
    const db = await _openIDB();
    return await new Promise((res, rej) => {
      const tx = db.transaction(IDB_HTML_STORE, 'readonly');
      const req = tx.objectStore(IDB_HTML_STORE).get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = e => rej(e.target.error);
    });
  } catch (_) { return null; }
}

async function deleteHtmlFromIDB(id) {
  try {
    const db = await _openIDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_HTML_STORE, 'readwrite');
      tx.objectStore(IDB_HTML_STORE).delete(id);
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
  } catch (_) { }
}

async function saveSnapshot(label) {
  if (!htmlModel) return;
  try {
    const db = await _openIDB();
    // Sauver aussi les données du formulaire : sans elles, restaurer un snapshot
    // de CV-formulaire ne réhydrate pas les champs (l'éditeur et le formulaire
    // se désynchronisent).
    let formJson = null;
    if (window.ResumeForm && window.ResumeForm.matchesEditor
      && window.ResumeForm.matchesEditor() && window.ResumeForm.getData) {
      formJson = window.ResumeForm.getData();
    }
    const snap = {
      ts: Date.now(),
      label: label || new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }),
      html: htmlModel.getValue(),
      css: cssModel ? cssModel.getValue() : '',
      json: formJson,
      doc_type: $('doc_type')?.value || 'CV',
      company: $('company')?.value || '',
      role: $('role')?.value || '',
    };
    await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const st = tx.objectStore(IDB_STORE);
      st.put(snap);
      tx.oncomplete = res;
      tx.onerror = e => rej(e.target.error);
    });
    // Garder seulement les MAX_SNAPS derniers
    await _pruneSnapshots(db);
  } catch (e) {
    console.warn('Snapshot:', e);
  }
}

async function _pruneSnapshots(db) {
  return new Promise((res) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const st = tx.objectStore(IDB_STORE);
    const req = st.getAll();
    req.onsuccess = () => {
      const all = req.result.sort((a, b) => b.ts - a.ts);
      all.slice(MAX_SNAPS).forEach(s => st.delete(s.ts));
    };
    tx.oncomplete = res;
  });
}

async function listSnapshots() {
  const db = await _openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).getAll();
    req.onsuccess = () => res(req.result.sort((a, b) => b.ts - a.ts));
    req.onerror = e => rej(e.target.error);
  });
}

async function deleteSnapshot(ts) {
  const db = await _openIDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(ts);
    tx.oncomplete = res;
    tx.onerror = e => rej(e.target.error);
  });
}

async function restoreSnapshot(snap) {
  if (!htmlModel) return;
  if (!(await uiConfirm(`Restaurer le snapshot "${snap.label}" ? Le contenu actuel sera remplacé.`, { title: 'Restaurer le snapshot', confirmLabel: 'Restaurer' }))) return;
  // Garde l'autosave silencieux pendant qu'on remet les 3 états en cohérence.
  _isSwitchingDoc = true;
  // Mettre à jour le type AVANT setValue : l'autosave (onDidChangeContent) sauve
  // sous _activeDocType, sinon le contenu restauré écrase le brouillon de l'ancien type.
  if (snap.doc_type) {
    _activeDocType = snap.doc_type;
    if ($('doc_type')) $('doc_type').value = _activeDocType;
    try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }
    if (window.ResumeForm && window.ResumeForm.setDocType) window.ResumeForm.setDocType(_activeDocType);
  }
  htmlModel.setValue(snap.html || '');
  if (cssModel) cssModel.setValue(snap.css || '');
  // Réhydrater le formulaire : indispensable pour les CV-formulaire, sinon les
  // champs restent périmés/vides face à l'éditeur restauré.
  if (window.ResumeForm) {
    if (snap.json && window.ResumeForm.loadData) {
      window.ResumeForm.loadData(snap.json, true); // skipApply : le HTML est déjà posé
    } else if (window.ResumeForm.clearData) {
      window.ResumeForm.clearData(); // snapshot HTML pur (ou ancien, sans json)
    }
  }
  _resetTailorDiff();
  _foldStyleBlocks();
  if (snap.company && $('company')) $('company').value = snap.company;
  if (snap.role && $('role')) $('role').value = snap.role;
  refreshFilenamePreview();
  closeSnapshotsModal();
  setTimeout(() => { _isSwitchingDoc = false; _saveCurrentState(); }, 50);
  showToast('Snapshot restauré.', 'ok');
}

// Auto-snapshot toutes les 5 minutes
setInterval(() => saveSnapshot(), 5 * 60 * 1000);

// Modal Snapshots
function openSnapshotsModal() {
  const modal = $('modal-snapshots');
  modal.classList.add('open');
  renderSnapshotsList();
}
function closeSnapshotsModal() {
  $('modal-snapshots').classList.remove('open');
}

async function renderSnapshotsList() {
  const list = $('snapshots-list');
  list.innerHTML = '';
  let snaps;
  try {
    snaps = await listSnapshots();
  } catch (_) {
    list.innerHTML = '<div class="snapshots-empty">Impossible de charger les snapshots.</div>';
    return;
  }
  if (!snaps.length) {
    list.innerHTML = '<div class="snapshots-empty">Aucun snapshot. Les snapshots sont créés automatiquement toutes les 5 minutes.</div>';
    return;
  }
  snaps.forEach(s => {
    const date = new Date(s.ts).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
    const chars = (s.html || '').length + (s.css || '').length;
    const item = document.createElement('div');
    item.className = 'snapshot-item';
    item.innerHTML = `
      <div>
        <div>${s.label}</div>
        <div class="snap-meta">${date} · ${chars.toLocaleString()} car. · ${s.doc_type || 'CV'}${s.company ? ' · ' + s.company : ''}${s.role ? ' · ' + s.role : ''}</div>
      </div>
      <div class="snap-actions">
        <button class="snap-restore">Restaurer</button>
        <button class="snap-delete">Suppr.</button>
      </div>`;
    item.querySelector('.snap-restore').onclick = () => restoreSnapshot(s);
    item.querySelector('.snap-delete').onclick = async () => {
      await deleteSnapshot(s.ts);
      renderSnapshotsList();
    };
    list.appendChild(item);
  });
}

$('btn-copy-json').onclick = () => {
  if (window.ResumeForm) {
    const data = window.ResumeForm.getData();
    if (data) {
      const dataToCopy = { ...data };
      delete dataToCopy.photo; // Ne pas polluer le presse-papiers avec la base64
      navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2))
        .then(() => showToast('JSON copié !', 'ok'))
        .catch(() => showToast('Erreur copie JSON', 'err'));
    } else {
      showToast('Aucun JSON dispo', 'err');
    }
  }
};

$('btn-import-json').onclick = async () => {
  if (!window.ResumeForm || !window.ResumeForm.loadData) {
    showToast('Mode formulaire non disponible', 'err');
    return;
  }

  let text = '';
  // Tente de lire le presse-papier
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      text = await navigator.clipboard.readText();
    }
  } catch (err) {
    console.warn("Lecture presse-papier impossible", err);
  }

  // Vérifie si le texte est du JSON valide
  let isValidJson = false;
  if (text) {
    try {
      JSON.parse(text);
      isValidJson = true;
    } catch (e) { }
  }

  // Si on n'a pas de JSON valide dans le presse-papier, on demande un collage manuel
  if (!isValidJson) {
    text = await uiPrompt('Collez les données JSON de votre CV ici :', {
      title: 'Importer un JSON',
      multiline: true,
      placeholder: '{ "fullName": "…", … }',
      validate: (v) => {
        if (!v.trim()) return 'Le champ est vide.';
        try { JSON.parse(v); return null; } catch (_) { return 'JSON invalide — vérifie la syntaxe.'; }
      },
    });
    if (!text) return; // Annulé par l'utilisateur
  }

  try {
    const data = JSON.parse(text);
    if (!window.ResumeForm.loadData(data, false, true)) {
      showToast('JSON sans données de CV reconnaissables — import ignoré.', 'err');
      return;
    }
    showToast('JSON importé avec succès !', 'ok');
    switchTab('form');
  } catch (e) {
    showToast('JSON invalide', 'err');
  }
};

$('btn-snapshots').onclick = openSnapshotsModal;
$('close-snapshots').onclick = closeSnapshotsModal;
$('modal-snapshots').addEventListener('click', e => {
  if (e.target === $('modal-snapshots')) closeSnapshotsModal();
});
$('btn-save-snapshot-now').onclick = async () => {
  await saveSnapshot('Manuel · ' + new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }));
  renderSnapshotsList();
  showToast('Snapshot créé.', 'ok');
};

// ============================================================
// Initialisation légère (Monaco est chargé à la demande)
// ============================================================
(function initEditorState() {
  _activeDocType = localStorage.getItem(STORAGE_KEY_LAST_TYPE);
  if (!_activeDocType || !['CV', 'Lettre', 'Maître', 'Autre'].includes(_activeDocType)) {
    _activeDocType = $('doc_type') ? $('doc_type').value : 'CV';
  }
  if ($('doc_type')) $('doc_type').value = _activeDocType;

  let initialHtml = null;
  let initialCss = null;
  let initialFormJson = null;

  const raw = localStorage.getItem(_docTypeKey(_activeDocType));
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      initialHtml = saved.html;
      initialCss = saved.css;
      initialFormJson = saved.json || null;
    } catch (_) { }
  }

  if (initialHtml === null) {
    if (_activeDocType === 'CV' || _activeDocType === 'Maître') {
      const legacyHtml = localStorage.getItem(STORAGE_KEY_HTML);
      const legacyCss = localStorage.getItem(STORAGE_KEY_CSS);
      if (legacyHtml !== null) {
        initialHtml = legacyHtml;
        initialCss = legacyCss || '';
      } else {
        initialHtml = TEMPLATES.sobre.html;
        initialCss = TEMPLATES.sobre.css;
      }
    } else if (_activeDocType === 'Lettre') {
      initialHtml = _LETTRE_SKELETON;
      initialCss = '';
    } else {
      initialHtml = '';
      initialCss = '';
    }
  }

  const wantTab = 'form';

  htmlModel = _makeModelStub(initialHtml || '');
  cssModel = _makeModelStub(initialCss || '');


  htmlModel.onDidChangeContent(() => {
    _saveCurrentState();
    schedulePreview();
  });
  cssModel.onDidChangeContent(() => {
    _saveCurrentState();
    schedulePreview();
  });

  document.querySelectorAll('.tab').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
  _initialFormJsonForBoot = initialFormJson;
  // Restaurer le formulaire depuis le brouillon (CV non encore exporté en PDF).
  // loadData() reconstruit les champs ET réécrit htmlModel + l'aperçu.
  _bootResumeFormIfReady();
  switchTab(wantTab);

  $('preview').srcdoc = mergedHtml();

  $('format-btn').onclick = () => {
    if (!editor) { _ensureMonaco().then(() => $('format-btn').click()).catch(() => { }); return; }
    const action = editor.getAction('editor.action.formatDocument');
    if (action) action.run();
  };
  $('snippet-page').onclick = () => {
    switchTab('css'); insertSnippet('@page { size: A4; margin: 15mm; }\n');
  };
  $('snippet-pagebreak').onclick = () => {
    switchTab('html'); insertSnippet('<div style="page-break-after: always;"></div>\n');
  };
  $('refresh-preview').onclick = () => { $('preview').srcdoc = mergedHtml(); };

  // --- Expert Mode Toggle ---
  const expertCheckbox = $('expert-mode-checkbox');

  if (expertCheckbox) {
    const isExpert = false;
    expertCheckbox.checked = isExpert;
    applyExpertMode(isExpert);

    expertCheckbox.addEventListener('change', async (e) => {
      // Avertissement « Eject » : passer en Expert sur un CV issu du formulaire
      // rompt la synchronisation avec celui-ci.
      if (e.target.checked && window.ResumeForm && window.ResumeForm.matchesEditor
        && window.ResumeForm.matchesEditor()) {
        if (!(await uiConfirm('⚠️ Si tu modifies le code HTML, tu perds la synchronisation avec le formulaire. Continuer ?', { title: 'Mode Expert', confirmLabel: 'Continuer', danger: true }))) {
          e.target.checked = false;
          return;
        }
      }
      setExpertMode(e.target.checked);
    });
  }

  $('template-select').onchange = async (e) => {
    const key = e.target.value;
    e.target.value = '';
    if (!key) return;
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    const dirty = htmlModel.getValue().trim() || cssModel.getValue().trim();
    if (dirty && !(await uiConfirm(`Charger le template "${key}" et écraser le contenu actuel ?`, { title: 'Charger un template', confirmLabel: 'Charger' }))) return;
    // Les templates sont des mises en page de CV. Aligner le type AVANT setValue
    // pour ne pas écraser le brouillon d'un autre type (ex. Lettre) via l'autosave.
    if (_activeDocType !== 'CV' && _activeDocType !== 'Maître') {
      _activeDocType = 'CV';
      if ($('doc_type')) $('doc_type').value = 'CV';
      try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, 'CV'); } catch (_) { }
    }

    _isSwitchingDoc = true;
    htmlModel.setValue(tpl.html);
    cssModel.setValue(tpl.css);
    if (window.ResumeForm && window.ResumeForm.clearData) {
      window.ResumeForm.clearData();
    }
    setTimeout(() => { _isSwitchingDoc = false; }, 50);
  };

  // ---- Sélecteur de type de document (CV / Lettre) -------------------------
  $('doc_type').addEventListener('change', function () {
    const newType = this.value;
    if (newType === _activeDocType) return;

    _saveCurrentState(); // Sauvegarder le document actuel avant de le quitter

    _isSwitchingDoc = true; // Empêcher l'autosave de polluer le nouveau document
    _activeDocType = newType;
    try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }

    if (window.ResumeForm && window.ResumeForm.setDocType) {
      window.ResumeForm.setDocType(_activeDocType);
    }

    const raw = localStorage.getItem(_docTypeKey(newType));
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        htmlModel.setValue(saved.html || '');
        if (cssModel) cssModel.setValue(saved.css || '');
        if (saved.json && window.ResumeForm && window.ResumeForm.loadData) {
          window.ResumeForm.loadData(saved.json, activeTab !== 'form'); // Écrase le HTML corrompu si on est sur l'onglet formulaire
        } else if (!saved.json && window.ResumeForm && window.ResumeForm.clearData) {
          window.ResumeForm.clearData(); // Document Expert pur, vider le formulaire
        }
      } catch (_) { }
    } else {
      if (newType === 'Lettre') {
        htmlModel.setValue(_LETTRE_SKELETON);
        if (cssModel) cssModel.setValue('');
      } else if (newType === 'CV' || newType === 'Maître') {
        htmlModel.setValue(TEMPLATES.sobre.html);
        if (cssModel) cssModel.setValue(TEMPLATES.sobre.css);
      } else {
        htmlModel.setValue('');
        if (cssModel) cssModel.setValue('');
      }
      if (window.ResumeForm && window.ResumeForm.clearData) {
        window.ResumeForm.clearData();
      }
    }

    // Rétablir l'autosave et forcer la sauvegarde du nouvel état
    setTimeout(() => {
      _isSwitchingDoc = false;
      _saveCurrentState();
    }, 50);

    refreshFilenamePreview();
  });

  // ---- Chargement depuis l'historique (?load=) -------------------------
  const params = new URLSearchParams(location.search);
  const loadId = params.get('load');

  if (loadId) {
    let localEntry = null;
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      localEntry = hist.find(e => e.id === loadId) || null;
    } catch (_) { }

    if (localEntry) {
      _activeDocType = localEntry.doc_type || 'CV';
      if ($('doc_type')) $('doc_type').value = _activeDocType;
      try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }
      if (window.ResumeForm && window.ResumeForm.setDocType) {
        window.ResumeForm.setDocType(_activeDocType);
      }
      $('company').value = localEntry.company || '';
      $('role').value = localEntry.role || '';
      $('notes').value = localEntry.notes || '';
      _syncJobDesc(localEntry.job_desc || '');
      refreshFilenamePreview();
    }

    loadHtmlFromIDB(loadId).then(stored => {
      if (stored && stored.json && window.ResumeForm && window.ResumeForm.loadData) {
        // CV issu du formulaire : on le rouvre en mode Formulaire.
        _isSwitchingDoc = true;
        htmlModel.setValue(stored.html || '');
        if (cssModel) cssModel.setValue(stored.css || '');
        window.ResumeForm.loadData(stored.json, true); // true = skipApply
        setTimeout(() => { _isSwitchingDoc = false; }, 50);
        switchTab('form');
        return;
      }
      if (stored) {
        // HTML custom / éjecté / ancien : mode Expert (édition du code).
        _isSwitchingDoc = true;
        htmlModel.setValue(stored.html || '');
        if (cssModel) cssModel.setValue(stored.css || '');
        if (window.ResumeForm && window.ResumeForm.clearData) window.ResumeForm.clearData();
        setTimeout(() => { _isSwitchingDoc = false; }, 50);
        setExpertMode(true);
        switchTab('html');
        return;
      }
      // Fallback : essayer le fichier HTML archivé sur disque (entrées pré-migration IDB)
      fetch(`/api/history/${encodeURIComponent(loadId)}/html`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(h => {
          _isSwitchingDoc = true;
          htmlModel.setValue(h);
          if (cssModel) cssModel.setValue('');
          if (window.ResumeForm && window.ResumeForm.clearData) window.ResumeForm.clearData();
          setTimeout(() => { _isSwitchingDoc = false; }, 50);
          setExpertMode(true);
          switchTab('html');
          // Migrer vers IDB pour les rechargements futurs
          saveHtmlToIDB(loadId, h, '');
        })
        .catch(() => {
          setStatus(
            localEntry
              ? 'Contenu HTML introuvable : ce document a été créé avant la sauvegarde automatique du contenu.'
              : 'Document introuvable dans ce navigateur.',
            'err'
          );
        });
    });
  }
})();

function insertSnippet(text) {
  if (!editor) { _ensureMonaco().then(() => insertSnippet(text)).catch(() => { }); return; }
  const sel = editor.getSelection();
  editor.executeEdits('snippet', [{ range: sel, text, forceMoveMarkers: true }]);
  editor.focus();
}

// ============================================================
// Nouveau CV
// ============================================================
const modalNewCv = $('modal-new-cv');

$('btn-new-cv').onclick = () => { modalNewCv.style.display = 'flex'; };
$('close-new-cv').onclick = () => { modalNewCv.style.display = 'none'; };
window.addEventListener('click', e => { if (e.target === modalNewCv) modalNewCv.style.display = 'none'; });

document.querySelectorAll('.template-card').forEach(card => {
  card.addEventListener('click', () => {
    const key = card.dataset.tpl;
    const tpl = TEMPLATES[key];
    if (!tpl) return;

    saveSnapshot('Avant nouveau CV');

    _isSwitchingDoc = true;
    _activeDocType = 'CV';
    if ($('doc_type')) $('doc_type').value = 'CV';
    try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, 'CV'); } catch (_) { }

    if (htmlModel) htmlModel.setValue(tpl.html);
    if (cssModel) cssModel.setValue(tpl.css);
    _resetTailorDiff();
    _foldStyleBlocks();

    ['company', 'role', 'filename', 'notes'].forEach(id => { const el = $(id); if (el) el.value = ''; });
    _syncJobDesc('');
    refreshFilenamePreview();

    if (window.ResumeForm && window.ResumeForm.clearData) {
      window.ResumeForm.clearData();
    }

    setTimeout(() => {
      _isSwitchingDoc = false;
      _saveCurrentState();
    }, 50);

    modalNewCv.style.display = 'none';
    switchTab('form'); // On ouvre le formulaire par défaut
    showToast(`Template "${key}" chargé.`, 'ok');
  });
});

// ============================================================
// Effacer
// ============================================================
$('clear').onclick = async () => {
  const hasContent = (htmlModel && htmlModel.getValue().trim()) || (cssModel && cssModel.getValue().trim());
  if (hasContent && !(await uiConfirm('Effacer tout le contenu ? Un snapshot automatique sera créé avant.', { title: 'Tout effacer', confirmLabel: 'Effacer', danger: true }))) return;
  saveSnapshot('Avant effacement');

  // Vider le formulaire s'il existe
  if (window.ResumeForm && window.ResumeForm.clearData) {
    window.ResumeForm.clearData();
  }

  if (htmlModel) htmlModel.setValue('');
  if (cssModel) cssModel.setValue('');
  _resetTailorDiff();
  _foldStyleBlocks();
  ['company', 'role', 'filename', 'notes'].forEach(id => $(id).value = '');
  refreshFilenamePreview();
  try {
    localStorage.removeItem(STORAGE_KEY_HTML);
    localStorage.removeItem(STORAGE_KEY_CSS);
    localStorage.removeItem(_docTypeKey(_activeDocType));
  } catch (_) { }
};

// ============================================================
// Raccourcis clavier
// ============================================================
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); $('go').click(); }
  if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); window.location.href = '/history'; }
  if (e.ctrlKey && e.shiftKey && e.key === 'I') { e.preventDefault(); $('btn-ia').click(); }
  if (e.ctrlKey && e.shiftKey && e.key === 'S') { e.preventDefault(); openSnapshotsModal(); }
  if (e.ctrlKey && !e.shiftKey && e.key === 's') {
    e.preventDefault();
    saveSnapshot('Manuel · ' + new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }));
    showToast('Brouillon sauvegardé.', 'ok');
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    _renderAts(htmlModel ? htmlModel.getValue() : '', $('job-desc-input').value.trim());
  }
});

// ============================================================
// Drag & drop d'un fichier .html / .md dans l'éditeur
// ============================================================
// Conversion Markdown minimale (titres, gras, italique, liens, listes,
// paragraphes). Le contenu est d'abord échappé pour éviter toute injection.
function _mdToHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  const out = [];
  let inList = false;
  for (const raw of esc(md).split(/\r?\n/)) {
    const line = raw.trim();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('  <li>' + inline(li[1]) + '</li>');
      continue;
    }
    if (inList) { out.push('</ul>'); inList = false; }
    if (h) out.push('<h' + h[1].length + '>' + inline(h[2]) + '</h' + h[1].length + '>');
    else if (line) out.push('<p>' + inline(line) + '</p>');
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function _loadDroppedFile(file) {
  const name = (file.name || '').toLowerCase();
  const isHtml = name.endsWith('.html') || name.endsWith('.htm');
  const isMd = name.endsWith('.md') || name.endsWith('.markdown');
  if (!isHtml && !isMd) { setStatus('Glissez un fichier .html ou .md.', 'err'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = String(ev.target.result || '');
    saveSnapshot('Avant import (glisser-déposer)');
    if (htmlModel) htmlModel.setValue(isHtml ? text : _mdToHtml(text));
    markCvLoaded();
    showToast(isHtml ? 'Fichier HTML importé.' : 'Markdown converti et importé.', 'ok');
  };
  reader.onerror = () => setStatus('Lecture du fichier impossible.', 'err');
  reader.readAsText(file);
}

(function _wireEditorDnd() {
  const zone = $('editor');
  if (!zone) return;
  const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
  ['dragenter', 'dragover'].forEach(evt =>
    zone.addEventListener(evt, (e) => {
      if (!hasFiles(e)) return; // laisse le drag&drop de texte natif de Monaco intact
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    })
  );
  zone.addEventListener('drop', (e) => {
    if (!hasFiles(e) || !e.dataTransfer.files.length) return;
    e.preventDefault();
    _loadDroppedFile(e.dataTransfer.files[0]);
  });
})();

// ============================================================
// Convertir en PDF
// ============================================================
$('go').onclick = async () => {
  const html = mergedHtml();
  if (!html.trim()) { setStatus("Editez du HTML d'abord.", 'err'); return; }
  const btn = $('go');
  btn.disabled = true;
  btn.textContent = 'Conversion...';
  setStatus('Generation du PDF...', '');
  try {
    const res = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        doc_type: $('doc_type').value,
        company: $('company').value.trim(),
        role: $('role').value.trim(),
        format: $('format').value,
        margin: $('margin').value,
        background: $('bg').checked,
        filename: $('filename').value.trim(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
      setStatus('Erreur : ' + (err.error || res.statusText), 'err');
      return;
    }
    const meta = JSON.parse(res.headers.get('X-Archive-Entry') || '{}');
    const entryId = meta.id || crypto.randomUUID();

    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = meta.filename || 'document.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 10_000);

    setStatus(`PDF téléchargé : ${meta.filename}`, 'ok');

    // Persistance navigateur : métadonnées dans localStorage, HTML+CSS dans IndexedDB
    try {
      const hist = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      hist.unshift({
        id: entryId,
        filename: meta.filename,
        created_at: meta.created_at,
        doc_type: $('doc_type').value,
        company: $('company').value.trim(),
        role: $('role').value.trim(),
        notes: $('notes').value.trim(),
        job_desc: $('job-desc-input').value.trim(),
      });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 100)));
    } catch (_) { }
    // Si le CV affiché provient du formulaire, on persiste aussi son JSON structuré
    // (+ template) pour pouvoir le rouvrir en mode Formulaire au rechargement.
    let resumeJson = null, resumeTemplate = null;
    if (window.ResumeForm && window.ResumeForm.matchesEditor && window.ResumeForm.matchesEditor()) {
      resumeJson = window.ResumeForm.getData();
      resumeTemplate = window.ResumeForm.getTemplateId ? window.ResumeForm.getTemplateId() : null;
    }
    await saveHtmlToIDB(entryId, htmlModel.getValue(), cssModel ? cssModel.getValue() : '', resumeJson, resumeTemplate);
  } catch (e) {
    setStatus('Erreur réseau : ' + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Convertir en PDF';
  }
};

// ============================================================
// Splitter redimensionnable
// ============================================================
(function initSplitter() {
  const split = $('split');
  const splitter = $('splitter');
  const editorPane = $('editor-pane');
  let dragging = false;

  const onStart = (e) => {
    dragging = true;
    if (e.cancelable) e.preventDefault();
    const isMobile = window.innerWidth <= 768;
    document.body.style.cursor = isMobile ? 'row-resize' : 'col-resize';
  };

  const onMove = (e) => {
    if (!dragging) return;
    const rect = split.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (isMobile) {
      const pct = Math.max(15, Math.min(85, ((clientY - rect.top) / rect.height) * 100));
      editorPane.style.flexBasis = `${pct}%`;
    } else {
      const pct = Math.max(15, Math.min(85, ((clientX - rect.left) / rect.width) * 100));
      editorPane.style.flexBasis = `${pct}%`;
    }
  };

  const onEnd = () => { dragging = false; document.body.style.cursor = ''; };

  splitter.addEventListener('mousedown', onStart);
  splitter.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mouseup', onEnd);
  window.addEventListener('touchend', onEnd);
})();

// ============================================================
// Chat IA
// ============================================================
let _tailorLevel = 'adapte';
let _tailorBeforeHtml = null;
let _tailorBeforeCss = null;
let _tailorBase64Map = {};

function _resetTailorDiff() {
  _tailorBeforeHtml = null;
  _tailorBeforeCss = null;
  const btn = $('btn-show-diff');
  if (btn) btn.style.display = 'none';
}

function _stripBase64ForTailor(html) {
  _tailorBase64Map = {};
  let i = 0;
  return html.replace(/src="data:image\/[^"]{20,}"/g, (match) => {
    const placeholder = '[IMAGE_BASE64_' + i + ']';
    _tailorBase64Map[placeholder] = match;
    i++;
    return 'src="' + placeholder + '"';
  });
}

function _restoreBase64InTailor(html) {
  if (!html) return html;
  let out = html;
  for (const placeholder in _tailorBase64Map) {
    out = out.split('src="' + placeholder + '"').join(_tailorBase64Map[placeholder]);
  }
  return out;
}

// Intègre le CSS dans le HTML avant envoi à Gemini (fragment ou document complet).
// Si le HTML a déjà un <style>, on fusionne pour éviter un double bloc qui perturbe Gemini.
function _buildTailorPayload(html, css) {
  if (!css || !css.trim()) return html;
  const safeCss = css.replace(/<\/style\s*>/gi, '<\\/style>');
  if (/<\/head>/i.test(html)) {
    if (/<style[\s>]/i.test(html)) {
      // Fusionner dans le <style> existant
      return html.replace(/<\/style>/i, '\n' + safeCss + '\n</style>');
    }
    return html.replace(/<\/head>/i, '<style>\n' + safeCss + '\n</style>\n</head>');
  }
  return '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>\n'
    + safeCss + '\n</style></head><body>\n' + html + '\n</body></html>';
}

// Extrait le contenu de la 1re balise <style> du HTML et renvoie {html, css}.
// Le HTML retourné n'a plus de balise <style> inline.
function _extractCssFromHtml(html) {
  const m = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!m) return { html, css: null };
  return {
    html: html.replace(/<style[^>]*>[\s\S]*?<\/style>\n?/i, '').trim(),
    css: m[1].trim(),
  };
}

// Fold tous les blocs <style> dans l'éditeur HTML (réduit le bruit visuel).
function _foldStyleBlocks() {
  if (!editor || !htmlModel) return;
  const doFold = () => {
    if (!editor || !htmlModel) return;
    const matches = htmlModel.findMatches(/<style[\s>]/i.source, false, true, false, null, true);
    const lines = matches.map(m => m.range.startLineNumber);
    if (lines.length) editor.trigger('api', 'editor.fold', { selectionLines: lines });
  };
  if (window.requestIdleCallback) requestIdleCallback(doFold, { timeout: 1000 });
  else setTimeout(doFold, 100);
}


function _initLevelSelector(selectorId, onChange) {
  const el = $(selectorId);
  if (!el) return;
  el.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      onChange(btn.dataset.level);
    });
  });
}

_initLevelSelector('tailor-level-selector', (lvl) => { _tailorLevel = lvl; });

// ---- Chat panel -------------------------------------------------------
const chatPanel = $('chat-ia-panel');
const chatOverlay = $('chat-overlay');
const chatMsgs = $('chat-messages');
const chatInput = $('chat-input');

let _chatHistory = [];
let _chatPreviewing = false;
let _lastBase64Data = null; // conserve le base64 photo retiré avant envoi à l'IA

function openChatPanel() {
  chatPanel.classList.add('open');
  chatOverlay.classList.add('open');
  chatInput.focus();
}

function closeChatPanel() {
  chatPanel.classList.remove('open');
  chatOverlay.classList.remove('open');
  if (_chatPreviewing) { _chatPreviewing = false; schedulePreview(); }
}

$('btn-ia').onclick = openChatPanel;
$('chat-panel-close').onclick = closeChatPanel;
chatOverlay.addEventListener('click', closeChatPanel);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && chatPanel.classList.contains('open')) closeChatPanel();
});

function _buildPreviewHtml(html, css) {
  if (!css || !css.trim()) return html;
  const safeCss = css.replace(/<\/style\s*>/gi, '<\\/style>');
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, '<style>\n' + safeCss + '\n</style>\n</head>');
  if (/<html[\s>]/i.test(html)) return html.replace(/<html([^>]*)>/i, '<html$1>\n<head><meta charset="utf-8"><style>\n' + safeCss + '\n</style></head>');
  return '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<style>\n' + safeCss + '\n</style>\n</head>\n<body>\n' + html + '\n</body>\n</html>';
}

function _appendMsg(role, text) {
  const wrap = document.createElement('div');
  wrap.className = 'chat-message chat-message--' + role;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  chatMsgs.appendChild(wrap);
  chatMsgs.scrollTop = chatMsgs.scrollHeight;
  return wrap;
}

function _appendProposals(proposals) {
  proposals.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'chat-proposal';

    var titleEl = document.createElement('span');
    titleEl.className = 'proposal-title';
    titleEl.textContent = p.title;

    var summaryEl = document.createElement('span');
    summaryEl.className = 'proposal-summary';
    summaryEl.textContent = p.summary;

    var actions = document.createElement('div');
    actions.className = 'proposal-actions';

    var btnPreview = document.createElement('button');
    btnPreview.className = 'proposal-btn proposal-preview';
    btnPreview.textContent = 'Prévisualiser';

    var btnApply = document.createElement('button');
    btnApply.className = 'proposal-btn proposal-apply';
    btnApply.textContent = 'Appliquer';

    var btnReject = document.createElement('button');
    btnReject.className = 'proposal-btn proposal-reject';
    btnReject.textContent = 'Rejeter';

    actions.appendChild(btnPreview);
    actions.appendChild(btnApply);
    actions.appendChild(btnReject);
    card.appendChild(titleEl);
    card.appendChild(summaryEl);
    card.appendChild(actions);
    chatMsgs.appendChild(card);
    chatMsgs.scrollTop = chatMsgs.scrollHeight;

    btnPreview.onclick = function () {
      _chatPreviewing = true;
      $('preview').srcdoc = _buildPreviewHtml(p.html, p.css);
    };

    btnApply.onclick = async function () {
      await saveSnapshot('Avant chat IA');
      const { html: applyHtml, css: applyCss } = _extractCssFromHtml(p.html || '');
      htmlModel.setValue(applyHtml);
      if (cssModel) cssModel.setValue(applyCss !== null ? applyCss : (p.css || ''));
      _foldStyleBlocks();
      _chatPreviewing = false;
      schedulePreview();
      btnPreview.disabled = true;
      btnApply.disabled = true;
      btnReject.disabled = true;
      card.classList.add('proposal--applied');
    };

    btnReject.onclick = function () {
      if (_chatPreviewing) { _chatPreviewing = false; schedulePreview(); }
      btnPreview.disabled = true;
      btnApply.disabled = true;
      btnReject.disabled = true;
      card.classList.add('proposal--rejected');
    };
  });
}

function _stripBase64ForChat(html) {
  // Retire les données base64 avant envoi à l'IA et les mémorise pour restauration
  var match = html.match(/src="(data:image\/[^"]{20,})"/);
  _lastBase64Data = match ? match[1] : null;
  return html.replace(/src="data:image\/[^"]{20,}"/g, 'src="[IMAGE_BASE64]"');
}

function _restoreBase64InProposals(proposals) {
  if (!_lastBase64Data || !proposals) return proposals;
  return proposals.map(function (p) {
    return Object.assign({}, p, {
      html: p.html ? p.html.replace('src="[IMAGE_BASE64]"', 'src="' + _lastBase64Data + '"') : p.html,
    });
  });
}

async function _sendChat() {
  var text = chatInput.value.trim();
  if (!text) return;
  if (!htmlModel) { _appendMsg('assistant', "L'éditeur n'est pas prêt, patientez."); return; }
  chatInput.value = '';
  chatInput.disabled = true;
  $('chat-send-btn').disabled = true;

  _appendMsg('user', text);
  _chatHistory.push({ role: 'user', content: text });
  var loading = _appendMsg('assistant', "L’IA génère une proposition");
  loading.classList.add('chat-loading');

  var controller = new AbortController();
  var timeoutId = setTimeout(function () { controller.abort(); }, 120000);

  try {
    var resp = await fetch('/api/editor-chat', {
      method: 'POST',
      signal: controller.signal,
      headers: Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders()),
      body: JSON.stringify({
        messages: _chatHistory,
        html: _buildTailorPayload(_stripBase64ForChat(htmlModel.getValue()), cssModel ? cssModel.getValue() : ''),
        css: '',
        doc_type: ($('doc_type') || {}).value || 'CV',
        job_desc: (($('job-desc-input') || {}).value || '').trim(),
        active_tab: activeTab || 'html',
      }),
    });
    clearTimeout(timeoutId);
    loading.remove();
    var data = await resp.json();
    if (!resp.ok) {
      _appendMsg('assistant', data.error || 'Erreur inconnue.');
      _chatHistory.pop();
      return;
    }
    _appendMsg('assistant', data.reply);
    _chatHistory.push({ role: 'assistant', content: data.reply });
    if (data.proposals && data.proposals.length) _appendProposals(_restoreBase64InProposals(data.proposals));
  } catch (e) {
    clearTimeout(timeoutId);
    loading.remove();
    var msg = e.name === 'AbortError'
      ? "Délai dépassé (> 2 min). L'IA n'a pas répondu. Réessayez."
      : 'Erreur : ' + e.message;
    _appendMsg('assistant', msg);
    _chatHistory.pop();
  } finally {
    chatInput.disabled = false;
    $('chat-send-btn').disabled = false;
    chatInput.focus();
  }
}

$('chat-send-btn').onclick = _sendChat;
chatInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); _sendChat(); }
});

// ---- Prompts par niveau (utilisé par le tailoring panel) ---
const LEVEL_PROMPT_RULES = {
  peu: `Règles d'adaptation (niveau SUBTIL) :
- Ajuste le titre/tagline sous le nom pour refléter le type de poste visé, de façon générique.
- Réoriente le résumé/accroche avec 2-3 mots-clés du poste, de façon naturelle et non évidente.
- NE modifie PAS les compétences, les expériences, les langues, les centres d'intérêt, la formation.
- Le CV doit rester fidèle à l'original à 95%.
- ANTI-DÉTECTION : n'écris jamais le nom de l'entreprise ciblée dans le résumé ou le titre. Le CV doit sembler naturel, pas taillé pour une seule offre.`,
  adapte: `Règles d'adaptation (niveau MODÉRÉ) :
- Ajuste le titre/tagline et réécris le résumé/accroche pour le type de poste visé.
- Réordonne les compétences existantes (sans en ajouter ni supprimer).
- Enrichis et reformule les puces d'expériences existantes (4 puces max par expérience, sans inventer de contenu absent du CV).
- NE touche PAS aux langues (garde-les toutes), aux centres d'intérêt, aux dates, aux entreprises du parcours.
- ANTI-DÉTECTION : n'écris jamais le nom de l'entreprise ciblée dans le résumé ou le titre.`,
  hyper: `Règles d'adaptation (niveau MAXIMUM) :
- Ajuste le titre/tagline et réécris complètement le résumé/accroche.
- Réorganise et reformule les compétences existantes (sans en inventer de nouvelles).
- Réécris entièrement les puces d'expériences (4 puces max par expérience, sans inventer de contenu absent du CV).
- ANTI-DÉTECTION : n'écris jamais le nom de l'entreprise ciblée dans le résumé ou le titre.
- ABSOLUMENT INTERDIT : supprimer des langues, supprimer les centres d'intérêt, inventer des compétences, modifier les dates/entreprises du parcours/diplômes.`,
};

// ============================================================
// Insertion Photo Base64
// ============================================================
$('btn-photo').onclick = async () => {
  if (htmlModel && !htmlModel.getValue().includes('URL_DE_VOTRE_PHOTO_ICI')) {
    await uiAlert("Aucun emplacement automatique de photo détecté.\n\nVotre photo sera insérée exactement là où se trouve actuellement votre curseur clignotant dans le code HTML.\n\nAssurez-vous d'avoir cliqué au bon endroit dans l'éditeur avant de choisir votre image !", { title: 'Insertion de photo' });
  }
  $('photo-upload').click();
};

$('photo-upload').onchange = e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = rev => {
    const base64 = rev.target.result;
    if (!htmlModel) return;
    const currentHtml = htmlModel.getValue();
    const photoCode = `\n<!-- #region Photo_Base64 -->\n<img src="${base64}" alt="Photo de profil" style="width:80px; border-radius:4px;"/>\n<!-- #endregion -->\n`;

    if (currentHtml.includes('URL_DE_VOTRE_PHOTO_ICI')) {
      let newHtml = currentHtml;
      if (currentHtml.includes('src="URL_DE_VOTRE_PHOTO_ICI"')) {
        newHtml = currentHtml.replace('URL_DE_VOTRE_PHOTO_ICI', base64);
      } else {
        newHtml = currentHtml
          .replace('<!-- URL_DE_VOTRE_PHOTO_ICI -->', photoCode.trim())
          .replace('URL_DE_VOTRE_PHOTO_ICI', photoCode.trim());
      }
      htmlModel.setValue(newHtml);
      setStatus('Photo insérée avec succès dans le CV !', 'ok');
    } else {
      insertSnippet(photoCode);
      setStatus('Photo insérée là où se trouvait votre curseur.', 'ok');
    }
    setTimeout(() => {
      if (editor) editor.trigger('fold', 'editor.foldAllMarkerRegions');
    }, 100);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
};

// ============================================================
// Clé API utilisateur (localStorage)
// ============================================================
const STORAGE_KEY_APIKEY = 'userApiKey';

function getUserApiKey() { return localStorage.getItem(STORAGE_KEY_APIKEY) || ''; }
function getApiHeaders() {
  const key = getUserApiKey();
  return key ? { 'X-Api-Key': key } : {};
}

$('btn-settings').addEventListener('click', () => {
  const key = getUserApiKey();
  $('settings-api-key').value = '';
  $('key-active-indicator').style.display = key ? '' : 'none';
  $('modal-settings').classList.add('open');
});
$('close-settings').addEventListener('click', () => { $('modal-settings').classList.remove('open'); });
$('modal-settings').addEventListener('click', (e) => {
  if (e.target === $('modal-settings')) $('modal-settings').classList.remove('open');
});
$('btn-settings-save').addEventListener('click', () => {
  const val = $('settings-api-key').value.trim();
  if (val) {
    localStorage.setItem(STORAGE_KEY_APIKEY, val);
    $('key-active-indicator').style.display = '';
    showToast('Clé enregistrée dans votre navigateur.', 'ok');
  }
  $('modal-settings').classList.remove('open');
});
$('btn-settings-clear').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY_APIKEY);
  $('settings-api-key').value = '';
  $('key-active-indicator').style.display = 'none';
  showToast('Clé effacée.', 'ok');
  $('modal-settings').classList.remove('open');
});

// ============================================================
// Streaming SSE → Monaco
// ============================================================
async function _readSseStream(resp, onChunk) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let accumulated = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return accumulated;
      if (data.startsWith('[ERROR]')) throw new Error(data.slice(8).trim() || 'Erreur serveur');
      try {
        const chunk = JSON.parse(data);
        accumulated += chunk;
        if (onChunk) onChunk(accumulated);
      } catch (_) { }
    }
  }
  return accumulated;
}

async function streamToMonaco(url, body, extraHeaders, onChunk) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = 'Erreur serveur';
    try { msg = (await resp.json()).error || msg; } catch (_) { }
    throw new Error(msg);
  }
  return _readSseStream(resp, onChunk);
}

async function streamFormToMonaco(url, formData, extraHeaders, onChunk) {
  const resp = await fetch(url, {
    method: 'POST',
    // Passe le token CSRF pour les requêtes multipart
    headers: { 'X-CSRF-Token': CSRF_TOKEN, ...extraHeaders },
    body: formData,
  });
  if (!resp.ok) {
    let msg = 'Erreur serveur';
    try { msg = (await resp.json()).error || msg; } catch (_) { }
    throw new Error(msg);
  }
  return _readSseStream(resp, onChunk);
}

// ============================================================
// Panneau Import — onglets
// ============================================================
document.querySelectorAll('.import-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.import-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('import-tab-' + tab.dataset.tab).classList.add('active');
  });
});

function markCvLoaded() { switchTab('html'); }

// ============================================================
// Import helpers
// ============================================================
function _applyImportCss(docType) {
  if (!cssModel) return;
  if (docType === 'Lettre') {
    cssModel.setValue('');
  } else {
    cssModel.setValue(TEMPLATES.sobre.css);
  }
}

// ============================================================
// Import texte → HTML
// ============================================================
$('btn-text-to-html').addEventListener('click', async () => {
  const text = $('cv-text-input').value.trim();
  if (!text) { showToast("Colle d'abord le contenu de ton CV.", 'err'); return; }

  const btn = $('btn-text-to-html');
  const status = $('import-text-status');
  btn.disabled = true;
  status.textContent = 'Conversion en cours';
  status.className = 'import-status status-busy';

  const docType = ($('doc_type') && $('doc_type').value) || 'CV';
  try {
    const html = await streamToMonaco(
      '/api/text-to-html',
      { text, doc_type: docType },
      getApiHeaders(),
      (partial) => { if (htmlModel) htmlModel.setValue(partial); }
    );
    if (htmlModel) htmlModel.setValue(html);
    _applyImportCss(docType);
    markCvLoaded();
    showToast('CV converti en HTML avec succès.', 'ok');
    status.textContent = '';
    status.className = 'import-status';
  } catch (err) {
    showToast(err.message, 'err');
    status.textContent = err.message;
    status.className = 'import-status status-err';
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Import PDF → HTML
// ============================================================
let _selectedPdfFile = null;

$('btn-pdf-pick').addEventListener('click', () => { $('pdf-upload-input').click(); });

$('pdf-upload-input').addEventListener('change', (e) => {
  _selectedPdfFile = e.target.files[0] || null;
  $('pdf-filename').textContent = _selectedPdfFile ? _selectedPdfFile.name : '';
  $('btn-pdf-to-html').disabled = !_selectedPdfFile;
  if (activeTab === 'form' && _selectedPdfFile) {
    $('btn-pdf-to-html').click();
  }
  e.target.value = '';
});

async function _pdfToResumeFields() {
  const btn = $('btn-pdf-to-html');
  const status = $('import-pdf-status');
  btn.disabled = true;
  status.textContent = 'Lecture du PDF et extraction des champs…';
  status.className = 'import-status status-busy';

  const formData = new FormData();
  formData.append('file', _selectedPdfFile);

  try {
    const resp = await fetch('/api/pdf-to-resume', {
      method: 'POST',
      headers: Object.assign({ 'X-CSRF-Token': CSRF_TOKEN }, getApiHeaders()),
      body: formData,
    });
    if (!resp.ok) {
      let msg = 'Erreur serveur';
      try { msg = (await resp.json()).error || msg; } catch (_) { }
      throw new Error(msg);
    }
    const resume = await resp.json();
    await saveSnapshot('Avant import PDF');
    if (!window.ResumeForm.loadData(resume, false, true)) {
      throw new Error("Extraction vide : aucune donnée de CV exploitable dans ce PDF.");
    }
    switchTab('form');
    showToast('CV importé dans le formulaire.', 'ok');
    status.textContent = '';
    status.className = 'import-status';
  } catch (err) {
    showToast(err.message, 'err');
    status.textContent = err.message;
    status.className = 'import-status status-err';
  } finally {
    btn.disabled = false;
  }
}

$('btn-pdf-to-html').addEventListener('click', async () => {
  if (!_selectedPdfFile) return;

  const docType = ($('doc_type') && $('doc_type').value) || 'CV';

  // CV → champs structurés ; Lettre → HTML (comportement historique).
  if ((docType === 'CV' || docType === 'Maître') && window.ResumeForm && window.ResumeForm.loadData) {
    await _pdfToResumeFields();
    return;
  }

  const btn = $('btn-pdf-to-html');
  const status = $('import-pdf-status');
  btn.disabled = true;
  status.textContent = 'Lecture du PDF';
  status.className = 'import-status status-busy';

  const formData = new FormData();
  formData.append('file', _selectedPdfFile);
  formData.append('doc_type', docType);

  try {
    const html = await streamFormToMonaco(
      '/api/pdf-to-html',
      formData,
      getApiHeaders(),
      (partial) => {
        if (htmlModel) htmlModel.setValue(partial);
        status.textContent = `${partial.length} car. générés`;
        status.className = 'import-status status-busy';
      }
    );
    if (htmlModel) htmlModel.setValue(html);
    _applyImportCss(docType);
    markCvLoaded();
    showToast('PDF converti en HTML avec succès.', 'ok');
    status.textContent = '';
    status.className = 'import-status';
  } catch (err) {
    showToast(err.message, 'err');
    status.textContent = err.message;
    status.className = 'import-status status-err';
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Offres d'emploi sauvegardées
// ============================================================
const STORAGE_KEY_JOB_DRAFT = 'html-to-pdf:draft:job-desc';
const STORAGE_KEY_SAVED_OFFERS = 'html-to-pdf:saved-offers';

function _getSavedOffers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_SAVED_OFFERS) || '[]'); } catch (_) { return []; }
}

function _setSavedOffers(list) {
  try { localStorage.setItem(STORAGE_KEY_SAVED_OFFERS, JSON.stringify(list)); } catch (_) { }
}

function _refreshOffersSelect() {
  const sel = $('saved-offers-select');
  const del = $('btn-delete-offer');
  if (!sel) return;
  const offers = _getSavedOffers();
  sel.innerHTML = `<option value="">Offres sauvegardées (${offers.length})...</option>` +
    offers.map(o => `<option value="${o.id}">${o.label}</option>`).join('');
  if (del) del.style.display = 'none';
}

function _saveCurrentOffer() {
  const content = ($('job-desc-input').value || '').trim();
  if (!content) { showToast("Aucune offre à sauvegarder.", 'err'); return; }
  const company = ($('company').value || '').trim();
  const role = ($('role').value || '').trim();
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const label = [company, role].filter(Boolean).join(' · ') || `Offre du ${date}`;
  const offers = _getSavedOffers();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  offers.unshift({ id, label, content, date: new Date().toISOString() });
  if (offers.length > 30) offers.pop();
  _setSavedOffers(offers);
  _refreshOffersSelect();
  showToast(`Offre "${label}" sauvegardée.`, 'ok');
}

function _syncJobDesc(value) {
  const tailor = $('job-desc-input');
  if (tailor && tailor.value !== value) tailor.value = value;
  try { localStorage.setItem(STORAGE_KEY_JOB_DRAFT, value); } catch (_) { }
}

// Restore draft job desc on load
(function () {
  const draft = localStorage.getItem(STORAGE_KEY_JOB_DRAFT) || '';
  if (draft) { const t = $('job-desc-input'); if (t) t.value = draft; }
  _refreshOffersSelect();
})();

// Auto-save draft + sync on input
$('job-desc-input').addEventListener('input', (e) => { _syncJobDesc(e.target.value); });

// Save button
$('btn-save-offer').addEventListener('click', _saveCurrentOffer);

// Load saved offer on select change
$('saved-offers-select').addEventListener('change', (e) => {
  const id = e.target.value;
  const del = $('btn-delete-offer');
  if (!id) { if (del) del.style.display = 'none'; return; }
  const offer = _getSavedOffers().find(o => o.id === id);
  if (!offer) return;
  _syncJobDesc(offer.content);
  if (del) del.style.display = '';
});

// Delete selected offer
$('btn-delete-offer').addEventListener('click', () => {
  const id = $('saved-offers-select').value;
  if (!id) return;
  const offers = _getSavedOffers().filter(o => o.id !== id);
  _setSavedOffers(offers);
  _syncJobDesc('');
  _refreshOffersSelect();
  showToast('Offre supprimée.', 'ok');
});

// ============================================================
// Extracteur d'offre d'emploi (URL → textarea)
// ============================================================
$('btn-extract-url').addEventListener('click', async () => {
  const url = ($('job-url-input').value || '').trim();
  if (!url) { showToast('Colle une URL d\'offre d\'emploi.', 'err'); return; }

  const ok = await uiConfirm(
    'L\'extraction lit la page directement. Si elle est bloquée (LinkedIn, etc.), ' +
    'l\'URL sera envoyée à <strong>Jina AI</strong> (r.jina.ai) pour extraction. ' +
    'Continuer ?',
    { title: 'Extraction d\'offre', confirmLabel: 'Extraire' }
  );
  if (!ok) return;

  const btn = $('btn-extract-url');
  const status = $('url-extract-status');
  btn.disabled = true;
  status.textContent = 'Extraction en cours…';
  status.className = 'url-extract-status busy';

  try {
    const resp = await fetch('/api/extract-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      status.textContent = data.error || 'Erreur lors de l\'extraction.';
      status.className = 'url-extract-status err';
      return;
    }
    _syncJobDesc(data.text);
    if (data.title) {
      status.textContent = `✓ Extrait : ${data.title.slice(0, 60)}`;
    } else {
      status.textContent = `✓ ${data.text.length.toLocaleString()} caractères extraits`;
    }
    status.className = 'url-extract-status ok';
    $('job-url-input').value = '';
  } catch (e) {
    status.textContent = 'Erreur réseau : ' + e.message;
    status.className = 'url-extract-status err';
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Tailoring — adapter à une offre
// ============================================================
const _modalTailor = $('modal-tailor');
function openTailorModal() { _modalTailor.style.display = 'flex'; }
function closeTailorModal() { _modalTailor.style.display = 'none'; }
$('tailor-open-btn').addEventListener('click', openTailorModal);
$('close-modal-tailor').addEventListener('click', closeTailorModal);
_modalTailor.addEventListener('click', (e) => { if (e.target === _modalTailor) closeTailorModal(); });

// Tailoring sur les champs structurés (CV généré par le formulaire).
async function _tailorResumeFields(jobDesc, overrideResume = null) {
  const resume = overrideResume || window.ResumeForm.getData();
  if (!resume) { showToast("Aucune donnée de formulaire à adapter.", 'err'); return; }

  // Retire la photo pour alléger la requête IA
  const originalPhoto = resume.photo;
  if (resume.photo) {
    resume.photo = '';
  }

  const btn = $('btn-tailor');
  const status = $('tailor-status');
  const atsPanel = $('ats-panel');
  const btnDiff = $('btn-show-diff');

  _tailorBeforeHtml = htmlModel ? htmlModel.getValue() : '';
  _tailorBeforeCss = cssModel ? cssModel.getValue() : '';
  await saveSnapshot('Avant tailoring');

  btn.disabled = true;
  atsPanel.style.display = 'none';
  btnDiff.style.display = 'none';
  status.textContent = 'Adaptation des champs en cours…';
  status.className = 'tailor-status status-busy';

  try {
    const resp = await fetch('/api/tailor-resume', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders()),
      body: JSON.stringify({ resume, job_desc: jobDesc, level: _tailorLevel }),
    });
    if (!resp.ok) {
      let msg = 'Erreur serveur';
      try { msg = (await resp.json()).error || msg; } catch (_) { }
      throw new Error(msg);
    }
    const adapted = await resp.json();

    // Restaure la photo
    if (originalPhoto) {
      adapted.photo = originalPhoto;
    }

    // Garde anti-vidage : une réponse vide ne doit jamais écraser le formulaire.
    if (!window.ResumeForm.loadData(adapted, false, true)) {
      throw new Error('Le CV adapté reçu est vide — formulaire conservé.');
    }
    showToast('CV adapté avec succès.', 'ok');
    status.textContent = '';
    status.className = 'tailor-status';
    btnDiff.style.display = 'block';
    _renderAts(htmlModel ? htmlModel.getValue() : '', jobDesc);
  } catch (err) {
    showToast(err.message, 'err');
    status.textContent = err.message;
    status.className = 'tailor-status status-err';
  } finally {
    btn.disabled = false;
  }
}

$('btn-tailor').addEventListener('click', async () => {
  const jobDesc = $('job-desc-input').value.trim();
  if (!jobDesc) { showToast("Colle d'abord une offre d'emploi.", 'err'); return; }

  const useMaster = $('tailor-use-master') && $('tailor-use-master').checked;

  if (useMaster) {
    const rawMaster = localStorage.getItem(_docTypeKey('Maître'));
    if (!rawMaster) { showToast("Aucun CV Maître trouvé.", 'err'); return; }
    try {
      const parsed = JSON.parse(rawMaster);
      if (parsed.json && Object.keys(parsed.json).length > 0) {
        // Le CV Maître contient les données JSON, on utilise l'adaptation JSON directe
        await _tailorResumeFields(jobDesc, parsed.json);
        return;
      }
    } catch (_) {
      showToast("Erreur de lecture du CV Maître.", 'err');
      return;
    }
  } else if (window.ResumeForm && window.ResumeForm.matchesEditor()) {
    // CV structuré (formulaire) + sans CV Maître HTML → adaptation sur les champs.
    await _tailorResumeFields(jobDesc);
    return;
  }

  let sourceHtml = htmlModel ? htmlModel.getValue() : '';
  let sourceCss = cssModel ? cssModel.getValue() : '';

  if (useMaster) {
    const rawMaster = localStorage.getItem(_docTypeKey('Maître'));
    if (rawMaster) {
      try {
        const parsed = JSON.parse(rawMaster);
        if (parsed.html && parsed.html.trim()) {
          sourceHtml = parsed.html;
          sourceCss = parsed.css || '';
        } else {
          showToast("Le CV Maître est vide.", 'err');
          return;
        }
      } catch (_) { }
    } else {
      showToast("Aucun CV Maître trouvé.", 'err');
      return;
    }
  }

  if (!sourceHtml || !sourceHtml.trim()) {
    showToast("Charge d'abord un CV dans l'éditeur ou crée un CV Maître.", 'err'); return;
  }

  _tailorBeforeHtml = sourceHtml;
  _tailorBeforeCss = sourceCss;
  saveSnapshot('Avant tailoring');

  const btn = $('btn-tailor');
  const status = $('tailor-status');
  const atsPanel = $('ats-panel');
  const btnDiff = $('btn-show-diff');
  btn.disabled = true;
  atsPanel.style.display = 'none';
  btnDiff.style.display = 'none';
  status.textContent = 'Adaptation en cours';
  status.className = 'tailor-status status-busy';

  try {
    const strippedHtml = _stripBase64ForTailor(sourceHtml);
    const payloadHtml = _buildTailorPayload(strippedHtml, sourceCss);
    const adapted = await streamToMonaco(
      '/api/tailor',
      { html: payloadHtml, job_desc: jobDesc, level: _tailorLevel, is_master: useMaster },
      getApiHeaders(),
      (partial) => {
        if (htmlModel) htmlModel.setValue(partial);
        status.textContent = `${partial.length} car. générés`;
        status.className = 'tailor-status status-busy';
      }
    );
    const restored = _restoreBase64InTailor(adapted);
    const { html: finalHtml, css: finalCss } = _extractCssFromHtml(restored);
    if (htmlModel) htmlModel.setValue(finalHtml);
    if (finalCss !== null && cssModel) cssModel.setValue(finalCss);
    _foldStyleBlocks();
    showToast('CV adapté avec succès.', 'ok');
    status.textContent = '';
    status.className = 'tailor-status';
    btnDiff.style.display = 'block';
    _renderAts(finalHtml, jobDesc);
  } catch (err) {
    showToast(err.message, 'err');
    status.textContent = err.message;
    status.className = 'tailor-status status-err';
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Pack candidature (lettre + email cohérents avec le CV)
// ============================================================
let _packLetterHtml = '';
let _packLetterCss = '';

function _openPackModal() { $('modal-pack').classList.add('open'); }
function _closePackModal() { $('modal-pack').classList.remove('open'); }

$('close-modal-pack').addEventListener('click', _closePackModal);
$('btn-pack-close').addEventListener('click', _closePackModal);
$('modal-pack').addEventListener('click', (e) => { if (e.target === $('modal-pack')) _closePackModal(); });

$('btn-pack-copy-email').addEventListener('click', async () => {
  const txt = $('pack-email-text').value;
  try {
    await navigator.clipboard.writeText(txt);
    showToast('Email copié dans le presse-papier.', 'ok');
  } catch (_) {
    $('pack-email-text').select();
    showToast("Copie automatique impossible : sélectionne et copie manuellement.", 'err');
  }
});

$('btn-pack-load-letter').addEventListener('click', async () => {
  if (!htmlModel) return;
  await saveSnapshot('Avant pack candidature');
  _activeDocType = 'Lettre';
  if ($('doc_type')) $('doc_type').value = 'Lettre';
  try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, 'Lettre'); } catch (_) { }
  htmlModel.setValue(_packLetterHtml);
  if (cssModel) cssModel.setValue(_packLetterCss);
  switchTab('html');
  refreshFilenamePreview();
  schedulePreview();
  _closePackModal();
  showToast('Lettre chargée dans l’éditeur (type « Lettre »).', 'ok');
});

$('btn-create-pack').addEventListener('click', async () => {
  const jobDesc = $('job-desc-input').value.trim();
  if (!jobDesc) { showToast("Colle d'abord une offre d'emploi.", 'err'); return; }

  const sourceHtml = htmlModel ? htmlModel.getValue() : '';
  if (!sourceHtml.trim()) { showToast("Charge d'abord un CV dans l'éditeur.", 'err'); return; }

  const btn = $('btn-create-pack');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.classList.add('status-busy');
  btn.textContent = 'Génération du pack… (jusqu’à 2 min)';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    // Retire le base64 (photo) pour alléger la requête : la lettre ne l'utilise pas.
    const cleanHtml = sourceHtml.replace(/src="data:image\/[^"]{20,}"/g, 'src="[IMAGE_BASE64]"');
    const resp = await fetch('/api/generate-pack', {
      method: 'POST',
      signal: controller.signal,
      headers: Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders()),
      body: JSON.stringify({
        html: cleanHtml,
        css: cssModel ? cssModel.getValue() : '',
        job_desc: jobDesc,
        company: ($('company') || {}).value || '',
        role: ($('role') || {}).value || '',
      }),
    });
    if (!resp.ok) {
      let msg = 'Erreur serveur';
      try { msg = (await resp.json()).error || msg; } catch (_) { }
      throw new Error(msg);
    }
    const data = await resp.json();
    _packLetterHtml = data.letter_html || '';
    _packLetterCss = data.letter_css || '';
    $('pack-letter-frame').srcdoc = _buildPreviewHtml(_packLetterHtml, _packLetterCss);
    $('pack-email-text').value = data.email || '';
    _openPackModal();
    showToast('Pack candidature généré.', 'ok');
  } catch (err) {
    showToast(err.name === 'AbortError' ? "Le serveur n'a pas répondu en 2 minutes. Réessaie." : err.message, 'err');
  } finally {
    clearTimeout(timeoutId);
    btn.disabled = false;
    btn.classList.remove('status-busy');
    btn.innerHTML = original;
  }
});

// ============================================================
// Score ATS
// ============================================================

const _ATS_STOP_WORDS = new Set([
  // Articles et pronoms
  'le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'ou', 'au', 'aux',
  'en', 'dans', 'sur', 'pour', 'par', 'avec', 'sans', 'que', 'qui', 'quoi', 'dont',
  'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous', 'on', 'ce', 'se', 'sa',
  'son', 'ses', 'mon', 'ton', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs', 'mes', 'tes', 'ces',
  'celui', 'celle', 'ceux', 'celles', 'moi', 'toi', 'soi', 'eux', 'lui',
  'quel', 'quelle', 'quels', 'quelles', 'quelque', 'quelques', 'plusieurs', 'aucun', 'aucune',

  // Verbes communs (être, avoir, faire, etc.)
  'est', 'sont', 'etre', 'avoir', 'faire', 'fait', 'faits', 'faite', 'faites', 'fais', 'faisons', 'font',
  'pouvoir', 'peut', 'peuvent', 'vouloir', 'veut', 'veulent', 'devoir', 'doit', 'doivent',
  'aller', 'va', 'vont', 'vas', 'venir', 'vient', 'viennent', 'dire', 'dit', 'disent',

  // Adverbes et prépositions
  'plus', 'tres', 'bien', 'tout', 'tous', 'toute', 'toutes', 'aussi', 'meme', 'memes',
  'mais', 'donc', 'car', 'cela', 'ceci', 'cette', 'cet', 'comme', 'afin', 'ainsi',
  'lors', 'entre', 'autre', 'autres', 'selon', 'notamment', 'quand', 'alors',
  'ici', 'la', 'voici', 'voila', 'bref', 'depuis', 'vers', 'chez', 'sous', 'sauf', 'parmi',
  'avant', 'apres', 'pendant', 'comment', 'combien', 'pourquoi', 'ailleurs', 'partout',
  'jamais', 'toujours', 'souvent', 'parfois', 'rarement', 'bientot', 'deja', 'enfin',
  'ensuite', 'puis', 'parce', 'puisque', 'lorsque', 'quoique', 'mal', 'mieux', 'pire',
  'vite', 'lentement', 'trop', 'peu', 'beaucoup', 'assez', 'moins', 'autant', 'seulement',
  'presque', 'surtout', 'environ', 'pres', 'loin', 'rien', 'personne', 'chacun', 'chacune',
  'tel', 'telle', 'tels', 'telles', 'certain', 'certains', 'certaine', 'certaines',
  'divers', 'diverses', 'differents', 'differentes', 'quelconque', 'chaque', 'maint', 'maints',

  // Mots courants / Vocabulaire entreprise non spécifique
  'poste', 'profil', 'candidat', 'candidate', 'equipe', 'rejoindre', 'mission', 'missions', 'contrat',
  'recherche', 'entreprise', 'societe', 'contexte', 'offre', 'emploi',
  'travail', 'collaborateur', 'collaborateurs', 'collaboratrice', 'collaboratrices',
  'ambiance', 'bienveillance', 'dynamique', 'croissance', 'locaux', 'babyfoot', 'avantage', 'avantages', 'mutuelle',
  'remuneration', 'salaire', 'teletravail', 'sein', 'assurer', 'suivre', 'suit',
  'gerer', 'piloter', 'participer', 'contribuer', 'accompagner', 'definir',
  'animer', 'mettre', 'garantir', 'optimiser', 'permettre', 'favoriser',
  'proposer', 'construire', 'travailler', 'niveau', 'type', 'domaine',
  'secteur', 'annee', 'annees', 'mois', 'jour', 'jours', 'service', 'besoin', 'client', 'produit',
  'solution', 'projet', 'fort', 'forte', 'ideal', 'atout', 'sens', 'envie',
  'capacite', 'aisance', 'aptitude', 'qualite', 'valeur', 'recrutement',
  'cadre', 'structure', 'challenge', 'defis', 'hybride', 'bureau',
  'bonne', 'bon', 'bonnes', 'bons', 'mot', 'mots', 'titre', 'titres', 'sujet', 'sujets',
  'oeuvre', 'œuvres', 'œuvre', 'uvre', 'uvres', 'concoit', 'concevoir', 'anime', 'diffuse', 'diffuser',
  'contribue', 'garant', 'garante', 'garant.e', 'garants', 'garantes',
  'engageant', 'engageants', 'engageante', 'engageantes', 'confie', 'confies', 'confiee', 'confiees',

  // Verbes conjugués fréquents dans les offres
  'cherchons', 'recherchons', 'attendons', 'souhaitons', 'proposons',
  'rejoindrez', 'rejoindront', 'rejoindra', 'rejoindrons',
  'travaillerez', 'travaillerons', 'travaillez', 'travaillerait',

  // Adjectifs fréquents
  'passionne', 'passionnee', 'passionnes', 'passionnees', 'requis', 'requise',
  'bienveillant', 'bienveillante', 'bienveillants', 'bienveillantes',
  'dynamiques', 'motivees', 'motivee', 'motive', 'motives', 'nouveau', 'nouvelle',
  'nouveaux', 'nouvelles', 'vrai', 'vraie', 'vrais', 'vraies', 'faux', 'fausse',

  // English stop words
  'the', 'of', 'and', 'or', 'to', 'a', 'an', 'in', 'on', 'for', 'with', 'be', 'is',
  'are', 'was', 'were', 'will', 'have', 'has', 'do', 'does', 'that', 'this', 'it',
  'you', 'we', 'they', 'he', 'she', 'not', 'but', 'if', 'as', 'at', 'from', 'by',
  'your', 'our', 'their', 'its', 'which', 'when', 'who', 'how', 'what', 'where',
  'team', 'company', 'work', 'role', 'join', 'position', 'experience', 'strong',
  'knowledge', 'ability', 'excellent', 'good', 'great', 'working', 'looking',
  'must', 'should', 'can', 'including', 'such', 'based', 'environment',
  'opportunity', 'culture', 'office', 'hybrid', 'remote', 'candidate',
  'profile', 'contract', 'enterprise', 'ideally', 'salary', 'benefits',
  'level', 'years', 'months', 'help', 'build', 'make', 'grow', 'ensure',
  'manage', 'lead', 'support', 'provide', 'deliver', 'create', 'drive', 'take',
]);

const _ATS_COMPOUNDS = [
  ['intelligence artificielle', 'ia'],
  ['natural language processing', 'nlp'],
  ['machine learning', 'machine-learning'],
  ['deep learning', 'deep-learning'],
  ['gestion de projet', 'gestion-projet'],
  ['base de donnees', 'base-donnees'],
  ['react native', 'react-native'],
  ['spring boot', 'spring-boot'],
  ['power bi', 'powerbi'],
  ['rest api', 'rest-api'],
  ['react js', 'react'],
  ['node js', 'nodejs'],
  ['vue js', 'vuejs'],
  ['next js', 'nextjs'],
  ['ci/cd', 'cicd'],
  ['ci cd', 'cicd'],
  ['node.js', 'nodejs'],
];

function _extractKeywords(text) {
  let clean = text
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s+#.\/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [phrase, replacement] of _ATS_COMPOUNDS) {
    clean = clean.split(phrase).join(replacement);
  }
  clean = clean.replace(/(\w)\/(\w)/g, "$1 $2");

  return [...new Set(
    clean.split(/\s+/)
      .map(w => w.replace(/^[-\/.]+|[-\/.]+$/g, ''))
      .filter(w => w.length >= 3 && !_ATS_STOP_WORDS.has(w))
  )];
}

function _detectSections(html) {
  const heading = (terms) =>
    new RegExp('<h[1-6][^>]*>[^<]*(' + terms + ')[^<]*<\/h[1-6]>', 'i');
  return {
    'Résumé / Accroche': heading('r[eé]sum[eé]|accroche|profil|summary|about').test(html),
    'Expériences': heading('exp[eé]rience|emploi|poste|travail|parcours').test(html),
    'Compétences': heading('comp[eé]tence|skill|technolog|technique|savoir').test(html),
    'Langues': heading('langue|language|anglais|fran[cç]ais|english').test(html),
    'Formation': heading('formation|dipl[oô]me|[ée]cole|universit[ée]|education|degree|cursus').test(html),
    "Centres d'intérêt": heading('int[ée]r[êe]t|loisir|hobby|passion|activit[ée]').test(html),
  };
}

function _renderAts(cvHtml, jobDesc) {
  const panel = $('ats-panel');
  if (!panel) return;

  const jobKw = _extractKeywords(jobDesc);
  const cvNorm = cvHtml
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');

  const isMatched = (kw) => {
    if (cvNorm.includes(kw)) return true;
    if ((kw.endsWith('s') || kw.endsWith('x')) && kw.length > 4)
      return cvNorm.includes(kw.slice(0, -1));
    return false;
  };

  const matched = jobKw.filter(isMatched);
  const missing = jobKw.filter(kw => !isMatched(kw)).slice(0, 20);
  _atsMissingKeywords = missing.map(k => k.replace(/-/g, ' '));
  const score = jobKw.length ? Math.round((matched.length / jobKw.length) * 100) : 0;
  const cls = score >= 70 ? 'ats-ok' : score >= 45 ? 'ats-mid' : 'ats-low';
  const barColor = score >= 70 ? '#5dd39e' : score >= 45 ? '#f5a623' : '#ff6b6b';
  const sections = _detectSections(cvHtml);

  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const matchedTop = matched.slice(0, 20);
  const pillsMatched = matchedTop.map(k => '<span class="ats-pill match">' + esc(k) + '</span>').join('');
  const pillsMissing = missing.map(k => '<span class="ats-pill missing">' + esc(k) + '</span>').join('');
  const sectBadges = Object.entries(sections).map(([name, ok]) =>
    '<span class="ats-section-badge ' + (ok ? 'found' : 'missing') + '">' + (ok ? '✓' : '✗') + ' ' + name + '</span>'
  ).join('');

  panel.innerHTML = [
    '<div class="ats-score-row">',
    '  <div class="ats-score-circle ' + cls + '">' + score + '</div>',
    '  <div class="ats-score-label">',
    '    Score ATS estimé',
    '    <span>' + matched.length + ' / ' + jobKw.length + ' mots-clés détectés</span>',
    '  </div>',
    '</div>',
    '<div class="ats-bar"><div class="ats-bar-fill" style="width:0%;background:' + barColor + '" data-target="' + score + '"></div></div>',
    matchedTop.length ? '<div class="ats-keywords-title">Mots-clés présents</div><div class="ats-pills">' + pillsMatched + '</div>' : '',
    missing.length ? '<div class="ats-keywords-title">Mots-clés absents</div><div class="ats-pills">' + pillsMissing + '</div>' : '',
    '<div class="ats-keywords-title">Sections détectées</div>',
    '<div class="ats-sections">' + sectBadges + '</div>',
    '<button type="button" class="ats-ai-btn" id="btn-ats-ai">🤖 Analyser avec l\'IA</button>',
    missing.length ? '<button type="button" class="ats-ai-btn ats-boost-btn' + (_atsBoostEnabled ? ' active' : '') + '" id="btn-ats-boost">🧲 Booster ATS invisible' + (_atsBoostEnabled ? ' ✓' : '') + '</button>' : '',
  ].join('');
  panel.style.display = 'block';

  // Animate bar
  requestAnimationFrame(() => {
    const fill = panel.querySelector('.ats-bar-fill');
    if (fill) fill.style.width = fill.dataset.target + '%';
  });

  const aiBtn = panel.querySelector('#btn-ats-ai');
  if (aiBtn) aiBtn.addEventListener('click', _runAtsAI);
  const boostBtn = panel.querySelector('#btn-ats-boost');
  if (boostBtn) boostBtn.addEventListener('click', _toggleAtsBoost);
}

// ---- Score ATS piloté par l'IA (côté serveur, optionnel) ----

async function _runAtsAI() {
  const jobDesc = ($('job-desc-input') ? $('job-desc-input').value : '').trim();
  const cvHtml = htmlModel ? htmlModel.getValue() : '';
  if (!cvHtml.trim()) { showToast("Charge d'abord un CV dans l'éditeur.", 'err'); return; }
  if (!jobDesc) { showToast("Colle l'offre d'emploi pour l'analyse IA.", 'err'); return; }

  const btn = $('btn-ats-ai');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyse IA en cours...'; }

  try {
    const stripped = _stripBase64ForTailor(cvHtml);
    const resp = await fetch('/api/ats-score', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getApiHeaders()),
      body: JSON.stringify({ html: stripped, job_desc: jobDesc }),
    });
    if (!resp.ok) {
      let msg = 'Erreur serveur';
      try { msg = (await resp.json()).error || msg; } catch (_) { }
      throw new Error(msg);
    }
    _renderAtsAI(await resp.json());
  } catch (err) {
    showToast(err.message, 'err');
    if (btn) { btn.disabled = false; btn.textContent = "🤖 Analyser avec l'IA"; }
  }
}

function _renderAtsAI(result) {
  const panel = $('ats-panel');
  if (!panel) return;

  const score = Math.max(0, Math.min(100, parseInt(result.score, 10) || 0));
  const matched = Array.isArray(result.matched_skills) ? result.matched_skills : [];
  const missingHard = Array.isArray(result.missing_hard_skills) ? result.missing_hard_skills : [];
  const missingNice = Array.isArray(result.missing_nice_to_have) ? result.missing_nice_to_have : [];
  _atsMissingKeywords = [...missingHard, ...missingNice];

  const cls = score >= 70 ? 'ats-ok' : score >= 45 ? 'ats-mid' : 'ats-low';
  const barColor = score >= 70 ? '#5dd39e' : score >= 45 ? '#f5a623' : '#ff6b6b';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pills = (arr, klass) => arr.map(k => '<span class="ats-pill ' + klass + '">' + esc(k) + '</span>').join('');

  panel.innerHTML = [
    '<div class="ats-ai-badge">✨ Analyse IA</div>',
    '<div class="ats-score-row">',
    '  <div class="ats-score-circle ' + cls + '">' + score + '</div>',
    '  <div class="ats-score-label">',
    '    Score ATS (IA)',
    '    <span>Adéquation réelle CV / offre</span>',
    '  </div>',
    '</div>',
    '<div class="ats-bar"><div class="ats-bar-fill" style="width:0%;background:' + barColor + '" data-target="' + score + '"></div></div>',
    missingHard.length ? '<div class="ats-keywords-title">⚠️ Compétences clés manquantes</div><div class="ats-pills">' + pills(missingHard, 'missing') + '</div>' : '',
    missingNice.length ? '<div class="ats-keywords-title">Atouts bonus manquants</div><div class="ats-pills">' + pills(missingNice, 'bonus') + '</div>' : '',
    matched.length ? '<div class="ats-keywords-title">Compétences présentes</div><div class="ats-pills">' + pills(matched, 'match') + '</div>' : '',
    '<button type="button" class="ats-ai-btn" id="btn-ats-ai">🔄 Relancer l\'analyse IA</button>',
    _atsMissingKeywords.length ? '<button type="button" class="ats-ai-btn ats-boost-btn' + (_atsBoostEnabled ? ' active' : '') + '" id="btn-ats-boost">🧲 Booster ATS invisible' + (_atsBoostEnabled ? ' ✓' : '') + '</button>' : '',
  ].join('');
  panel.style.display = 'block';

  requestAnimationFrame(() => {
    const fill = panel.querySelector('.ats-bar-fill');
    if (fill) fill.style.width = fill.dataset.target + '%';
  });

  const aiBtn = panel.querySelector('#btn-ats-ai');
  if (aiBtn) aiBtn.addEventListener('click', _runAtsAI);
  const boostBtn = panel.querySelector('#btn-ats-boost');
  if (boostBtn) boostBtn.addEventListener('click', _toggleAtsBoost);
}

function _toggleAtsBoost() {
  _atsBoostEnabled = !_atsBoostEnabled;
  const btn = document.getElementById('btn-ats-boost');
  if (btn) {
    btn.classList.toggle('active', _atsBoostEnabled);
    btn.textContent = '🧲 Booster ATS invisible' + (_atsBoostEnabled ? ' ✓' : '');
  }
  showToast(
    _atsBoostEnabled
      ? '🧲 Booster actif — mots-clés injectés invisiblement au prochain export PDF.'
      : '🧲 Booster désactivé.',
    'ok'
  );
}

// ============================================================
// Diff visuel avant/après adaptation
// ============================================================
function _openDiffModal() {
  if (!_tailorBeforeHtml) return;
  const afterHtml = htmlModel ? htmlModel.getValue() : '';
  const afterCss = cssModel ? cssModel.getValue() : '';
  const beforeCss = _tailorBeforeCss != null ? _tailorBeforeCss : afterCss;
  const modal = $('modal-diff');
  const before = $('diff-frame-before');
  const after = $('diff-frame-after');
  modal.style.display = 'flex';
  // Wait for layout so clientWidth is correct, then inject zoomed srcdoc.
  requestAnimationFrame(() => {
    const w = before.clientWidth || 793;
    const zoom = Math.min(1, Math.max(0.3, (w - 10) / 793));
    const injectZoom = (html) => {
      if (zoom >= 1) return html;
      return html.replace(/<\/head>/i, '<style>html,body{zoom:' + zoom.toFixed(3) + ';}</style></head>');
    };
    before.srcdoc = injectZoom(_buildPreviewHtml(_tailorBeforeHtml, beforeCss));
    after.srcdoc = injectZoom(_buildPreviewHtml(afterHtml, afterCss));
  });
}

$('btn-show-diff').addEventListener('click', _openDiffModal);
$('close-modal-diff').addEventListener('click', () => { $('modal-diff').style.display = 'none'; });
$('modal-diff').addEventListener('click', (e) => {
  if (e.target === $('modal-diff')) $('modal-diff').style.display = 'none';
});
