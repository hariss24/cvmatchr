// Templates HTML/CSS intégrés — port fidèle de TEMPLATES (static/js/app.js, l.70-409).
// 5 modèles : sobre, moderne, classique, minimal, graphique. Chaque modèle = { html, css }.

export type TemplateId = "sobre" | "moderne" | "classique" | "minimal" | "graphique";
export type Template = { html: string; css: string };

export const TEMPLATES = {
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
    <h2 class="resume-template-renderer-section__title summary-objective__title">À propos</h2>
    <div class="summary-objective__content">
      Bref resume professionnel : 2 a 3 phrases qui presentent votre profil, votre experience et ce que vous recherchez.
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Expériences</h2>
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
    <h2 class="resume-template-renderer-section__title">Formations</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Diplome</span>
      <span class="entry-list__date">2020 - 2022</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Etablissement</span><span class="entry-list__location">Ville</span>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Compétences</h2>
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
} as unknown as Record<TemplateId, Template>;

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
.resume-template-1.resume-template-renderer .personal-data .personal-data__photo { position: static !important; width: 75px !important; height: 75px !important; border-radius: 4px; overflow: hidden; margin-right: 16px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__title-row { flex: 1; display: flex; flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 4px 10px; margin-bottom: 0; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name { font-size: 14pt; font-weight: 700; text-transform: uppercase; color: #111; line-height: 1.2; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #0078d4; font-size: 12pt; font-weight: 700; margin-top: 0; display: inline; }
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

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
