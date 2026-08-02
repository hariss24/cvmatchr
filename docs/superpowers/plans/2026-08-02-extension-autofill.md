# Extension navigateur — autofill de candidature — Plan d'implémentation

> **Pour les agents d'exécution :** ce plan se lit avec `web/CADRAGE_EXECUTION.md`
> (le contrat, qui prime en cas de conflit), `.agents/rules/cadrage.md` et
> `docs/superpowers/specs/2026-08-02-extension-autofill-design.md` (la spec, qui
> justifie chaque choix — notamment pourquoi ce chantier ne couvre QUE l'autofill,
> pas la capture d'offre, et pourquoi Lever utilise une reconnaissance générique
> plutôt que des sélecteurs figés, faute de preuve publique sur son DOM réel).
> Les étapes utilisent des cases à cocher (`- [ ]`) pour le suivi.

**But :** ajouter une extension de navigateur (Manifest V3, JavaScript vanilla,
zéro dépendance npm) qui reçoit — via un pont `postMessage` ↔ `chrome.storage.local`
— un paquet {identité, texte de lettre, CV en base64} préparé depuis `/pack`, et
le réinjecte dans les formulaires de candidature Greenhouse et Lever, sans jamais
soumettre le formulaire à la place du candidat.

**Architecture :** nouveau répertoire `extension/` à la racine du dépôt (sibling de
`web/` et `scraper-service/`), et deux nouveaux fichiers + un composant dans
`web/src/` (`lib/extension/autofillPackage.ts`, `lib/extension/bridge.ts`,
`components/pack/ExtensionExportButton.tsx`, monté dans `PackView.tsx`).

**Stack :** TypeScript strict côté `web/` (rien de nouveau), JavaScript vanilla
côté `extension/` (aucun TypeScript, aucun bundler — le navigateur charge les
fichiers tels quels). Aucune dépendance npm ajoutée ou modifiée.

## Contraintes globales

Ces règles s'appliquent à **toutes** les tâches, sans être répétées à chaque fois.

- **Aucune dépendance npm ajoutée ou mise à jour**, ni dans `web/package.json` ni
  ailleurs. `extension/` n'a pas de `package.json`.
- **Pas de `any`, pas de `@ts-ignore`, pas de `eslint-disable` ajouté** dans
  `web/src/`. TypeScript strict doit compiler.
- **Jamais `alert`/`confirm`/`prompt` natifs** dans `web/src/` → `toast` de
  `@/state/uiStore` (aucun `uiConfirm` nécessaire ici, pas d'action destructive).
- **Jamais de couleur en dur** dans le CSS ajouté à `web/src/app/globals.css` →
  variables de thème (`var(--bg)`, `var(--text)`, etc.). Le CSS injecté par
  `extension/content-autofill.js` (bouton flottant sur une page tierce) est hors
  de cette règle : il vit dans une page qui n'a pas les variables CSS de CVMatchr,
  et doit rester visible sur un fond inconnu — couleurs fixes assumées, contraste
  vérifié manuellement (voir Task 3).
- **PUSH STRICTEMENT INTERDIT sur `main`.** Travaille sur une branche `claude/…`.
  Commit local par tâche.
- **Vérification après CHAQUE tâche qui touche `web/src/`**, depuis `web/`, dans
  cet ordre, sortie collée dans le rapport :
  ```
  npx tsc --noEmit
  npm run lint
  npx vitest run
  ```
  Les tâches qui ne touchent que `extension/` n'ont pas de vérification
  automatisée (§7 de la spec) — voir le protocole manuel propre à chaque tâche.
- **Une vérification rouge = tâche NON LIVRÉE.** On corrige avant de continuer.
- **Journal obligatoire** après chaque tâche : entrée datée en tête de la section
  `## Journal` de `WORK_HISTORY.md` (racine) + mise à jour de la ligne
  « Prochaine étape suggérée ».

---

## Vue d'ensemble des fichiers

| Fichier | Sort |
|---|---|
| `extension/manifest.json` | **Créé** |
| `extension/README.md` | **Créé** — chargement en mode développeur |
| `extension/lib/fieldMatch.js` | **Créé** — reconnaissance générique de champ |
| `extension/content-bridge.js` | **Créé** — pont CVMatchr → `chrome.storage.local` |
| `extension/content-autofill.js` | **Créé** — bouton flottant + remplissage |
| `extension/popup.html` | **Créé** |
| `extension/popup.js` | **Créé** |
| `web/src/lib/extension/autofillPackage.ts` | **Créé** — construction pure du paquet |
| `web/src/lib/extension/autofillPackage.test.ts` | **Créé** |
| `web/src/lib/extension/bridge.ts` | **Créé** — émission `postMessage` + attente d'accusé |
| `web/src/components/pack/ExtensionExportButton.tsx` | **Créé** |
| `web/src/components/pack/PackView.tsx` | Modifié — monte `ExtensionExportButton` |
| `PROJECT_INDEX.md` | Modifié — nouvelle section décrivant l'extension |

---

## Task 1 : `extension/` — manifeste, pont CVMatchr, popup (sans autofill)

**Files:**
- Create: `extension/manifest.json`
- Create: `extension/content-bridge.js`
- Create: `extension/popup.html`
- Create: `extension/popup.js`
- Create: `extension/README.md`

**Interfaces:**
- Produces (contrat lu par Task 3) : `chrome.storage.local` clé
  `"cvmatchrAutofillPackage"`, valeur = objet `AutofillPackage` (voir §6.3 de la
  spec, repris en Task 2).

**Contexte.** Cette tâche pose le pont et le popup, testables indépendamment de
l'autofill lui-même : on doit pouvoir préparer un paquet (Task 2) et le voir
apparaître dans le popup de l'extension AVANT d'écrire la moindre logique de
remplissage sur Greenhouse/Lever (Task 3). Découpage volontaire pour vérifier
chaque bout séparément (spec §6.1, §6.3).

- [ ] **Step 1 : `extension/manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "CVMatchr — Autofill de candidature",
  "version": "0.1.0",
  "description": "Prépare un CV et une identité depuis CVMatchr, puis remplit les formulaires de candidature Greenhouse et Lever.",
  "permissions": ["storage"],
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://cvmatchr.fr/*", "http://localhost:3000/*"],
      "js": ["content-bridge.js"],
      "run_at": "document_idle"
    },
    {
      "matches": [
        "https://*.greenhouse.io/*",
        "https://job-boards.greenhouse.io/*",
        "https://jobs.lever.co/*"
      ],
      "js": ["lib/fieldMatch.js", "content-autofill.js"],
      "run_at": "document_idle"
    }
  ]
}
```

Note : `lib/fieldMatch.js` est déclaré ici mais créé en Task 3 — à cette étape,
créer un fichier vide `extension/lib/fieldMatch.js` (juste un commentaire, ex.
`// rempli en Task 3`) pour que le manifeste soit valide dès cette tâche. Il sera
réécrit intégralement en Task 3, ce n'est pas un problème de le committer vide ici.

- [ ] **Step 2 : `extension/content-bridge.js`**

```js
// Pont entre la page CVMatchr (window.postMessage) et chrome.storage.local.
// Injecté uniquement sur cvmatchr.fr et localhost:3000 (voir manifest.json).
(function () {
  const STORAGE_KEY = "cvmatchrAutofillPackage";
  const MESSAGE_TYPE = "cvmatchr:autofill-package";
  const ACK_TYPE = "cvmatchr:autofill-package-ack";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== "cvmatchr-app" || data.type !== MESSAGE_TYPE) return;

    chrome.storage.local.set({ [STORAGE_KEY]: data.payload }, () => {
      window.postMessage({ source: "cvmatchr-extension", type: ACK_TYPE }, window.location.origin);
    });
  });
})();
```

- [ ] **Step 3 : `extension/popup.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>CVMatchr — Autofill</title>
  <style>
    body { font-family: system-ui, sans-serif; width: 260px; padding: 12px; color: #1a1a1a; }
    h1 { font-size: 14px; margin: 0 0 8px; }
    p { font-size: 13px; margin: 4px 0; }
    button { margin-top: 8px; font-size: 13px; padding: 6px 10px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>CVMatchr — Autofill</h1>
  <div id="status">Chargement…</div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 4 : `extension/popup.js`**

```js
const STORAGE_KEY = "cvmatchrAutofillPackage";

function render(pkg) {
  const el = document.getElementById("status");
  if (!pkg) {
    el.innerHTML = "<p>Aucune candidature préparée.</p><p>Va sur /pack dans CVMatchr et clique sur « Préparer pour l'extension ».</p>";
    return;
  }
  el.innerHTML = `
    <p>Candidature préparée :</p>
    <p><strong>${pkg.role || "(poste non renseigné)"}</strong> chez <strong>${pkg.company || "(entreprise non renseignée)"}</strong></p>
    <button id="clear">Vider</button>
  `;
  document.getElementById("clear").addEventListener("click", () => {
    chrome.storage.local.remove(STORAGE_KEY, () => render(null));
  });
}

chrome.storage.local.get(STORAGE_KEY, (result) => render(result[STORAGE_KEY] || null));
```

- [ ] **Step 5 : `extension/README.md`**

```md
# Extension CVMatchr — autofill de candidature

Extension de navigateur (Manifest V3, Chrome/Edge/Brave) qui remplit les
formulaires de candidature Greenhouse et Lever avec un CV et une identité
préparés depuis CVMatchr (`/pack`).

## Charger en mode développeur

1. `chrome://extensions`
2. Activer « Mode développeur » (en haut à droite)
3. « Charger l'extension non empaquetée » → sélectionner ce dossier (`extension/`)

## Utilisation

1. Dans CVMatchr, page `/pack`, clique sur « Préparer pour l'extension ».
2. Ouvre une offre Greenhouse ou Lever.
3. Clique sur le bouton flottant « Remplir avec CVMatchr » en bas à droite de la
   page.
4. Relis le formulaire avant d'envoyer — l'extension ne soumet jamais à ta place.

Conception détaillée :
`docs/superpowers/specs/2026-08-02-extension-autofill-design.md`.
```

- [ ] **Step 6 : Vérification manuelle**

```
1. chrome://extensions → mode développeur → charger extension/ non empaquetée.
   Attendu : aucune erreur de chargement (manifeste valide).
2. Cliquer sur l'icône de l'extension → popup affiche « Aucune candidature préparée. »
```

- [ ] **Step 7 : Commit**

```bash
git add extension/
git commit -m "feat(extension): scaffold manifeste V3, pont CVMatchr et popup

Première tranche du chantier autofill (spec 2026-08-02) : manifeste Manifest V3,
zéro dépendance npm, content-bridge.js qui écrit dans chrome.storage.local ce
que la page CVMatchr lui envoie par postMessage, et un popup qui affiche l'état
du paquet préparé. L'autofill lui-même (Greenhouse/Lever) arrive en Task 3, une
fois le côté CVMatchr (Task 2) capable de préparer un vrai paquet à envoyer."
```

---

## Task 2 : `web/src/` — construction du paquet, pont sortant, bouton

**Files:**
- Create: `web/src/lib/extension/autofillPackage.ts`
- Create: `web/src/lib/extension/autofillPackage.test.ts`
- Create: `web/src/lib/extension/bridge.ts`
- Create: `web/src/components/pack/ExtensionExportButton.tsx`
- Modify: `web/src/components/pack/PackView.tsx`

**Interfaces:**
- Produces:
  ```ts
  // web/src/lib/extension/autofillPackage.ts
  export interface AutofillPackage {
    createdAt: number;
    company: string;
    role: string;
    identity: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      location: string;
      linkedin: string;
    };
    coverLetterText: string;
    resume: {
      filename: string;
      mimeType: "application/pdf";
      base64: string;
    };
  }
  export function buildAutofillPackage(args: {
    identity: { prenom: string; nom: string; cv: Resume };
    company: string;
    role: string;
    coverLetterText: string;
    resumeFilename: string;
    resumeBase64: string;
    now: number;
  }): AutofillPackage;

  // web/src/lib/extension/bridge.ts
  export function postAutofillPackage(pkg: AutofillPackage, timeoutMs?: number): Promise<boolean>;
  ```

**Contexte.** `PackView.tsx` a déjà tout ce qu'il faut en mémoire : `identity`
(via `resolveLetterIdentity(cvRaw, profile)`, ligne 64), `letter.body` (le texte de
la lettre déjà construite), `company`/`role` (état local), et `cvRaw`/`templateId`
pour générer le PDF (`generateResumePdfBlob`, déjà utilisé ailleurs dans l'app —
`src/lib/pdfgen/generatePdf.tsx`). Aucune nouvelle donnée à collecter, aucune
modification à `docStore.ts`.

- [ ] **Step 1 : `web/src/lib/extension/autofillPackage.ts`**

```ts
import type { Resume } from "@/lib/resume/schema";

export interface AutofillPackage {
  createdAt: number;
  company: string;
  role: string;
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    location: string;
    linkedin: string;
  };
  coverLetterText: string;
  resume: {
    filename: string;
    mimeType: "application/pdf";
    base64: string;
  };
}

export function buildAutofillPackage(args: {
  identity: { prenom: string; nom: string; cv: Resume };
  company: string;
  role: string;
  coverLetterText: string;
  resumeFilename: string;
  resumeBase64: string;
  now: number;
}): AutofillPackage {
  const { identity, company, role, coverLetterText, resumeFilename, resumeBase64, now } = args;
  return {
    createdAt: now,
    company: company.trim(),
    role: role.trim(),
    identity: {
      firstName: identity.prenom,
      lastName: identity.nom,
      email: identity.cv.email,
      phone: identity.cv.phone,
      location: identity.cv.location,
      linkedin: identity.cv.linkedin,
    },
    coverLetterText,
    resume: {
      filename: resumeFilename,
      mimeType: "application/pdf",
      base64: resumeBase64,
    },
  };
}
```

(`now` est un paramètre plutôt que `Date.now()` interne : rend la fonction pure et
testable sans horloge système — même choix que le reste du dépôt pour les modules
purs de `src/lib/applications/`.)

- [ ] **Step 2 : `web/src/lib/extension/autofillPackage.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildAutofillPackage } from "./autofillPackage";
import { DEFAULT_RESUME } from "@/lib/resume/defaults";

describe("buildAutofillPackage", () => {
  it("mappe l'identité résolue (prénom/nom + champs du CV fusionné)", () => {
    const pkg = buildAutofillPackage({
      identity: {
        prenom: "Hariss",
        nom: "Hafeji",
        cv: { ...DEFAULT_RESUME, email: "h@example.com", phone: "0600000000", location: "Paris", linkedin: "linkedin.com/in/hariss" },
      },
      company: "  SharkNinja  ",
      role: "  Chef de projet  ",
      coverLetterText: "Corps de la lettre.",
      resumeFilename: "CV_Chef_de_projet.pdf",
      resumeBase64: "QkFTRTY0",
      now: 1735689600000,
    });

    expect(pkg).toEqual({
      createdAt: 1735689600000,
      company: "SharkNinja",
      role: "Chef de projet",
      identity: {
        firstName: "Hariss",
        lastName: "Hafeji",
        email: "h@example.com",
        phone: "0600000000",
        location: "Paris",
        linkedin: "linkedin.com/in/hariss",
      },
      coverLetterText: "Corps de la lettre.",
      resume: {
        filename: "CV_Chef_de_projet.pdf",
        mimeType: "application/pdf",
        base64: "QkFTRTY0",
      },
    });
  });

  it("découpe company/role (trim) sans toucher aux autres champs", () => {
    const pkg = buildAutofillPackage({
      identity: { prenom: "", nom: "", cv: DEFAULT_RESUME },
      company: "",
      role: "",
      coverLetterText: "",
      resumeFilename: "CV.pdf",
      resumeBase64: "",
      now: 0,
    });
    expect(pkg.company).toBe("");
    expect(pkg.role).toBe("");
    expect(pkg.identity.firstName).toBe("");
  });
});
```

- [ ] **Step 3 : `web/src/lib/extension/bridge.ts`**

```ts
"use client";

import type { AutofillPackage } from "./autofillPackage";

const MESSAGE_TYPE = "cvmatchr:autofill-package";
const ACK_TYPE = "cvmatchr:autofill-package-ack";

/**
 * Envoie le paquet à l'extension (si installée) via postMessage, et attend son
 * accusé de réception écrit par `content-bridge.js`. `false` si aucune extension
 * ne répond dans le délai (`timeoutMs`) — l'appelant en déduit qu'elle n'est pas
 * installée sur cette origine.
 */
export function postAutofillPackage(pkg: AutofillPackage, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "cvmatchr-extension" || event.data?.type !== ACK_TYPE) return;
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(true);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "cvmatchr-app", type: MESSAGE_TYPE, payload: pkg }, window.location.origin);

    setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(false);
    }, timeoutMs);
  });
}
```

- [ ] **Step 4 : Conversion Blob → base64 (glue, non testée séparément — cf. spec §7)**

Dans `web/src/components/pack/ExtensionExportButton.tsx` (nouveau fichier) :

```tsx
"use client";

import { useState } from "react";
import { useDocStore } from "@/state/docStore";
import { generateResumePdfBlob } from "@/lib/pdfgen/generatePdf";
import { buildPdfFilename } from "@/lib/pdfgen/filename";
import { buildAutofillPackage } from "@/lib/extension/autofillPackage";
import { postAutofillPackage } from "@/lib/extension/bridge";
import { toast } from "@/state/uiStore";
import type { LetterIdentity } from "@/lib/profile/profile";

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export default function ExtensionExportButton({
  identity,
  company,
  role,
  coverLetterText,
}: {
  identity: LetterIdentity;
  company: string;
  role: string;
  coverLetterText: string;
}) {
  const [busy, setBusy] = useState(false);
  const templateId = useDocStore((s) => s.templateId);

  const onClick = async () => {
    setBusy(true);
    try {
      const blob = await generateResumePdfBlob(identity.cv, templateId);
      const base64 = await blobToBase64(blob);
      const filename = `${buildPdfFilename("CV", role, false)}.pdf`;
      const pkg = buildAutofillPackage({
        identity,
        company,
        role,
        coverLetterText,
        resumeFilename: filename,
        resumeBase64: base64,
        now: Date.now(),
      });
      const ok = await postAutofillPackage(pkg);
      toast(
        ok
          ? "Préparé pour l'extension — ouvre une offre Greenhouse ou Lever."
          : "Extension CVMatchr non détectée (voir extension/README.md).",
        ok ? "success" : "error",
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Échec de la préparation.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" className="form-btn-mini" onClick={onClick} disabled={busy}>
      {busy ? "Préparation…" : "Préparer pour l'extension"}
    </button>
  );
}
```

- [ ] **Step 5 : Monter le bouton dans `PackView.tsx`**

Dans `web/src/components/pack/PackView.tsx`, ajouter l'import :

```tsx
import ExtensionExportButton from "./ExtensionExportButton";
```

Et, dans le bloc `.pack-actions` (juste après le bouton « Créer ma lettre… »,
avant sa balise fermante `</div>`) :

```tsx
{isCv && identity ? (
  <ExtensionExportButton
    identity={identity}
    company={company}
    role={role}
    coverLetterText={letter?.body ?? ""}
  />
) : null}
```

- [ ] **Step 6 : Vérification**

```bash
cd web && npx tsc --noEmit && npm run lint && npx vitest run
```

Attendu : tout vert, tests existants inchangés + les nouveaux tests de
`autofillPackage.test.ts`.

- [ ] **Step 7 : Commit**

```bash
git add web/src/lib/extension web/src/components/pack/ExtensionExportButton.tsx web/src/components/pack/PackView.tsx
git commit -m "feat(pack): bouton « Préparer pour l'extension » (paquet autofill)

Ajoute la construction (buildAutofillPackage, pur, testé) et l'envoi
(postAutofillPackage, postMessage + accusé de réception) du paquet
{identité, lettre, CV en base64} consommé par l'extension CVMatchr
(extension/, Task 1). Aucune nouvelle donnée : identity/company/role/lettre
sont déjà en mémoire dans PackView. Sans l'extension installée, un toast
explicite le dit au lieu d'un succès silencieux trompeur."
```

---

## Task 3 : `extension/` — reconnaissance générique de champ + remplissage

**Files:**
- Modify: `extension/lib/fieldMatch.js` (remplace le stub de Task 1)
- Create: `extension/content-autofill.js`

**Interfaces:** aucune nouvelle interface côté `web/src/` — cette tâche ne
consomme que `chrome.storage.local["cvmatchrAutofillPackage"]` déjà écrit par
`content-bridge.js` (Task 1) avec la forme produite par Task 2.

**Contexte.** C'est le cœur du chantier (spec §5.2) : reconnaître les champs
Prénom/Nom/Email/Téléphone/LinkedIn/CV sur une page qu'on ne contrôle pas, sans
sélecteurs figés par ATS — seuls les noms `first_name`/`last_name`/`email`/
`phone`/`resume`/`cover_letter` sont documentés (Greenhouse, spec §3) ; le reste
(Lever, champs optionnels Greenhouse) passe par `autocomplete` puis le texte du
`<label>`/`placeholder`.

- [ ] **Step 1 : `extension/lib/fieldMatch.js`**

```js
// Reconnaissance générique de champ de formulaire de candidature.
// Ordre de préférence : nom d'attribut documenté (Greenhouse) > autocomplete
// standard > texte de label/placeholder. Voir spec §5.2 — aucun sélecteur figé
// par ATS au-delà des noms publiquement documentés par Greenhouse.
const FIELD_HINTS = {
  firstName: { names: ["first_name"], autocomplete: ["given-name"], words: ["first name", "prénom", "prenom"] },
  lastName: { names: ["last_name"], autocomplete: ["family-name"], words: ["last name", "nom de famille", "nom"] },
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
    const el = document.querySelector(`[name="${CSS.escape(name)}"]`);
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
  const byName = document.querySelector(`input[type="file"][name="${kind === "resume" ? "resume" : "cover_letter"}"]`);
  if (byName) return byName;

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
```

- [ ] **Step 2 : `extension/content-autofill.js`**

```js
// Bouton flottant + remplissage sur Greenhouse/Lever. Injecté après lib/fieldMatch.js
// (voir manifest.json — l'ordre des scripts dans "js" les charge dans cet ordre,
// donc window.CVMatchrFieldMatch existe déjà ici).
(function () {
  const STORAGE_KEY = "cvmatchrAutofillPackage";

  function injectButton(pkg) {
    if (document.getElementById("cvmatchr-autofill-btn")) return;
    const btn = document.createElement("button");
    btn.id = "cvmatchr-autofill-btn";
    btn.textContent = `Remplir avec CVMatchr (${pkg.role || "poste"} · ${pkg.company || "entreprise"})`;
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: "2147483647",
      background: "#1a73e8",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      padding: "10px 14px",
      fontSize: "13px",
      fontFamily: "system-ui, sans-serif",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    });
    btn.addEventListener("click", () => fillForm(pkg, btn));
    document.body.appendChild(btn);
  }

  function fillForm(pkg, btn) {
    const { findField, findFileField, setNativeValue, base64ToFile, setFileInput } = window.CVMatchrFieldMatch;
    let filled = 0;
    let total = 0;

    const textFields = [
      ["firstName", pkg.identity.firstName],
      ["lastName", pkg.identity.lastName],
      ["email", pkg.identity.email],
      ["phone", pkg.identity.phone],
      ["linkedin", pkg.identity.linkedin],
      ["location", pkg.identity.location],
    ];
    for (const [key, value] of textFields) {
      if (!value) continue;
      total++;
      const el = findField(key);
      if (el) {
        setNativeValue(el, value);
        filled++;
      }
    }

    if (pkg.resume && pkg.resume.base64) {
      total++;
      const fileEl = findFileField("resume");
      if (fileEl) {
        const file = base64ToFile(pkg.resume.base64, pkg.resume.filename, pkg.resume.mimeType);
        setFileInput(fileEl, file);
        filled++;
      }
    }

    btn.textContent = `${filled}/${total} champs remplis — vérifie avant d'envoyer`;
  }

  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const pkg = result[STORAGE_KEY];
    if (pkg) injectButton(pkg);
  });
})();
```

- [ ] **Step 3 : Retirer le stub de Task 1**

Le fichier `extension/lib/fieldMatch.js` créé vide en Task 1 Step 1 est maintenant
remplacé par le contenu du Step 1 ci-dessus (même chemin, contenu réel).

- [ ] **Step 4 : Vérification manuelle (protocole, spec §7)**

```
1. chrome://extensions → recharger l'extension (icône ↻) après ces changements.
2. Dans CVMatchr (/pack), avec un CV chargé, cliquer sur « Préparer pour l'extension ».
   Attendu : toast « Préparé pour l'extension… ».
3. Ouvrir une vraie offre Greenhouse (ex. une offre publique sur job-boards.greenhouse.io).
   Attendu : bouton flottant en bas à droite « Remplir avec CVMatchr (...) ».
4. Cliquer dessus.
   Attendu : Prénom, Nom, Email, Téléphone, LinkedIn remplis quand le champ existe
   sur cette offre ; pièce jointe CV attachée si un champ de dépôt de fichier est
   détecté ; le bouton affiche « X/Y champs remplis » ; AUCUNE soumission du
   formulaire.
5. Répéter sur une vraie offre Lever (jobs.lever.co).
   Attendu : au moins Nom/Email remplis si le formulaire expose un `autocomplete`
   standard ou un `<label>` reconnaissable (spec §5.2) — un champ non reconnu
   reste vide, ce n'est pas un échec de cette tâche (dégradé assumé, spec §5.2/§10).
6. Consigner dans WORK_HISTORY.md le résultat exact observé sur les deux
   plateformes (quels champs remplis, lesquels non, sur quelle offre précise —
   URL + date), pour que la limite de couverture réelle soit mesurée, pas supposée.
```

- [ ] **Step 5 : Commit**

```bash
git add extension/lib/fieldMatch.js extension/content-autofill.js
git commit -m "feat(extension): remplissage Greenhouse/Lever par reconnaissance générique

fieldMatch.js reconnaît un champ par nom documenté (Greenhouse : first_name,
last_name, email, phone, resume, cover_letter — spec §3), sinon autocomplete
standard, sinon texte de label/placeholder — jamais de sélecteur figé par ATS,
faute de preuve publique sur le DOM réel de Lever (spec §5.2). content-autofill.js
affiche un bouton flottant et remplit au clic, sans jamais soumettre le
formulaire. Couverture Lever mesurée en usage réel, consignée dans WORK_HISTORY.md."
```

---

## Task 4 : Documentation et clôture

**Files:**
- Modify: `PROJECT_INDEX.md`
- Modify: `WORK_HISTORY.md`

**But :** rendre l'existence de `extension/` découvrable par la prochaine lecture
de `PROJECT_INDEX.md` (§2, structure du dépôt) — sans quoi un futur agent
redécouvre à l'aveugle ce qui vient d'être construit, exactement ce que
`PROJECT_INDEX.md` dit vouloir éviter en tête de fichier.

- [ ] **Step 1 : `PROJECT_INDEX.md` — structure du dépôt (§2)**

Ajouter une ligne dans le bloc de structure (après `scraper-service/` si listé, ou
à la suite de `web/`) :

```
├── extension/            # Extension navigateur (Manifest V3) : autofill de candidature
│                          # Greenhouse/Lever depuis un paquet préparé dans /pack
```

- [ ] **Step 2 : `PROJECT_INDEX.md` — nouvelle section courte**

Ajouter, après la section « 8 bis. Fonctionnalité « Mes candidatures » » (avant la
section 9 Authentification) :

```md
## 8 ter. Extension navigateur (autofill de candidature)

`extension/` (Manifest V3, JavaScript vanilla, zéro dépendance npm, chargée en
mode développeur — pas de publication Chrome Web Store à ce stade). Depuis
`/pack`, « Préparer pour l'extension » envoie {identité, texte de lettre, CV en
base64} par `postMessage` ; l'extension l'écrit dans `chrome.storage.local` et
propose un bouton flottant sur les pages Greenhouse/Lever pour remplir le
formulaire — jamais de soumission automatique.

Reconnaissance de champ générique (nom documenté → `autocomplete` → texte de
label), pas de sélecteurs figés par ATS : voir
`docs/superpowers/specs/2026-08-02-extension-autofill-design.md` §5.2 pour le
raisonnement (aucune preuve publique sur le DOM réel de Lever).

Hors périmètre à ce stade : capture d'offre par extension (l'extracteur URL
existant, §7, couvre l'essentiel), tout ATS autre que Greenhouse/Lever.
```

- [ ] **Step 3 : Commit**

```bash
git add PROJECT_INDEX.md WORK_HISTORY.md
git commit -m "docs: référencer l'extension autofill dans PROJECT_INDEX.md

Nouveau répertoire extension/ (Task 1-3) documenté dans la carte du dépôt, pour
qu'un futur agent ne le redécouvre pas à l'aveugle."
```

---

## Récapitulatif des critères de succès (spec §9)

- [ ] `npx tsc --noEmit` / `npm run lint` / `npx vitest run` verts (Task 2).
- [ ] Aucune dépendance npm ajoutée (`git diff web/package.json web/package-lock.json` vide).
- [ ] `extension/manifest.json` chargeable sans erreur (Task 1 Step 6).
- [ ] Remplissage vérifié sur une offre Greenhouse réelle (Task 3 Step 4).
- [ ] Remplissage vérifié (au moins Nom/Email) sur une offre Lever réelle (Task 3 Step 4).
- [ ] Jamais de soumission automatique constatée (Task 3 Step 4).
- [ ] Message clair si l'extension n'est pas installée (Task 2 Step 4, testé en
      désactivant temporairement l'extension avant de cliquer sur le bouton).
