# 🗺️ PROJECT_INDEX.md — CVMatchr

Carte du dépôt. À lire avant toute modification pour ne pas redécouvrir à l'aveugle
ce qui existe déjà. Pour les règles de comportement (Karpathy, vérifications,
interdictions), voir `CLAUDE.md` (racine) et `web/CLAUDE.md`.

---

## 1. Vue d'ensemble

CVMatchr est une app web mono-utilisateur qui aide à adapter un CV et une lettre
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
├── extension/            # Extension navigateur (Manifest V3) : autofill de candidature
│                         # Greenhouse/Lever depuis un paquet préparé dans /pack
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
  meta), `previewOverride` (proposition du chat IA avant validation), `pendingJobDesc` 
  (offre en attente depuis l'onglet Offres).
- **`src/state/uiStore.ts`** : toasts, et les remplaçants de `alert/confirm/prompt`
  natifs (`uiAlert`, `uiConfirm`, `uiPrompt`) — **ne jamais utiliser les natifs**.
- **`src/lib/storage/db.ts`** (Dexie, IndexedDB, tout est local au navigateur) :
  - `snapshots` — points de sauvegarde manuels (max 20, purge auto des plus anciens)
  - `drafts` — brouillon courant par type de document (`draft-CV`, `draft-Lettre`)
  - `history` — CV/lettres générés. Champs ajoutés en v8 : `applicationId` (rattache
    le document à une candidature) et `label` (nom donné à un CV du rayon « Mes CV » ;
    vide = document anonyme, remplaçable au prochain export du même type).
  - `jobs` — offres retenues/masquées par le chasseur d'offres (dédoublonnage par id).
    Champ ajouté en v8 : `applicationId` (offre suivie → bouton « Suivie » inactif).
  - `templates` — modèles avec variables dynamiques (Lettre + Email)
  - `applications` (v8) — candidatures suivies. **Le statut n'est jamais stocké** : il
    est dérivé du journal `events` et de l'ancienneté (voir section « Mes candidatures »).
  - `atsDirectory` (v12) — cache de détection des ATS par entreprise (Ashby, Lever,
    SmartRecruiters, Greenhouse). La v12 purge les `none` de la v11, calculés quand
    seuls Greenhouse et Lever étaient interrogés.

---

## 6. Génération PDF

Un seul moteur exclusif :

1. **Pipeline JSON → React PDF** : `src/lib/pdfgen/generatePdf.tsx`
   génère un `Blob` PDF dans le navigateur via `ResumeDocument.tsx` /
   `LetterDocument.tsx` + les gabarits `src/lib/pdfgen/templates/*.tsx`
   (`SobreTemplate`, `GraphiqueTemplate`, `KakunaTemplate`, `MarineTemplate`). L'aperçu affiche
   ensuite ce blob page par page via `pdf.js` (`PdfPreview.tsx`).
   Templates CV disponibles : **Sobre, Graphique, Kakuna, Marine**.
   La Lettre n'a qu'un seul gabarit.

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
| `editor-chat` | Chat de l'éditeur : réponses + propositions de modification (`propose/preview/apply`) |
| `ats-score` | Analyse ATS : l'IA extrait les **exigences** de l'offre et dit lesquelles le CV prouve (elle ne calcule aucun score) |
| `adapt-letter` | Adapte le corps du modèle de lettre de l'utilisateur à une offre (IA optionnelle du Pack) |
| `extract-meta` | Extrait entreprise + poste d'une offre (préremplissage barre meta / nommage PDF) |
| `pdf-to-resume` | Importe un CV depuis un PDF (rendu en images côté client via `pdf.js`, puis vision IA) |
| `text-to-resume` | Importe un CV depuis du texte brut collé |
| `text-to-letter` | Importe une lettre depuis du texte brut collé |
| `extract-job` | « Extracteur magique d'offre » : scrape et nettoie une URL d'offre (LinkedIn, WTTJ…) via `src/lib/scraper/`. Cascade : fetch+cheerio → microservice Camoufox (`scraper-service/`, si `SCRAPER_URL` définie) → Jina AI |
| `jobs/ats` | Résolution par lot du board public (Greenhouse, Lever) d'une liste d'entreprises |
| `status` | Statut de configuration IA (clé serveur présente ou non) |

**Système ATS** (`src/lib/ats/`, panneau `components/modals/AtsPanel.tsx`) :

- `resumeText.ts` — sérialise le CV (`docStore.json`) en texte, zone par zone, en
  excluant les sections masquées (absentes du PDF, donc invisibles pour un vrai ATS).
- `engine.ts` — le moteur de score, **unique et partagé** par les deux chemins. Le score
  global agrège 4 axes pondérés : **Mots-clés 40 %, Structure 25 %, Impact 20 %,
  Adéquation 15 %**. Un terme de l'offre n'est retenu comme *exigence* que s'il est un
  savoir-faire identifiable (lexique, composé, acronyme isolé), martelé par l'offre
  (≥ 3 occurrences), ou présent dans l'intitulé du poste — sans quoi le dénominateur se
  remplit de baratin RH.
- Deux chemins, **un seul calcul** : « Score ATS » (local, gratuit, instantané) déduit les
  exigences par pondération statistique ; « Analyser avec l'IA » les fait extraire par
  l'IA (sémantique, synonymes, indispensable vs souhaité) **mais le score reste calculé
  par le moteur** — donc reproductible d'un appel à l'autre.

---

## 8. Fonctionnalité « Offres » (chasseur multi-sources)

Onglet dédié (`app/jobs/page.tsx`, composants `components/jobs/*`). Pipeline :

Les critères se règlent dans une **barre de filtres toujours visible**
(`FilterBar`) : poste et lieu en haut, pastilles (`FilterPill`) pour contrat,
ancienneté, expérience, temps de travail et sources, et un panneau
« Plus de filtres » (`MoreFilters`) pour les onze réglages rares. Les libellés et
états actifs des pastilles viennent d'un module pur, `lib/jobs/filters.ts`.
`FilterBar` n'est monté qu'une fois le profil lu depuis Dexie — `LocationInput`
fige le libellé du lieu à son montage.


1. **`src/lib/jobs/profile.ts`** — `JobSearchProfile` : configuration centrale
   (adresse, mots-clés de poste, modes de transport, types de contrat, région,
   ancienneté max, mots exclus, score minimum, grille de notation). Une seule
   instance aujourd'hui (`DEFAULT_PROFILE`, profil de Hariss) ; conçu pour devenir
   multi-utilisateur sans toucher au cœur de la logique.

La recherche interroge trois sources au choix de l'utilisateur : **France Travail**
(illimité), **Adzuna** (1 000 appels/mois) et **JSearch / Google for Jobs**
(200 appels/mois, seule source à fournir un logo d'entreprise et le jobboard réel).
Un module par source dans `web/src/lib/jobs/` expose `search(profile, creds)` et
renvoie des `JobOffer` (`web/src/lib/jobs/offer.ts`). `/api/jobs/search` les appelle
en parallèle, fusionne, dédoublonne par `normKey` (`dedupe.ts`).

Les offres sont classées **en local, sans IA** : `lib/jobs/rank/` note chaque
offre sur 100 (compétences & missions 45, métier 20, distance 15, contrat &
salaire 10, expérience 10, malus hors-sujet −20 et signaux négatifs −15), puis
traduit le score en lettre S/A/B/C/D par des seuils absolus réglables. Le
classement ne dépend jamais du lot analysé : une lettre reste stable dans le
temps.

Deux voies par critère : les champs structurés de France Travail (`romeCode`,
`competences` codifiées) et l'analyse du texte pour toutes les sources, pour le
même nombre de points — sans quoi les offres France Travail seraient
systématiquement avantagées.

Le référentiel ROME 4.0 est embarqué (`lib/jobs/data/`, régénérable par
`scripts/build-rome.mjs`). Le code ROME sert surtout de filtre anti-bruit.

L'index des boards français (`lib/jobs/data/boards-fr.json`) liste les
entreprises dont le board ATS public a au moins une offre en France — le
répertoire du « marché caché ». Régénérable par `node scripts/build-boards-fr.mjs`
et rafraîchi chaque lundi par `.github/workflows/boards-fr.yml`.
`boards-fr-testes.json` est la mémoire des couples déjà testés (échecs compris) ;
rien d'autre ne le lit. **La brique 2 — moissonner les offres depuis ces boards et
les afficher dans « Offres » — n'est pas faite** : l'index ne sert encore à rien
dans l'app. Voir `docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`.

Google Maps n'est plus appelé pendant le scan (c'était 354 appels facturés par
passage) mais au dépliage d'une offre, avec un cache de 30 jours.

Conception détaillée et mesures :
`docs/superpowers/specs/2026-07-28-notation-lettres-design.md`.

Pièges :
- Décocher une source signifie **ne pas l'interroger**, pas masquer ses résultats.
- Le favicon du jobboard passe par une **cascade de domaines** (`board.ts`) : le
  service échoue sur certains sous-domaines et renvoie un globe générique **en
  HTTP 404**, donc le repli doit se déclencher sur l'erreur de chargement.
- Le compteur de quota (table Dexie `apiUsage`) est **local et indicatif**.
- Les **logos d'entreprise** (`lib/jobs/logos.ts`) : aucune source ne fournit de logo
  exploitable, il faut donc retrouver l'entreprise depuis sa seule raison sociale.
  **Un nom d'entreprise n'identifie pas une entreprise** : « Nexton » désigne aussi
  un vendeur pakistanais (`nexton.com.pk`), un éditeur japonais (`nexton-net.jp`) et
  un lotissement américain (`nexton.com`) — tous réellement nommés ainsi. Annuaires
  (Brandfetch, Wikidata) comme domaines devinés y tombent. Tout candidat passe donc
  deux filtres gratuits — extension en liste blanche, domaine qui épouse le nom —
  puis, selon sa provenance : un **domaine deviné** doit être confirmé par sa page
  d'accueil (titre au nom de l'entreprise, site visant la France) ; un **domaine
  nommé par l'annuaire** est retenu sans visite, sa présence au répertoire valant
  caution. Les devinés sont essayés en premier, parce que l'annuaire ne départage
  pas les homonymes (pour « Fab Group » il propose un fabricant de meubles italien).
  Sans confirmation : initiale, jamais de logo approximatif.
- **Le CDN Brandfetch ne renvoie jamais 404** : pour un domaine qu'il ne connaît pas,
  il sert une image *vide* de 128×128, donc le repli sur l'initiale — déclenché par
  l'erreur de chargement — ne peut pas s'appliquer. D'où le choix du fournisseur
  selon la provenance du domaine (`logoUrlFor`) : Brandfetch pour un domaine que
  l'annuaire a nommé (il a forcément un logo), **le service de favicons de Google**
  pour un domaine deviné puis vérifié (il couvre les PME que Brandfetch ignore et
  répond 404 quand il ne sait pas).
- **Les logos ne sont pas résolus par `/api/jobs/search`** mais par `/api/jobs/logos`,
  appelée par le client une fois les offres affichées : la résolution demande de
  visiter des pages d'accueil (~9 s pour 50 entreprises inconnues) et retardait tout
  l'affichage. Effet de bord voulu : cette route ignore d'où viennent les entreprises,
  donc les offres **déjà en base** — que le scan écarte par dédoublonnage et qui
  restaient sans logo à jamais — sont rattrapées au simple retour sur la page.
- **Le scan interroge les sources en deux groupes** (`JobsView.scanGroupe`) : France
  Travail + Adzuna (~1 s), puis JSearch (~16 s, ~5 s par mot-clé chez eux). Chaque
  groupe s'affiche dès qu'il répond. Conséquence : le dédoublonnage inter-source ne
  peut plus être fait par le serveur d'un seul coup, il se joue côté client sur les
  clés `normKey` déjà en base (`jobKeys`).
- Le **rendu** du logo revient à Brandfetch, qui le sert bien dès qu'on lui donne le
  bon domaine. Ses conditions interdisent l'accès programmatique à l'image et exigent
  un `Referer` : le serveur construit l'URL du CDN, le navigateur la charge. Sans
  `BRANDFETCH_CLIENT_ID`, l'étape est sautée.
- Les **offres déjà en base ne sont jamais reclassées** (`JobsView.tsx`, dédoublonnage
  par `jobExists`) : modifier l'algorithme n'a aucun effet visible sur les offres
  existantes, il faut vider le store `jobs` pour le constater.

Sans `FT_CLIENT_ID`/`FT_CLIENT_SECRET`/`GOOGLE_MAPS_API_KEY`, l'onglet affiche un
message de configuration au lieu de chercher (voir `web/README.md`).

---

## 8 bis. Fonctionnalité « Mes candidatures » (tracker)

Page `app/candidatures/page.tsx`. Elle **absorbe l'ancien Historique** (`/history`
redirige) et récupère le dashboard qui vivait dans Paramètres.

**Principe directeur : le suivi ne doit rien coûter à l'utilisateur.** Le mode d'échec
de tout tracker de candidatures est que la mise à jour coûte plus cher que le bénéfice.
Donc **le statut n'est jamais stocké, il est dérivé** :

- un refus est terminal ; un entretien décroché ne vieillit jamais ;
- au-delà de `staleDays` de silence (réglable dans Paramètres, défaut 30) la
  candidature passe seule en « Sans suite » — personne ne clique pour ça ;
- les événements `note` n'influencent ni le statut ni l'ancienneté.

Les deux seules saisies manuelles sont « Entretien » et « Refusée », délibérément rares.

**Toute la logique décisionnelle est dans des modules purs** (`src/lib/applications/`),
parce que le projet n'a ni `jsdom` ni `fake-indexeddb` : c'est la seule couche
testable par Vitest. `store.ts` ne fait qu'appliquer leurs décisions à Dexie.

1. **`normKey.ts`** — clé de dédoublonnage entreprise+poste (accents, casse et
   ponctuation neutralisés). `""` si les deux champs sont vides → aucune candidature.
2. **`types.ts`** — `Application`, `ApplicationEvent` (`source: "manual" | "system" | "ai"`).
3. **`status.ts`** — `deriveStatus`, `daysSince`, `summarize`, `indexOfLastStatusEvent`.
4. **`shelf.ts`** — règle du CV anonyme (voir ci-dessous).
5. **`backfill.ts`** — `planBackfill` peuple le tracker depuis l'historique existant
   au premier affichage, groupé par entreprise+poste. Idempotent.

**Points d'entrée d'une candidature** : automatique à l'export PDF quand entreprise et
poste sont renseignés (`TopBar.onConvert`) ; bouton « Suivre » sur une offre France
Travail ; ajout manuel. Le dédoublonnage sur `normKey` fait que régénérer un CV pour la
même entreprise+poste n'ajoute ni candidature ni événement.

**Rayon « Mes CV »** (bas de page) : les documents sans candidature. **Un seul document
anonyme par type de document** — un nouvel export sans entreprise ni poste remplace le
précédent, silencieusement (le libellé « Dernier CV exporté · sera remplacé au prochain
export » l'annonce). **Nommer un document, c'est le garder** : dès qu'il porte un
`label` il est épinglé et n'est jamais remplacé.

**Décision propriétaire du 25/07/2026** : supprimer une candidature *détache* ses
documents et les conserve tous, même si le rayon contient alors temporairement plusieurs
anonymes du même type. La règle d'unicité étant appliquée à l'export, le prochain
téléchargement nettoie. Supprimer ici serait une perte de donnée non demandée.

**Écarté explicitement** : aucune statistique par variante de CV (taux de réponse par
CV). Cela reposait sur une corvée de nommage que l'utilisateur cible ne fera pas et sur
une déduction invisible produisant des chiffres faux dès qu'un CV est retouché.

Spec : `docs/superpowers/specs/2026-07-25-tracker-candidatures-design.md`.
Maquettes validées : `docs/design/candidatures/` (dont un prototype cliquable).

---

## 8 ter. Extension navigateur (autofill de candidature)

`extension/` (Manifest V3, JavaScript vanilla, zéro dépendance npm, chargée en
mode développeur — pas de publication Chrome Web Store à ce stade). Depuis
`/pack`, « Préparer pour l'extension » envoie {identité, texte de lettre, CV en
base64} par `postMessage` ; l'extension l'écrit dans `chrome.storage.local` et
propose un bouton flottant sur les pages Greenhouse/Lever pour remplir le
formulaire — jamais de soumission automatique.

Reconnaissance de champ générique (identifiant documenté → `autocomplete` →
texte de label), pas de sélecteurs figés par ATS : voir
`docs/superpowers/specs/2026-08-02-extension-autofill-design.md` §5.2 pour le
raisonnement (aucune preuve publique sur le DOM réel de Lever). Vérifié en
usage réel sur une offre Greenhouse et une offre Lever (détail des champs
remplis dans `WORK_HISTORY.md`, Journal 2026-08-02) : les identifiants
documentés par l'API Greenhouse sont exposés en attribut `id` (pas `name`) sur
le DOM rendu, et Lever n'a qu'un champ « Full name » (pas de prénom/nom
séparés) — les deux constats ont fait évoluer `fieldMatch.js`.

Hors périmètre à ce stade : capture d'offre par extension (l'extracteur URL
existant, §7, couvre l'essentiel), tout ATS autre que Greenhouse/Lever.

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
  candidatures/     # Tracker « Mes candidatures » (absorbe l'ancien Historique)
  help/             # Page d'aide / FAQ
  history/          # Redirection vers /candidatures (signets et liens existants)
  jobs/             # Chasseur d'offres
  login/            # Écran de mot de passe (mode remote)
  pack/             # Pack candidature (lettre de motivation / email)
  profil/           # Profil du candidat (préremplissage)
components/
  editor/           # EditorPane (formulaire ⇄ JSON), PreviewPane, PdfPreview (rendu canvas)
  applications/     # ApplicationsScreen, ApplicationsDashboard, ApplicationsFilters,
                     # ApplicationCard, ResumeShelf, AddApplicationModal
  form/             # FormEditor (CV), LetterForm
  jobs/             # JobsView, FilterBar, JobCard, ScanProgress, ScoringInfo
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
- **Turbopack/Windows** : CSS parfois périmé en dev, purger `.next`.
- **Quota Gemini** : erreurs 429 traduites en message utilisateur actionnable
  (proposer une clé personnelle via ⚙️ Paramètres).
- **`TODO.md`** liste encore en priorité haute un « Nettoyage et stabilisation
  globale post-migration » — ne pas supposer que tout est figé/nettoyé.
- **Nom du PDF ≠ contenu de la barre meta** : `lib/pdfgen/filename.ts` ne retient
  que le type de document et le poste (`CV_Chef_de_projet`), plus la date en
  option. L'entreprise reste saisie et stockée — elle sert au suivi de
  candidature et à l'historique — mais n'entre pas dans le nom du fichier, pas
  plus que le nom du candidat. Ne pas les y remettre « pour être complet » : le
  nom devenait illisible.
- **Adapter sans CV Maître** : `loadMasterResume()` renvoie `null` quand
  `draft-Maître` est absent ou vide, et `TailorModal` retombe alors sur le CV
  affiché — donc sur le CV réécrit pour l'offre précédente, que l'IA réécrit à
  nouveau (dérive cumulative). La retombée est désormais annoncée dans la modale
  et dans le toast final ; ne pas la re-silencer.
- **Adapter depuis le type « CV Principal »** : le résultat n'écrase jamais le
  Maître — `TailorModal` écrit `draft-CV` puis bascule le `docType` sur « CV ».
  L'ordre compte : `useAutoDraft` recharge le brouillon au changement de type, donc
  poser le document d'abord et basculer ensuite ferait écraser l'adaptation par
  l'ancien brouillon. La meta (`company`/`role`) part dans le même `saveDraft`.
- **`useAutoDraft` ne restaure pas une entreprise/un poste déjà posés** : arriver
  par « Adapter mon CV » depuis l'onglet Offres écrit la meta de l'offre AVANT de
  naviguer vers l'éditeur ; le brouillon, restauré aveuglément, l'écrasait avec
  celle de la candidature précédente. Le drapeau est lu avant tout `await` — le
  store bouge pendant le chargement du brouillon.
- **`AtsPanel` garde sa dernière analyse hors de React** (`derniere`, module) :
  `TailorModal` démonte son contenu à la fermeture, et le rapport repartait avec.
  Il est indexé par le texte de l'offre — une autre offre ne le récupère jamais.

---

## 13. Boucle autonome

Un agent Claude se réveille toutes les 6 heures (`.github/workflows/boucle.yml`) et joue
**un** rôle : Gardien (répare), Bâtisseur (code), Architecte (planifie) ou Éclaireur
(audite). Le choix est fait par un script pur et testé
(`boucle/bin/choisir-role.mjs`), jamais par le jugement de l'agent.

Piloter la boucle : `boucle/README.md`.
Conception : `docs/superpowers/specs/2026-07-31-boucle-autonome-design.md`.

Pièges :
- **La boucle ne pousse jamais sur `main`.** Elle committe en local ; le workflow pousse
  sur `claude/…`, ouvre la PR et arme `--auto`. La fusion n'a lieu que si la protection
  de branche `main` exige le check `test-web` — **sans cette protection, `--auto`
  fusionne immédiatement, y compris avant que la CI ait répondu** (le moteur refuse
  désormais de s'armer sans cette protection mise en place).
- Une PR ouverte avec le jeton par défaut de GitHub Actions **ne déclenche aucune CI**.
  D'où le secret `LOOP_GITHUB_TOKEN` (jeton personnel). Si les PR de la boucle n'ont
  aucun check, c'est ce secret qu'il faut regarder.
- **Une seule PR de la boucle ouverte à la fois** : tant qu'elle vit, les réveils la
  font avancer au lieu d'en ouvrir une autre.
- La boucle ne peut modifier ni `MISSION.md`, ni `roles/`, ni `.github/workflows/`, ni
  aucun `.env*` — `bin/verifier-perimetre.mjs` refuse le diff avant le push.
- Elle n'a **aucune clé applicative** (France Travail, Adzuna, Gemini, Maps, Brandfetch) :
  les tests tournent sur des bouchons.

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
