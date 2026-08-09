# Réordonner les éléments à l'intérieur des sections du formulaire (drag & drop)

**Date :** 14 juillet 2026
**Statut :** validé, prêt pour le plan d'implémentation
**Origine :** `TODO.md`, priorité haute — « Déplacement haut/bas DANS les sections du formulaire »

---

## 1. Problème

Les flèches ↑/↓ permettent déjà de réordonner les **sections entre elles** (bloc « Ordre des
sections », `SectionOrderSection` dans `web/src/components/form/FormEditor.tsx`).

Mais **à l'intérieur** d'une section, aucun moyen de déplacer un élément : pour remonter une
expérience, il faut aujourd'hui retaper son contenu ailleurs et supprimer l'original. Or l'ordre
des expériences est ce qu'on ajuste le plus souvent quand on adapte un CV à une offre — on met en
premier ce qui parle au recruteur.

## 2. Solution retenue

Chaque élément de liste gagne une **poignée de glisser-déposer** dans une gouttière à gauche.
L'utilisateur saisit la poignée et fait glisser l'élément à sa nouvelle place. Pas de flèches :
la bibliothèque retenue rend la poignée pilotable au clavier, l'accessibilité est donc préservée
sans charger l'interface de boutons supplémentaires.

**Décision :** on va directement au drag & drop, sans étape intermédiaire par flèches. C'est le
geste que l'utilisateur veut au bout du compte ; implémenter des flèches d'abord reviendrait à
écrire du code destiné à être jeté.

## 3. Périmètre

### Dans le périmètre — 12 listes

| Section | Composant actuel |
|---|---|
| Expériences | `ItemCard` |
| Formations | `ItemCard` |
| Projets | `ItemCard` |
| Bénévolat | `ItemCard` |
| Sections libres | `ItemCard` |
| Compétences | `StringListSection` |
| Soft skills | `StringListSection` |
| Outils | `StringListSection` |
| Certifications | `StringListSection` |
| Centres d'intérêt | `StringListSection` |
| Langues | `LanguagesSection` (ligne) |
| Informations complémentaires | `CustomFieldsSection` (ligne) |

Les cinq sections en cartes passent toutes par `ItemCard` : les traiter revient à modifier un
seul composant. Les cinq listes de chaînes passent toutes par `StringListSection` : idem.

### Hors périmètre — décisions explicites

- **Les puces « Réalisations »** (expériences, bénévolat) restent une zone de texte, une ligne par
  puce. Les convertir en liste d'inputs ferait perdre le collage multi-lignes, précieux à l'import.
  Chantier séparé si le besoin apparaît.
- **Le bloc « Ordre des sections »** garde ses flèches ↑/↓. Choix de l'utilisateur, assumé : le
  formulaire aura donc deux gestes de réordonnancement selon l'endroit. À réévaluer une fois le
  drag & drop en service — le convertir sera peu coûteux, la mécanique sera déjà là.
- **Alléger l'interface du formulaire** : chantier distinct, à ne pas mélanger à celui-ci.

## 4. Architecture

### 4.1 Dépendances

```
@dnd-kit/core@^6.3.1      # contexte de glissement, capteurs
@dnd-kit/sortable@^10     # stratégie de liste triable + arrayMove
@dnd-kit/modifiers@^9     # contrainte à l'axe vertical
```

Compatibles React 19 (peer `react: >=16.8.0`) et Next 16. On prend la branche stable, **pas**
`@dnd-kit/react` (v2), encore en 0.x et sujette à des ruptures d'API.

Pourquoi dnd-kit plutôt que `pragmatic-drag-and-drop` : ce dernier s'appuie sur le glisser-déposer
natif HTML5, qui ne fonctionne pas au doigt. L'application est utilisée sur mobile (le CSS a déjà
ses cibles tactiles de 44 px) — c'est éliminatoire.

### 4.2 Nouveau fichier : `web/src/components/form/Sortable.tsx`

Toute la mécanique de glissement vit ici et nulle part ailleurs. Trois exports :

**`<SortableList count onMove>`** — l'enveloppe d'une liste triable. Elle :
- installe les capteurs : pointeur (souris + doigt, avec une contrainte de distance pour ne pas
  déclencher un glissement sur un simple clic), et clavier ;
- contraint le déplacement à l'axe vertical (`restrictToVerticalAxis`) ;
- appelle `onMove(depuis, vers)` à la dépose, et rien d'autre.

**`<DragHandle>`** — la poignée. Seul endroit du code qui décide à quoi ressemble un point de
saisie, et seul élément qui capte le geste : le reste de la carte laisse la page défiler
normalement au doigt.

**`useSortableItem(index)`** — le lien entre les deux : rend un élément déplaçable et fournit les
propriétés à poser sur sa poignée.

Les sections du formulaire ne connaissent que ces trois exports. Elles ignorent tout de dnd-kit.

### 4.3 Identité des éléments

Les listes du CV n'ont pas d'identifiant : une compétence est une simple chaîne, et deux éléments
peuvent être rigoureusement identiques (« Anglais » deux fois). On utilise donc **l'indice comme
identité**.

C'est correct ici parce que l'ensemble des indices (`0…n-1`) ne change jamais pendant un
glissement : seul l'ordre du tableau change, et seulement après la dépose. dnd-kit calcule la
position d'arrivée à partir de cet ensemble, qui reste stable tout du long.

Aucun champ `id` n'est ajouté au schéma du CV : ce serait une migration de données pour un besoin
purement visuel.

### 4.4 Modifications dans `FormEditor.tsx`

- `ItemCard` : gagne une gouttière à gauche contenant la poignée, et un `index`. Couvre d'un coup
  les 5 sections en cartes.
- **Nouveau `RowCard`** : l'équivalent pour les listes en ligne (poignée, contenu, ✕). Utilisé par
  `StringListSection`, `LanguagesSection`, `CustomFieldsSection`.
- Chaque section entoure sa liste d'un `<SortableList>` — une ligne par section.

### 4.5 Flux de données

Le glisser-déposer ne crée **aucun chemin de données nouveau** :

```
dépose → onMove(depuis, vers) → arrayMove(items, depuis, vers) → onChange(items)  [déjà existant]
       → update({ experience: … }) → setJson → docStore
                                              ├→ aperçu PDF re-rendu
                                              └→ historyStore : une entrée par dépose (Ctrl+Z)
```

`arrayMove` vient de `@dnd-kit/sortable` : pas de fonction maison à écrire ni à tester.

## 5. Interface

- **Gouttière à gauche**, poignée à points (⁙⁙), dans le style neumorphique existant
  (`--neu-raised-sm`, `--muted`). Le ✕ reste où il est.
- **Mobile** : poignée d'au moins 44 px de haut, comme les autres cibles tactiles du formulaire.
- **Pendant le glissement** : l'élément saisi s'allège (opacité réduite) et la liste s'écarte pour
  montrer le point d'atterrissage.
- **Clavier** : Tab jusqu'à la poignée, Espace pour saisir, ↑/↓ pour déplacer, Espace pour déposer,
  Échap pour annuler. Fourni par dnd-kit, à ne pas réimplémenter.

## 6. Critères de succès

Vérifiables, à faire tourner avant toute déclaration de fin :

1. `npm run lint` — pas d'erreur.
2. `npm test` — la suite unitaire passe (aucune régression).
3. `npm run build` — compile.
4. **Test e2e clavier** (nouveau) : sur les expériences, Tab jusqu'à la poignée du 2ᵉ élément,
   Espace, ↑, Espace → l'ordre des champs « Poste » est inversé. C'est le chemin fiable à
   automatiser dans Playwright.
5. **Test e2e souris** (nouveau) : glisser une compétence de la 2ᵉ à la 1ʳᵉ place (pointeur avec
   déplacements intermédiaires, dnd-kit ignore un saut instantané).
6. **Contrôle manuel** : glisser une expérience, voir l'aperçu PDF se réordonner, Ctrl+Z la
   remettre en place.
7. **Contrôle manuel mobile** (émulation) : le glissement fonctionne au doigt depuis la poignée, et
   le défilement de la page reste possible ailleurs sur la carte.

## 7. Risques connus

- **Défilement contre glissement au doigt** : atténué par la poignée dédiée (seule zone qui
  capte le geste). Si ça coince malgré tout, le remède est une contrainte de délai sur le capteur
  tactile (appui long avant saisie), pas un retour aux flèches.
- **Playwright et dnd-kit** : un `dragTo` direct ne déclenche rien, dnd-kit exige des déplacements
  de pointeur intermédiaires. Le test souris doit descendre au niveau de `page.mouse` avec des
  étapes. Le test clavier, lui, est robuste — c'est la garantie principale.
