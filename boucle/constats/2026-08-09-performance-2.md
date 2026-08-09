# Constat — performance au 2026-08-09

**Domaine :** performance (rotation Éclaireur, précédent passage :
`boucle/constats/2026-08-04-performance.md`).

**Contexte de ce réveil :** aucun commit n'a touché
`web/src/components/editor/PreviewPane.tsx`, `PdfPreview.tsx`, `web/src/lib/pdfgen/`
ni `web/src/app/page.tsx` depuis le 04/08/2026 (`git log --since=2026-08-04` sur ces
fichiers : aucune sortie) — le dépassement mesuré le 04/08 (idée n°11 d'`IDEES.md`,
« Retarder ou alléger le premier aperçu PDF de `/` ») n'a été ni construit ni changé
depuis. Ce réveil le remesure pour confirmer qu'il tient toujours, puis couvre deux
points que le 04/08 laissait ouverts : le poids réel de `/` contre le seuil de 2,5 s
(base de l'idée n°21, « jamais mesuré contre le seuil ») et l'interactivité réelle de
`/pack` (idée n°24, dont le titre porte une prémisse corrigée le 04/08 lui-même — voir
« Correction » ci-dessous).

**Mesuré par :**
- Build de production réel : `cd web && rm -rf .next && npm install && npx playwright
  install chromium && npm run build && npm run start`, serveur vérifié up (`curl -s -o
  /dev/null -w "%{http_code}"` → `200` sur `/`, `/pack`, `/jobs`) avant toute mesure.
  Aucun mot de passe (`REMOTE_AUTH_PASSWORD`/`AUTH_PASSWORD`) configuré dans cet
  environnement — middleware inactif, comme lors des audits précédents.
- Chronométrage navigateur réel (Playwright, Chromium, piloté via CDP) — mêmes profils
  que le 04/08 : réseau **Slow 4G** (1,6 Mbps descendant, 750 kbps montant, RTT 150 ms,
  `Network.emulateNetworkConditions`) et **CPU x4**
  (`Emulation.setCPUThrottlingRate({rate:4})`), 3 relevés par mesure.
- Poids réel transféré : script Playwright ad hoc interceptant chaque réponse
  `.js`/`.css` et mesurant `(await response.body()).length` (taille décompressée) —
  même méthode que le 04/08.
- Concurrence : `curl` TTFB sur les pages d'accueil publiques (1 relevé, le 09/08/2026,
  pages marketing statiques, non comparables à l'app derrière connexion — comme au
  04/08) + deux recherches web ciblées sur le mécanisme d'aperçu en direct de la
  concurrence.

## Correction d'une prémisse héritée du 04/08

L'idée n°24 d'`IDEES.md` porte le titre « Performance `/pack` — mesurer le vrai temps
d'interactivité (**Monaco/react-pdf**) ». Cette formulation date d'avant la correction
de route du 04/08 : `/pack` ne contient ni Monaco ni `react-pdf` (`PackView.tsx` →
`VariableEditor`, un `<div contentEditable>`, zéro import de ces deux bibliothèques,
confirmé par lecture du fichier et `grep -rn "monaco\|react-pdf"
src/components/pack/`). Le vrai facteur limitant de `/pack` est ailleurs — voir mesures
ci-dessous. Le titre de l'idée n°24 reste inexact tant qu'il n'est pas corrigé.

## Mesures

### `/` — remesure de l'idée n°11 (aperçu PDF réellement rendu)

Sélecteur : `canvas.pdf-preview__page` (identique au 04/08).

| Condition | Relevés (ms) | 04/08 (référence) |
|---|---|---|
| Slow 4G + CPU x4 | **8930, 9025, 8976** | 9061, 9066, 9512 |

Inchangé au dixième de seconde près : moyenne **~8977 ms** contre **~9213 ms** le
04/08, un écart de 2,6 % qui reste dans le bruit de mesure d'un environnement CI
partagé. **Aucune amélioration ni régression constatée** — cohérent avec l'absence de
commit sur les fichiers concernés.

### `/` — décomposition de « interactif » en trois seuils distincts (nouveau)

Le 04/08 mesurait un seul seuil (le canvas PDF, 9 s). Ce réveil ajoute deux points
intermédiaires pour distinguer ce qui bloque réellement l'utilisateur de ce qui ne
bloque que l'aperçu :

| Seuil | Sélecteur | Relevés (ms), Slow 4G + CPU x4 |
|---|---|---|
| Premier champ du formulaire réellement saisissable | `input.form-input` | **1075, 1080, 1074** |
| Page + sous-ressources chargées (`waitUntil: load`) | — | **2774** (poids : 1 336 006 o sur 13 fichiers JS/CSS) |
| Aperçu PDF rendu (`canvas.pdf-preview__page`) | — | **8930-9025** (référence, voir ci-dessus) |

Le formulaire lui-même est utilisable en ~1,08 s, **bien sous le seuil de 2,5 s** — un
candidat peut commencer à saisir son CV très vite. Seul l'événement `load` du
navigateur (2,77 s, poids 1,34 Mo) dépasse légèrement le seuil (**facteur ~1,11**), et
seul l'aperçu PDF automatique le dépasse largement (facteur ~3,6, inchangé). Ceci
reformule l'idée n°11 sans la remplacer : le blocage réel n'est pas « le formulaire »
mais spécifiquement le rendu automatique du PDF au montage, qui gonfle à la fois le
temps d'événement `load` et le temps jusqu'à l'aperçu visible.

### `/pack` — remesure de l'idée n°24, avec la bonne prémisse

Sélecteur : `.var-editor` (premier champ de saisie réel de `VariableEditor`, le seul
composant d'édition de `/pack` — voir correction ci-dessus).

| Condition | Relevés (ms) |
|---|---|
| Slow 4G + CPU x4 | **2615, 2609, 2631** (run précédent : 2644, 2625, 2645 — cohérent) |

Poids JS/CSS jusqu'à ce même seuil : **770 985 o sur 12 fichiers** — moins de la
moitié du poids de `/` (1 336 006 o), cohérent avec l'absence de Monaco/react-pdf sur
cette route. Malgré ce poids plus faible, `/pack` **dépasse tout de même le seuil de
2,5 s** de `MISSION.md` : moyenne **~2618 ms**, **facteur ~1,05**. Fichier le plus
lourd : `3j9pm5otqxm82.js` (226 355 o), suivi de `373yfygk3klou.js` (138 009 o) et
`3_qs68yr3bjte.css` (109 982 o) — contenu de ces chunks non identifié plus précisément
dans ce réveil (pas de source map lisible depuis le build de production).

## Ce que fait la concurrence sur ce point

- Recherche web (09/08/2026, requête « Rezi Kickresume Teal resume editor slow loading
  time complaints 2026 ») : aucune plainte publique chiffrée sur la lenteur de
  l'éditeur trouvée pour ces trois produits — **non vérifiable sans compte**, comme au
  04/08 et au 31/07.
- Recherche web ciblée (09/08/2026, requête « Kickresume "live preview" resume builder
  how it works HTML CSS instant ») : la documentation publique de Kickresume décrit
  son aperçu comme mettant à jour les changements « instantanément »
  (kickresume.com/en/ et pages de revue tierces consultées le même jour) — renforce,
  sans le confirmer techniquement, l'hypothèse déjà posée le 04/08 d'un aperçu
  HTML/CSS recalculé en direct plutôt qu'un cycle génération-PDF-puis-rastérisation à
  chaque frappe comme celui de CVMatchr. Toujours **aucun détail d'implémentation
  technique public** trouvé chez aucun des trois produits vérifiés (Rezi, Kickresume,
  Teal) — l'hypothèse reste non confirmée au sens strict.
- TTFB des pages marketing (`curl`, 1 relevé le 09/08/2026, non comparable à
  l'interactivité de l'app derrière connexion, à titre indicatif seulement) :
  rezi.ai 200/0,091 s, kickresume.com 302/0,529 s, enhancv.com 200/0,190 s,
  tealhq.com 403 (bloqué), careerflow.ai 200/0,274 s.

## Écart au seuil de MISSION.md

- `/` (éditeur), aperçu PDF (idée n°11) : seuil < 2,5 s. Mesuré **~8977 ms — facteur
  ~3,6**, inchangé depuis le 04/08 (aucun correctif construit). Toujours le
  dépassement le plus sévère de tout l'historique des audits performance.
- `/` (éditeur), formulaire saisissable (nouveau, non couvert par une idée existante) :
  seuil < 2,5 s. Mesuré **~1076 ms — sous le seuil**, aucun dépassement. À noter
  explicitement pour éviter une lecture trop large de l'idée n°11 : ce n'est pas tout
  `/` qui est lent, seulement l'aperçu automatique.
- `/` (éditeur), événement `load` complet (base de l'idée n°21) : seuil < 2,5 s.
  Mesuré **~2774 ms — facteur ~1,11**, sous le facteur 2 de la règle de tranchage de
  `MISSION.md`. Répond à la question ouverte par la justification de l'idée n°21
  (« jamais mesuré contre le seuil de 2,5 s ») : léger dépassement confirmé, mais
  modeste au regard du facteur ~3,6 de l'aperçu PDF.
- `/pack` (idée n°24, prémisse Monaco/react-pdf inexacte — voir correction) : seuil <
  2,5 s. Mesuré **~2618 ms — facteur ~1,05**, un dépassement réel mais le plus faible
  de toutes les mesures de ce réveil. Poids 770 985 o, cause exacte des trois chunks
  les plus lourds non identifiée dans ce réveil.

## Écart à la concurrence

**Toujours non tranchable frontalement** (implémentations internes non publiques),
mais la recherche du jour renforce légèrement le signal indirect déjà posé le 04/08 :
la documentation publique de Kickresume revendique une mise à jour « instantanée » de
son aperçu, cohérent avec une architecture HTML/CSS live plutôt qu'un cycle PDF complet
à chaque frappe — non confirmé techniquement, mais un deuxième indice dans le même
sens que le 04/08.

## Chantiers proposés

1. *(déjà classé, idée n°11 d'`IDEES.md` — pas un nouveau chantier)* : le dépassement
   du facteur ~3,6 sur l'aperçu PDF de `/` est confirmé inchangé. Ce réveil ajoute une
   précision utile pour cadrer une future implémentation : le formulaire lui-même est
   utilisable en ~1,08 s, donc une piste (a) du 04/08 — afficher un aperçu HTML/CSS
   provisoire pendant que le vrai PDF se génère en arrière-plan — n'a pas besoin de
   retarder aussi la saisie, seulement l'aperçu.
2. **Corriger le titre de l'idée n°24 d'`IDEES.md`** — sa mention « Monaco/react-pdf »
   pour `/pack` est fausse depuis la correction de route du 04/08 (`/pack` ne contient
   ni l'un ni l'autre). À reformuler en « Performance `/pack` — poids et temps
   d'interactivité du `VariableEditor` », avec les chiffres de ce réveil : ~2618 ms
   (facteur ~1,05), 770 985 o sur 12 fichiers. Dépassement réel mais modeste — pas
   d'urgence au sens de la règle de tranchage de `MISSION.md` (facteur < 2), mais une
   idée à corriger plutôt qu'à laisser sur une prémisse fausse.
3. **Nouveau : identifier le contenu des trois chunks JS/CSS les plus lourds de
   `/pack`** (`3j9pm5otqxm82.js` 226 355 o, `373yfygk3klou.js` 138 009 o,
   `3_qs68yr3bjte.css` 109 982 o, ensemble 68 % du poids jusqu'à interactif) — non fait
   dans ce réveil faute de source maps lisibles depuis le build de production. Sans
   cette identification, aucun chantier de réduction de poids n'est actionnable pour
   `/pack`. Gain attendu : ramener le dépassement du facteur ~1,05 sous le seuil.
