# Constat — performance au 2026-08-04

**Domaine :** performance (rotation Éclaireur, précédent passage : 2026-07-31,
`boucle/constats/2026-07-31-performance.md`).

**Contexte de ce réveil :** deux plans issus de l'audit du 31/07 ont été livrés depuis
(`WORK_HISTORY.md`, entrées du 01/08/2026) : allègement du bundle `/jobs` (-56 % de poids
JS) et retrait de `zod` du bundle de 8 routes sur 9. Ce réveil remesure les deux points
que l'audit du 31/07 laissait ouverts faute de temps (« non fait faute de temps » dans
son propre texte), et corrige une confusion de route découverte en cours de route :
**`/pack` n'est pas l'éditeur CV** (voir « Correction » ci-dessous).

**Mesuré par :**
- Build de production réel : `cd web && rm -rf .next && npm install && npm run build &&
  npm run start`, serveur vérifié up (`curl -s -o /dev/null -w "%{http_code}"
  http://localhost:3000/` → `200`, idem `/jobs`, `/pack`, `/api/status`) avant toute
  mesure.
- Chronométrage navigateur réel (Playwright 1.62, Chromium 149 téléchargé pour cet
  audit, piloté via CDP) — mêmes profils que le 31/07 : réseau **Slow 4G** (1,6 Mbps
  descendant, 750 kbps montant, RTT 150 ms, `Network.emulateNetworkConditions`) et
  **CPU x4** (`Emulation.setCPUThrottlingRate({rate:4})`).
- Poids réel transféré : script Playwright ad hoc (écrit et détruit dans ce réveil,
  jamais commis — voir note en fin de constat) interceptant chaque réponse `.js`/`.css`
  et mesurant `(await response.body()).length` (taille décompressée).
- Concurrence : `curl` sur les pages d'accueil publiques (3 relevés, le 04/08/2026) +
  une recherche web sur le fonctionnement de l'aperçu en temps réel chez Rezi/Kickresume/
  Enhancv (aucun détail d'implémentation technique public trouvé — voir section
  concurrence).

## Correction d'une confusion de route héritée du 31/07

Le constat du 31/07 mesurait `/pack` en le décrivant comme « l'éditeur CV/lettre »
contenant Monaco et react-pdf. Lecture du code actuel : **c'est faux aujourd'hui** (et
probablement déjà le cas le 31/07, erreur non détectée alors) :

- `web/src/app/pack/page.tsx` → `PackView` : éditeur de **lettre à variables** (objet +
  corps, `VariableEditor`), zéro Monaco, zéro `react-pdf`, zéro aperçu PDF (vérifié par
  lecture complète du composant et par `grep -rn "monaco\|react-pdf" src/components/pack/`
  → aucun résultat).
- `web/src/app/page.tsx` (route **`/`**) → `EditorPane` + `PreviewPane` : **c'est ici**
  que vivent Monaco (`import Editor from "@monaco-editor/react"`,
  `EditorPane.tsx:4`, rendu quand l'utilisateur active « Mode Expert » → onglet
  « JSON ») et l'aperçu PDF live (`PreviewPane.tsx` génère un blob PDF réel via
  `generatePdf.tsx` et le fait rendre par PDF.js dans un `<canvas>`,
  `PdfPreview.tsx:74-80`, **automatiquement au chargement**, sans action de
  l'utilisateur).

Le seuil MISSION.md « Chargement de l'éditeur : interactif < 2,5 s » concerne donc
**`/`**, pas `/pack`. Toutes les mesures ci-dessous en tiennent compte.

## Mesures

### `/jobs` — seuil MISSION.md : premier résultat visible < 2 s

Atterrissage → page chargée (`waitUntil: "load"`), 3 relevés, Slow 4G + CPU x4 (condition
mobile combinée, seule reprise ici — les autres conditions du 31/07 ne changeaient pas
la conclusion) :

| Condition | Relevés (ms) | 31/07 (référence) |
|---|---|---|
| Slow 4G + CPU x4 | **2075, 2013, 2010** | 3885, 4072, 3877 |

Poids JS+CSS décompressé au chargement : **799 667 o** sur 12 fichiers, contre
**1 024 000 o** mesurés le 31/07 (avant le second plan de retrait global de `zod`, qui a
aussi réduit `/jobs` — voir tableau `WORK_HISTORY.md` du 01/08, `/jobs` : 1 088 472 o →
802 423 o après ce second plan, cohérent à 2 756 o près avec ma mesure du jour).

**Toujours pas de recherche déclenchable dans cet environnement** (aucune clé
`francetravail`/`adzuna`/`jsearch` configurée) — comme le 31/07, seul le chargement de
la page est mesuré, pas le rendu du premier résultat après une recherche réelle.

### `/` (éditeur CV/lettre) — seuil MISSION.md : interactif < 2,5 s

Sélecteur d'interactivité réelle : `canvas.pdf-preview__page` — le premier `<canvas>`
que `PdfPreview.tsx` insère une fois le PDF généré et rendu par PDF.js (pas juste la
coquille de page ni un bouton, contrairement à la mesure `/pack` du 31/07 qui utilisait
`button` et se savait elle-même sous-estimée).

| Condition | Relevés (ms) |
|---|---|
| Sans throttling (référence machine) | 1732, 1681, 1701 |
| CPU x4 seul (réseau normal) | 4225, 4132, 3760 |
| Réseau Slow 4G seul (CPU normal) | 7560, 7558, 7557 |
| **Réseau Slow 4G + CPU x4 (condition mobile combinée)** | **9512, 9061, 9066** |

Poids JS+CSS décompressé chargé jusqu'à ce premier rendu de l'aperçu : **3 392 586 o**
sur 24 fichiers — bien au-dessus du poids de simple atterrissage de `/` (1 334 318 o sur
13 fichiers, mesuré séparément avec `waitUntil: "load"` seul). Les deux chunks
supplémentaires les plus lourds :

- `2x2pd0p5iq-yi.js` — **1 443 775 o**, 491 occurrences du mot « font » / 115
  « Font », 5 « react-pdf » : polices embarquées pour la génération PDF
  (`lib/pdfgen/fonts.ts`, templates `Marine`/`Sobre`/`Kakuna`/`Graphique`).
- `3vaxe7ga2zkcc.js` — **423 075 o**, 65 occurrences de « pdfjs » : le moteur PDF.js
  qui rend le blob généré dans le `<canvas>` de l'aperçu.

Ces deux chunks (ensemble **1 866 850 o**, 55 % du poids total jusqu'à l'aperçu) sont
chargés **automatiquement dès l'atterrissage sur `/`**, sans action de l'utilisateur :
`PreviewPane.tsx` génère et affiche un aperçu du document par défaut au montage
(`useEffect` sur `json`/`docType`/`templateId`/`previewOverride`, aucune de ces valeurs
n'exige un geste préalable).

### Monaco (`/`, mode Expert → onglet JSON) — sortie du domaine « briques externes », mais mesurée ici parce qu'elle bloque l'interactivité

Contrairement à l'aperçu PDF, Monaco **n'est pas** dans le bundle JS de CVMatchr : la
bibliothèque `@monaco-editor/react` (`node_modules/@monaco-editor/loader/lib/es/config/
index.js:3`) pointe par défaut sur un CDN externe, **`cdn.jsdelivr.net`**, chargé en
AMD au moment où l'utilisateur clique « Mode Expert » puis « JSON ».

Mesuré (Slow 4G + CPU x4, navigation vers `/` → clic « Mode Expert » → clic « JSON »,
attente du sélecteur `.monaco-editor .view-lines`) :

- **15 requêtes externes** vers `cdn.jsdelivr.net/npm/monaco-editor@0.55.1/…`, dont
  `editor.api-CalNCsUg.js` à lui seul **3 669 759 o** et `editor.main.css` à
  **308 989 o** — total externe mesuré : **~4,1 Mo**.
- Temps jusqu'à l'éditeur Monaco réellement utilisable : **11 235 ms**.

Aucune de ces requêtes ne part vers l'infrastructure CVMatchr : c'est un appel réseau
non facturé (jsdelivr est gratuit) mais **non maîtrisé** — hors de portée d'un
throttling ou d'un cache applicatif, et le seul point de tout le produit où le
navigateur contacte un tiers pour du code plutôt que pour une donnée (France Travail,
Adzuna, Gemini…). Signalé ici parce qu'il bloque une interactivité, pas parce qu'il
coûte de l'argent (ce serait le domaine « briques externes » ou « coût des appels
externes » ; il n'entre dans aucun des deux au sens strict de la mission, d'où sa
mention ici plutôt qu'un chantier séparé).

## Ce que fait la concurrence sur ce point

- Recherche web (04/08/2026, requête « Rezi Kickresume Enhancv "real-time preview"
  resume editor how it works ») : aucun des trois ne documente publiquement le
  mécanisme technique de son aperçu en direct (HTML/CSS live vs rendu PDF réel côté
  client comme CVMatchr) — **non vérifiable sans compte**, comme le 31/07 pour le
  chargement complet de l'éditeur.
- Accès direct aux pages d'accueil (marketing, pas l'éditeur) :

  | Site | Code | Temps (3 relevés) |
  |---|---|---|
  | rezi.ai | 301 (redirect) | 0.149s |
  | kickresume.com | 301 (redirect) | 0.524s |
  | enhancv.com | 200 | 0.230s |

  Non comparable à mes mesures d'interactivité de `/` : c'est un TTFB de page
  marketing statique, pas un temps jusqu'à un aperçu de document généré.
- **Hypothèse non vérifiée, à traiter comme telle** : la plupart des générateurs de CV
  grand public affichent un aperçu **HTML/CSS** en direct (mise en page recalculée en
  JS/CSS pur) et ne génèrent un vrai PDF qu'à l'export — une opération bien moins
  coûteuse en CPU/réseau qu'un cycle complet génération-PDF-puis-rendu-PDF.js à chaque
  frappe, comme le fait CVMatchr. Cette hypothèse s'appuie sur l'architecture
  générale connue des outils de ce type (page HTML stylée = aperçu, PDF = export
  final), pas sur une inspection de leur code — **à vérifier avant de la traiter comme
  un fait**, aucun de ces trois produits n'étant accessible sans compte pour confirmer.

## Écart au seuil de MISSION.md

- `/jobs` : seuil < 2 s. Mesuré : **~2,03 s en moyenne** (2010-2075 ms), contre ~3,9 s le
  31/07. **Dépassement réduit d'un facteur ~2 (31/07) à un facteur ~1,02 (04/08)** —
  quasiment résorbé par les deux plans déjà livrés. Le seuil est encore techniquement
  dépassé de quelques dizaines de millisecondes, mais l'idée n°5 de `IDEES.md`
  (« remesurer le chronométrage réel ») peut être considérée comme répondue : plus de
  dépassement de facteur 2, donc plus de raison de faire primer ce chantier sur un
  manque fonctionnel (règle de tranchage de `MISSION.md`).
- `/` (éditeur) : seuil < 2,5 s pour « interactif ». Mesuré au premier aperçu PDF
  réellement visible : **~9,2 s en moyenne (9061-9512 ms) en condition mobile
  combinée — dépassement d'un facteur ~3,7**, très supérieur au facteur 2 qui, selon
  la règle de tranchage de `MISSION.md`, fait primer un dépassement technique sur un
  manque fonctionnel. C'est la mesure la plus sévère de tout l'audit de performance
  depuis le 31/07 (le 31/07 n'avait mesuré que la coquille de `/pack`, pas cette
  page, et se savait sous-estimé).
- Monaco (`/`, mode Expert) : pas de seuil MISSION.md dédié (Monaco n'est pas sur le
  chemin critique de l'atterrissage), mais 11,2 s avant utilisabilité une fois demandé
  est un temps d'attente perçu très long pour une fonctionnalité que l'utilisateur a
  explicitement demandée en cliquant deux fois.

## Écart à la concurrence

**Toujours non tranchable frontalement** (implémentations internes non visibles sans
compte), mais le signal indirect a changé de sens depuis le 31/07 : l'audit précédent
notait l'absence de plaintes publiques chiffrées sur la lenteur de ces produits comme
un signal faible de leur rapidité relative. Ce réveil ajoute un signal architectural :
si l'hypothèse d'un aperçu HTML/CSS chez la concurrence est vraie (non vérifiée), alors
un aperçu PDF réel comme celui de CVMatchr est structurellement plus lourd par
construction, indépendamment de tout bug — un chantier de dégradation progressive
(afficher d'abord un rendu HTML léger, ne générer le vrai PDF qu'à la demande/export)
rapprocherait l'architecture de ce que la concurrence semble faire.

## Chantiers proposés

1. **Retarder ou alléger le premier aperçu PDF de `/` au chargement** — gain attendu :
   ramener le temps jusqu'à l'aperçu sous 2,5 s. Piste explicitement **non tranchée
   ici** (plusieurs options possibles, chacune avec un compromis produit à arbitrer,
   pas seulement technique) : (a) aperçu HTML/CSS provisoire affiché immédiatement,
   PDF réel généré en arrière-plan puis substitué (change ce que voit l'utilisateur au
   premier instant) ; (b) précharger/scinder les deux chunks lourds
   (polices 1,44 Mo + PDF.js 423 Ko) pendant que le reste de la page s'affiche plutôt
   qu'en bloquant le premier rendu (change seulement l'ordre de chargement, pas le
   rendu visible) ; (c) réduire le jeu de polices embarquées chargé par défaut si tous
   les templates n'en ont pas besoin au premier rendu (non vérifié ici si c'est le
   cas). C'est le dépassement de seuil le plus net mesuré dans tout l'historique des
   audits performance de la boucle (facteur ~3,7).
2. **Décider si Monaco doit rester chargé depuis `cdn.jsdelivr.net`** — gain attendu :
   soit accepter le compromis (poids hors bundle propre, mais 11 s d'attente + une
   dépendance réseau tierce non maîtrisée), soit envisager un bundle local (poids
   ajouté au build, mais suppression de la dépendance CDN et de son incertitude de
   disponibilité). Décision produit, pas seulement technique — signalé, pas tranché.
3. *(clôturé par ce réveil, à retirer du classement)* : l'idée n°5 de `IDEES.md`
   (« remesurer `/jobs` ») est répondue — dépassement résiduel sous le facteur 2, plus
   de raison de le faire primer sur un manque fonctionnel.

## Note méthodologique

Les scripts Playwright utilisés pour ce chronométrage (`tmp-perf-measure.mjs`,
`tmp-perf-measure2.mjs`, `tmp-monaco-check.mjs`) ont été écrits dans `web/` (seul
endroit où `node_modules/playwright` est résolvable en ESM), utilisés, puis
**supprimés avant de terminer ce réveil** — jamais ajoutés à `git`, conformément au
périmètre de l'Éclaireur (aucune modification dans `web/`). `web/package-lock.json`,
modifié par un `npm install` nécessaire pour installer les dépendances de test dans cet
environnement, a été restauré (`git checkout --`) avant de conclure. Vérifié par
`git status --short` (aucune sortie) avant la rédaction de ce constat.
