# Marché caché — Brique 1 : l'index des boards français

**Goal:** produire et tenir à jour `boards-fr.json`, la liste des entreprises
dont le board ATS public contient au moins une offre en France — le répertoire
d'où la brique 2 ira moissonner les offres.

**Architecture:** un script Node hors ligne, sur le patron exact de
`scripts/build-rome.mjs`, alimenté par deux sources de découverte (les listes de
slugs publiques, puis la base SIRENE), écrivant un fichier JSON commité dans
`web/src/lib/jobs/data/`. Un workflow GitHub Actions hebdomadaire le relance en
incrémental.

**Tech Stack:** Node 22 (`.mjs`, aucune dépendance), `fetch` natif, le
`resolveAts` déjà livré en Phase 1.

## Pourquoi cette brique existe

Les offres publiées sur France Travail, LinkedIn ou Indeed reçoivent des
centaines de candidatures. Les mêmes postes existent souvent sur le board ATS de
l'entreprise, où presque personne ne va. L'objectif est d'atteindre ces
offres — mais on ne peut pas les chercher sans savoir *où* chercher. Cette
brique construit cette carte, et rien d'autre.

## Global Constraints

- Aucune dépendance npm nouvelle, ni dans le script ni dans l'app.
- Le script ne touche jamais à `web/` hors du fichier de données qu'il produit.
- Aucun secret : les quatre ATS et l'API entreprises sont publics et sans clé.
- Le fichier produit est commité et versionné : un rafraîchissement doit donner
  un diff lisible, entreprise par entreprise.
- La brique ne récupère aucune offre et ne modifie aucune page de l'app.

---

## 1. Le fichier produit

`web/src/lib/jobs/data/boards-fr.json` — un tableau plat, trié par `nom` pour
que le diff d'un rafraîchissement reste lisible :

```json
[
  {
    "nom": "Accor",
    "ats": "smartrecruiters",
    "slug": "accor",
    "offresFR": 192,
    "siren": "602036444",
    "vuLe": "2026-08-04"
  },
  {
    "nom": "Contentsquare",
    "ats": "lever",
    "slug": "contentsquare",
    "offresFR": 5,
    "siren": null,
    "vuLe": "2026-08-04"
  }
]
```

- `ats` : l'une des quatre valeurs de `AtsProvider` (`greenhouse`, `lever`,
  `ashby`, `smartrecruiters`).
- `offresFR` : le nombre d'offres françaises constaté au dernier passage. Sert à
  prioriser la moisson en brique 2 et à repérer un board qui se vide.
- `siren` : renseigné par la source B seulement, `null` pour la source A. C'est
  ce qui permettra plus tard de rapprocher une entreprise de sa fiche publique.
- `vuLe` : date ISO courte du dernier passage réussi. Pilote l'incrémental.

Ordre de grandeur attendu : quelques milliers d'entrées, quelques centaines de
Ko — comparable aux `rome-*.json` déjà commités (0,8 et 1,4 Mo).

## 2. Source A — les listes de slugs publiques

Trois listes de slugs, maintenues par le dépôt `Feashliaa/job-board-aggregator`
à partir de Common Crawl :

| ATS | URL | slugs |
|---|---|---|
| Greenhouse | `raw.githubusercontent.com/Feashliaa/job-board-aggregator/main/data/greenhouse_companies.json` | 8 333 |
| Lever | `.../data/lever_companies.json` | 4 368 |
| Ashby | `.../data/ashby_companies.json` | 3 161 |

Pour chaque slug : appeler l'endpoint du board, compter les offres dont le lieu
est français (§4), et retenir le board si ce compte est ≥ 1.

**Il n'existe pas de liste SmartRecruiters** — ni dans ce dépôt (le répertoire
`data/` contient ashby, bamboohr, greenhouse, icims, lever, paylocity, workday),
ni via une API d'énumération publique (`/v1/companies` répond 404). SmartRecruiters
n'est donc atteint que par la source B.

**Licence :** ces listes sont publiées sous CC BY-NC 4.0 — usage non commercial.
Elles sont utilisées ici comme amorce de découverte pour interroger des APIs
publiques, dans un usage personnel. Le jour d'une exploitation commerciale, cette
source devra être remplacée par une régénération maison depuis Common Crawl, qui
est la source publique dont ces listes dérivent. Le script isole cette source
derrière une seule fonction pour que ce remplacement ne touche rien d'autre.

## 3. Source B — les entreprises françaises

`https://recherche-entreprises.api.gouv.fr/search` — base SIRENE, sans clé,
Licence Ouverte. Pour chaque entreprise retenue, on dérive ses slugs candidats
avec `atsSlugs` (Phase 1), puis on interroge les quatre ATS en parallèle.

**On ne réutilise pas `resolveAts` tel quel.** Il répond « ce board existe et a
au moins une offre » — pas « au moins une offre *en France* » — et il ne rend
aucun compte. L'index a besoin des deux. La source B applique donc le même
comptage que la source A (§4) : elle récupère le board et compte les offres
françaises. `atsSlugs`, en revanche, est réutilisé sans modification : la
dérivation des slugs candidats est identique.

Pour SmartRecruiters, le paramètre `country=fr` donne ce compte directement,
côté serveur, sans rapatrier le board — mesuré sur Accor : 530 offres au total,
192 avec le filtre.

Périmètre initial : les entreprises **actives** à partir de 200 salariés, prises
tranche d'effectif par tranche d'effectif. Comptes relevés le 04/08/2026 :

| Tranche INSEE | Effectif | Entreprises actives |
|---|---|---|
| 31 | 200–249 | 3 125 |
| 32 | 250–499 | 6 007 |
| 41 | 500–999 | 2 952 |
| 42 | 1 000–1 999 | 1 473 |
| 51 | 2 000–4 999 | 831 |
| 52 | 5 000–9 999 | 174 |
| 53 | 10 000 et + | 89 |
| | **Total** | **14 651** |

Ce découpage n'est pas cosmétique : **l'API plafonne la pagination à 10 000
résultats**. Chacune de ces tranches passe sous le plafond, donc aucun découpage
supplémentaire n'est nécessaire. Les tranches 21 (50–99) et 22 (100–199) le
dépassent toutes deux et sont hors périmètre initial ; les inclure exigera un
découpage par département, ce qui est un travail distinct.

Le nom testé est `nom_complet`. Une entreprise dont aucun slug ne résout n'est
pas réessayée avant l'expiration de son `vuLe` (§5) — y compris les échecs, pour
ne pas repayer 14 651 résolutions à chaque passage.

## 4. Reconnaître une offre « en France »

Les quatre ATS écrivent le lieu différemment. Formats relevés sur de vraies
réponses le 04/08/2026 :

```
Greenhouse       "Berlin, Berlin, Germany"   "Frankfurt"   "Münster; Osnabrück"
Ashby            "Paris, France"             "Anywhere in France"
Lever            "Montpellier, France"       "Remote, Brasil"
SmartRecruiters  champ structuré : { city: "Lille", country: "fr" }
```

**Règle, dans cet ordre :**

1. **SmartRecruiters** expose le pays en champ structuré. On lit `country`, on ne
   devine jamais sur du texte.
2. Pour les trois autres, un **marqueur de pays fait foi** : `France`,
   `, fr` en fin de segment, `(FR)`. Insensible à la casse et aux accents.
3. À défaut de marqueur, une **liste de villes françaises** sert de repli — mais
   la correspondance est **rejetée** si la chaîne contient par ailleurs un autre
   marqueur de pays ou un code d'état américain. Sans cette garde, « Paris, TX »
   et « Paris, Texas » entrent dans l'index.
4. Une chaîne sans marqueur de pays ni ville connue est écartée. C'est le bon
   comportement : `"Frankfurt"` seul est allemand.

Cette logique est une fonction pure, isolée du réseau, et c'est la seule partie
de la brique réellement testée unitairement.

## 5. Incrémental

Le script relit `boards-fr.json` avant de commencer. Une entrée dont `vuLe`
remonte à moins de 30 jours n'est pas re-testée. Sans ça, chaque exécution
hebdomadaire repaierait le balayage complet — 1,6 Go pour la source A, 14 651
résolutions pour la source B — sans rien apprendre.

Un drapeau `--complet` force le re-test intégral, pour le jour où la logique de
détection change et où l'index doit être reconstruit.

Une entrée dont le board ne répond plus, ou n'a plus d'offre française, est
**retirée** du fichier. L'index décrit l'état courant, pas un historique.

## 6. Exécution

Script : `scripts/build-boards-fr.mjs`, invoqué `node scripts/build-boards-fr.mjs`.

Workflow : `.github/workflows/boards-fr.yml`, **distinct de `boucle.yml`** —
une moisson réseau n'a rien à faire dans le même job qu'un agent qui écrit du
code, et l'échec de l'une ne doit pas emporter l'autre.

- Déclenchement : `schedule` hebdomadaire, plus `workflow_dispatch`.
- **`concurrency: group: boucle-autonome`** — le même groupe que la boucle. Les
  deux workflows commitent sur `main` ; sans ce verrou partagé, un `push`
  simultané échoue ou écrase. C'est la seule raison de partager le groupe.
- Le job commite le fichier s'il a changé, et ne commite rien sinon.

## Coûts mesurés

| | requêtes | volume | durée |
|---|---|---|---|
| Source A, balayage complet | 15 862 | 1,6 Go mesurés | ~5 min mesurées |
| Source B, 14 651 entreprises | ~117 000 | faible | ~20–40 min estimées |

La source A est mesurée. La source B est estimée : 14 651 entreprises × 2 slugs
× 4 ATS, dont l'écrasante majorité répond 404 en quelques dizaines de
millisecondes sans corps. Seuls les rares boards existants sont rapatriés, d'où
un volume faible malgré le nombre de requêtes.

Les deux tiennent très au large sous la limite de 6 h d'un job GitHub Actions.

**Politesse réseau :** ces APIs sont publiques et gratuites, et personne ne nous
a invités. Le script plafonne la concurrence (12 requêtes simultanées, la valeur
utilisée pour les mesures ci-dessus) et abandonne une requête au-delà de 15 s.
Un balayage plus agressif ne gagnerait que des minutes et risquerait un
bannissement d'IP qui coûterait la brique entière.

## Testing

Le projet ne teste pas ses scripts de build ; il teste la **cohérence du fichier
produit** — c'est ce que fait `rome-data.test.ts`. Même convention :

- `boards-fr.test.ts` : chaque entrée a les six champs, `ats` appartient aux
  quatre valeurs connues, `offresFR` est un entier ≥ 1, aucun doublon sur
  `ats + slug`, le tableau est trié par `nom`.
- La détection « France » est testée unitairement sur les huit formats réels
  ci-dessus, plus les pièges : `Paris, TX`, `Paris, Texas`, chaîne vide.
- Aucun test réseau : la suite doit passer hors ligne.

## Réserves

**Le rendement de la source B est une extrapolation, pas une mesure.** Les 33 %
avancés viennent d'un sondage sur 49 entreprises françaises choisies à la main,
majoritairement tech et connues. La population SIRENE est tout autre — on y
trouve La Poste et des industriels régionaux. Le rendement réel sera plus bas.
La première exécution du script donnera le chiffre ; il faudra l'inscrire ici.

**Le volume final restera modeste.** La source A donne ~1 400 offres françaises,
extrapolées d'un échantillon de 450 boards. Ce ne sera jamais France Travail.
Le pari est la rareté, pas le volume.

## Hors scope

- La récupération des offres depuis les boards indexés — brique 2.
- La notation, le dédoublonnage contre les jobboards, l'affichage — brique 3.
- Les entreprises de 50 à 199 salariés (tranches 21 et 22), qui exigent un
  découpage par département.
- Les ATS à authentification (Taleez, Flatchr, Digitalrecruiters, Welcome to the
  Jungle) et ceux qui exigent l'URL du locataire (Workday, SuccessFactors,
  Cegid Talentsoft).
- Workable, Recruitee, Teamtailor, Personio : sondés sur 49 entreprises
  françaises le 03/08/2026, **zéro résultat**. Workable répond en outre `200`
  avec un board vide pour presque n'importe quel nom.
