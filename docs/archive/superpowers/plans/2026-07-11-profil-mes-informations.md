# Profil « Mes informations » Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une fiche « Mes informations » saisie une fois, stockée en local, qui pré-remplit les CV vierges et alimente l'en-tête + les pastilles Prénom/Nom des lettres, même sans CV chargé.

**Architecture:** Un objet `UserProfile` singleton en IndexedDB (Dexie, table `profile`). Deux helpers purs : `applyProfileToResume` (remplit les champs vides d'un CV vierge, sans écraser de saisie réelle) et `resolveLetterIdentity` (le profil est prioritaire sur le CV chargé, avec fallback). Une page `/profil` en autosave débouncée. Câblage aux 3 points qui créent un CV vierge + à `PackView` pour la lettre.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript strict, Dexie (IndexedDB), Zustand, Vitest, Playwright.

## Global Constraints

- Ne **jamais** `git push` (la branche `feature/refonte-ui-nextjs` déploie la prod Vercel). Commits locaux uniquement.
- TypeScript strict : pas de `any`, pas de `@ts-ignore`.
- Pas de `alert`/`confirm`/`prompt` natifs → `uiConfirm`/`toast` (déjà en place où utile ici).
- La photo (base64) n'est jamais envoyée à l'IA : hors périmètre ici (pas d'appel IA ajouté).
- Réutiliser les classes CSS existantes (`.wrap`, `.topbar--secondary`, `.hist-h1`, `.pane`, `.pack-page`, `.pack-vars`, `.pack-hint`, `.pack-advanced`, `.pack-advanced-toggle`, `.form-input`, `.form-btn-mini`, `.btn-nav`, `.ghost`, `.btn-label`) — **aucun CSS nouveau** requis.
- Vérification de référence (barre verte) : `cd web && npx tsc --noEmit` (0 erreur), `npx eslint <fichiers>` (0 erreur), `npx vitest run` (tout vert), `npm run build`, e2e concerné.
- Journaliser la tâche dans `WORK_HISTORY.md`.

---

### Task 1 : Modèle `UserProfile` + helpers purs (TDD)

**Files:**
- Create: `web/src/lib/profile/profile.ts`
- Test: `web/src/lib/profile/profile.test.ts`

**Interfaces:**
- Consumes: `Resume`, `DEFAULT_RESUME` depuis `@/lib/resume/schema`.
- Produces :
  - `interface UserProfile { id: "me"; prenom: string; nom: string; email: string; telephone: string; ville: string; adresse: string; codePostal: string; linkedin: string; updatedAt: number }`
  - `const EMPTY_PROFILE: UserProfile`
  - `interface LetterIdentity { cv: Resume; prenom: string; nom: string }`
  - `function applyProfileToResume(resume: Resume, profile: UserProfile | null): Resume`
  - `function resolveLetterIdentity(cv: Resume, profile: UserProfile | null): LetterIdentity`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `web/src/lib/profile/profile.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import { applyProfileToResume, resolveLetterIdentity, EMPTY_PROFILE } from "./profile";
import { DEFAULT_RESUME, type Resume } from "@/lib/resume/schema";

const profile = {
  ...EMPTY_PROFILE,
  prenom: "Jean",
  nom: "Dupont",
  email: "jean@ex.fr",
  telephone: "0600000000",
  ville: "Lyon",
  linkedin: "linkedin.com/in/jd",
};

describe("applyProfileToResume", () => {
  it("remplit les champs placeholder du CV par défaut", () => {
    const r = applyProfileToResume(structuredClone(DEFAULT_RESUME), profile);
    expect(r.name).toBe("Jean Dupont");
    expect(r.email).toBe("jean@ex.fr");
    expect(r.phone).toBe("0600000000");
    expect(r.location).toBe("Lyon");
    expect(r.linkedin).toBe("linkedin.com/in/jd");
  });

  it("n'écrase pas une saisie réelle mais complète les champs restés placeholder", () => {
    const real: Resume = { ...DEFAULT_RESUME, name: "Alice Réel", email: "alice@vrai.fr" };
    const r = applyProfileToResume(real, profile);
    expect(r.name).toBe("Alice Réel");
    expect(r.email).toBe("alice@vrai.fr");
    expect(r.location).toBe("Lyon"); // resté placeholder → rempli
  });

  it("retourne le CV inchangé si le profil est null", () => {
    const r = applyProfileToResume(structuredClone(DEFAULT_RESUME), null);
    expect(r.name).toBe(DEFAULT_RESUME.name);
  });
});

describe("resolveLetterIdentity", () => {
  it("le profil est prioritaire sur le CV chargé", () => {
    const cv: Resume = { ...DEFAULT_RESUME, name: "Alice Réel", email: "alice@vrai.fr", location: "Paris" };
    const id = resolveLetterIdentity(cv, profile);
    expect(id.prenom).toBe("Jean");
    expect(id.nom).toBe("Dupont");
    expect(id.cv.name).toBe("Jean Dupont");
    expect(id.cv.email).toBe("jean@ex.fr");
    expect(id.cv.location).toBe("Lyon");
  });

  it("fallback sur le CV (nom redécoupé) quand le profil est vide", () => {
    const cv: Resume = { ...DEFAULT_RESUME, name: "Alice Martin" };
    const id = resolveLetterIdentity(cv, null);
    expect(id.prenom).toBe("Alice");
    expect(id.nom).toBe("Martin");
    expect(id.cv).toBe(cv);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `cd web && npx vitest run src/lib/profile/profile.test.ts`
Expected: FAIL (`Failed to resolve import "./profile"` / helpers non définis).

- [ ] **Step 3 : Écrire l'implémentation minimale**

Créer `web/src/lib/profile/profile.ts` :

```ts
import { DEFAULT_RESUME, type Resume } from "@/lib/resume/schema";

/**
 * Profil « Mes informations » : identité de l'utilisateur, saisie une fois et
 * réutilisée pour pré-remplir les CV vierges et les lettres. Singleton local
 * (id = "me"), pensé pour adosser un compte plus tard.
 */
export interface UserProfile {
  id: "me";
  // Requis
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  ville: string;
  // Optionnels
  adresse: string;
  codePostal: string;
  linkedin: string;
  updatedAt: number;
}

export const EMPTY_PROFILE: UserProfile = {
  id: "me",
  prenom: "",
  nom: "",
  email: "",
  telephone: "",
  ville: "",
  adresse: "",
  codePostal: "",
  linkedin: "",
  updatedAt: 0,
};

/** Identité résolue pour construire une lettre (profil prioritaire, fallback CV). */
export interface LetterIdentity {
  cv: Resume;
  prenom: string;
  nom: string;
}

/** True si la valeur est vide ou encore égale au placeholder du CV par défaut. */
function isPlaceholder(value: string, def: string): boolean {
  return !value.trim() || value === def;
}

/**
 * Pré-remplit l'identité d'un CV vierge depuis le profil, SANS écraser une
 * saisie réelle : ne remplace qu'un champ vide ou resté au placeholder.
 */
export function applyProfileToResume(resume: Resume, profile: UserProfile | null): Resume {
  if (!profile) return resume;
  const name = `${profile.prenom} ${profile.nom}`.trim();
  return {
    ...resume,
    name: name && isPlaceholder(resume.name, DEFAULT_RESUME.name) ? name : resume.name,
    email: profile.email && isPlaceholder(resume.email, DEFAULT_RESUME.email) ? profile.email : resume.email,
    phone: profile.telephone && isPlaceholder(resume.phone, DEFAULT_RESUME.phone) ? profile.telephone : resume.phone,
    location: profile.ville && isPlaceholder(resume.location, DEFAULT_RESUME.location) ? profile.ville : resume.location,
    linkedin: profile.linkedin && isPlaceholder(resume.linkedin, DEFAULT_RESUME.linkedin) ? profile.linkedin : resume.linkedin,
  };
}

/**
 * Résout l'identité de l'en-tête de lettre : le profil est prioritaire (champ
 * par champ), sinon on retombe sur le CV chargé (nom redécoupé sur l'espace).
 */
export function resolveLetterIdentity(cv: Resume, profile: UserProfile | null): LetterIdentity {
  if (profile && (profile.prenom || profile.nom)) {
    const name = `${profile.prenom} ${profile.nom}`.trim();
    return {
      cv: {
        ...cv,
        name: name || cv.name,
        location: profile.ville || cv.location,
        email: profile.email || cv.email,
        phone: profile.telephone || cv.phone,
        linkedin: profile.linkedin || cv.linkedin,
      },
      prenom: profile.prenom,
      nom: profile.nom,
    };
  }
  const [prenom, ...rest] = (cv.name || "").trim().split(/\s+/);
  return { cv, prenom: prenom ?? "", nom: rest.join(" ") };
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run: `cd web && npx vitest run src/lib/profile/profile.test.ts`
Expected: PASS (6 tests verts).

- [ ] **Step 5 : Vérifier types + lint**

Run: `cd web && npx tsc --noEmit && npx eslint src/lib/profile/profile.ts src/lib/profile/profile.test.ts`
Expected: 0 erreur.

- [ ] **Step 6 : Commit**

```bash
git add web/src/lib/profile/profile.ts web/src/lib/profile/profile.test.ts
git commit -m "feat(profil): modele UserProfile + helpers applyProfileToResume/resolveLetterIdentity"
```

---

### Task 2 : Stockage Dexie du profil (table `profile`, v5)

**Files:**
- Modify: `web/src/lib/storage/db.ts`

**Interfaces:**
- Consumes: `UserProfile` depuis `@/lib/profile/profile` (Task 1).
- Produces :
  - `db.profile` (Dexie `Table<UserProfile, string>`, clé `id`)
  - `function loadProfile(): Promise<UserProfile | null>`
  - `function saveProfile(p: UserProfile): Promise<void>` (force `id: "me"` + `updatedAt`)

> Note : cette tâche est de la glu Dexie (pas de logique métier) — elle n'a pas de test unitaire dédié (le repo ne teste pas la couche Dexie ; `ensureDefaultTemplates` non plus). Vérification par `tsc` + `build`, et couverture réelle par l'e2e de la Task 6.

- [ ] **Step 1 : Importer le type et déclarer la table**

Dans `web/src/lib/storage/db.ts`, ajouter l'import en haut (après les imports existants) :

```ts
import type { UserProfile } from "@/lib/profile/profile";
```

Dans la classe `AppDatabase`, ajouter la propriété table (après la ligne `templates!: Table<MailTemplate, string>;`) :

```ts
  profile!: Table<UserProfile, string>; // Primary key: id (singleton "me")
```

- [ ] **Step 2 : Ajouter la migration v5**

Dans le constructeur d'`AppDatabase`, après le bloc `this.version(4).stores({ templates: "id, updatedAt" });`, ajouter :

```ts
    // v5 : profil « Mes informations » (singleton id="me"), réutilisé par CV & lettre.
    this.version(5).stores({
      profile: "id",
    });
```

- [ ] **Step 3 : Ajouter l'API du profil**

À la fin de `web/src/lib/storage/db.ts`, ajouter une section :

```ts
// ---------------------------------------------------------------------------
// PROFILE API (profil « Mes informations »)
// ---------------------------------------------------------------------------

export async function loadProfile(): Promise<UserProfile | null> {
  try {
    return (await db.profile.get("me")) ?? null;
  } catch (e) {
    console.warn("loadProfile error:", e);
    return null;
  }
}

export async function saveProfile(p: UserProfile): Promise<void> {
  try {
    await db.profile.put({ ...p, id: "me", updatedAt: Date.now() });
  } catch (e) {
    console.warn("saveProfile error:", e);
  }
}
```

- [ ] **Step 4 : Vérifier types + lint + build**

Run: `cd web && npx tsc --noEmit && npx eslint src/lib/storage/db.ts && npm run build`
Expected: 0 erreur, build OK.

- [ ] **Step 5 : Commit**

```bash
git add web/src/lib/storage/db.ts
git commit -m "feat(profil): table Dexie profile (v5) + loadProfile/saveProfile"
```

---

### Task 3 : Page `/profil` (ProfileView) + entrée dans la barre d'actions

**Files:**
- Create: `web/src/components/profile/ProfileView.tsx`
- Create: `web/src/app/profil/page.tsx`
- Modify: `web/src/components/layout/ActionsBar.tsx`

**Interfaces:**
- Consumes: `loadProfile`, `saveProfile` (Task 2) ; `EMPTY_PROFILE`, `UserProfile` (Task 1).
- Produces: route `/profil` ; bouton « Mes infos » dans `ActionsBar` naviguant vers `/profil`.

- [ ] **Step 1 : Créer le composant ProfileView**

Créer `web/src/components/profile/ProfileView.tsx` :

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadProfile, saveProfile } from "@/lib/storage/db";
import { EMPTY_PROFILE, type UserProfile } from "@/lib/profile/profile";

/**
 * Page « Mes informations » (/profil) : identité saisie une fois, autosave
 * local, réutilisée pour pré-remplir CV et lettres. Champs requis marqués `*`,
 * optionnels repliés.
 */
export default function ProfileView() {
  const router = useRouter();
  const [p, setP] = useState<UserProfile>(EMPTY_PROFILE);
  const [showMore, setShowMore] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const existing = await loadProfile();
      if (existing) setP(existing);
      setLoaded(true);
    })();
  }, []);

  // Autosave débouncé (800 ms) une fois le profil chargé — pas de bouton.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => void saveProfile(p), 800);
    return () => clearTimeout(t);
  }, [p, loaded]);

  const set = (patch: Partial<UserProfile>) => setP((prev) => ({ ...prev, ...patch }));

  return (
    <div className="wrap">
      <header className="topbar topbar--secondary">
        <h1 className="hist-h1">Mes informations</h1>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn-nav"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            Retour
          </button>
        </div>
      </header>

      <div className="pane pack-page" style={{ overflowY: "auto" }}>
        <p className="pack-hint">
          Ces informations pré-remplissent automatiquement tes CV et tes lettres de motivation.
        </p>

        <div className="pack-vars">
          <input className="form-input" placeholder="Prénom *" autoComplete="given-name"
            value={p.prenom} onChange={(e) => set({ prenom: e.target.value })} />
          <input className="form-input" placeholder="Nom *" autoComplete="family-name"
            value={p.nom} onChange={(e) => set({ nom: e.target.value })} />
          <input className="form-input" type="email" placeholder="Email *" autoComplete="email"
            value={p.email} onChange={(e) => set({ email: e.target.value })} />
          <input className="form-input" type="tel" placeholder="Téléphone *" autoComplete="tel"
            value={p.telephone} onChange={(e) => set({ telephone: e.target.value })} />
          <input className="form-input" placeholder="Ville *" autoComplete="address-level2"
            value={p.ville} onChange={(e) => set({ ville: e.target.value })} />
        </div>

        <button
          type="button"
          className="form-btn-mini pack-advanced-toggle"
          aria-expanded={showMore}
          onClick={() => setShowMore((v) => !v)}
        >
          {showMore ? "▾ Informations complémentaires" : "▸ Informations complémentaires"}
        </button>
        {showMore ? (
          <div className="pack-advanced">
            <input className="form-input" placeholder="Adresse (rue)" autoComplete="address-line1"
              value={p.adresse} onChange={(e) => set({ adresse: e.target.value })} />
            <input className="form-input" placeholder="Code postal" autoComplete="postal-code"
              value={p.codePostal} onChange={(e) => set({ codePostal: e.target.value })} />
            <input className="form-input" placeholder="LinkedIn" autoComplete="url"
              value={p.linkedin} onChange={(e) => set({ linkedin: e.target.value })} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Créer la route**

Créer `web/src/app/profil/page.tsx` :

```tsx
import ProfileView from "@/components/profile/ProfileView";

export const metadata = {
  title: "Mes informations — CV Tailor",
};

export default function ProfilPage() {
  return <ProfileView />;
}
```

- [ ] **Step 3 : Ajouter l'entrée « Mes infos » dans ActionsBar**

Dans `web/src/components/layout/ActionsBar.tsx` :

Ajouter l'import de `useRouter` (après la ligne `import { useState, useEffect } from "react";`) :

```tsx
import { useRouter } from "next/navigation";
```

Dans le composant, juste après `const [helpOpen, setHelpOpen] = useState(false);`, ajouter :

```tsx
  const router = useRouter();
```

Ajouter le bouton juste avant le bouton « Comment ça marche » (avant `<button ... className="actions-help" ...>`) :

```tsx
      <button
        type="button"
        className="ghost"
        aria-label="Mes informations"
        onClick={() => router.push("/profil")}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
        <span className="btn-label">Mes infos</span>
      </button>
```

- [ ] **Step 4 : Vérifier types + lint + build**

Run: `cd web && npx tsc --noEmit && npx eslint src/components/profile/ProfileView.tsx src/app/profil/page.tsx src/components/layout/ActionsBar.tsx && npm run build`
Expected: 0 erreur, build OK (route `/profil` listée).

- [ ] **Step 5 : Recette visuelle manuelle**

Lancer `cd web && npm run dev`, ouvrir `/profil` : titre « Mes informations », mention discrète, 5 champs requis, section « Informations complémentaires » repliable. Saisir des valeurs, recharger la page → les valeurs reviennent (autosave OK). Vérifier le bouton « Mes infos » dans la barre du bas.

- [ ] **Step 6 : Commit**

```bash
git add web/src/components/profile/ProfileView.tsx web/src/app/profil/page.tsx web/src/components/layout/ActionsBar.tsx
git commit -m "feat(profil): page /profil (autosave) + entree Mes infos dans la barre d'actions"
```

---

### Task 4 : Pré-remplir les CV vierges depuis le profil

**Files:**
- Modify: `web/src/components/layout/ActionsBar.tsx` (`onClear`)
- Modify: `web/src/components/layout/TopBar.tsx` (`onNewCv`)
- Modify: `web/src/lib/storage/useAutoDraft.ts` (`init`)

**Interfaces:**
- Consumes: `loadProfile` (Task 2), `applyProfileToResume` (Task 1), `Resume` (`@/lib/resume/schema`).
- Produces: aucun nouvel export ; les 3 chemins « CV vierge » appliquent le profil.

- [ ] **Step 1 : ActionsBar.onClear applique le profil (CV uniquement)**

Dans `web/src/components/layout/ActionsBar.tsx`, ajouter les imports :

```tsx
import { loadProfile } from "@/lib/storage/db";
import { applyProfileToResume } from "@/lib/profile/profile";
import type { Resume } from "@/lib/resume/schema";
```

Remplacer le corps de `onClear` :

```tsx
  const onClear = async () => {
    if (!(await uiConfirm("Effacer le document courant et repartir d'un modèle vierge ?", "Effacer"))) return;
    const base = defaultJsonFor(docType);
    if (docType === "Lettre") {
      setJson(base);
    } else {
      const profile = await loadProfile();
      setJson(applyProfileToResume(base as Resume, profile));
    }
    toast("Document effacé.", "success");
  };
```

- [ ] **Step 2 : TopBar.onNewCv applique le profil**

Dans `web/src/components/layout/TopBar.tsx`, ajouter les imports (avec les imports existants) :

```tsx
import { loadProfile } from "@/lib/storage/db";
import { applyProfileToResume } from "@/lib/profile/profile";
```

Remplacer le corps de `onNewCv` :

```tsx
  const onNewCv = async () => {
    if (!(await uiConfirm("Repartir d'un CV vierge ? Le contenu actuel sera remplacé.", "Nouveau CV"))) return;
    const profile = await loadProfile();
    setJson(applyProfileToResume(structuredClone(DEFAULT_RESUME), profile));
    toast("Nouveau CV.", "success");
  };
```

> `DEFAULT_RESUME` est déjà importé dans `TopBar.tsx` (utilisé par `onNewCv` actuel).

- [ ] **Step 3 : useAutoDraft applique le profil au 1er lancement sans brouillon**

Dans `web/src/lib/storage/useAutoDraft.ts`, ajouter les imports :

```ts
import { loadProfile } from "@/lib/storage/db";
import { applyProfileToResume } from "@/lib/profile/profile";
import type { Resume } from "@/lib/resume/schema";
```

Dans `init()`, remplacer le bloc `if (draft) { ... }` par une version avec `else` (premier lancement CV sans brouillon → profil) :

```ts
        const draft = await loadDraft(`draft-${docType}`);
        if (draft) {
          useDocStore.setState({
            html: draft.html,
            css: draft.css,
            ...(draft.json ? { json: draft.json } : {}),
            templateId: draft.templateId || "sobre",
            ...(draft.company !== undefined ? { company: draft.company } : {}),
            ...(draft.role !== undefined ? { role: draft.role } : {}),
            htmlSource: draft.htmlSource ?? !draft.json,
          });
        } else if (docType === "CV" || docType === "Maître") {
          const profile = await loadProfile();
          if (profile) {
            useDocStore.setState({
              json: applyProfileToResume(useDocStore.getState().json as Resume, profile),
            });
          }
        }
```

- [ ] **Step 4 : Vérifier types + lint + build**

Run: `cd web && npx tsc --noEmit && npx eslint src/components/layout/ActionsBar.tsx src/components/layout/TopBar.tsx src/lib/storage/useAutoDraft.ts && npm run build`
Expected: 0 erreur, build OK.

- [ ] **Step 5 : Recette manuelle**

Avec un profil rempli (`/profil`), cliquer « Nouveau CV » (TopBar) puis « Effacer » (barre du bas) : le formulaire CV doit afficher nom/email/téléphone/ville du profil (au lieu des placeholders). Modifier un champ CV, refaire « Effacer » → le champ réel n'est pas ré-écrasé tant qu'il diffère du placeholder.

- [ ] **Step 6 : Commit**

```bash
git add web/src/components/layout/ActionsBar.tsx web/src/components/layout/TopBar.tsx web/src/lib/storage/useAutoDraft.ts
git commit -m "feat(profil): pre-remplir les CV vierges depuis le profil (Effacer / Nouveau CV / 1er lancement)"
```

---

### Task 5 : La lettre utilise le profil (PackView)

**Files:**
- Modify: `web/src/components/pack/PackView.tsx`

**Interfaces:**
- Consumes: `resolveLetterIdentity` (Task 1), `loadProfile` (Task 2), `UserProfile` (Task 1).
- Produces: la lettre construite dans `PackView` utilise l'identité résolue (profil prioritaire). `buildLetterFromTemplate` garde sa signature `(tpl, vars, cv, today)` — on lui passe `identity.cv`.

- [ ] **Step 1 : Charger le profil dans PackView**

Dans `web/src/components/pack/PackView.tsx`, ajouter les imports :

```tsx
import { loadProfile } from "@/lib/storage/db";
import { resolveLetterIdentity, type UserProfile } from "@/lib/profile/profile";
```

Ajouter un état profil (à côté des autres `useState`) :

```tsx
  const [profile, setProfile] = useState<UserProfile | null>(null);
```

Charger le profil au montage (nouvel effet, à côté de celui qui charge le modèle) :

```tsx
  useEffect(() => {
    void loadProfile().then(setProfile);
  }, []);
```

- [ ] **Step 2 : Résoudre l'identité et l'utiliser pour les vars et la lettre**

Toujours dans `PackView.tsx`, remplacer le bloc `vars` + `letter` actuel :

```tsx
  const vars: TemplateVars = useMemo(() => {
    const name = (isCv ? cv.name : "").trim();
    const [prenom, ...rest] = name.split(/\s+/);
    return {
      Entreprise: company.trim(),
      Poste: role.trim(),
      "M/Mme Nom": contact.trim(),
      "Prénom": prenom ?? "",
      Nom: rest.join(" "),
      Date: today,
    };
  }, [company, role, contact, cv, isCv, today]);

  const letter = useMemo(
    () => (tpl && isCv ? buildLetterFromTemplate(tpl, vars, cv, today) : null),
    [tpl, vars, cv, isCv, today],
  );
```

par :

```tsx
  const identity = useMemo(
    () => (isCv ? resolveLetterIdentity(cv, profile) : null),
    [cv, isCv, profile],
  );

  const vars: TemplateVars = useMemo(() => {
    return {
      Entreprise: company.trim(),
      Poste: role.trim(),
      "M/Mme Nom": contact.trim(),
      "Prénom": identity?.prenom ?? "",
      Nom: identity?.nom ?? "",
      Date: today,
    };
  }, [company, role, contact, identity, today]);

  const letter = useMemo(
    () => (tpl && identity ? buildLetterFromTemplate(tpl, vars, identity.cv, today) : null),
    [tpl, vars, identity, today],
  );
```

> `identity` est `null` seulement si le document courant n'est pas un CV (`isCv` faux). Quand aucun vrai CV n'est chargé, `cv` vaut `DEFAULT_RESUME` (un `Resume`), donc `isCv` reste vrai et le profil prend la main sur l'en-tête.

- [ ] **Step 3 : Vérifier types + lint + build + tests unitaires**

Run: `cd web && npx tsc --noEmit && npx eslint src/components/pack/PackView.tsx && npx vitest run && npm run build`
Expected: 0 erreur, Vitest tout vert (le test existant `defaults.test.ts` de `buildLetterFromTemplate` reste valide — signature inchangée), build OK.

- [ ] **Step 4 : Commit**

```bash
git add web/src/components/pack/PackView.tsx
git commit -m "feat(profil): la lettre utilise l'identite du profil (prioritaire sur le CV)"
```

---

### Task 6 : Test e2e + journalisation

**Files:**
- Create: `web/tests/e2e/profil.spec.ts`
- Modify: `WORK_HISTORY.md`

**Interfaces:**
- Consumes: la route `/profil` (Task 3), le pré-remplissage lettre (Task 5), `window.useDocStore` (exposé par `docStore.ts`).
- Produces: garantie e2e que le profil alimente l'en-tête de lettre sans CV chargé.

- [ ] **Step 1 : Écrire le test e2e**

Créer `web/tests/e2e/profil.spec.ts` :

```ts
import { test, expect } from "@playwright/test";

test("le profil pré-remplit l'en-tête de la lettre sans CV chargé", async ({ page }) => {
  // 1. Remplir le profil.
  await page.goto("/profil");
  await page.getByPlaceholder("Prénom *").fill("Jean");
  await page.getByPlaceholder("Nom *").fill("Dupont");
  await page.getByPlaceholder("Email *").fill("jean@ex.fr");
  await page.getByPlaceholder("Téléphone *").fill("0600000000");
  await page.getByPlaceholder("Ville *").fill("Lyon");
  // Laisser l'autosave débouncé (800 ms) écrire dans IndexedDB.
  await page.waitForTimeout(1200);

  // 2. Aller créer une lettre (aucun vrai CV chargé : le CV reste le modèle par défaut).
  await page.goto("/pack");
  await page.getByPlaceholder("Entreprise").fill("ACME");
  await page.getByRole("button", { name: /Créer ma lettre/ }).click();

  // 3. La lettre chargée dans l'éditeur doit utiliser l'identité du profil.
  await page.waitForFunction(() => {
    const s = (window as unknown as { useDocStore?: { getState: () => { docType: string } } }).useDocStore;
    return s?.getState().docType === "Lettre";
  });
  const letter = await page.evaluate(() => {
    const s = (window as unknown as { useDocStore: { getState: () => { json: Record<string, string> } } }).useDocStore;
    return s.getState().json;
  });
  expect(letter.sender_name).toBe("Jean Dupont");
  expect(letter.sender_contact).toContain("jean@ex.fr");
  expect(letter.sender_contact).toContain("0600000000");
  expect(letter.date).toContain("Lyon");
  expect(letter.body).toContain("ACME");
});
```

- [ ] **Step 2 : Lancer le test e2e**

Run: `cd web && npx playwright test tests/e2e/profil.spec.ts`
Expected: PASS.

> Si le test échoue sur le remplissage du profil non persisté, augmenter la marge du `waitForTimeout` au-delà des 800 ms de débounce. Si `getByRole` ne trouve pas le bouton, vérifier le libellé exact « Créer ma lettre (ouvrir dans l'éditeur) » (le regex `/Créer ma lettre/` doit matcher).

- [ ] **Step 3 : Suite e2e complète (non-régression)**

Run: `cd web && npx playwright test`
Expected: tous les tests verts (les specs existantes, dont `pack.spec.ts`, ne doivent pas régresser).

- [ ] **Step 4 : Journaliser dans WORK_HISTORY.md**

Ajouter une entrée datée 2026-07-11 dans `WORK_HISTORY.md` (section Journal), résumant : profil « Mes informations » (B) — table Dexie v5, page `/profil` autosave, helpers `applyProfileToResume`/`resolveLetterIdentity`, câblage CV vierge (Effacer/Nouveau CV/1er lancement) + lettre (profil prioritaire, fallback CV). Mentionner le quick win A déjà livré (autofill navigateur, commit `d455335`) et que la spec est `docs/archive/superpowers/specs/2026-07-11-profil-mes-informations-design.md`.

- [ ] **Step 5 : Commit**

```bash
git add web/tests/e2e/profil.spec.ts WORK_HISTORY.md
git commit -m "test(profil): e2e profil -> en-tete lettre sans CV + journal WORK_HISTORY"
```

---

## Notes de périmètre (décisions verrouillées)

- **Adresse/Code postal optionnels** : stockés et éditables dans `/profil`, mais **non injectés** dans l'en-tête de lettre à cette itération. Raison : `buildLetterFromTemplate` dérive la ville de la date depuis `location.split(",")[0]` ; injecter une adresse complète dans `location` casserait la ligne de date. Un bloc expéditeur formel (adresse + CP + ville, avec ville de date séparée) fera l'objet d'une itération dédiée si besoin — YAGNI pour l'instant.
- **Pas de validation dure** des champs requis : marqués `*`, mais aucun blocage. Le fallback lettre (profil → CV → placeholder) couvre l'absence.
- **Pas de compte/synchro** : la table `profile` est structurée pour en accueillir un plus tard.
