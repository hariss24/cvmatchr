import type { Resume, Letter } from "./schema";

/**
 * Rendu données → HTML (template « sobre »).
 * Port fidèle de `renderResume` / `renderLetter` (static/js/resume-form.js, l.85-316),
 * échappement HTML inclus, sections vides filtrées.
 */

/** Échappement HTML — port de `esc` (resume-form.js, l.76). */
export function escapeHtml(value: unknown): string {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const esc = escapeHtml;
const t = (v: unknown): string => (v == null ? "" : String(v)).trim();

export function renderResume(d: Resume): string {
  const out: string[] = ['<div class="resume-template-1 resume-template-renderer">'];

  // Informations personnelles
  const photoInner = d.photo
    ? `<img src="${esc(d.photo)}" alt="Photo de profil">`
    : "<!-- URL_DE_VOTRE_PHOTO_ICI -->";
  const photoStyle = d.photo ? "" : ' style="background:#eee;"';
  const contact = [d.location, d.email, d.phone, d.linkedin]
    .map((s) => t(s))
    .filter(Boolean)
    .map(esc)
    .join(" &middot; ");
  out.push(`
  <section class="resume-template-renderer-section personal-data">
    <h2 class="resume-template-renderer-section__title">Informations personnelles</h2>
    <div class="personal-data__photo"${photoStyle}>
      ${photoInner}
    </div>
    <div class="personal-data__title-row">
      <span class="personal-data__name">${esc(d.name)}</span>${
        t(d.title) ? `<span class="personal-data__desired-job-title">${esc(d.title)}</span>` : ""
      }
    </div>
    <div class="personal-data__contact-row">
      ${contact}
    </div></section>`);

  // À propos
  if (t(d.summary)) {
    out.push(`
  <section class="resume-template-renderer-section summary-objective">
    <h2 class="resume-template-renderer-section__title summary-objective__title">À propos</h2>
    <div class="summary-objective__content">
      ${esc(d.summary)}
    </div>
  </section>`);
  }

  // Expérience
  const exp = d.experience.filter((e) => e && (e.title || e.company || e.bullets.length));
  if (exp.length) {
    const items = exp
      .map((e) => {
        const bullets = e.bullets.filter((b) => t(b));
        const desc = bullets.length
          ? `
      <div class="entry-list__description">
        <ul>
${bullets.map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
      </div>`
          : "";
        const parts: string[] = [];
        if (t(e.company)) parts.push(`<span class="entry-list__subtitle">${esc(e.company)}</span>`);
        if (t(e.contract))
          parts.push(`<span class="entry-list__contract" style="color: #787673;">${esc(e.contract)}</span>`);
        if (t(e.location))
          parts.push(`<span class="entry-list__location" style="margin-left: 0;">${esc(e.location)}</span>`);
        const companyRow = parts.join(" &mdash; ");
        return `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(e.title)}</span>
      <span class="entry-list__date">${esc(e.date)}</span>
      <div class="entry-list__company-row">
        ${companyRow}
      </div>${desc}
    </div>`;
      })
      .join("\n");
    out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Expériences</h2>
${items}
  </section>`);
  }

  // Formation
  const edu = d.education.filter((e) => e && (e.title || e.school));
  if (edu.length) {
    const items = edu
      .map(
        (e) => `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(e.title)}</span>
      <span class="entry-list__date">${esc(e.date)}</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">${esc(e.school)}</span>${
          t(e.location) ? ` &mdash; <span class="entry-list__location">${esc(e.location)}</span>` : ""
        }
      </div>
    </div>`,
      )
      .join("\n");
    out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Formations</h2>
${items}
  </section>`);
  }

  // Compétences
  const skills = d.skills.filter((s) => t(s));
  if (skills.length) {
    const items = skills
      .map((s) => {
        let parts = s.split(" — ");
        if (parts.length === 1) parts = s.split(" - ");
        if (parts.length > 1) {
          return `      <li class="plain-list__item"><strong>${esc(parts[0].trim())}</strong> &mdash; ${esc(
            parts.slice(1).join(" — ").trim(),
          )}</li>`;
        }
        return `      <li class="plain-list__item">${esc(s)}</li>`;
      })
      .join("\n");
    out.push(`
  <section class="resume-template-renderer-section plain-list section-skills">
    <h2 class="resume-template-renderer-section__title">Compétences</h2>
    <ul class="plain-list__items">
${items}
    </ul>
  </section>`);
  }

  // Projets
  const projects = d.projects.filter((p) => p && (p.title || p.description));
  if (projects.length) {
    const items = projects
      .map((p) => {
        const descTxt = t(p.description);
        const desc = descTxt
          ? `
      <div class="entry-list__description">
        <p>${esc(descTxt)}</p>
      </div>`
          : "";
        return `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(p.title)}</span>
      <span class="entry-list__date">${esc(p.date)}</span>${desc}
    </div>`;
      })
      .join("\n");
    out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Projets</h2>
${items}
  </section>`);
  }

  // Certifications
  const certs = d.certifications.filter((s) => t(s));
  if (certs.length) {
    out.push(`
  <section class="resume-template-renderer-section plain-list section-certifications">
    <h2 class="resume-template-renderer-section__title">Certifications</h2>
    <ul class="plain-list__items">
${certs.map((s) => `      <li class="plain-list__item">${esc(s)}</li>`).join("\n")}
    </ul>
  </section>`);
  }

  // Bénévolat
  const volunteer = d.volunteer.filter((v) => v && (v.title || v.organization || v.bullets.length));
  if (volunteer.length) {
    const items = volunteer
      .map((v) => {
        const bullets = v.bullets.filter((b) => t(b));
        const desc = bullets.length
          ? `
      <div class="entry-list__description">
        <ul>
${bullets.map((b) => `          <li>${esc(b)}</li>`).join("\n")}
        </ul>
      </div>`
          : "";
        const orgRow = t(v.organization)
          ? `        <span class="entry-list__subtitle">${esc(v.organization)}</span>${
              t(v.location) ? ` &mdash; <span class="entry-list__location">${esc(v.location)}</span>` : ""
            }`
          : "";
        return `    <div class="entry-list__item">
      <span class="entry-list__title">${esc(v.title)}</span>
      <span class="entry-list__date">${esc(v.date)}</span>
      <div class="entry-list__company-row">
${orgRow}
      </div>${desc}
    </div>`;
      })
      .join("\n");
    out.push(`
  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Bénévolat</h2>
${items}
  </section>`);
  }

  // Langues
  const langs = d.languages.filter((l) => l && t(l.name));
  if (langs.length) {
    out.push(`
  <section class="resume-template-renderer-section languages section-languages">
    <h2 class="resume-template-renderer-section__title">Langues</h2>
    <ul class="languages__items">
${langs
  .map(
    (l) => `      <li class="languages__item">
        <span class="languages__name">${esc(l.name)}</span>${
          t(l.level) ? `<span class="languages__description">${esc(l.level)}</span>` : ""
        }
      </li>`,
  )
  .join("\n")}
    </ul>
  </section>`);
  }

  // Centres d'intérêt
  const interests = d.interests.filter((s) => t(s));
  if (interests.length) {
    out.push(`
  <section class="resume-template-renderer-section plain-list section-interests">
    <h2 class="resume-template-renderer-section__title">Centres d'intérêt</h2>
    <ul class="plain-list__items">
${interests.map((s) => `      <li class="plain-list__item">${esc(s)}</li>`).join("\n")}
    </ul>
  </section>`);
  }

  out.push("\n</div>");
  return out.join("\n");
}

export function renderLetter(d: Letter): string {
  const paragraphs = d.body
    .split("\n")
    .filter((p) => p.trim() !== "")
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n  ");
  const signoffParagraphs = d.signoff
    .split("\n")
    .filter((p) => p.trim() !== "")
    .map((p) => `<p>${esc(p)}</p>`)
    .join("\n  ");

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
