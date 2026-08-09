# Constat — accessibilité au 2026-08-05

**Mesuré par :**

- `npx pa11y --config pa11y.json --reporter json -e axe -s WCAG2AA <url>` (pa11y
  9.1.1, moteur `axe-core` via `axe-puppeteer`, norme WCAG2AA), `pa11y.json` :
  `{"chromeLaunchConfig":{"args":["--no-sandbox","--disable-setuid-sandbox"]}}`
  (sandbox Chrome indisponible dans l'environnement, sans effet sur le résultat du
  scan). Serveur cible : `npm run dev` (Next.js 16.2.9 / Turbopack), aucune variable
  `REMOTE_AUTH_PASSWORD`/`AUTH_PASSWORD` définie donc pas de gate de connexion.
- Pour chaque résultat `color-contrast` marqué `needsFurtherReview` par axe (cas des
  arrière-plans en dégradé CSS ou en pile d'ancêtres, qu'axe ne résout pas seul en
  DOM headless) : script Node + Puppeteer dédié qui lit
  `getComputedStyle(el).color`/`.backgroundImage`/`.backgroundColor` sur l'élément
  réel rendu, remonte les ancêtres jusqu'à un fond opaque, extrait les couleurs de
  départ/arrivée d'un `linear-gradient(...)` le cas échéant, et calcule le ratio de
  contraste selon la formule WCAG 2 (`(L1+0.05)/(L2+0.05)`, `L` = luminance relative
  sRGB). Chaque ratio ci-dessous est donc une mesure directe des couleurs réellement
  affichées, pas une estimation.
- Focus clavier : `page.focus(selecteur)` (Puppeteer) puis lecture de
  `getComputedStyle(el).outline`/`.boxShadow` sur l'élément réellement focusé.
- Code source : lecture directe de `web/src/app/globals.css` et
  `web/src/components/form/FormEditor.tsx` pour chaque défaut, avec numéro de ligne.

## Mesures

### 1. Labels de formulaire non associés (CV editor, `/`)

`pa11y` (axe) : **36 erreurs `label`** (« Form elements must have labels », impact
*critical*) + **1 erreur `label-title-only`** sur la page `/` (formulaire CV par
défaut). Cause unique identifiée dans le code : le composant `Field`
(`web/src/components/form/FormEditor.tsx:400-425`) rend un `<label className="form-label">{label}</label>`
sans `htmlFor`, à côté d'un `<input>` sans `id` — l'association est purement
visuelle (proximité CSS), jamais programmatique. Un lecteur d'écran annonce
« champ de texte vide », sans nom, pour chacun des champs générés par ce composant
partagé (nom, titre de poste, ville, email, téléphone, LinkedIn, chaque
expérience/formation/compétence/loisir…). Reproductible :
```
grep -n "form-label" web/src/components/form/FormEditor.tsx
# ligne 415 : <label className="form-label">{label}</label>, aucun htmlFor
```
Le 37e signalement (`label-title-only`) concerne `<select class="toolbar-select" title="Charger un modèle">` :
son seul nom accessible vient de l'attribut `title` (infobulle au survol), sans
label visible ni `aria-label` — un utilisateur clavier voit un menu déroulant sans
étiquette à l'écran.

### 2. Contraste insuffisant — texte secondaire (`--faint`)

`web/src/app/globals.css:15` (thème clair) et `:73` (thème sombre) :
```
--faint: #9A9187;   /* clair,  sur --bg: #FBFAF8 */
--faint: #857D72;   /* sombre, sur --bg: #26221E */
```
Ratios de contraste calculés (formule ci-dessus, mêmes valeurs hex que le code) :

| Thème | Couleur texte | Fond | Ratio mesuré | Seuil AA texte normal |
|---|---|---|---|---|
| Clair | `--faint` `#9A9187` | `--bg` `#FBFAF8` | **2,97:1** | 4,5:1 |
| Sombre | `--faint` `#857D72` | `--bg` `#26221E` | **3,89:1** | 4,5:1 |

Les deux thèmes échouent. Confirmé en direct sur `/candidatures` (thème clair,
rendu réel, pas seulement le calcul CSS) : 5 occurrences de `.app-tile__hint`
(« aucune pour l'instant », « moins de 30 jours », « réponses positives »,
« 0 réponses sur 0 », « silence > 30 jours ») et 5 occurrences de
`.app-chip__count` (« 0 »), toutes mesurées à `rgb(154,145,135)` sur
`rgb(251,250,248)`, ratio **2,97:1**. `--faint` est utilisée par **17 déclarations
CSS distinctes** dans `globals.css` (`grep -n "var(--faint)" web/src/app/globals.css`
→ 17 lignes) : indices de champ, placeholders, sous-titres de menu, badges de date —
du texte réellement porteur d'information, pas décoratif, sur au moins deux écrans
mesurés directement (`/`, `/candidatures`).

### 3. Contraste insuffisant — texte blanc sur bouton orange (`--cta-grad` / `.btn-orange`)

`web/src/app/globals.css:42-43` (thème clair) :
```
--cta-grad: linear-gradient(180deg, var(--orange2), var(--orange));
/* --orange2: #F07030, --orange: #E85D04 */
```
`.btn-orange { background: var(--cta-grad); color: #fff; }` (`globals.css:229-233`).
Ratios mesurés (texte blanc `#FFFFFF` contre chaque extrémité du dégradé, taille de
police confirmée par `getComputedStyle` — 13-13,5px, graisse 600-700, donc **texte
normal**, seuil 4,5:1, pas 3:1) :

| Élément | Sélecteur / page | Taille police | Ratio haut du dégradé | Ratio bas du dégradé |
|---|---|---|---|---|
| « Télécharger » | `.go.go-top`, `/` | 13px / 700 | 2,97:1 | 3,50:1 |
| « Adapter à une offre » | `.btn-nav.btn-orange`, `/` | 13px / 600 | 2,97:1 | 3,50:1 |
| « Ajouter » | `.btn-nav.btn-orange`, `/candidatures` | 13px / 600 | 2,97:1 | 3,50:1 |
| « Rechercher » | `.flt-go`, `/jobs` | 13,5px / 600 | 2,97:1 | 3,50:1 |

Tous en dessous de 4,5:1. La variable `--cta-grad` est utilisée dans **14
déclarations CSS distinctes** de `globals.css` (`grep -n "var(--cta-grad)"` → 14
lignes) : boutons d'action principaux dans au moins 3 écrans (`ActionsBar.tsx`,
`AddApplicationModal.tsx`, `ApplicationsScreen.tsx`, la barre du haut). Fait notable :
une variable `--on-orange: #201200` existe déjà dans le thème
(`globals.css:22` et `:78`, identique dans les deux thèmes) et n'est utilisée qu'à
un seul endroit (`globals.css:2434`, une étiquette de diff). Recalculée sur les
mêmes couleurs de dégradé : `#201200` sur `#F07030` = **6,15:1** ; sur `#E85D04` =
**5,23:1** — un jeton de couleur déjà présent dans le code passerait AA aux deux
extrémités du même dégradé, là où le blanc échoue.

### 4. Indicateur de focus clavier supprimé (chasseur d'offres, `/jobs`)

`web/src/app/globals.css:1549-1550` :
```css
.flt-box .ui-input { background: none; box-shadow: none; padding: 6px 0; font-size: 13.5px; }
.flt-box .ui-input:focus { box-shadow: none; }
```
Cette règle plus spécifique écrase l'anneau de focus par défaut défini pour
`.ui-input:focus` (`globals.css:379-381`, `box-shadow: var(--neu-inset), 0 0 0 3.5px rgba(232,93,4,0.16)`),
sans rien y substituer. Confirmé en direct par focus programmatique réel sur le
champ « Où » de `/jobs` :
```
outline: "rgb(31, 27, 22) none 3px"   // outline-style: none → jamais dessiné
boxShadow: "none"
```
Un utilisateur clavier qui tabule jusqu'au champ de lieu de la recherche d'offres
n'a **aucun indice visuel** qu'il y est arrivé. Même défaut, non déclenché en
direct (élément conditionnel, n'apparaît que quand le lieu cible une commune
précise — `globals.css:1382-1390`, commentaire du code) mais confirmé par lecture
du CSS : `.flt-radius select { outline: none; ... }` (`globals.css:1387-1390`),
aucune règle `:focus` ni `:focus-visible` nulle part dans le fichier pour ce
sélecteur (`grep -n "flt-radius" web/src/app/globals.css` → seulement les deux
déclarations de base, aucune pour `:focus`).

### 5. Aperçu PDF non focusable au clavier

`pa11y` (axe) : 1 erreur `scrollable-region-focusable` sur `/`, cible
`<div class="pdf-preview" data-testid="pdf-preview">` contenant le `<canvas>` de
rendu. Une zone défilante sans `tabindex` ne peut pas recevoir le focus clavier :
un utilisateur clavier seul ne peut pas faire défiler l'aperçu de son propre CV
avec les flèches, seulement à la souris/au tactile.

### Récapitulatif des faux positifs axe (pour ne pas gonfler artificiellement le compte)

Sur les **44 signalements `color-contrast`** relevés par `pa11y`/axe sur les 3 pages
testées (`/` : 25, `/jobs` : 4, `/candidatures` : 15), tous marqués
`needsFurtherReview` par axe (dégradés ou piles d'ancêtres qu'il ne résout pas
seul), la vérification manuelle par calcul direct des couleurs réellement rendues
confirme **13 échecs réels** (2 sur `/`, 0 sur `/jobs`, 11 sur `/candidatures` — les
cas 2, 3 et 4 ci-dessus) et **31 faux positifs** (texte gris `#6C6559` sur fond
clair à 5,51-16,86:1, largement conforme — axe signale par prudence sans pouvoir
confirmer en environnement headless). Les 13 échecs réels se ramènent à deux causes
uniques (`--faint`, `--cta-grad`/blanc), pas à 13 défauts indépendants.

## Ce que fait la concurrence sur ce point

Aucun des 8 produits de référence n'expose son produit authentifié sans compte —
seules leurs pages publiques (accueil/marketing) sont vérifiables sans créer de
compte, contrairement à CVMatchr qui ne demande pas de connexion par défaut. Chaque
page publique scannée avec le **même outil, la même configuration**
(`pa11y --config pa11y.json --reporter json -e axe -s WCAG2AA <url>`, 2026-08-05) :

| Produit | URL consultée | Total | `color-contrast` | Autres erreurs notables |
|---|---|---|---|---|
| Jobscan | https://www.jobscan.co/ | 56 | 55 | 1 `frame-tested` |
| Teal | https://www.tealhq.com/ | 29 | 26 | 2 `aria-valid-attr-value`, 1 `nested-interactive` |
| Rezi | https://www.rezi.ai/ | 223 | 218 | 3 `link-name`, 1 `aria-prohibited-attr`, 1 `aria-required-children` |
| Huntr | https://huntr.co/ | 12 | 8 | 3 `scrollable-region-focusable`, 1 `frame-tested` |
| Kickresume | https://www.kickresume.com/en/ | 154 | 130 | 15 `aria-hidden-focus`, 3 `link-in-text-block`, 2 `frame-tested`, 2 `frame-title-unique`, 1 `label`, 1 `duplicate-id-aria` |
| Enhancv | https://enhancv.com/ | 70 | 68 | 1 `aria-prohibited-attr`, 1 `aria-valid-attr-value` |
| Careerflow | https://www.careerflow.ai/ | 44 | 24 | 10 `link-name`, 5 `aria-valid-attr-value`, 2 `button-name`, 2 `image-alt`, 1 `aria-hidden-focus` |
| Simplify | https://simplify.jobs/ | 54 | 54 | — |

**8 produits sur 8** ont des défauts de contraste automatiquement détectables sur
leur seule page publique (sans même compter ce qui pourrait exister derrière un
compte) — le contraste insuffisant n'est donc pas un point de retard propre à
CVMatchr face au marché, c'est un défaut quasi universel du secteur. En revanche
l'absence totale d'association `<label>`/`<input>` sur **36 champs d'un même
formulaire** (CVMatchr) n'a d'équivalent direct chez aucun des 8 sur leur page
publique (1 seule erreur `label` chez Kickresume, sur un tout autre élément) — mais
cette comparaison reste partielle : **non vérifiable sans compte** pour leurs
propres formulaires de CV derrière connexion, qui sont l'équivalent direct de
`FormEditor.tsx` et n'ont pas pu être testés.

Huntr partage avec CVMatchr le même défaut de catégorie `scrollable-region-focusable`
(3 occurrences sur sa page publique) — CVMatchr n'est pas seul sur ce point précis.

## Écart au seuil de MISSION.md

Seuil : « parcours principaux navigables au clavier seul, contrastes AA ».

- **Contrastes AA** : dépassé sur au moins 2 causes systémiques (`--faint`,
  `--cta-grad`/blanc), confirmées sur 3 écrans (`/`, `/jobs`, `/candidatures`) et 2
  thèmes (clair et sombre) pour `--faint`. Ratios mesurés 2,97-3,89:1 contre un
  seuil de 4,5:1 — pas un léger dépassement, un facteur de déficit de 1,15 à 1,5×
  selon les combinaisons.
- **Navigable au clavier seul** : dépassé sur le chasseur d'offres (`/jobs`) —
  focus invisible sur le champ de lieu, confirmé en direct — et sur l'aperçu PDF de
  l'éditeur (`/`), non focusable du tout. Les 36 champs sans label ne bloquent pas
  la navigation Tab elle-même (l'ordre de tabulation reste correct, seul le nom
  annoncé manque) mais rendent le parcours principal (remplir son CV) inutilisable
  à la voix/lecteur d'écran, un mode de navigation que le seuil de `MISSION.md`
  couvre implicitement (« au clavier seul » suppose de savoir où l'on se trouve).

## Écart à la concurrence

- **En retard, mais pas seul** : contraste AA — 8/8 produits de référence ont des
  défauts de contraste automatiquement détectables sur leur page publique.
  CVMatchr est à parité de méthode de mesure, pas en avance ni en net retard sur ce
  point précis.
- **Non vérifiable sans compte** : association label/input sur le formulaire de
  CV lui-même chez les 8 concurrents (page derrière connexion) — impossible de dire
  si CVMatchr est pire ou pareil sur ce point précis, faute d'accès à leur éditeur
  réel.
- **En avance sur un point** : contrairement à Kickresume, Rezi, Enhancv et
  Careerflow (defaults `link-name`/`button-name`/`image-alt` détectés sur leurs
  pages publiques), aucune de ces trois catégories n'est apparue sur les 3 pages
  CVMatchr testées.

## Chantiers proposés

1. Associer chaque `<label>` à son `<input>` dans le composant partagé `Field`
   (`FormEditor.tsx:400-425`) — gain attendu : correction d'un seul composant
   réutilisé, les 36 signalements `label` de `/` disparaissent d'un coup (à
   vérifier si d'autres écrans réutilisent le même composant ou un équivalent,
   pas vérifié ici).
2. Remplacer le texte blanc par le jeton `--on-orange` (déjà défini, déjà à
   5,2-6,2:1 sur les mêmes dégradés) sur `.btn-orange`/`.go.go-top`/`.flt-go` —
   gain attendu : les 4 boutons mesurés passent d'environ 3:1 à plus de 5:1, zéro
   nouvelle variable à créer.
3. Assombrir `--faint` dans les deux thèmes jusqu'à 4,5:1 (ou réserver la variable
   au texte réellement décoratif et créer une variable dédiée pour le texte
   porteur d'information) — gain attendu : au moins 17 déclarations CSS
   concernées, mesuré sur 2 écrans.
4. Retirer `box-shadow: none` de `.flt-box .ui-input:focus` (`globals.css:1550`)
   et ajouter une règle `:focus`/`:focus-visible` à `.flt-radius select`
   (`globals.css:1387`) — gain attendu : le champ de recherche d'offres redevient
   navigable au clavier avec un repère visuel.
5. Ajouter `tabindex="0"` (et un `aria-label` décrivant le contenu) au conteneur
   `.pdf-preview` — gain attendu : l'aperçu PDF devient défilable au clavier.
