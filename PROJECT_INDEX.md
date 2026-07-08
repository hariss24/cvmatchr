# 🗺️ PROJECT_INDEX.md — CV Tailor

Carte du dépôt. À lire avant toute modification pour ne pas redécouvrir à l'aveugle
ce qui existe déjà. Pour les règles de comportement (Karpathy, vérifications,
interdictions), voir `CLAUDE.md` (racine) et `web/CLAUDE.md`.

---

## 1. Vue d'ensemble

CV Tailor est une app web mono-utilisateur qui aide à adapter un CV et une lettre
de motivation à une offre d'emploi précise, avec l'aide d'une IA (Gemini par
défaut, Anthropic en option), puis à exporter le résultat en PDF. Elle intègre
aussi un chasseur d'offres (France Travail) qui note automatiquement chaque offre
pour un profil donné.

**Historique important** : le projet a été réécrit intégralement en Next.js
courant juin/juillet 2026. L'ancien backend Python/Flask (rendu HTML → PDF via
Playwright) a été supprimé début juillet — tout le code vit désormais dans `web/`.
Les documents de conception de cette migration sont archivés dans `docs/archive/`.

---

## 2. Structure du dépôt

```
cv-tailor/
├── web/                  # L'application (Next.js). Tout le code vit ici.
├── docs/archive/         # Documents de conception des chantiers passés (lecture seule, historique)
├── .agents/rules/        # Contrats d'exécution génériques pour agents (cadrage.md)
├── README.md             # Présentation courte + renvoi vers web/README.md
├── TODO.md               # Suivi fonctionnel (fait / à faire / idées)
├── CLAUDE.md             # Règles pour agents IA (racine, courtes, renvoie ici)
└── Lancer CV Builder (Next.js).bat   # Lanceur local (cd web && npm run dev)
```

Tout ce qui suit décrit `web/`.

---

## 3. Stack technique

- **Framework** : Next.js 16 (App Router, Turbopack), React 19, TypeScript strict
- **State client** : Zustand (`src/state/docStore.ts`, `src/state/uiStore.ts`)
- **Persistance locale** : Dexie / IndexedDB (`src/lib/storage/db.ts`) — tout est stocké dans le navigateur, pas de base serveur
- **Validation/schéma** : Zod (`src/lib/resume/schema.ts`)
- **Génération PDF** : `@react-pdf/renderer` (100 % côté client)
- **Rendu de l'aperçu PDF** : `pdfjs-dist` (les pages du blob PDF sont dessinées dans des `<canvas>`)
- **IA** : `@google/genai` (Gemini, par défaut) et `@anthropic-ai/sdk` (Anthropic, optionnel)
- **Offres d'emploi** : API France Travail (OAuth) + Google Maps Distance Matrix (temps de trajet)
- **Tests** : Vitest (unitaires) + Playwright (e2e)
- **Déploiement** : Vercel (serverless), racine du projet Vercel = `web/`

---

## 4. Modèle de données

Source de vérité : `src/lib/resume/schema.ts` (Zod). Deux types de document :

- **`Resume`** (CV) : `name`, `title`, `location`, `email`, `phone`, `linkedin`,
  `photo` (base64), `summary`, `experience[]`, `education[]`, `skills[]`,
  `languages[]`, `interests[]`, `projects[]`, `certifications[]`, `volunteer[]`.
- **`Letter`** (lettre de motivation) : champs expéditeur/destinataire/corps/signature.

`DocType = "CV" | "Lettre"`. Tous les champs ont une valeur par défaut — le
parsing est tolérant, ce qui permet à `src/lib/resume/normalize.ts` de fusionner
sans « effacer » les réponses partielles de l'IA (anti-wipe : caps sur le nombre
d'items, découpage de chaînes en listes, etc.).

⚠️ **Règle absolue** : le champ `photo` (base64) n'est **jamais** envoyé à une IA.
Il est retiré avant l'appel et restauré à la réception (`src/lib/ai/base64.ts`).

---

## 5. State & Stockage

- **`src/state/docStore.ts`** (Zustand) : le document courant (CV ou Lettre) —
  `json` (source de vérité structurée), `templateId`, `company`/`role` (barre
  meta), `previewOverride` (proposition du chat IA avant validation), `atsBoost`
  (mots-clés injectés en 1px), `tailorBefore` (état pré-adaptation, pour le
  `DiffModal`), `pendingJobDesc` (offre en attente depuis l'onglet Offres).
  Contient aussi `html`/`css`/`htmlSource` : reliquat du **mode expert** (édition
  HTML brute), toujours utilisé par `/api/tailor` — voir section 7.
- **`src/state/uiStore.ts`** : toasts, et les remplaçants de `alert/confirm/prompt`
  natifs (`uiAlert`, `uiConfirm`, `uiPrompt`) — **ne jamais utiliser les natifs**.
- **`src/lib/storage/db.ts`** (Dexie, IndexedDB, tout est local au navigateur) :
  - `snapshots` — points de sauvegarde manuels (max 20, purge auto des plus anciens)
  - `drafts` — brouillon courant par type de document (`draft-CV`, `draft-Lettre`)
  - `history` — CV/lettres générés (historique consultable, stats de vues)
  - `jobs` — offres retenues/masquées par le chasseur d'offres (dédoublonnage par id)
  - `templates` — modèles avec variables dynamiques (Lettre + Email)

---

## 6. Génération PDF

Deux moteurs coexistent, pour deux usages différents :

1. **Pipeline JSON → React PDF (principal)** : `src/lib/pdfgen/generatePdf.tsx`
   génère un `Blob` PDF dans le navigateur via `ResumeDocument.tsx` /
   `LetterDocument.tsx` + les gabarits `src/lib/pdfgen/templates/*.tsx`
   (`SobreTemplate`, `GraphiqueTemplate`, `KakunaTemplate`). L'aperçu affiche
   ensuite ce blob page par page via `pdf.js` (`PdfPreview.tsx`).
   Templates CV disponibles : **Sobre, Graphique, Kakuna** (`PdfTemplateId` expose
   aussi `moderne`/`classique`/`minimal`, non implémentés — retombent sur Graphique).
   La Lettre n'a qu'un seul gabarit.
2. **Couche HTML/CSS legacy (parallèle au JSON)** : `docStore` garde `html`/`css`/
   `htmlSource` en plus de `json`. Alimentée par `/api/tailor` (adaptation HTML en
   streaming SSE, conservée intentionnellement en plus de `/api/tailor-resume` —
   voir sa docstring), restaurée par `SnapshotsModal`/`HistoryList` (anciens
   snapshots/entrées d'historique), lue par `AtsPanel` (analyse ATS locale) et
   `DraftManager` (détection de changement pour l'auto-save). ⚠️ Dans
   `EditorPane.tsx`, l'onglet « mode expert » édite en réalité du **JSON**
   (Monaco) — le HTML brut n'est manipulable que via les flux ci-dessus. Cette
   couche n'alimente **jamais** le PDF final (100 % `json` → react-pdf) ;
   `htmlSource=true` bloque juste le formulaire pour ne pas écraser ces données.

Point d'attention Windows/Turbopack : si un changement CSS ne s'affiche pas,
supprimer `web/.next`, vérifier qu'aucun serveur ne traîne sur le port 3000, puis
relancer (`next dev` sert parfois un CSS périmé).

---

## 7. IA — clients et fonctionnalités

**Client bas niveau** : `src/lib/ai/clients.ts`. Sélection du backend selon la clé
fournie (`sk-ant-…` → Anthropic, sinon Gemini). La clé vient soit de l'utilisateur
(stockée en `localStorage`, header `X-Api-Key` — `src/lib/settings.ts`), soit de
`GEMINI_API_KEY` côté serveur. Anthropic ne supporte pas les images (donc pas
l'import PDF). Modèle Gemini par défaut : `gemini-3.1-flash-lite` (réglable via
`GEMINI_MODEL`). Gestion dédiée des erreurs de quota (429).

**Fonctionnalités IA (routes `/api/*`)** :

| Route | Rôle |
|---|---|
| `tailor-resume` | Adapte un CV structuré (JSON) à une offre — pipeline principal |
| `tailor` | Adaptation HTML → HTML (mode expert, streaming SSE) |
| `editor-chat` | Chat de l'éditeur : réponses + propositions de modification (`propose/preview/apply`) |
| `ats-score` | Score ATS piloté par l'IA (mots-clés attendus par l'offre) |
| `adapt-letter` | Adapte le corps du modèle de lettre de l'utilisateur à une offre (IA optionnelle du Pack) |
| `extract-meta` | Extrait entreprise + poste d'une offre (préremplissage barre meta / nommage PDF) |
| `pdf-to-resume` | Importe un CV depuis un PDF (rendu en images côté client via `pdf.js`, puis vision IA) |
| `text-to-resume` | Importe un CV depuis du texte brut collé |
| `text-to-letter` | Importe une lettre depuis du texte brut collé |
| `extract-job` | « Extracteur magique d'offre » : scrape et nettoie une URL d'offre (LinkedIn, WTTJ…) via `src/lib/scraper/` |
| `status` | Statut de configuration IA (clé serveur présente ou non) |

**Score ATS local (sans IA)** : `src/lib/ats/score.ts` — analyse statistique
côté client (mots-clés, stop-words français, sections détectées), indépendante
du score ATS piloté par l'IA.

**White-fonting** : mots-clés manquants injectés en texte transparent 1px à
l'export (`docStore.atsBoost`), pour le score ATS des plateformes de recrutement.

---

## 8. Fonctionnalité « Offres » (chasseur France Travail)

Onglet dédié (`app/jobs/page.tsx`, composants `components/jobs/*`). Pipeline :

1. **`src/lib/jobs/profile.ts`** — `JobSearchProfile` : configuration centrale
   (adresse, mots-clés de poste, modes de transport, types de contrat, région,
   ancienneté max, mots exclus, score minimum, grille de notation). Une seule
   instance aujourd'hui (`DEFAULT_PROFILE`, profil de Hariss) ; conçu pour devenir
   multi-utilisateur sans toucher au cœur de la logique.
2. **`src/lib/jobs/francetravail.ts`** — recherche via l'API France Travail (OAuth
   client_credentials), une requête par mot-clé, filtre stages/alternances.
3. **`src/lib/jobs/prefilter.ts`** — pré-tri gratuit (sans IA) par recoupement de
   mots-clés (titre = poids 2, description = poids 1) ; élimine les offres à 0
   avant d'appeler l'IA.
4. **`src/lib/jobs/score.ts`** — notation IA structurée (Gemini uniquement, sortie
   JSON) sur plusieurs critères (tech, séniorité, secteur, géo, red flags).
5. **`src/lib/jobs/maps.ts`** — temps de trajet réel (Google Distance Matrix).
6. Résultat stocké dans `db.jobs` (statuts `new` / `dismissed` / `hidden`,
   dédoublonnage par id France Travail).

Sans `FT_CLIENT_ID`/`FT_CLIENT_SECRET`/`GOOGLE_MAPS_API_KEY`, l'onglet affiche un
message de configuration au lieu de chercher (voir `web/README.md`).

---

## 9. Authentification

`src/middleware.ts` : si `REMOTE_AUTH_PASSWORD`/`AUTH_PASSWORD` est défini, toutes
les routes (sauf `/login`, `/api/login`, assets) exigent un cookie `auth_token`
égal au SHA-256 du mot de passe (calculé côté Edge, sans librairie externe).
Sans variable définie → app ouverte (mode local). Rate-limiting basique par IP sur
`/api/login` (5 tentatives / minute).

---

## 10. Arborescence UI

```
app/
  page.tsx          # Éditeur principal (TopBar, MetaBar, EditorPane, PreviewPane, ActionsBar, DraftManager)
  history/          # Historique des CV/lettres générés
  jobs/             # Chasseur d'offres
  login/            # Écran de mot de passe (mode remote)
components/
  editor/           # EditorPane (formulaire ⇄ JSON), PreviewPane, PdfPreview (rendu canvas)
  form/             # FormEditor (CV), LetterForm
  history/          # HistoryList, HistoryActions
  jobs/             # JobsView, JobCard, ScanProgress, ScoringInfo
  layout/           # TopBar, MetaBar, ActionsBar, DraftManager
  modals/           # TailorModal, ChatPanel, PackModal, DiffModal, ImportPdfModal,
                     # ImportTextModal, JobExtractor, AtsPanel, SnapshotsModal, HelpModal
  pack/             # TemplateEditorPanel
  ui/               # UiHost (toasts + uiAlert/uiConfirm/uiPrompt)
```

Design system : CSS unique `src/app/globals.css`, variables de thème
(`--bg`, `--text`, etc., support Light/Dark) — **jamais de couleur en dur**.
Modales de référence : `TailorModal.tsx`, `PackModal.tsx` (Pack candidature : lettre + email construits depuis des modèles à variables (table Dexie `templates`, seed 3 modèles), IA optionnelle).

---

## 11. Pièges connus / angles morts

- **Photo base64** : jamais envoyée à une IA, jamais affichée brute dans un flux
  IA (strip/restore systématique, `lib/ai/base64.ts`).
- **Deux moteurs de rendu coexistent** (section 6) : ne pas supposer que le
  pipeline JSON/React-PDF est le seul chemin — `/api/tailor` (mode expert HTML)
  est actif et alimente `html`/`css` dans `docStore`/`Snapshot`/`Draft`/`History`.
- **Turbopack/Windows** : CSS parfois périmé en dev, purger `.next`.
- **Quota Gemini** : erreurs 429 traduites en message utilisateur actionnable
  (proposer une clé personnelle via ⚙️ Paramètres).
- **`TODO.md`** liste encore en priorité haute un « Nettoyage et stabilisation
  globale post-migration » — ne pas supposer que tout est figé/nettoyé.

---

## 12. Commandes essentielles (depuis `web/`)

```bash
npm run dev          # Serveur de dev (localhost:3000)
npm run build         # Build de production
npm run lint          # ESLint
npm test              # Vitest (tests unitaires)
npm run test:e2e      # Playwright (e2e)
npx tsc --noEmit      # Vérification TypeScript stricte
```

Lanceur pratique depuis la racine : `Lancer CV Builder (Next.js).bat`.
