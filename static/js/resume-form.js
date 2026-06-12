// ============================================================
// Mode Formulaire structuré — « CV = données »
// ------------------------------------------------------------
// Le CV est édité comme une fiche de champs. À chaque saisie, on
// régénère le markup du template « sobre » dans htmlModel : toute
// la tuyauterie existante (aperçu, PDF, tailoring, autosave) suit
// sans modification. L'éditeur HTML reste le « mode expert ».
//
// Dépendances (globales déclarées dans app.js, même portée de script) :
//   htmlModel, cssModel, TEMPLATES, schedulePreview, $, showToast
// ============================================================
(function () {
  'use strict';

  const STORAGE_KEY_DATA = 'html-to-pdf:resume-data';
  const STORAGE_KEY_TEMPLATE = 'html-to-pdf:resume-template';
  const RENDER_MARKER = 'resume-template-renderer';

  // ----- Données par défaut (alignées sur le template « sobre ») -----
  const DEFAULT_RESUME = {
    name: 'Prénom Nom',
    title: 'Titre du poste',
    location: 'Ville, Pays',
    email: 'email@example.com',
    phone: '+33 6 00 00 00 00',
    linkedin: 'linkedin.com/in/profil',
    photo: '',
    summary: 'Bref résumé professionnel : 2 à 3 phrases qui présentent votre profil, votre expérience et ce que vous recherchez.',
    experience: [
      {
        title: 'Poste occupé', company: 'Entreprise', contract: 'Stage', location: 'Ville', date: 'Jan 2024 - Présent',
        bullets: ['Réalisation marquante avec métrique chiffrée.', 'Autre réalisation pertinente pour le poste visé.'],
      },
      {
        title: 'Poste précédent', company: 'Autre entreprise', contract: '', location: 'Ville', date: '2022 - 2023',
        bullets: ['Description courte de la mission.'],
      },
    ],
    education: [
      { title: 'Diplôme', school: 'Établissement', location: 'Ville', date: '2020 - 2022' },
    ],
    skills: ['Compétence 1', 'Compétence 2', 'Compétence 3', 'Compétence 4', 'Compétence 5', 'Compétence 6'],
    interests: ['Lecture', 'Sport', 'Voyages'],
    languages: [
      { name: 'Français', level: 'Natif' },
      { name: 'Anglais', level: 'Courant' },
    ],
    projects: [],
    certifications: [],
    volunteer: [],
  };

  
  const DEFAULT_LETTER = {
    sender_name: 'Prénom Nom',
    sender_address: 'Adresse, Ville',
    sender_contact: 'email@example.com &middot; +33 6 00 00 00 00',
    date: 'Ville, le JJ/MM/AAAA',
    recipient_name: "Nom de l'entreprise",
    recipient_service: 'Service Recrutement',
    recipient_address: "Adresse de l'entreprise",
    subject: 'Candidature au poste de [Intitulé du poste]',
    greeting: 'Madame, Monsieur,',
    body: "[Accroche : présentez-vous brièvement et expliquez pourquoi ce poste et cette entreprise vous intéressent particulièrement.]\n\n[Argumentaire : décrivez vos compétences et expériences les plus pertinentes, avec des exemples concrets.]\n\n[Conclusion : réaffirmez votre motivation, mentionnez votre disponibilité pour un entretien et remerciez pour l'attention portée à votre candidature.]",
    signoff: "Dans l'attente de votre réponse, je reste à votre disposition pour tout échange.\n\nVeuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    signature: 'Prénom Nom'
  };

  let _currentDocType = 'CV';

  let resumeData = null;
  let built = false;
  let applyTimer = null;

  // ----- Échappement HTML -----
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ----- Rendu : données → markup du template « sobre » -----
  function renderResume(d) {
    const out = ['<div class="resume-template-1 resume-template-renderer">'];

    // Informations personnelles
    const photoInner = d.photo
      ? `<img src="${esc(d.photo)}" alt="Photo de profil">`
      : '<!-- URL_DE_VOTRE_PHOTO_ICI -->';
    const photoStyle = d.photo ? '' : ' style="background:#eee;"';
    const contact = [d.location, d.email, d.phone, d.linkedin]
      .map(s => (s || '').trim()).filter(Boolean).map(esc).join(' &middot; ');
    out.push(`
  <section class="resume-template-renderer-section personal-data">
    <h2 class="resume-template-renderer-section__title">Informations personnelles</h2>
    <div class="personal-data__photo"${photoStyle}>
      ${photoInner}
    </div>
    <div class="personal-data__title-row">
      <span class="personal-data__name">${esc(d.name)}</span>${(d.title || '').trim() ? `<span class="personal-data__desired-job-title">${esc(d.title)}</span>` : ''}
    </div>
    <div class="personal-data__contact-row">
      ${contact}
    </div></section>`);

    // À propos
    if ((d.summary || '').trim()) {
      out.push(`
  <section class="resume-template-renderer-section summary-objective">
    <h2 class="resume-template-renderer-section__title summary-objective__title">A propos</h2>
    <div class="summary-objective__content">
      ${esc(d.summary)}
    </div>
  </section>`);
    }

    // Expérience
    const exp = (d.experience || []).filter(e => e && (e.title || e.company || (e.bullets || []).length));
    if (exp.length) {
      const items = exp.map(e => {
        const bullets = (e.bullets || []).filter(b => b && b.trim());
        const desc = bullets.length ? `
      <div class="entry-list__description">
        <ul>
${bullets.map(b => `          <li>${esc(b)}</li>`).join('\n')}
        </ul>
      </div>` : '';
        const parts = [];
        if ((e.company || '').trim()) parts.push(`<span class="entry-list__subtitle">${esc(e.company)}</span>`);
        if ((e.contract || '').trim()) parts.push(`<span class="entry-list__contract" style="color: #787673;">${esc(e.contract)}</span>`);
        if ((e.location || '').trim()) parts.push(`<span class="entry-list__location" style="margin-left: 0;">${esc(e.location)}</span>`);
        const companyRow = parts.join(' &mdash; ');
        return `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(e.title)}</span>
      <span class="entry-list__date">${esc(e.date)}</span>
      <div class="entry-list__company-row">
        ${companyRow}
      </div>${desc}
    </div>`;
      }).join('\n');
      out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Experience</h2>
${items}
  </section>`);
    }

    // Formation
    const edu = (d.education || []).filter(e => e && (e.title || e.school));
    if (edu.length) {
      const items = edu.map(e => `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(e.title)}</span>
      <span class="entry-list__date">${esc(e.date)}</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">${esc(e.school)}</span>${(e.location || '').trim() ? `<span class="entry-list__location">${esc(e.location)}</span>` : ''}
      </div>
    </div>`).join('\n');
      out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Formation</h2>
${items}
  </section>`);
    }

    // Compétences
    const skills = (d.skills || []).filter(s => s && s.trim());
    if (skills.length) {
      const items = skills.map(s => {
        let parts = s.split(' — ');
        if (parts.length === 1) parts = s.split(' - ');
        if (parts.length > 1) {
          return `      <li class="plain-list__item"><strong>${esc(parts[0].trim())}</strong> &mdash; ${esc(parts.slice(1).join(' — ').trim())}</li>`;
        }
        return `      <li class="plain-list__item">${esc(s)}</li>`;
      }).join('\n');
      out.push(`
  <section class="resume-template-renderer-section plain-list section-skills">
    <h2 class="resume-template-renderer-section__title">Competences</h2>
    <ul class="plain-list__items">
${items}
    </ul>
  </section>`);
    }

    // Projets
    const projects = (d.projects || []).filter(p => p && (p.title || p.description));
    if (projects.length) {
      const items = projects.map(p => {
        const descTxt = (p.description || '').trim();
        const desc = descTxt ? `
      <div class="entry-list__description">
        <p>${esc(descTxt)}</p>
      </div>` : '';
        return `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(p.title)}</span>
      <span class="entry-list__date">${esc(p.date)}</span>${desc}
    </div>`;
      }).join('\n');
      out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Projets</h2>
${items}
  </section>`);
    }

    // Certifications
    const certs = (d.certifications || []).filter(s => s && s.trim());
    if (certs.length) {
      out.push(`
  <section class="resume-template-renderer-section plain-list section-certifications">
    <h2 class="resume-template-renderer-section__title">Certifications</h2>
    <ul class="plain-list__items">
${certs.map(s => `      <li class="plain-list__item">${esc(s)}</li>`).join('\n')}
    </ul>
  </section>`);
    }

    // Bénévolat
    const volunteer = (d.volunteer || []).filter(v => v && (v.title || v.organization || (v.bullets || []).length));
    if (volunteer.length) {
      const items = volunteer.map(v => {
        const bullets = (v.bullets || []).filter(b => b && b.trim());
        const desc = bullets.length ? `
      <div class="entry-list__description">
        <ul>
${bullets.map(b => `          <li>${esc(b)}</li>`).join('\n')}
        </ul>
      </div>` : '';
        const orgRow = (v.organization || '').trim()
          ? `        <span class="entry-list__subtitle">${esc(v.organization)}</span>${(v.location || '').trim() ? `<span class="entry-list__location">${esc(v.location)}</span>` : ''}`
          : '';
        return `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(v.title)}</span>
      <span class="entry-list__date">${esc(v.date)}</span>
      <div class="entry-list__company-row">
${orgRow}
      </div>${desc}
    </div>`;
      }).join('\n');
      out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Benevolat</h2>
${items}
  </section>`);
    }

    // Langues
    const langs = (d.languages || []).filter(l => l && (l.name || '').trim());
    if (langs.length) {
      out.push(`
  <section class="resume-template-renderer-section languages section-languages">
    <h2 class="resume-template-renderer-section__title">Langues</h2>
    <ul class="languages__items">
${langs.map(l => `      <li class="languages__item">
        <span class="languages__name">${esc(l.name)}</span>${(l.level || '').trim() ? `<span class="languages__description">${esc(l.level)}</span>` : ''}
      </li>`).join('\n')}
    </ul>
  </section>`);
    }

    // Centres d'intérêt
    const interests = (d.interests || []).filter(s => s && s.trim());
    if (interests.length) {
      out.push(`
  <section class="resume-template-renderer-section plain-list section-interests">
    <h2 class="resume-template-renderer-section__title">Centres d'interet</h2>
    <ul class="plain-list__items">
${interests.map(s => `      <li class="plain-list__item">${esc(s)}</li>`).join('\n')}
    </ul>
  </section>`);
    }

    out.push('\n</div>');
    return out.join('\n');
  }

  
  // ----- Rendu Lettre : données → markup du template Lettre -----
  function renderLetter(d) {
    const paragraphs = (d.body || '').split('\n').filter(p => p.trim() !== '').map(p => `<p>${esc(p)}</p>`).join('\n  ');
    const signoffParagraphs = (d.signoff || '').split('\n').filter(p => p.trim() !== '').map(p => `<p>${esc(p)}</p>`).join('\n  ');

    return `<div style="font-family: 'Inter', sans-serif; max-width: 680px; margin: 40px auto; color: #222; line-height: 1.7; font-size: 14px;" class="resume-template-renderer">

  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px;">
    <!-- Infos de l'entreprise à gauche -->
    <div style="flex: 1; padding-right: 20px;">
      <p style="margin: 0;"><strong>${esc(d.recipient_name)}</strong><br>
      ${esc(d.recipient_service)}<br>
      ${esc(d.recipient_address)}</p>
    </div>
    
    <!-- Infos personnelles à droite -->
    <div style="text-align: right; flex: 1; padding-left: 20px;">
      <p style="margin: 0;"><strong>${esc(d.sender_name)}</strong><br>
      ${esc(d.sender_address)}<br>
      ${esc(d.sender_contact)}</p>
      <p style="margin: 16px 0 0; color: #555;">${esc(d.date)}</p>
    </div>
  </div>

  <p style="margin-bottom: 32px;"><strong>Objet : ${esc(d.subject)}</strong></p>

  <p>${esc(d.greeting)}</p>

  ${paragraphs}

  ${signoffParagraphs}

  <br><br>
  <p style="text-align: right; padding-right: 40px;"><strong>${esc(d.signature)}</strong></p>

</div>`;
  }

  // ----- Persistance des données du formulaire -----
  function persist() {
    try { localStorage.setItem(STORAGE_KEY_DATA, JSON.stringify(resumeData)); } catch (_) {}
  }

  function loadStoredData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DATA);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return JSON.parse(JSON.stringify(_currentDocType === 'Lettre' ? DEFAULT_LETTER : DEFAULT_RESUME));
  }

  // ----- Modèle de mise en page (templateId) -----
  function currentTemplateId() {
    try {
      const id = localStorage.getItem(STORAGE_KEY_TEMPLATE);
      if (id && typeof TEMPLATES !== 'undefined' && TEMPLATES[id]) return id;
    } catch (_) {}
    return 'sobre';
  }

  // Change de modèle : remplace le CSS du document puis régénère le rendu.
  function setTemplate(id) {
    if (typeof TEMPLATES === 'undefined' || !TEMPLATES[id]) id = 'sobre';
    try { localStorage.setItem(STORAGE_KEY_TEMPLATE, id); } catch (_) {}
    if (typeof cssModel !== 'undefined' && cssModel && TEMPLATES[id]) {
      cssModel.setValue(TEMPLATES[id].css);
    }
    applyToEditor();
  }

  // ----- Application au CV (écrit dans htmlModel) -----
  function ensureCss() {
    if (typeof cssModel === 'undefined' || !cssModel) return;
    const tpl = (typeof TEMPLATES !== 'undefined' && TEMPLATES) ? TEMPLATES[currentTemplateId()] : null;
    if (!cssModel.getValue().includes(RENDER_MARKER) && tpl) {
      cssModel.setValue(tpl.css);
    }
  }

  function applyToEditor() {
    if (typeof htmlModel === 'undefined' || !htmlModel) return;
    if (_currentDocType === 'Lettre') {
      if (typeof cssModel !== 'undefined' && cssModel) cssModel.setValue('');
      htmlModel.setValue(renderLetter(resumeData));
    } else {
      ensureCss();
      htmlModel.setValue(renderResume(resumeData)); // déclenche autosave + aperçu
    }
    persist();
  }

  function scheduleApply() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(applyToEditor, 250);
  }

  // ----- Construction du formulaire (DOM) -----
  function field(section, index, key, label, value, type) {
    const idx = index != null ? ` data-index="${index}"` : '';
    return `<label class="rf-field"><span>${label}</span>` +
      `<input type="${type || 'text'}" data-section="${section}"${idx} data-field="${key}" value="${esc(value)}"></label>`;
  }

  function textarea(section, index, key, label, value, rows) {
    const idx = index != null ? ` data-index="${index}"` : '';
    return `<label class="rf-field rf-full"><span>${label}</span>` +
      `<textarea rows="${rows || 3}" data-section="${section}"${idx} data-field="${key}">${esc(value)}</textarea></label>`;
  }

  function itemActions(section, index) {
    return `<div class="rf-item-actions">` +
      `<button type="button" class="rf-icon-btn" data-action="up" data-section="${section}" data-index="${index}" title="Monter">▲</button>` +
      `<button type="button" class="rf-icon-btn" data-action="down" data-section="${section}" data-index="${index}" title="Descendre">▼</button>` +
      `<button type="button" class="rf-icon-btn" data-action="remove" data-section="${section}" data-index="${index}" title="Supprimer">✕</button>` +
      `</div>`;
  }

  function buildForm() {
    const pane = $('form-pane');
    if (!pane) return;
    const d = resumeData;
    const isCustom = typeof htmlModel !== 'undefined' && htmlModel &&
      htmlModel.getValue().trim() && !htmlModel.getValue().includes(RENDER_MARKER);

    const html = [];

    if (isCustom) {
      html.push(`<div class="rf-note">Le formulaire génère un CV propre à partir des champs ci-dessous. Le HTML actuel (importé ou édité à la main) n'est pas relu ici : modifier un champ remplacera le contenu de l'éditeur.</div>`);
    }

    // Header Import PDF
    html.push(`
      <div class="rf-header-actions" style="margin-bottom: 18px; padding: 16px; background: var(--bg); border-radius: 14px; box-shadow: var(--neu-inset); display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div>
          <strong style="font-size: 13px; color: var(--text); display: block;">Gagnez du temps avec l'IA ✨</strong>
          <span style="font-size: 12px; color: var(--muted);">Importez un CV existant, l'IA remplira les champs automatiquement.</span>
        </div>
        <div>
          <button type="button" class="rf-add-btn" id="rf-import-pdf-btn" style="background: linear-gradient(145deg, var(--orange), var(--orange-hover)); color: white; border: none; padding: 9px 16px; border-radius: 10px; font-weight: 600; box-shadow: var(--neu-raised-sm);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px; vertical-align: -2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Importer un PDF
          </button>
        </div>
      </div>
    `);

    if (_currentDocType === 'Lettre') {
      // Formulaire Lettre
      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Expéditeur</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'sender_name', 'Nom', d.sender_name)}
          ${field('lettre', null, 'sender_address', 'Adresse', d.sender_address)}
          ${field('lettre', null, 'sender_contact', 'Contact (Email / Tél)', d.sender_contact)}
        </div>
      </section>`);

      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Date et Lieu</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'date', 'Lieu et Date', d.date)}
        </div>
      </section>`);

      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Destinataire</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'recipient_name', 'Entreprise', d.recipient_name)}
          ${field('lettre', null, 'recipient_service', 'Service', d.recipient_service)}
          ${field('lettre', null, 'recipient_address', 'Adresse', d.recipient_address)}
        </div>
      </section>`);

      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Contenu de la lettre</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'subject', 'Objet', d.subject)}
          ${field('lettre', null, 'greeting', 'Salutation', d.greeting)}
        </div>
        ${textarea('lettre', null, 'body', 'Corps de la lettre (sauts de ligne conservés)', d.body, 10)}
        ${textarea('lettre', null, 'signoff', 'Formule de politesse', d.signoff, 3)}
        <div class="rf-grid" style="margin-top: 8px;">
          ${field('lettre', null, 'signature', 'Signature', d.signature)}
        </div>
      </section>`);

    } else {
      // Formulaire CV
      // Modèle de mise en page
      const _tplId = currentTemplateId();
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Modèle de mise en page</span></div>
      <div class="rf-grid">
        <label class="rf-field"><span>Modèle</span>
          <select id="rf-template-select">
            <option value="sobre"${_tplId === 'sobre' ? ' selected' : ''}>Sobre</option>
            <option value="moderne"${_tplId === 'moderne' ? ' selected' : ''}>Moderne</option>
            <option value="classique"${_tplId === 'classique' ? ' selected' : ''}>Classique</option>
            <option value="minimal"${_tplId === 'minimal' ? ' selected' : ''}>Minimal</option>
            <option value="graphique"${_tplId === 'graphique' ? ' selected' : ''}>Graphique</option>
          </select>
        </label>
      </div>
    </section>`);

    // Informations personnelles
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Informations personnelles</span></div>
      <div class="rf-grid">
        ${field('basics', null, 'name', 'Nom complet', d.name)}
        ${field('basics', null, 'title', 'Titre du poste', d.title)}
        ${field('basics', null, 'email', 'Email', d.email)}
        ${field('basics', null, 'phone', 'Téléphone', d.phone)}
        ${field('basics', null, 'location', 'Ville / Pays', d.location)}
        ${field('basics', null, 'linkedin', 'LinkedIn / Site', d.linkedin)}
      </div>
      <div class="rf-photo-row">
        <button type="button" class="rf-add-btn" id="rf-photo-btn">${d.photo ? 'Changer la photo' : 'Ajouter une photo'}</button>
        ${d.photo ? '<button type="button" class="rf-add-btn" id="rf-photo-clear">Retirer</button>' : ''}
        <input type="file" id="rf-photo-input" accept="image/*" style="display:none">
      </div>
    </section>`);

    // À propos
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>À propos</span></div>
      ${textarea('summary', null, 'summary', '', d.summary, 4)}
    </section>`);

    // Expérience
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Expérience</span>
        <button type="button" class="rf-add-btn" data-action="add" data-section="experience">+ Ajouter</button></div>
      ${(d.experience || []).map((e, i) => `<div class="rf-item">
        <div class="rf-item-head"><span>Expérience ${i + 1}</span>${itemActions('experience', i)}</div>
        <div class="rf-grid">
          ${field('experience', i, 'title', 'Poste', e.title)}
          ${field('experience', i, 'company', 'Entreprise', e.company)}
          ${field('experience', i, 'contract', 'Contrat (ex: Stage)', e.contract)}
          ${field('experience', i, 'location', 'Ville', e.location)}
          ${field('experience', i, 'date', 'Période', e.date)}
        </div>
        ${textarea('experience', i, 'bullets', 'Réalisations (une par ligne)', (e.bullets || []).join('\n'), 3)}
      </div>`).join('')}
    </section>`);

    // Formation
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Formation</span>
        <button type="button" class="rf-add-btn" data-action="add" data-section="education">+ Ajouter</button></div>
      ${(d.education || []).map((e, i) => `<div class="rf-item">
        <div class="rf-item-head"><span>Formation ${i + 1}</span>${itemActions('education', i)}</div>
        <div class="rf-grid">
          ${field('education', i, 'title', 'Diplôme', e.title)}
          ${field('education', i, 'school', 'Établissement', e.school)}
          ${field('education', i, 'location', 'Ville', e.location)}
          ${field('education', i, 'date', 'Période', e.date)}
        </div>
      </div>`).join('')}
    </section>`);

    // Compétences
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Compétences</span></div>
      ${textarea('skills', null, 'skills', 'Une compétence par ligne', (d.skills || []).join('\n'), 5)}
    </section>`);

    // Projets
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Projets</span>
        <button type="button" class="rf-add-btn" data-action="add" data-section="projects">+ Ajouter</button></div>
      ${(d.projects || []).map((p, i) => `<div class="rf-item">
        <div class="rf-item-head"><span>Projet ${i + 1}</span>${itemActions('projects', i)}</div>
        <div class="rf-grid">
          ${field('projects', i, 'title', 'Nom du projet', p.title)}
          ${field('projects', i, 'date', 'Date', p.date)}
        </div>
        ${textarea('projects', i, 'description', 'Description', p.description, 2)}
      </div>`).join('')}
    </section>`);

    // Certifications
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Certifications</span></div>
      ${textarea('certifications', null, 'certifications', 'Une certification par ligne', (d.certifications || []).join('\n'), 3)}
    </section>`);

    // Bénévolat
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Bénévolat</span>
        <button type="button" class="rf-add-btn" data-action="add" data-section="volunteer">+ Ajouter</button></div>
      ${(d.volunteer || []).map((v, i) => `<div class="rf-item">
        <div class="rf-item-head"><span>Bénévolat ${i + 1}</span>${itemActions('volunteer', i)}</div>
        <div class="rf-grid">
          ${field('volunteer', i, 'title', 'Rôle', v.title)}
          ${field('volunteer', i, 'organization', 'Organisation', v.organization)}
          ${field('volunteer', i, 'location', 'Ville', v.location)}
          ${field('volunteer', i, 'date', 'Période', v.date)}
        </div>
        ${textarea('volunteer', i, 'bullets', 'Activités (une par ligne)', (v.bullets || []).join('\n'), 3)}
      </div>`).join('')}
    </section>`);

    // Langues
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Langues</span>
        <button type="button" class="rf-add-btn" data-action="add" data-section="languages">+ Ajouter</button></div>
      ${(d.languages || []).map((l, i) => `<div class="rf-lang-row">
        ${field('languages', i, 'name', 'Langue', l.name)}
        ${field('languages', i, 'level', 'Niveau', l.level)}
        <button type="button" class="rf-icon-btn" data-action="remove" data-section="languages" data-index="${i}" title="Supprimer">✕</button>
      </div>`).join('')}
    </section>`);

    // Centres d'intérêt
    html.push(`<section class="rf-group">
      <div class="rf-group-head"><span>Centres d'intérêt</span></div>
      ${textarea('interests', null, 'interests', "Un centre d'intérêt par ligne", (d.interests || []).join('\n'), 3)}
    </section>`);

    
    }
pane.innerHTML = html.join('');
    built = true;
  }

  // ----- Lecture d'un champ → mise à jour des données -----
  function updateField(section, index, key, value) {
    if (section === 'lettre') {
      resumeData[key] = value;
    } else if (section === 'basics') {
      resumeData[key] = value;
    } else if (section === 'summary') {
      resumeData.summary = value;
    } else if (section === 'skills') {
      resumeData.skills = value.split('\n');
    } else if (section === 'interests') {
      resumeData.interests = value.split('\n');
    } else if (section === 'certifications') {
      resumeData.certifications = value.split('\n');
    } else if (section === 'experience') {
      if (key === 'bullets') resumeData.experience[index].bullets = value.split('\n');
      else resumeData.experience[index][key] = value;
    } else if (section === 'education') {
      resumeData.education[index][key] = value;
    } else if (section === 'languages') {
      resumeData.languages[index][key] = value;
    } else if (section === 'projects') {
      resumeData.projects[index][key] = value;
    } else if (section === 'volunteer') {
      if (key === 'bullets') resumeData.volunteer[index].bullets = value.split('\n');
      else resumeData.volunteer[index][key] = value;
    }
  }

  const EMPTY = {
    experience: () => ({ title: '', company: '', contract: '', location: '', date: '', bullets: [] }),
    education: () => ({ title: '', school: '', location: '', date: '' }),
    languages: () => ({ name: '', level: '' }),
    projects: () => ({ title: '', date: '', description: '' }),
    volunteer: () => ({ title: '', organization: '', location: '', date: '', bullets: [] }),
  };

  function handleAction(action, section, index) {
    const arr = resumeData[section];
    if (action === 'add' && EMPTY[section]) {
      arr.push(EMPTY[section]());
    } else if (action === 'remove') {
      arr.splice(index, 1);
    } else if (action === 'up' && index > 0) {
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    } else if (action === 'down' && index < arr.length - 1) {
      [arr[index + 1], arr[index]] = [arr[index], arr[index + 1]];
    } else {
      return;
    }
    buildForm();
    applyToEditor();
  }

  // ----- Câblage des événements (délégation) -----
  function wire() {
    const pane = $('form-pane');
    if (!pane) return;

    pane.addEventListener('input', (e) => {
      const t = e.target;
      if (!t.dataset || t.dataset.field === undefined) return;
      const idx = t.dataset.index !== undefined ? +t.dataset.index : null;
      updateField(t.dataset.section, idx, t.dataset.field, t.value);
      scheduleApply();
    });

    pane.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const idx = btn.dataset.index !== undefined ? +btn.dataset.index : null;
        handleAction(btn.dataset.action, btn.dataset.section, idx);
        return;
      }
      if (e.target.id === 'rf-photo-btn') { $('rf-photo-input').click(); }
      else if (e.target.closest('#rf-import-pdf-btn')) { $('pdf-upload-input').click(); }
      else if (e.target.id === 'rf-photo-clear') {
        resumeData.photo = '';
        buildForm();
        applyToEditor();
      }
    });

    pane.addEventListener('change', (e) => {
      if (e.target.id === 'rf-template-select') { setTemplate(e.target.value); return; }
      if (e.target.id !== 'rf-photo-input') return;
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        resumeData.photo = ev.target.result;
        buildForm();
        applyToEditor();
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });
  }

  // ----- Normalisation d'un CV entrant (IA / import) vers le schéma -----
  function normalizeIncoming(obj) {
    obj = obj || {};
    if (_currentDocType === 'Lettre') {
      return {
        sender_name: obj.sender_name || DEFAULT_LETTER.sender_name,
        sender_address: obj.sender_address || DEFAULT_LETTER.sender_address,
        sender_contact: obj.sender_contact || DEFAULT_LETTER.sender_contact,
        date: obj.date || DEFAULT_LETTER.date,
        recipient_name: obj.recipient_name || DEFAULT_LETTER.recipient_name,
        recipient_service: obj.recipient_service || DEFAULT_LETTER.recipient_service,
        recipient_address: obj.recipient_address || DEFAULT_LETTER.recipient_address,
        subject: obj.subject || DEFAULT_LETTER.subject,
        greeting: obj.greeting || DEFAULT_LETTER.greeting,
        body: obj.body || DEFAULT_LETTER.body,
        signoff: obj.signoff || DEFAULT_LETTER.signoff,
        signature: obj.signature || DEFAULT_LETTER.signature
      };
    }
    const arr = (v) => Array.isArray(v) ? v : [];
    return {
      name: obj.name || '', title: obj.title || '', location: obj.location || '',
      email: obj.email || '', phone: obj.phone || '', linkedin: obj.linkedin || '',
      photo: obj.photo || '',
      summary: obj.summary || '',
      experience: arr(obj.experience).map(e => ({
        title: (e && e.title) || '', company: (e && e.company) || '',
        contract: (e && e.contract) || '', location: (e && e.location) || '',
        date: (e && e.date) || '',
        bullets: Array.isArray(e && e.bullets) ? e.bullets : [],
      })),
      education: arr(obj.education).map(e => ({
        title: (e && e.title) || '', school: (e && e.school) || '',
        location: (e && e.location) || '', date: (e && e.date) || '',
      })),
      skills: arr(obj.skills),
      interests: arr(obj.interests),
      languages: arr(obj.languages).map(l => ({ name: (l && l.name) || '', level: (l && l.level) || '' })),
      projects: arr(obj.projects).map(p => ({
        title: (p && p.title) || '', date: (p && p.date) || '',
        description: (p && p.description) || '',
      })),
      certifications: arr(obj.certifications),
      volunteer: arr(obj.volunteer).map(v => ({
        title: (v && v.title) || '', organization: (v && v.organization) || '',
        location: (v && v.location) || '', date: (v && v.date) || '',
        bullets: Array.isArray(v && v.bullets) ? v.bullets : [],
      })),
    };
  }

  // ----- API publique (appelée par app.js) -----
  window.ResumeForm = {
    setDocType(type) {
      _currentDocType = type;
      built = false; // force rebuild
    },
    init() {
      resumeData = loadStoredData();
      buildForm();
      wire();
      // Si on recharge directement sur l'onglet Formulaire, il est déjà visible.
    },
    onShow() {
      if (!built) { this.init(); return; }
      buildForm(); // re-synchronise l'affichage avec les données courantes
    },
    // Copie profonde des données courantes (photo incluse) — pour le tailoring IA.
    getData() {
      return resumeData ? JSON.parse(JSON.stringify(resumeData)) : null;
    },
    // Charge un CV (IA / import PDF) dans le formulaire et l'applique à l'éditeur.
    // La photo existante est conservée si le CV entrant n'en fournit pas.
    loadData(obj, skipApply = false) {
      if (!resumeData) resumeData = loadStoredData();
      const incoming = normalizeIncoming(obj);
      if (!incoming.photo && resumeData && resumeData.photo) incoming.photo = resumeData.photo;
      resumeData = incoming;
      buildForm();
      if (!skipApply) {
        applyToEditor();
      } else {
        persist();
      }
    },
    // Vide le formulaire (utile lors d'un switch vers un document sans JSON)
    clearData() {
      resumeData = normalizeIncoming(null);
      buildForm();
      persist();
    },
    // true si l'éditeur affiche actuellement un CV généré par le formulaire.
    matchesEditor() {
      return typeof htmlModel !== 'undefined' && !!htmlModel &&
        htmlModel.getValue().includes(RENDER_MARKER);
    },
    // Identifiant du modèle de mise en page sélectionné (sobre / moderne).
    getTemplateId() {
      return currentTemplateId();
    },
  };
  if (window.__bootResumeFormIfReady) window.__bootResumeFormIfReady();
})();
