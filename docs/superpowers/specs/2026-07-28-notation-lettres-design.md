# Classement des offres en lettres (S/A/B/C/D) par algorithme local

> Spec de conception — 28/07/2026
> Remplace la notation IA sur 100 par un classement algorithmique instantané.
> La phase « embeddings » fera l'objet d'un spec distinct (voir « Hors périmètre »).

## 1. Problème

La notation actuelle envoie chaque offre à Gemini via `POST /api/jobs/score`
(`lib/jobs/score.ts`). Trois conséquences :

- **Lenteur** — 50 offres notées par pool de 4 requêtes, soit 30 à 50 s par scan.
- **Quota** — une recherche consomme une part importante du quota Gemini du jour.
- **Opacité** — le LLM renvoie un entier de 0 à 100 sans justification exploitable.
  Repasser deux fois la même offre peut donner 72 puis 81 : ni reproductible, ni
  explicable.

Deux limites du produit n'existent que pour contenir ce coût : le plafond
`aiShortlist` (on ne note qu'une partie des offres trouvées) et le rejet des
offres sous `minScore`, enregistrées vides via `saveExplored` et invisibles à
jamais. Ces deux limites disparaissent avec un classement gratuit et instantané.

## 2. Constats vérifiés

Tout ce qui suit a été mesuré en direct sur les API réelles le 28/07/2026, pas
supposé.

### 2.1 Les offres France Travail sont déjà structurées

Sur 150 offres réelles (mot-clé « developpeur web ») :

| Champ | Couverture |
|---|---|
| `romeCode` | 150/150 (100 %) |
| `competences` (codées) | 131/150 (87 %) — 4,0 en moyenne, max 25 |
| `experienceLibelle` / `experienceExige` | 150/150 (100 %) |
| `typeContrat` / `contexteTravail` | 150/150 (100 %) |
| `salaire` | 145/150 (96 %) |
| `qualificationCode` | 143/150 (95 %) |
| `secteurActiviteLibelle` | 142/150 (94 %) |
| `formations` / `langues` | 46 et 48 /150 (~30 %) |
| `permis` | 3/150 (2 %) |

`competences[].exigence` distingue **E** (exigé, 120 occurrences) de **S**
(souhaité, 403) — exploitable comme pondération.

**`lib/jobs/francetravail.ts` (`RawOffer`, `mapOffer`) ne lit aujourd'hui aucun de
ces champs.** Il s'arrête à `id`, `intitule`, `description`, `alternance`,
`typeContratLibelle`, `dateCreation`, `entreprise.nom`, `lieuTravail`,
`origineOffre`.

### 2.2 Les codes de compétence correspondent au référentiel ROME

Le ROME complet est publié en open data (licence Etalab, gratuit, sans
authentification) : ZIP de 5,3 Mo à
`https://api.francetravail.fr/api-nomenclatureemploi/v1/open-data/json`.

`unix_fiche_emploi_metier_v461.json` (22 Mo) contient 1 911 fiches métier. Les
codes `competences[].code` vus sur de vraies offres existent bien parmi les
**32 021 `code_ogr`** du référentiel. Le rapprochement est donc du code contre
code, sans NLP.

Structure d'une fiche (encodage **latin-1**, pas UTF-8) :

```
rome: { code_rome, intitule, code_ogr }
appellations: [{ libelle, libelle_court, code_ogr }]
competences:
  savoir_faire:              { enjeux:     [{ libelle, items: [{libelle, code_ogr, coeur_metier}] }] }
  savoir_etre_professionnel: { enjeux:     [...] }
  savoirs:                   { categories: [...] }   # ← `categories`, PAS `enjeux`
mobilites: [{ rome_cible: "A1102 - Libellé", ordre_mobilite }]
```

Deux apports gratuits :
- `coeur_metier: "Principale"` — distingue les compétences centrales des accessoires.
- `mobilites` — table officielle des métiers voisins.

Table dérivée (`rome → { intitulé, { code_ogr: poids } }`) : **835 Ko** pour
1 911 métiers. Comparable au fichier ROME déjà embarqué (732 Ko).

### 2.3 Le code ROME discrimine fortement — comme filtre anti-bruit

Profil cible M1834 + M1855 + M1886 (métiers du web), 23 métiers voisins issus des
mobilités, testé sur 60 offres par mot-clé :

| Recherche | Sur cible | Voisines | Hors-sujet | Score moyen |
|---|---|---|---|---|
| webmaster | 22 | 1 | 37 | **38,1** |
| chargé de communication | 1 | 0 | 59 | 2,5 |
| comptable | 0 | 0 | 60 | **0,0** |

Fait marquant : sur 60 offres remontées par le mot « webmaster », **20 sont
classées K2101 « Conseiller en formation »** — du bruit de recherche plein-texte.
Le code ROME les élimine immédiatement.

C'est là sa vraie valeur : **éliminer le hors-sujet**, pas récompenser le
pertinent. D'où son positionnement en malus plutôt qu'en bonus (§4).

### 2.4 Les compétences ROME ne transfèrent pas entre métiers voisins

Recouvrement moyen des compétences entre métiers proches du web : **2,4 %**.
Community manager et Chargé de relations publiques partagent 3 compétences sur
~70.

Conséquence directe : le rapprochement par codes de compétence n'affine qu'à
l'**intérieur d'un même code ROME**. Il n'apporte presque rien dès que l'offre
relève d'un métier voisin. Il ne peut donc pas porter le poids principal.

### 2.5 Le fichier ROME local est périmé — bug actif

| | Codes ROME |
|---|---|
| `web/src/lib/jobs/data/rome-appellations.json` | 532 (ROME 3.x), 11 118 appellations |
| Référentiel 4.0 | 1 911, 14 301 appellations |

Les codes portés par les vraies offres (M1834, M1855, M1886, M1716, E1112) sont
**absents du fichier local**. Le champ `romeCodes` du profil, alimenté depuis ce
fichier, produit donc des codes qui ne correspondront jamais à ceux des offres.

Le passage au référentiel 4.0 récupère au passage des intitulés absents
(« communication digitale », « référencement »). Mais « contenu web » et
« webmarketing » restent introuvables **même en 4.0** : aucune taxonomie ne
couvre tous les intitulés réels du marché.

### 2.6 Les sources non-France-Travail n'ont rien d'équivalent

Adzuna, sur 50 offres réelles :

| Champ | Couverture | Exploitable ? |
|---|---|---|
| `category` | 100 % | **Non** — 21/50 en « Unknown », taxonomie grossière (un webmaster classé « Fabrication ») |
| `latitude` / `longitude` | 88 % | **Oui** |
| `contract_type` / `contract_time` | 24 % / 28 % | marginal |
| `salary_min` / `salary_max` | 22 % | marginal |

France Travail représente environ 48 % du volume (57 offres sur 118 lors d'un
scan complet mesuré). Le reste doit être noté par le texte.

### 2.7 Google Maps est un coût caché

`getCommuteTimes` (`lib/jobs/maps.ts`) émet **un appel Distance Matrix par mode
de transport**, sans aucun cache. Le profil par défaut a 3 modes.

| | Appels facturés par scan |
|---|---|
| Aujourd'hui (50 offres × 3 modes) | 150 |
| Si l'on classait les 118 offres | **354** |

Supprimer le coût Gemini sans traiter ce point reviendrait à tripler la facture
Google Maps.

**Tarif** (vérifié le 28/07/2026) : Distance Matrix est gratuit jusqu'à 5 000
éléments/mois, puis 10 $ les 1 000. Un appel origine→destination = 1 élément.

| Rythme | Éléments/mois | Coût |
|---|---|---|
| 14 scans/mois | 4 956 | 0 $ |
| 1 scan/jour | 10 620 | **56 $/mois** |
| 2 scans/jour | 21 240 | **162 $/mois** |

**Coût en temps** : 200 à 500 ms par appel, soit **30 à 45 s ajoutées à chaque
scan** même en parallèle. La lenteur actuelle n'est donc pas imputable à la seule
IA.

**Potentiel du cache**, mesuré sur 150 offres réelles : 150 offres → 107 lieux
distincts, soit 29 % d'économie dès le premier scan. Le gain déterminant est
cependant la **persistance entre scans** : les recherches portent sur la même
région, les lieux se répètent. En régime établi (~20 % de lieux nouveaux), on
tombe à ~71 éléments par scan — sous le seuil gratuit même à raison d'un scan
quotidien.

Clé de cache : `(adresse domicile, lieu de l'offre arrondi, mode)`. Durée de vie
30 jours — un temps de trajet entre deux points fixes ne varie pas d'une semaine
à l'autre.

**Décision confirmée le 28/07/2026** : calcul à la demande à l'ouverture d'une
offre (§3.6). Le cache rend techniquement viable l'affichage systématique, mais
il coûterait 30 à 45 s sur les premiers scans et exposerait à la facture en cas
de changement de région de recherche.

### 2.8 Contraintes de déploiement

- Fonction Vercel Node.js : **250 Mo** décompressé (5 Go via Fluid Compute). Sans
  objet ici : aucun modèle n'est embarqué.
- API ROME 4.0 de France Travail : **scopes refusés** avec les identifiants
  actuels (`api_rome-fiches-metiersv1`, `api_rome-metiersv1`,
  `api_rome-competencesv1`, `api_romev1`, `nomenclatureRome` — tous testés). D'où
  le choix de l'open data local : aucun abonnement à souscrire, aucun appel
  réseau, fonctionne hors ligne.

## 3. Décisions de conception

1. **Lettres absolues à seuils réglables**, pas de classement relatif au lot.
   Une offre en A aujourd'hui reste en A demain — condition pour comparer dans le
   temps et pour filtrer (« je ne regarde plus sous B »).
   *Corollaire :* aucune pondération ne peut dépendre du lot analysé. C'est ce qui
   exclut BM25, dont l'IDF se calcule sur le corpus courant.

2. **La description est le juge principal.** Un même métier réel se présente sous
   des intitulés multiples (webmaster, chargé de contenu web, chargé de
   communication digitale, chargé de projet web, webmarketing…) que ni le titre ni
   la taxonomie ne réconcilient (§2.4, §2.5). Seules les missions décrites les
   couvrent tous.

3. **Le code ROME sert de filtre, pas de récompense** (§2.3). Positionné en malus
   sur le hors-sujet avéré.

4. **Deux voies par critère, une seule échelle.** Chaque critère a une
   implémentation structurée (France Travail) et une implémentation textuelle
   (autres sources), pour le même nombre de points. Une offre Adzuna et une offre
   FT restent comparables — pas de biais de source.

5. **Toutes les offres sont classées et conservées.** Plus de plafond
   `aiShortlist`, plus de rejet silencieux.
   *Couture prévue :* la décision d'enregistrer passe par une fonction unique
   `shouldPersist(result, profile)` renvoyant `true` aujourd'hui. Un seuil de
   rejet réglable s'y branchera plus tard sans réécriture. **Aucune
   fonctionnalité de seuil n'est construite maintenant.**

6. **Distance à vol d'oiseau pour classer, Google Maps à la demande.** Le trajet
   réel n'est calculé que sur consultation d'une offre, et mis en cache dans
   Dexie (§2.7).

## 4. La grille

100 points, deux malus.

| Critère | Max | Voie France Travail | Voie texte (Adzuna, JSearch) |
|---|---|---|---|
| **Compétences & missions** | **45** | Voie texte (colonne de droite) comme socle, **affinée** par le recouvrement des codes `competences` pondéré `coeur_metier` × `exigence`. Le total du critère reste plafonné à 45 : la part structurée redistribue à l'intérieur de l'enveloppe, elle ne s'y ajoute pas — sans quoi les offres FT seraient systématiquement avantagées (cf. décision §3.4) | Compétences du profil recherchées dans la description, pondérées par zone : titre ×3, section « profil recherché » ×2, reste ×1, avec saturation |
| **Métier** | 20 | Code ROME sur cible (plein) ou voisin via `mobilites` (partiel) + intitulés dans le titre | Intitulés du profil dans le titre |
| **Distance** | 15 | Vol d'oiseau depuis le domicile (GPS 100 %) | Idem (GPS 88 % chez Adzuna) |
| **Contrat & salaire** | 10 | `typeContrat`, `salaire`, `dureeTravailLibelleConverti` | Extraction par motifs |
| **Expérience** | 10 | `experienceExige`, `qualificationCode` | Motif « X ans » |
| *Malus métier hors-sujet* | **−20** | Code ROME connu, ni cible ni voisin | *(inapplicable — pas de code)* |
| *Malus signaux négatifs* | **−15** | Motifs littéraux (« salaire selon profil »…), mots exclus du profil, offre plus ancienne que `maxAgeDays` | identique |

Score final borné à [0, 100].

**Le cumul sur le hors-sujet est voulu.** Une offre dont le code ROME n'est ni
cible ni voisin marque 0 sur « Métier » *et* encaisse le malus de −20. C'est
délibéré : c'est le mécanisme qui écarte les 20 offres « conseiller en formation »
du §2.3. Une telle offre ne peut plus dépasser 80 même en cochant tout le reste,
et devra donc exceller ailleurs pour seulement atteindre A.

**Le malus hors-sujet ne s'applique jamais aux sources sans code ROME.** Adzuna et
JSearch ne sont donc ni punis ni protégés : ils sont jugés sur les 100 points
ordinaires. C'est la contrepartie assumée de la limite §9.1.

**Notes sur la voie texte des compétences.** La saturation évite qu'une annonce
répétant douze fois « SEO » vaille douze fois une annonce le mentionnant deux
fois : les occurrences suivantes rapportent de moins en moins. Les zones sont
détectées par leurs intitulés usuels (« Profil recherché », « Compétences
requises », « Votre mission »…) ; à défaut de section identifiable, tout le texte
est traité en poids ×1.

**Lettres.** S ≥ 85 · A ≥ 70 · B ≥ 55 · C ≥ 40 · D < 40. Seuils modifiables via le
profil, comme `minScore` aujourd'hui.

**Restitution.** Chaque critère renvoie son score *et* sa justification, ce que
l'IA ne fournissait pas. La carte affiche par exemple :

> **A** — Métier : Développeur web (sur cible) · 4 compétences sur 6 · 8 km · CDI · salaire annoncé

## 5. Architecture

### Modules ajoutés

| Fichier | Rôle |
|---|---|
| `lib/jobs/data/rome-competences.json` | Table dérivée : `rome → { intitulé, compétences pondérées, voisins }` (~835 Ko) |
| `scripts/build-rome.mjs` | Régénère la table depuis l'open data. Versionné, relançable — le ROME évolue |
| `lib/jobs/rome.ts` | Chargement de la table, appartenance cible/voisin |
| `lib/jobs/geo.ts` | Distance à vol d'oiseau (haversine) |
| `lib/jobs/rank/*.ts` | Une fonction pure par critère |
| `lib/jobs/rank/index.ts` | Orchestration → `{ score, grade, breakdown[] }` |

Chaque critère est une fonction pure `(offer, profile, ctx) => { points, reason }`,
testable isolément. La table `clé → fonction` reprend la structure
`ScoringCriterion` déjà présente dans le profil, ce qui préserve l'encart de
transparence (`ScoringInfo`) et le réglage des maximums.

### Modules modifiés

- `lib/jobs/francetravail.ts` — lire `romeCode`, `competences`, `salaire`,
  `experienceExige`, `qualificationCode`, `dureeTravailLibelleConverti`, et au
  passage `entreprise.logo` (jamais lu aujourd'hui).
- `lib/jobs/adzuna.ts` — lire `latitude` / `longitude`.
- `lib/jobs/offer.ts` — étendre `JobOffer` des champs structurés, tous optionnels.
- `components/jobs/MetierInput.tsx` — **conserver le code ROME** de l'appellation
  choisie ; il est actuellement jeté par `add(shortTerm(s.label))`. Alimente
  `profile.romeCodes`, qui existe déjà.
- `lib/jobs/data/rome-appellations.json` — régénéré depuis le référentiel 4.0
  (§2.5).
- `components/jobs/JobsView.tsx` — `scan()` classe **toutes** les offres en local ;
  plus de pool de requêtes, plus de plafond, plus d'appel IA.
- `components/jobs/JobCard.tsx` — afficher la lettre et le détail au lieu du /100.
- `lib/storage/db.ts` — champs `grade` et `breakdown` sur `JobEntry` ; cache des
  trajets Maps.

### Modules supprimés

- `lib/jobs/score.ts` et son test.
- `app/api/jobs/score/route.ts` et son test.
- L'appel `getCommuteTimes` dans le chemin de scan (le module `maps.ts` reste,
  appelé à la demande).

### Flux

```
recherche multi-sources  →  dédoublonnage (jobExists)
   →  classement local (instantané, toutes les offres)
   →  shouldPersist()  →  enregistrement avec lettre + détail
```

Plus aucun appel réseau entre la recherche et l'affichage.

## 6. Migration

Les offres déjà en base portent un `score` de 0 à 100. La lettre s'en déduit par
les mêmes seuils — aucune donnée perdue, aucun rescan imposé.

Les entrées `status: "hidden"` créées par `saveExplored` (offres sous l'ancien
seuil, enregistrées vides) restent en place : elles servent toujours à ne pas
reproposer une offre déjà écartée. Elles ne sont pas reconstituées.

## 7. Tests

- Une suite par critère, sur des offres synthétiques couvrant les deux voies
  (structurée et textuelle) et les cas dégradés : `competences` absent (13 % des
  offres FT), GPS absent (12 % chez Adzuna), description vide.
- Non-régression du classement : jeu figé d'offres réelles anonymisées avec les
  lettres attendues, pour détecter toute dérive lors d'un réglage de pondération.
- `web/tests/fixtures/base_resume.json` et `job_sharkninja.txt` comme références,
  conformément à `CLAUDE.md`.

## 8. Critères de succès vérifiables

1. Un scan de 118 offres se termine **sans aucun appel réseau** après la phase de
   recherche (vérifiable dans l'onglet réseau).
2. Durée du classement < 1 s pour 118 offres.
3. Zéro appel Google Maps pendant un scan.
4. Sur le jeu de test : une recherche « webmaster » place ≥ 20 offres en B ou
   mieux, et **aucune** offre K2101 (« conseiller en formation ») au-dessus de C.
5. Une recherche « comptable » avec un profil web ne produit **aucune** offre au-dessus de D.
6. `npm test`, `npm run lint` et `npm run build` passent.

## 9. Limites connues

1. **Les offres non-France-Travail sont notées uniquement par le texte** — environ
   52 % du volume. Moins précis, sans filtre anti-bruit par code métier.
2. **Le ROME évolue** (mise à jour ~mensuelle) : d'où le script de régénération
   plutôt qu'un fichier figé.
3. **Les pondérations sont des hypothèses.** L'affichage du détail par critère est
   précisément ce qui permettra de les corriger à l'usage.
4. **Aucun jugement sur le fond.** Un algorithme ne dira jamais « ces missions
   ressemblent à du commercial déguisé en marketing ». Hors de portée, y compris
   en phase 2.
5. **Aucune taxonomie ne couvre tous les intitulés** (§2.5) — assumé, c'est la
   raison du poids majoritaire donné à la description.

## 10. Hors périmètre

**Phase 2 — embeddings.** Comparaison sémantique via l'API d'embeddings Gemini
(`ai.models.embedContent` accepte un tableau : un appel groupé par scan ; palier
gratuit à 10 M tokens/minute), pour combler la voie texte sur les sources
non-France-Travail. Vecteurs mis en cache dans Dexie. **Spec distinct**, à écrire
après usage réel de la phase 1 — concevoir maintenant reviendrait à supposer les
manques au lieu de les constater.

**Seuil de rejet réglable.** Prévu par la couture `shouldPersist` (§3.5), non
implémenté.

**Analyse IA à la demande sur une offre.** Non retenue à ce stade.
