# Pack candidature — refonte en page pleine largeur avec éditeur à étiquettes

**Date :** 2026-07-10
**Statut :** conception validée avec l'utilisateur, prête pour le plan d'implémentation.

## Problème

La modale « Pack candidature » est enterrée à deux niveaux (elle s'ouvre à
l'intérieur de la modale « Adapter à une offre »), ce qui la rend étroite. Elle
affiche tout en même temps : sélecteur de modèle + gestion, 3 variables,
extracteur d'offre, **6 champs texte d'édition** (objet/appel/corps/politesse de
la lettre, objet/corps de l'email) et les aperçus. L'utilisateur la décrit comme
« incompréhensible ».

Référence citée : l'éditeur de lettre de Candiboost — une seule zone qui sert à la
fois d'éditeur et d'aperçu, où les variables (Poste, Entreprise, Nom…) sont des
**étiquettes colorées à l'intérieur du texte**, qu'on insère en cliquant et qu'on
efface comme un mot.

## Objectif

Remplacer la modale par une **page `/pack` pleine largeur** dont le cœur est un
**éditeur à étiquettes** (variables inline), à la place du bloc « 6 champs séparés
+ aperçu séparé pour éditer ». La lettre PDF formelle reste la sortie finale.

## Non-objectifs (YAGNI)

- Pas de bibliothèque de modèles à la Candiboost (barre latérale de cartes). Un
  seul modèle sert pour l'instant ; le **système de modèles reste en base** pour
  un usage futur, mais l'UI ne le met pas en avant.
- Pas de refonte de la modale « Adapter à une offre » (TailorModal) : hors
  périmètre, on ne touche qu'à son bouton d'entrée vers le Pack.
- Aucune dépendance npm ajoutée : l'éditeur à étiquettes est **fait maison**
  (décision validée avec l'utilisateur).
- On ne supprime aucune fonctionnalité existante du Pack (parité, voir plus bas).

## Décisions actées avec l'utilisateur

1. Structure : **page dédiée `/pack`**, pleine largeur, avec un bouton
   « ← Retour » toujours présent qui ramène à la page précédente.
2. Édition : **éditeur à étiquettes** WYSIWYG (variables inline) pour la lettre
   et pour l'email, à la place des 6 champs séparés.
3. Aperçu : la **lettre PDF formelle** (en-tête, date, adresse, valeurs
   substituées) reste affichée à droite comme rendu final.
4. Un seul modèle par défaut, infra modèles conservée (rien en dur).
5. Éditeur à étiquettes construit **sans dépendance** (custom `contentEditable`).

---

## Composant central : `VariableEditor` (l'éditeur à étiquettes)

Nouveau composant réutilisable (lettre ET email l'utilisent).

### Contrat

```ts
function VariableEditor(props: {
  value: string;                 // chaîne tokenisée, ex. "Bonjour {M/Mme Nom}, … {Poste}"
  onChange: (next: string) => void;
  variables: readonly string[];  // chips proposées (TEMPLATE_VARIABLES)
  disabled?: boolean;
  ariaLabel: string;
  minHeightPx?: number;
}): JSX.Element
```

- **Source de vérité** : la chaîne tokenisée `value` (contrôlée par le parent).
  Le token conserve la syntaxe existante `{Variable}` **ou** `{Variable|repli}`
  (`render.ts`). Le composant ne réinvente pas le rendu : il édite cette chaîne.
- **Rendu** : le composant parse `value` en segments (texte / token) et affiche
  chaque token comme une pastille inline `contentEditable={false}`
  (`<span class="var-pill" data-token="{…}">Nom</span>`), le reste comme texte
  éditable. La pastille affiche **le nom de la variable** (partie avant `|`) ;
  l'attribut `data-token` conserve le token brut complet, repli inclus.

### Comportements

- **Insertion** : au clic sur une chip « + Poste », insertion d'une pastille
  `{Poste}` (sans repli) à la position du curseur, puis curseur replacé après la
  pastille.
- **Suppression** : la pastille étant `contentEditable={false}`, un `Backspace`
  la supprime en un bloc (atomique), comme un caractère.
- **Sérialisation** : à chaque saisie (`onInput`), le DOM est reconverti en chaîne
  tokenisée (texte des nœuds texte + `data-token` des pastilles) et remonté via
  `onChange`. Le token brut est réémis verbatim → le repli
  `{M/Mme Nom|Madame, Monsieur}` d'un modèle existant est préservé même sans être
  affiché.
- **Synchronisation externe** : quand `value` change pour une raison externe
  (changement de modèle, « Adapter à l'offre (IA) »), le DOM est reconstruit
  depuis `value` et le curseur remis en fin. Détection : on ne reconstruit que si
  `value` diffère de la dernière chaîne sérialisée émise (évite le saut de curseur
  pendant la frappe — piège classique du `contentEditable` contrôlé).
- **Collage** : `onPaste` force le texte brut (`insertText`) pour ne jamais
  injecter de HTML dans l'éditeur.
- **Accessibilité** : `role="textbox"`, `aria-multiline="true"`, `aria-label`
  fourni ; chips d'insertion = vrais `<button>` avec libellé.

### Cas limites reconnus

Curseur en frontière de pastille, éditeur vide, pastille en tout début/fin :
gérés en garantissant un nœud texte éditable autour des pastilles et en normalisant
la sélection après insertion. Pour une lettre courte à 5-6 variables, ce périmètre
est suffisant (constat validé avec l'utilisateur ; une brique d'édition externe
reste l'option de repli si un cas limite gêne à l'usage).

### CSS

Nouvelle classe `.var-editor` (zone éditable, mêmes tokens de thème que
`.form-textarea` : fond `var(--bg)`, `box-shadow: var(--neu-inset)`, rayon,
padding) et `.var-pill` (pastille : fond discret, `var(--orange-text)` ou une
teinte de variable, rayon 999px, `user-select: none`). Réutilise la logique
d'insertion déjà présente dans `.tpl-vars` / `.var-btn` (barre de chips).

---

## Page `/pack`

### Structure (fichiers)

- **Créer** `src/app/pack/page.tsx` : page serveur légère (métadonnées + `<PackView />`),
  sur le modèle de `src/app/jobs/page.tsx` (`.wrap` + `.topbar--secondary`).
- **Créer** `src/components/pack/PackView.tsx` : composant client portant toute la
  logique aujourd'hui dans `PackModal.tsx` (chargement modèles, variables, build
  lettre/email, aperçu PDF debouncé, adaptation IA, insertion éditeur, copie
  email), **sans** le châssis de modale (`.ui-overlay`/`.ui-dialog`).
- **Créer** `src/components/pack/VariableEditor.tsx` : le composant ci-dessus.
- **Modifier** `src/components/pack/TemplateEditorPanel.tsx` : réécrit pour
  utiliser `VariableEditor` sur les champs longs (corps lettre, corps email…) au
  lieu de `<textarea>` bruts. Placé dans la zone « Personnaliser » (repliée).
- **Supprimer** `src/components/modals/PackModal.tsx` : remplacé par `PackView`
  (logique déplacée, pas perdue).

### En-tête

`topbar--secondary` : titre « Pack candidature » + bouton « ← Retour ». Le retour
utilise `router.back()` (revient à la page précédente : éditeur ou Offres) avec
repli sur `/` si l'historique est vide (accès direct).

### Disposition (deux colonnes, pleine largeur)

```
┌─────────────────────────────────────────────────────────┐
│ ← Retour            Pack candidature                     │
├───────────────────────────────┬─────────────────────────┤
│  Entreprise  [_____________]  │   Lettre de motivation  │
│  Poste       [_____________]  │   ┌───────────────────┐ │
│  Contact     [_____________]  │   │  aperçu PDF final │ │
│                               │   │  (valeurs remplies)│ │
│  ▸ Adapter à une offre (opt.) │   └───────────────────┘ │
│    zone offre + Extraire      │   [Insérer dans l'édit.] │
│    [✨ Adapter à l'offre (IA)]│                         │
│                               │   Email d'accompagnement│
│  CORPS DE LA LETTRE           │   (éditeur à étiquettes) │
│  Variables:[+Poste][+Entrep.] │   Variables:[+Poste]…    │
│  ┌───────────────────────────┐│   ┌───────────────────┐ │
│  │Bonjour (M/Mme Nom),       ││   │Bonjour (M/Mme Nom)││ │
│  │… pour (Poste) au sein de  ││   │…                  ││ │
│  │(Entreprise).              ││   └───────────────────┘ │
│  └───────────────────────────┘│   [📋 Copier l'email]   │
│  ▸ Personnaliser (objet, appel│                         │
│    politesse, objet email…)   │                         │
└───────────────────────────────┴─────────────────────────┘
```

- **Colonne gauche (composer)** : variables (Entreprise/Poste/Contact,
  auto-remplies), zone offre repliable (extracteur + textarea + bouton IA), puis
  **l'éditeur à étiquettes du corps de la lettre** et **celui de l'email**, avec
  leur rangée de chips. Les champs secondaires (objet lettre, formule d'appel,
  formule de politesse, objet email) sont regroupés sous un dépliant
  « Personnaliser » (fermé par défaut), tout comme la gestion de modèles
  (Enregistrer / Dupliquer / Supprimer) et le sélecteur de modèle.
- **Colonne droite (rendu)** : aperçu **PDF de la lettre finale** (variables
  substituées par leurs valeurs) + « Insérer dans l'éditeur (Lettre) » ; aperçu
  de l'email.
- **Mobile** : une seule colonne pleine largeur, composer puis rendu dessous.
  Réutilise les points de rupture existants (`@media`) du CSS Pack.

### Sélecteur de modèle (discret)

Un simple `<select>` dans la zone « Personnaliser », **affiché seulement s'il
existe plus d'un modèle** en base. Avec l'unique modèle par défaut, il n'apparaît
pas — l'UI reste épurée sans casser l'infra multi-modèles.

---

## Points d'entrée (rewiring)

- **Modifier** `src/components/modals/TailorModal.tsx` : le bouton « Créer le Pack
  candidature » ne monte plus `<PackModal>` en interne. Il stocke l'offre courante
  via `setPendingJobDesc(jobDesc)` puis navigue (`router.push('/pack')`) et ferme
  TailorModal. On retire l'état `packOpen` et l'import/rendu de `PackModal`.
- **Modifier** `src/components/jobs/JobsView.tsx` (`apply`, l.148-155) : « Candidater »
  ne passe plus par `setPendingPackOpen(true)` + `router.push('/')`. Il fait
  `setPendingJobDesc(job.jobText)` (+ company/role) puis `router.push('/pack')`.
- **`PackView`** consomme `pendingJobDesc` à l'initialisation (comme le faisait
  PackModal via `initialJobDesc`), puis le remet à `null`.
- **Nettoyage** `src/state/docStore.ts` : `pendingPackOpen` / `setPendingPackOpen`
  ne sont plus utilisés → suppression du champ, du setter et de leurs types. (Si
  un test ou un fichier y fait encore référence, il est mis à jour dans le même
  lot.)

---

## Parité fonctionnelle (rien de supprimé)

Toutes ces fonctions du Pack actuel restent présentes dans `PackView` :

| Fonction | Devient |
|---|---|
| Variables Entreprise/Poste/Contact (auto-remplies) | inchangé (inputs en haut à gauche) |
| Extraction d'offre par URL (`JobExtractor`) + préremplissage | inchangé (zone offre repliable) |
| « Adapter à l'offre (IA) » (`/api/adapt-letter`, photo jamais envoyée) | inchangé |
| Édition du corps lettre / corps email | via **VariableEditor** (étiquettes) |
| Édition objet/appel/politesse/objet email | via « Personnaliser » (champs courts) |
| Aperçu PDF lettre (debounce 600 ms) | inchangé (colonne droite) |
| « Insérer dans l'éditeur (Lettre) » | inchangé (`router.push('/')` après chargement) |
| Aperçu + « Copier l'email » | inchangé |
| Enregistrer / Dupliquer / Supprimer modèle | déplacé sous « Personnaliser » |

Contrainte transverse conservée : **la photo (base64) n'est jamais envoyée à
l'IA** (`{ ...cv, photo: "" }` dans `adaptWithAi`).

---

## Données / modèles

- **Modifier** `src/lib/templates/defaults.ts` : `DEFAULT_TEMPLATES` réduit à **un
  seul** modèle « Candidature » (texte passe-partout candidature spontanée /
  réponse à une offre). Les deux autres entrées sont retirées du tableau. La
  structure `MailTemplate`, `ensureDefaultTemplates`, `listTemplates`,
  `saveTemplate`, `deleteTemplate` sont **inchangées** (infra multi-modèles
  préservée). Note : les modèles déjà semés dans l'IndexedDB d'un utilisateur
  existant ne sont pas supprimés (non destructif) ; le sélecteur discret les
  laisse accessibles.
- Le moteur `renderTemplate` / `buildLetterFromTemplate` / `renderEmail`
  (`render.ts`, `build.ts`) est **inchangé** : le `VariableEditor` produit
  exactement la même chaîne tokenisée qu'aujourd'hui.

---

## Tests

- **`tests/e2e/pack.spec.ts`** : mis à jour pour le nouveau point d'entrée — le
  Pack s'ouvre désormais en naviguant vers `/pack` (depuis « Créer le Pack
  candidature » ou directement). L'assertion « 3 modèles seedés » devient « 1
  modèle » (seed réduit). Les vérifications métier (email construit sans IA,
  repli « Bonjour, » quand contact vide, aperçu PDF, adaptation IA) sont
  conservées, adaptées au nouveau layout.
- **Nouveau test e2e ciblé du `VariableEditor`** : insérer une variable via une
  chip crée une pastille dans le texte ; supprimer la pastille (Backspace) la
  retire ; la chaîne sérialisée contient bien `{Poste}` ; un modèle chargé avec
  `{M/Mme Nom|Madame, Monsieur}` affiche la pastille « M/Mme Nom » et **préserve
  le repli** après une édition (sérialisation round-trip).
- **`tests/e2e/jobs.spec.ts`** : si un test couvre « Candidater » → Pack, il est
  mis à jour pour attendre l'URL `/pack` au lieu de l'ouverture de la modale.
- Tests unitaires Vitest existants sur `render`/`build`/`db` : **inchangés**
  (logique non modifiée) ; ils doivent rester verts.
- Vérification finale complète : `tsc --noEmit`, `lint`, `vitest run`, `build`,
  `playwright test` (protocole `CADRAGE_EXECUTION.md`).

---

## Risques

1. **`contentEditable` fait maison** — risque principal. Mitigé par : pastilles
   atomiques (`contentEditable={false}`), collage forcé en texte brut,
   synchronisation externe conditionnelle (anti-saut de curseur), périmètre
   volontairement réduit (lettre courte, 6 variables). Repli documenté : brique
   d'édition externe si un cas limite gêne réellement.
2. **Préservation du repli `{Var|…}`** — assurée en stockant le token brut dans
   `data-token` et en le réémettant verbatim (couvert par un test round-trip).
3. **Piège Turbopack/CSS périmé (Windows)** — nouvelle classe CSS `.var-editor` /
   `.var-pill` : purger `web/.next` et le serveur `:3000` si le style n'apparaît
   pas (déjà rencontré cette session).

## Critères de succès vérifiables

- La page `/pack` s'affiche en pleine largeur ; « ← Retour » ramène à la page
  précédente.
- Dans le corps de la lettre et de l'email, les variables sont des pastilles
  inline ; on en insère par les chips et on les efface au Backspace.
- L'aperçu PDF de droite montre la lettre finale avec les valeurs substituées.
- « Insérer dans l'éditeur » et « Copier l'email » fonctionnent comme avant.
- Un seul modèle par défaut ; le repli « Madame, Monsieur » du salut fonctionne
  toujours quand le contact est vide.
- `tsc` / `lint` / `vitest` / `build` / `playwright` : tout vert.
