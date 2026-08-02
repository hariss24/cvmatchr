// Reconnaissance générique de champ de formulaire de candidature.
// Ordre de préférence : identifiant documenté (Greenhouse) > autocomplete
// standard > texte de label/placeholder. Voir spec §5.2 — aucun sélecteur figé
// par ATS au-delà des noms publiquement documentés par Greenhouse.
// Mesuré le 02/08/2026 sur une offre Greenhouse réelle (voir WORK_HISTORY.md) :
// les identifiants documentés par l'API (first_name, last_name, email, phone,
// resume, cover_letter) sont exposés en tant qu'attribut `id`, pas `name`, sur
// le DOM rendu — les deux attributs sont donc vérifiés.
// Mesuré le 02/08/2026 sur une offre Lever réelle : pas de champ prénom/nom
// séparé, un seul champ « Full name » (attribut standard `name="name"` /
// `autocomplete="name"`, jamais un sélecteur propre à Lever) — d'où l'entrée
// fullName, remplie séparément de firstName/lastName (content-autofill.js).
const FIELD_HINTS = {
  firstName: { names: ["first_name"], autocomplete: ["given-name"], words: ["first name", "prénom", "prenom"] },
  lastName: { names: ["last_name"], autocomplete: ["family-name"], words: ["last name", "nom de famille", "nom"] },
  fullName: { names: ["name"], autocomplete: ["name"], words: ["full name", "nom complet", "nom et prénom"] },
  email: { names: ["email"], autocomplete: ["email"], words: ["email", "e-mail", "courriel"] },
  phone: { names: ["phone"], autocomplete: ["tel"], words: ["phone", "téléphone", "telephone", "mobile"] },
  linkedin: { names: ["linkedin"], autocomplete: [], words: ["linkedin"] },
  location: { names: [], autocomplete: ["address-level2"], words: ["location", "ville", "city"] },
};

function isVisible(el) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function labelTextFor(el) {
  if (el.id) {
    const byFor = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (byFor) return byFor.textContent || "";
  }
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.textContent || "";
  return "";
}

function candidateFields() {
  return Array.from(document.querySelectorAll("input, textarea")).filter(
    (el) => isVisible(el) && !el.disabled && el.type !== "hidden" && el.type !== "file",
  );
}

function findField(key) {
  const hint = FIELD_HINTS[key];
  if (!hint) return null;

  for (const name of hint.names) {
    const el = document.querySelector(`[name="${CSS.escape(name)}"], #${CSS.escape(name)}`);
    if (el && isVisible(el)) return el;
  }
  for (const value of hint.autocomplete) {
    const el = document.querySelector(`[autocomplete="${CSS.escape(value)}"]`);
    if (el && isVisible(el)) return el;
  }
  const words = hint.words;
  for (const el of candidateFields()) {
    const label = (labelTextFor(el) || el.getAttribute("placeholder") || "").toLowerCase();
    if (words.some((w) => label.includes(w))) return el;
  }
  return null;
}

function findFileField(kind) {
  // kind: "resume" | "coverLetter"
  const id = kind === "resume" ? "resume" : "cover_letter";
  const byId = document.querySelector(`input[type="file"][name="${id}"], input[type="file"]#${CSS.escape(id)}`);
  if (byId) return byId;

  const files = Array.from(document.querySelectorAll('input[type="file"]')).filter(isVisible);
  if (files.length === 1) return kind === "resume" ? files[0] : null;

  const words = kind === "resume" ? ["resume", "cv", "cv/résumé"] : ["cover letter", "lettre de motivation"];
  for (const el of files) {
    const label = (labelTextFor(el) || el.getAttribute("aria-label") || "").toLowerCase();
    if (words.some((w) => label.includes(w))) return el;
  }
  return null;
}

function setNativeValue(el, value) {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function base64ToFile(base64, filename, mimeType) {
  const byteChars = atob(base64);
  const bytes = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
  return new File([bytes], filename, { type: mimeType });
}

function setFileInput(el, file) {
  const dt = new DataTransfer();
  dt.items.add(file);
  el.files = dt.files;
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

window.CVMatchrFieldMatch = { findField, findFileField, setNativeValue, base64ToFile, setFileInput };
