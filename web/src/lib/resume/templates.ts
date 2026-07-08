// Templates HTML/CSS intégrés — port fidèle de TEMPLATES (static/js/app.js, l.70-409).
// 5 modèles : sobre, moderne, classique, minimal, graphique. Chaque modèle = { html, css }.

export type TemplateId = "sobre" | "graphique" | "kakuna" | "marine";
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
} as unknown as Record<TemplateId, Template>;


// Modèle « Graphique » : inspiré du CV de Hariss (Timeline, en-tête flex)
TEMPLATES.graphique = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css + `

/* === Modele Graphique (overrides) === */
:root { --resume-template-customization-color: #0078d4; }
.resume-template-1.resume-template-renderer { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
.resume-template-1.resume-template-renderer .personal-data { display: flex !important; align-items: center; justify-content: space-between; min-height: auto; padding-left: 0 !important; margin-bottom: 10px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__photo { position: static !important; width: 75px !important; height: 75px !important; border-radius: 4px; overflow: hidden; margin-right: 16px; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__title-row { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; margin-bottom: 0; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__name { font-size: 14pt; font-weight: 700; text-transform: uppercase; color: #111; line-height: 1.2; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title { color: #0078d4; font-size: 12pt; font-weight: 700; margin-top: 0; display: block; }
.resume-template-1.resume-template-renderer .personal-data .personal-data__desired-job-title::before { content: none; }
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

// Modèle « Kakuna » : port de Reactive Resume
TEMPLATES.kakuna = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css,
};

// Modèle « Marine » : sidebar bleu marine (rendu réel géré par MarineTemplate.tsx en React-PDF).
TEMPLATES.marine = {
  html: TEMPLATES.sobre.html,
  css: TEMPLATES.sobre.css,
};

export const TEMPLATE_IDS = Object.keys(TEMPLATES) as TemplateId[];
