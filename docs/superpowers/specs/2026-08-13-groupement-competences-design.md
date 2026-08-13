# Groupement des compétences par catégorie — design

**Date :** 2026-08-13
**Statut :** validé, prêt pour plan d'implémentation

---

## 1. Le problème

Un utilisateur a importé son CV (PDF) puis regénéré un CV avec l'app. La sortie est
nettement moins lisible que la source :

| | CV source | CV produit par l'app |
|---|---|---|
| Compétences techniques | 8 lignes groupées (`Systems : Linux, systemd, distributed systems…`) | 38 éléments atomiques éclatés sur 3 listes |
| Sidebar `OUTILS` | n'existe pas (fondue dans les catégories) | 25 puces empilées, dont `Git`, `2G`, `3G`, `4G`, `5G` |
| Pagination | 1 page pleine et équilibrée | 1 page + 2ᵉ page contenant **une seule ligne** |
| Titres de section | anglais (CV anglais) | mélange `PROFIL` / `FORMATIONS` / `ASSETS` sur un CV anglais |

Fichiers de référence du diagnostic (hors dépôt, fournis par l'utilisateur) :
`CV_2026-07-26_Khan_Yasin.pdf` (source) et
`CV_Ingenieur_SRE_DevOps_confirme_H_F_2026-08-12.pdf` (sortie app, template Marine).

## 2. Causes racines

### 2.1 L'import détruit le regroupement par catégorie

`resumeSchema` (`web/src/lib/resume/schema.ts:93-95`) modélise `skills`, `softSkills` et
`tools` comme des `string[]` plats. Aucun champ ne peut porter une catégorie.

`SECTION_ROUTING_RULES` (`web/src/lib/ai/prompts.ts:137`) demande explicitement de trier
chaque élément **par nature** (savoir-faire / savoir-être / outil). L'IA exécute
correctement cette consigne : elle casse les 8 groupes du CV source et redistribue les
~38 mots un par un. L'information « ces éléments vont ensemble sous l'intitulé
`Networking` » est perdue **définitivement**, en amont du PDF. Aucun template ne peut la
reconstituer.

### 2.2 Le template Marine ne sait rendre une liste qu'en colonne verticale

Deux points de rendu, tous deux en « une puce par ligne, pleine largeur » :

- `web/src/lib/pdfgen/templates/primitives.tsx:154-166` (colonne principale)
- `web/src/lib/pdfgen/templates/MarineTemplate.tsx:183-194` (sidebar)

Chaque élément est un `flexDirection: "row"` avec `flex: 1` sur le texte : `Git` occupe
la même hauteur que `Configuration of emergency communication connectors`. Marine est le
seul des quatre templates sans `flexWrap` (Sobre `SobreTemplate.tsx:140` et Kakuna
`KakunaTemplate.tsx:50` en ont un).

### 2.3 Le doublon `ASSETS` vient d'une contrainte impossible, pas d'une erreur de l'IA

`RESUME_SCHEMA_DESC` (`web/src/lib/ai/prompts.ts:110`) **ne contient pas
`sectionTitles`**. L'omission est délibérée et documentée (`prompts.test.ts:42`) :
« préférence d'affichage, pas du contenu ».

Ce raisonnement est correct pour l'adaptation à une offre, et **faux à l'import**. Face à
une rubrique intitulée `ASSETS`, l'IA reçoit deux règles inconciliables :

- « utilise le champ standard » → le contenu va dans `softSkills`, l'intitulé `ASSETS` est perdu ;
- « ne renomme ni ne déforme JAMAIS une rubrique » → l'intitulé doit être préservé.

Aucun champ ne permet de satisfaire les deux. L'IA a produit **les deux** sorties : 3
puces dans `softSkills` (sidebar) **et** une section libre `ASSETS` (colonne principale).
Ce doublon est ce qui pousse le document sur une seconde page à 95 % vide.

À l'import, l'intitulé du CV source est du **contenu**, pas une préférence d'affichage.

### 2.4 Mécanique compacte présente mais non alimentée

`SkillText` (`web/src/lib/pdfgen/templates/primitives.tsx:234`) met déjà en gras la partie
d'une chaîne située avant ` — `. C'est exactement le rendu du CV source. Le tailoring
l'exploite (`prompts.ts:193`, `prompts.ts:203`), mais **l'import ne produit jamais ce
format**. Le tuyau existe aux deux extrémités, il n'est pas raccordé au milieu.

## 3. Décisions

### 3.1 Ambition retenue

L'app **améliore** le CV source, elle ne se contente pas de le recopier. Si le CV source
ne groupe pas ses compétences, l'IA invente le regroupement.

### 3.2 Approche retenue : convention textuelle, pas changement de schéma

La catégorie devient **le contenu de la ligne** :

```
Avant  skills: ["Machine Learning", "Data Analysis", "KPI Optimization", … 13 éléments]
Après  skills: ["Systèmes — Linux, systemd, haute disponibilité, virtualisation",
                "Réseau — TCP/IP, HTTP/HTTPS, DNS, TLS, firewalls, tcpdump",
                "Cloud & DevOps — Docker, Kubernetes, Ansible, AWS, Azure, CI/CD"]
```

Une ligne du tableau = une catégorie.

**Justification :**

- `SkillText` produit déjà le rendu visé : aucune nouvelle mécanique de rendu à inventer ;
- 38 éléments → ~8 lignes : l'empilement vertical disparaît **sans toucher au template** ;
- le formulaire devient plus maniable (8 champs au lieu de 38) sans modification —
  `StringListSection` (`FormEditor.tsx:107`) accepte du texte libre ;
- l'ATS est inchangé : `resumeToZones` (`web/src/lib/ats/resumeText.ts:46`) aplatit les
  compétences en texte, tous les mots-clés restent présents ;
- **aucune migration** : les CV déjà en localStorage et en base Supabase s'affichent
  exactement comme avant.

**Coût accepté :** la catégorie est une convention d'écriture, pas une donnée typée. Une
compétence contenant naturellement ` — ` s'affichera en gras à tort. Ce risque existe
déjà dans le code actuel et n'a jamais posé problème.

### 3.3 Approches écartées

**Schéma structuré** (`skills: [{category, items}]`) : 10 fichiers touchés (4 templates,
formulaire, normalize, defaults, sections, ATS, prompts), migration obligatoire et
permanente pour les CV en localStorage et Supabase, nouveau composant d'édition à deux
niveaux, et réapprentissage de la forme JSON par le tailoring. N'achète rien de plus que
l'approche retenue sur le résultat visible : toute la valeur est dans la **qualité du
regroupement fait par l'IA**, qui relève du prompt. Reste convertible mécaniquement plus
tard (`"X — a, b"` → `{category:"X", items:["a","b"]}`).

**Regroupement au moment du rendu PDF** : l'utilisateur verrait 38 éléments dans son
formulaire et 8 lignes dans son PDF, sans comprendre ni pouvoir corriger, et il faudrait
un appel IA à chaque génération.

## 4. Conception

### Pièce 1 — Règle de regroupement à l'extraction

Dans `SECTION_ROUTING_RULES` (`web/src/lib/ai/prompts.ts:137`), partagée par les deux
extractions (PDF et texte). Format imposé : `Catégorie — élément, élément, élément`, avec
le séparateur ` — ` (tiret cadratin **entouré d'espaces**) — celui que `SkillText`
reconnaît en premier.

Ordre de priorité :

1. **Le CV source groupe déjà** → reprendre les intitulés **exacts** (`Networking`, pas
   sa traduction).
2. **Le CV source ne groupe pas, et la liste dépasse 8 éléments** → l'IA regroupe
   elle-même en 3 à 6 familles.
3. **La liste contient 8 éléments ou moins** → liste plate, aucune catégorie forcée
   (3 soft skills n'ont pas besoin d'être rangés).
4. **Langue** : les catégories inventées suivent la langue du CV source.

Le cloisonnement `skills` / `softSkills` / `tools` reste en vigueur : le regroupement
s'applique **à l'intérieur** de chaque liste, il ne les fusionne pas.

### Pièce 2 — Ouvrir `sectionTitles` à l'extraction uniquement

Nouvelle constante `EXTRACTION_SCHEMA_DESC` = `RESUME_SCHEMA_DESC` + la ligne
`sectionTitles`. Utilisée **uniquement** par `SYSTEM_PDF_TO_RESUME`
(`prompts.ts:565`) et `SYSTEM_TEXT_TO_RESUME` (`prompts.ts:586`).

Le prompt de tailoring (`prompts.ts:245`) continue d'utiliser `RESUME_SCHEMA_DESC` et
reste **inchangé** : les préférences d'affichage de l'utilisateur y restent protégées,
et `mergeTailored` continue de les restaurer.

Règle associée, ajoutée aux extractions : *si une rubrique du CV correspond à un champ
standard mais porte un autre intitulé, place le contenu dans le champ standard **et**
l'intitulé exact dans `sectionTitles`. Ne crée jamais une section libre qui doublonne un
champ standard déjà rempli.*

Effet attendu sur le cas observé : `softSkills` reçoit les 3 éléments, `sectionTitles`
reçoit `{"softSkills": "Assets"}`, aucune `customSection` n'est créée, la 2ᵉ page
disparaît. Bénéfice secondaire : un CV anglais conserve ses intitulés anglais.

### Pièce 3 — Verrouiller le format au tailoring

- `peu` (`prompts.ts:184`) : déjà intouchable, aucune modification.
- `adapte` (`prompts.ts:193`) et `hyper` (`prompts.ts:203`) : la règle actuelle
  `format 'Mot clé — Description'` est ambiguë. Elle devient : *conserve le regroupement
  par catégorie ; tu peux réordonner les catégories entre elles et les éléments à
  l'intérieur d'une catégorie, jamais casser le format ni éclater une catégorie.*

Sans cette pièce, adapter un CV à une offre détruirait le regroupement obtenu à l'import.

### Pièce 4 — Marine : la sidebar ignore `SkillText`

`MarineTemplate.tsx:189` affiche `{item}` brut. Sans correctif, `OUTILS` sortirait
`Cloud & DevOps — Docker, Kubernetes…` sans gras sur la catégorie, alors que la colonne
principale l'aurait. Remplacer par `<SkillText skill={item} />`.

La couleur est héritée du style parent (`s.sideBulletText`, texte clair sur fond navy) :
`SkillText` ne pose que `fontWeight`, il ne réintroduit pas d'encre sombre.

### Pièce 5 — Filet pour les CV déjà importés

Les CV déjà enregistrés restent en éléments atomiques et ne bénéficient d'aucune des
pièces précédentes. Règle purement locale, sans IA :

> si **aucun** élément d'une liste ne dépasse 20 caractères, la liste est rendue en tags
> qui se replient sur la largeur (`flexWrap`) ; sinon, puces verticales classiques.

La règle vit à **un seul endroit** : une fonction exportée par `primitives.tsx`
(`shouldRenderCompact(items: string[]): boolean`) et la constante de seuil associée. Elle
est consommée aux deux points de rendu de Marine, qui sont distincts :

- **colonne principale** : nouveau prop optionnel `compact` sur `SectionContent`
  (`primitives.tsx:133`), passé **uniquement par Marine** (`MarineTemplate.tsx:308`) ;
- **sidebar** : `SideList` (`MarineTemplate.tsx:183`) appelle directement la même
  fonction, puisqu'il ne passe pas par `SectionContent`.

Sobre et Kakuna ont leur propre `flexWrap` et ne sont pas touchés ; Graphique n'est pas
modifié. Sans le prop `compact`, `SectionContent` conserve son comportement actuel à
l'identique.

Le seuil de 20 caractères est un choix de mise en page, pas une règle métier. Il est
indépendant du seuil de 8 éléments de la pièce 1, qui pilote l'IA et non le rendu.

## 5. Impact sur les tests existants

`web/src/lib/ai/prompts.test.ts:34` (« garde-fou anti-dérive ») vérifie que tout champ du
schéma Zod figure dans `RESUME_SCHEMA_DESC`, avec `sectionTitles` dans la liste des
exclusions volontaires. Ce test doit être étendu, pas contourné :

- `sectionTitles` reste **exclu** de `RESUME_SCHEMA_DESC` (fiche de tailoring) ;
- `sectionTitles` devient **obligatoire** dans `EXTRACTION_SCHEMA_DESC` (fiche
  d'extraction), avec un cas de test dédié ;
- le commentaire d'exclusion est mis à jour pour expliquer la distinction
  extraction / tailoring.

`prompts.test.ts:53` (« les extractions imposent des listes cloisonnées ») doit rester
vert : le regroupement ne remplace pas le cloisonnement.

## 6. Critères de succès

| # | Vérification | Attendu | Comment |
|---|---|---|---|
| 1 | `npm test` et `npm run build` | vert | automatisé |
| 2 | Réimport du PDF source | `skills` et `tools` ≤ 10 lignes, chacune contenant ` — ` | manuel (appel IA réel) |
| 3 | Même import | aucune `customSection` doublonnant `softSkills` | manuel |
| 4 | Même import | `sectionTitles.softSkills === "Assets"` | manuel |
| 5 | PDF Marine généré depuis cet import | **1 page**, catégories en gras en sidebar et en colonne principale | manuel |
| 6 | CV de test : 25 éléments courts non catégorisés | rendu en tags repliés, pas en colonne | test unitaire sur `shouldRenderCompact` + contrôle visuel |
| 8 | Un template non modifié (Sobre) rendu avant/après | sortie identique | test unitaire de non-régression |
| 7 | Tailoring `hyper` sur un CV groupé | les catégories survivent | manuel |

Les points 2, 3, 4, 5 et 7 exigent un appel IA réel : ils sont vérifiés à la main dans
l'app, jamais en CI. Les points 1 et 6 sont automatisés.

Fixtures de référence pour toute vérification liée à l'ATS ou à la génération :
`web/tests/fixtures/base_resume.json` et `web/tests/fixtures/job_sharkninja.txt`
(cf. `CLAUDE.md`).

## 7. Hors périmètre

- **Changement de schéma** (`skills: [{category, items}]`) — conversion possible plus tard
  sans perte.
- **Les trois autres templates** (Sobre, Kakuna, Graphique) — ils ont déjà leur propre
  gestion de largeur.
- **Le placement de `COMPÉTENCES` en bas de la colonne principale** — relève de
  `sectionOrder`, sujet distinct.
- **La photo absente du CV généré** — comportement documenté et voulu (`photo` n'est
  jamais envoyée à l'IA, cf. `schema.ts:13`).
