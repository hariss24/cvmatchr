// ============================================================
// Export vers Reactive Resume (format standard « JSON Resume »)
// ------------------------------------------------------------
// Traduit le CV de l'app (schéma interne, cf. resume-form.js) vers
// le standard jsonresume.org, que Reactive Resume sait importer
// quelle que soit sa version (RR convertit lui-même à l'import).
//
// Champs volontairement non exportés : photo (base64, à rajouter
// dans Reactive Resume) et contract (pas d'équivalent standard).
//
// Dépendances navigateur (globales d'app.js) : ResumeForm, showToast.
// ============================================================
(function (root) {
  'use strict';

  function s(v) { return v == null ? '' : String(v).trim(); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  // « 2020 - 2022 » / « Jan 2024 - Présent » -> {startDate, endDate}
  function splitDate(period) {
    const p = s(period);
    if (!p) return { startDate: '', endDate: '' };
    const parts = p.split(/\s*[–—-]\s*/); // tiret, en-dash, em-dash
    if (parts.length >= 2 && s(parts[0])) {
      return { startDate: s(parts[0]), endDate: s(parts.slice(1).join(' - ')) };
    }
    return { startDate: p, endDate: '' };
  }

  function resumeToJsonResume(d) {
    d = d || {};

    const profiles = [];
    if (s(d.linkedin)) {
      const raw = s(d.linkedin);
      const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
      profiles.push({ network: 'LinkedIn', username: '', url: url });
    }

    const work = arr(d.experience)
      .filter(function (e) { return e && (s(e.title) || s(e.company) || arr(e.bullets).length); })
      .map(function (e) {
        const dt = splitDate(e.date);
        return {
          name: s(e.company),
          position: s(e.title),
          location: s(e.location),
          startDate: dt.startDate,
          endDate: dt.endDate,
          summary: '',
          highlights: arr(e.bullets).map(s).filter(Boolean),
          url: '',
        };
      });

    const education = arr(d.education)
      .filter(function (e) { return e && (s(e.title) || s(e.school)); })
      .map(function (e) {
        const dt = splitDate(e.date);
        return {
          institution: s(e.school),
          area: '',
          studyType: s(e.title),
          startDate: dt.startDate,
          endDate: dt.endDate,
          score: '',
          url: '',
          courses: [],
        };
      });

    const skillNames = arr(d.skills).map(s).filter(Boolean);
    const skills = skillNames.length
      ? [{ name: 'Compétences', level: '', keywords: skillNames }]
      : [];

    const languages = arr(d.languages)
      .filter(function (l) { return l && s(l.name); })
      .map(function (l) { return { language: s(l.name), fluency: s(l.level) }; });

    const interests = arr(d.interests).map(s).filter(Boolean)
      .map(function (name) { return { name: name, keywords: [] }; });

    return {
      $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
      basics: {
        name: s(d.name),
        label: s(d.title),
        image: '',
        email: s(d.email),
        phone: s(d.phone),
        url: '',
        summary: s(d.summary),
        location: {
          address: s(d.location), postalCode: '', city: '', countryCode: '', region: '',
        },
        profiles: profiles,
      },
      work: work,
      education: education,
      skills: skills,
      languages: languages,
      interests: interests,
    };
  }

  function downloadJsonResume() {
    if (!root.ResumeForm || !root.ResumeForm.getData) {
      if (root.showToast) root.showToast('Mode formulaire non disponible', 'err');
      return;
    }
    const data = root.ResumeForm.getData();
    if (!data) {
      if (root.showToast) root.showToast('Aucun CV à exporter', 'err');
      return;
    }
    const json = JSON.stringify(resumeToJsonResume(data), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (s(data.name) || 'cv').replace(/[^\w-]+/g, '_') || 'cv';
    a.href = url;
    a.download = safe + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    if (root.showToast) root.showToast('CV exporté (format Reactive Resume) ✓', 'ok');
  }

  // Câblage navigateur (script chargé en fin de <body>, le DOM existe déjà).
  if (typeof document !== 'undefined') {
    const btn = document.getElementById('btn-export-rr');
    if (btn) btn.addEventListener('click', downloadJsonResume);
    root.exportToReactiveResume = downloadJsonResume;
  }

  // Export Node pour les tests.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { resumeToJsonResume: resumeToJsonResume };
  }
})(typeof window !== 'undefined' ? window : this);
