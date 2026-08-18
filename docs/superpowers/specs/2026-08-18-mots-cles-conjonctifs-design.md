# Un mot-clé composé est une exigence, pas une suggestion — conception

**Date :** 18 août 2026
**Plan d'exécution :** `../plans/2026-08-18-mots-cles-conjonctifs.md`
**Chantier précédent sur le même symptôme :** `../plans/2026-08-07-pertinence-marche-cache.md`

---

## Le symptôme

Un candidat qui cherche dans le marketing digital reçoit, sur la source
« Marché caché », des offres de chef de projet achats, de chef de projet santé,
de supply chain. Mesuré le 18/08/2026 sur l'index réel (19 555 offres) :

| Mots-clés saisis | Offres retenues | Dont réellement pertinentes |
|---|---|---|
| `chef de projet marketing` | 60 | **0** |
| `chef de projet web` | 60 | **0** |
| `chef de projet marketing` + `marketing digital` + `Webmaster` | 60 | **1** |

À titre de comparaison, les mots-clés du 07/08 (`Web marketer`, `Webmaster`,
`Chargé marketing digital`, `Chargé de communication digitale`,
`E-merchandiser`) rendent aujourd'hui **9 offres, toutes pertinentes**. Le
correctif du 07/08 a donc bien tenu. Le défaut décrit ici se déclenche
uniquement lorsqu'un mot-clé **contient une expression générique** connue de la
table de synonymes — et « chef de projet web » est un intitulé parfaitement
naturel pour ce candidat.

## La cause unique

Le même choix de conception a été fait, indépendamment, à trois endroits :

> **un mot-clé composé est traité comme un sac de mots interchangeables.**

Trois fois, ce choix visait la tolérance — trouver plus. Trois fois, il produit
du bruit, et les trois se cumulent.

1. **L'élargissement aux synonymes** (`synonymes.ts`). « chef de projet
   marketing » contient « chef de projet », donc le groupe entier est ajouté :
   « chef de projet », « project manager », « program manager » — **des termes
   plus larges que celui du candidat**. Son adjectif, le seul qui disait son
   métier, est perdu. Sur 534 titres atteints, 527 arrivent par ces ajouts.

2. **La notation du métier** (`rank/text.ts`). Un mot-clé introuvable tel quel
   est éclaté en mots, et deux mots sur trois suffisent à créditer.

3. **La notation des compétences** (`rank/criteria.ts`). Quand le candidat n'a
   pas saisi ses compétences, le critère le plus lourd — 45 des 100 points — se
   rabat sur ses mots-clés, éclatés de la même façon, cherchés cette fois dans
   les 3 000 caractères de la description. « chef » et « projet » y saturent le
   crédit sans effort. C'est ce qui fait franchir à ces offres le seuil de 40
   au-dessous duquel elles ne seraient pas enregistrées.

## Le principe correctif

> **Un mot-clé composé est une conjonction. Toute traduction de ce mot-clé —
> synonyme, découpage, notation — doit préserver la conjonction.**

« chef de projet marketing » ne devient pas « chef de projet ». Il devient
« project manager » **et** « marketing » — ce qui trouve toujours
« Marketing Project Manager », et ne trouve plus « Chef de projet Achats ».

Conséquence pratique : la notion centrale n'est plus une liste de mots, mais une
liste de **critères**, chacun étant un ensemble de termes qui doivent **tous**
être présents. Un seul module les construit ; la sélection et le classement les
consomment tous deux. Aujourd'hui ces deux étages réinterprètent les mots-clés
chacun à sa manière, et c'est précisément pour ça qu'ils divergent.

## Le principe qui l'accompagne

> **Le plafond de 60 est un plafond, pas un quota.**

Sur « chef de projet marketing », l'index ne contient **aucune** offre
pertinente de moins de 30 jours. Le système en retient tout de même 60. Il ne
comble pas un manque : il le déguise. Une fois les critères en place, une
recherche sans résultat doit rendre une liste vide — et le dire.

C'est la même règle que celle déjà écrite dans ce dépôt : *une absence, un refus
et une panne ne se disent jamais de la même façon.*

## Ce qui ne change pas

- **Les mots-clés simples.** « développeur » ne contient pas de qualificatif :
  son groupe s'applique tel quel, « Software Engineer » reste trouvé. La
  correction ne mord que lorsque le candidat a été **plus précis** que la table.
  C'est exactement la propriété recherchée.
- **La table de synonymes elle-même.** Ses groupes sont bâtis sur les intitulés
  réels de l'index et ont déjà été purgés deux fois (07/08). On change la façon
  de les appliquer, pas leur contenu.
- **La répartition entre employeurs.** Elle empêche un gros publieur de manger
  la sélection, ce qu'elle fait bien. Elle sera simplement appliquée à
  l'intérieur de chaque niveau de pertinence au lieu de l'ensemble.

## Le risque à assumer

**Le candidat verra moins d'offres.** C'est le but, mais il faut le dire : sur
les recherches mesurées, on passe de 60 à quelques unités, parfois zéro. Une
liste vide honnête vaut mieux que soixante fausses pistes, et coûte accessoirement
soixante requêtes réseau de moins par recherche.

**Les points 2 et 3 touchent les quatre sources**, pas seulement le marché
caché. Ils sont donc traités en second lot, après mesure, et livrables
séparément.
