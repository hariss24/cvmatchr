# Constat — cohérence visuelle au 2026-08-07

**Mesuré par :** lecture directe de `web/src/app/globals.css` (2896 lignes) et
`grep -oE` sur les propriétés `border-radius`, `font-size`, `padding`, `gap` ;
`grep -rn` pour vérifier chaque sélecteur en contexte et son ou ses appelants
(`.tsx`) ; script Node inline (formule de luminance relative WCAG) pour les
contrastes ; `curl` sur le CSS public de Rezi pour comparaison chiffrée.

## Mesures

### 1. Aucun token de rayon d'angle — 19 valeurs distinctes, dont deux qui font le même travail

```
grep -oE "border-radius:\s*[0-9]+(\.[0-9]+)?(px|%)" web/src/app/globals.css | sort | uniq -c | sort -rn
```
19 valeurs distinctes trouvées : 2px, 3px, 4px, 5px, 6px, 8px, 9px, 10px, 11px,
12px (×34, la plus fréquente), 13px, 14px, 16px, 18px, 22px, 24px, 50%, 999px
(×29), et séparément **9999px (×1, ligne 890)** — deux valeurs différentes
pour le même « entièrement arrondi » (999px partout ailleurs). Aucune
variable `--radius-*` n'existe dans `:root` (`grep -n "\-\-radius" globals.css`
→ 0 résultat), contrairement aux couleurs qui, elles, sont toutes tokenisées
(`--bg`, `--orange`, `--border`, etc., ~35 variables).

### 2. Aucun token de taille de texte — 20 valeurs, dont 6 au demi-pixel

```
grep -oE "font-size:\s*[0-9]+(\.[0-9]+)?px" web/src/app/globals.css | sort -u
```
→ 9.5px, 10px, 10.5px, 11px, 11.5px, 12px, 12.5px, 13px, 13.5px, 14px, 14.5px,
15px, 16px, 17px, 18px, 19px, 20px, 22px, 24px, 28px — 20 valeurs, dont **six
demi-pixels** (9.5/10.5/11.5/12.5/13.5/14.5) qui ne peuvent provenir que d'un
ajustement au pixel près, pas d'une échelle voulue (une échelle typographique
usuelle progresse par ratio, pas par pas de 0,5 px). `grep -n "\-\-font-size\|
\-\-fs-\|\-\-text-" globals.css` → 0 résultat : comme pour les rayons, aucun
palier n'est nommé, seul `--font-ui`/`--font-code` (la famille de police,
pas la taille) existe.

Même symptôme sur les espacements, mesuré pour corroborer la cause commune
(absence de tokens de dimension) sans en faire un chantier séparé : 23 valeurs
`padding: Npx` distinctes, 17 valeurs `gap: Npx` distinctes.

### 3. Une couleur d'état sortie du système de thème — `.ats-mid` figée à `#f5a623`

```
grep -n "ats-ok\|ats-mid\|ats-low" web/src/app/globals.css
```
```
.ats-score-circle.ats-ok  { background: var(--success); }
.ats-score-circle.ats-mid { background: #f5a623; }
.ats-score-circle.ats-low { background: var(--error); }
```
(même trio répété pour `.ats-axis-score` et `.ats-axis-fill`, 3 occurrences au
total de `#f5a623`.) `--success` et `--error` sont tous deux redéfinis dans
`[data-theme="dark"]` (`--success: #256D2A` → `#66BB6A`, `--error: #C62828` →
`#EF5350`) : le trio « bon / moyen / mauvais » d'un même composant
(`AtsPanel.tsx:29`, `scoreClass()`) a donc deux membres qui s'éclaircissent en
thème sombre et un troisième qui reste identique au pixel près dans les deux
thèmes. Chiffré (formule de luminance relative WCAG, fond = `--bg` du thème) :

| État | Couleur (clair) | Contraste vs fond clair | Couleur (sombre) | Contraste vs fond sombre |
|---|---|---|---|---|
| ats-ok | #256D2A | 6,10:1 | #66BB6A | 6,68:1 |
| **ats-mid** | **#f5a623** | **1,94:1** | **#f5a623 (inchangé)** | **7,79:1** |
| ats-low | #C62828 | 5,39:1 | #EF5350 | 4,53:1 |

Les deux tokens font varier leur contraste de ±0,6 à ±0,9 point d'un thème à
l'autre (ajustement voulu et cohérent) ; la couleur figée, elle, saute de
1,94:1 à 7,79:1 (**×4**) — un écart que personne n'a choisi, produit
mécaniquement par un fond qui change de thème sous une couleur qui, elle, n'en
change pas. Confirmé actif : `AtsPanel.tsx:29` utilise bien `scoreClass()`
pour les CV entre 45 et 69/100, une plage courante.

### 4. Le bouton d'action orange (`--cta-grad`) redéfini dans 10 sélecteurs séparés au lieu d'une classe partagée

```
grep -n "cta-grad" web/src/app/globals.css
```
Une classe partagée existe (`.btn-orange`, ligne 229), mais `var(--cta-grad)`
est réappliqué indépendamment dans au moins 10 autres sélecteurs qui ne
l'utilisent pas : `.logo-icon-inner`, `.tailor-btn`, `.type-badge.type-cv`,
`.flt-go`, `.flt-count`, `.scan-progress-fill` (×2), `.diffx-tag--after`,
`.job-fresh`, `.job-cta`. Conséquence directe de cette duplication plutôt que
d'une classe unique : la couleur du texte dessus diverge d'un sélecteur à
l'autre sans qu'aucun ne l'ait décidé — `grep -n "on-orange" globals.css`
montre que le jeton `--on-orange` (créé pour corriger le contraste du texte
sur ce dégradé, cf. idée n°6 déjà classée dans `IDEES.md`) n'est repris que
par **1 des ~13 blocs** qui posent ce fond (`.diffx-tag--after`, ligne 2434) ;
les autres (ex. lignes 1394, 1440, 2855) écrivent encore `color: #fff` en dur.
Ce constat ne redouble pas l'idée n°6 (qui porte sur le contraste du texte) :
il explique pourquoi le correctif, une fois fait à un endroit, ne s'est pas
propagé — il n'existe pas de composant bouton unique à corriger une fois.

## Ce que fait la concurrence sur ce point

- **Rezi** (site public, `https://www.rezi.ai/`, consulté le 07/08/2026) :
  CSS de production téléchargé directement (`cdn.prod.website-files.com/…
  .opt.min.css`, 772 004 octets). Sur 50 déclarations `border-radius`, 47
  suivent un pas régulier de 0,25 rem (.25rem ×8, .5rem ×10, .75rem ×11, 1rem
  ×10, 1.25rem ×5, 1.5rem ×1), les 3 restantes étant `50%` (cercles) ou des
  valeurs isolées (.63rem, .38rem, .125rem). Contre les 19 valeurs sans pas
  commun de CVMatchr. Réserve : c'est le site marketing (Webflow), pas
  l'éditeur derrière connexion — non vérifiable pour ce dernier.
- **Kickresume** (page d'accueil publique, `https://www.kickresume.com/`,
  consultée le 07/08/2026, lecture qualitative faute d'accès au CSS compilé) :
  palette resserrée (bleu/gris/blanc), motifs répétés (cartes, icônes SVG),
  mais échelle typographique elle-même décrite comme « hiérarchie flexible »
  plutôt que paliers fixes — signal plus faible que celui de Rezi, à traiter
  comme une observation qualitative et non comme une mesure.
- Aucun des huit produits de référence n'expose son design system (Storybook,
  charte) publiquement à ma connaissance — recherché, non trouvé pour Jobscan,
  Teal, Huntr, Enhancv, Careerflow, Simplify (Jobscan et Simplify renvoient
  HTTP 403 au robot, Careerflow redirige, Enhancv et Huntr n'exposent pas de
  CSS statique récupérable sans exécuter leur JS).

## Écart au seuil de MISSION.md

Aucun seuil chiffré de `MISSION.md` ne porte spécifiquement sur la cohérence
visuelle (contrairement aux contrastes AA ou aux temps de chargement) — ce
domaine relève de la priorité n°1 de l'« Ordre des priorités » : « Finition
professionnelle — l'application donne l'impression d'un produit fini ». Une
échelle de tailles/rayons sans palier commun et une couleur d'état qui se
comporte différemment de ses deux voisines sont exactement le genre de détail
qui, cumulé, donne une impression de bricolage plutôt que de produit fini,
sans qu'aucun d'eux, pris seul, ne soit un bug visible.

## Écart à la concurrence

En retard sur la discipline d'échelle (rayons), au moins face à Rezi — seule
comparaison chiffrée obtenue. Le reste (couleur d'état figée, duplication du
bouton CTA) est un défaut interne à CVMatchr, sans équivalent observable chez
la concurrence dont le code n'est pas public.

## Chantiers proposés

1. Introduire des variables `--radius-sm/md/lg/pill` dans `:root` et
   remplacer les 19 valeurs `border-radius` en dur (dont l'incohérence
   999px/9999px) — gain attendu : une seule décision de design à changer pour
   tout le produit, plus l'incohérence 999px/9999px corrigée mécaniquement.
2. Introduire une échelle `--font-size-xs/sm/base/md/lg/xl` et remplacer les
   20 valeurs en dur, en particulier les six valeurs au demi-pixel qui ne
   peuvent correspondre à aucun choix de design délibéré.
3. Faire de `.ats-mid` un token de thème (`--warning` existe déjà et couvre le
   même rôle sémantique « état intermédiaire », ou un nouveau `--score-mid` si
   `--warning` porte un sens distinct ailleurs) plutôt qu'une couleur figée
   `#f5a623`, pour que les trois états du score ATS varient ensemble entre
   thème clair et sombre.
4. Extraire une classe unique `.btn-primary` (ou généraliser `.btn-orange`)
   pour les ~13 blocs qui posent aujourd'hui `var(--cta-grad)`
   indépendamment, de sorte qu'un correctif comme celui de l'idée n°6
   (`--on-orange`) se propage partout en une seule modification plutôt qu'en
   nécessitant de retrouver chaque occurrence un jour à la fois.
