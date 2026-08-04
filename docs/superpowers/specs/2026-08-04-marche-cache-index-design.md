# Marché caché — Brique 1 : l'index des boards français

**Goal:** produire et tenir à jour `boards-fr.json`, la liste des entreprises
dont le board ATS public contient au moins une offre en France — le répertoire
d'où la brique 2 ira moissonner les offres.

**Architecture:** un script Node hors ligne, sur le patron exact de
`scripts/build-rome.mjs`, alimenté par deux sources de découverte (les listes de
slugs publiques, puis la base SIRENE), écrivant deux fichiers JSON commités dans
`web/src/lib/jobs/data/` — l'index et la mémoire de ce qui a déjà été testé (§1).
Un workflow GitHub Actions hebdomadaire le relance en incrémental.

**Tech Stack:** Node 22 (`.mjs`, aucune dépendance), `fetch` natif.

**Ce que la Phase 1 ne peut pas prêter.** Ni `resolveAts` ni `atsSlugs` ne sont
importables ici, pour deux raisons distinctes :

- `resolveAts` répond à une autre question — voir §3.
- `atsSlugs` répond à la bonne question, mais vit dans `web/src/lib/jobs/ats.ts`,
  en TypeScript, à l'intérieur de l'app. Un script `.mjs` ne peut pas importer un
  `.ts`, et l'app ne peut pas importer depuis `scripts/`. La dérivation des slugs
  est donc **dupliquée** dans `scripts/boards/slugs.mjs` — huit lignes, sans
  logique cachée. Les deux copies sont épinglées par des **vecteurs de test
  identiques**, cités de part et d'autre, pour qu'une divergence casse une suite
  au lieu de produire un index silencieusement faux.

## Pourquoi cette brique existe

Les offres publiées sur France Travail, LinkedIn ou Indeed reçoivent des
centaines de candidatures. Les mêmes postes existent souvent sur le board ATS de
l'entreprise, où presque personne ne va. L'objectif est d'atteindre ces
offres — mais on ne peut pas les chercher sans savoir *où* chercher. Cette
brique construit cette carte, et rien d'autre.

## Global Constraints

- Aucune dépendance npm nouvelle, ni dans le script ni dans l'app.
- Le script ne touche jamais à `web/` hors des deux fichiers de données qu'il
  produit (§1).
- Aucun secret : les quatre ATS et l'API entreprises sont publics et sans clé.
- L'index produit est commité et versionné : un rafraîchissement doit donner un
  diff lisible, entreprise par entreprise. C'est cette contrainte qui impose de
  sortir la mémoire des négatifs dans un second fichier (§1).
- La brique ne récupère aucune offre et ne modifie aucune page de l'app.

---

## 1. Les deux fichiers produits

Le script écrit **deux** fichiers, aux rôles opposés. Les séparer n'est pas un
confort : l'index doit rester un diff lisible (contrainte globale), et la mémoire
des négatifs pèse cent fois plus que lui tout en changeant à chaque passage.

| Fichier | Contenu | Lu par |
|---|---|---|
| `web/src/lib/jobs/data/boards-fr.json` | les boards ayant ≥ 1 offre française | la brique 2 |
| `web/src/lib/jobs/data/boards-fr-testes.json` | tout ce qui a été testé, succès comme échecs | le script seul |

### 1.1 `boards-fr.json` — l'index

Un tableau plat, trié par `nom` puis `ats` — le second critère départage deux
entrées de même nom sur deux ATS, sans quoi l'ordre serait instable d'un
passage à l'autre et le diff illisible :

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
- `offresFR` : le nombre d'offres françaises constaté au dernier passage.
  **Toujours ≥ 1 dans ce fichier** — un board tombé à zéro sort de l'index et ne
  subsiste que dans le mémo (§5). Sert à prioriser la moisson en brique 2.
- `siren` : renseigné par la source B seulement, `null` pour la source A. C'est
  ce qui permettra plus tard de rapprocher une entreprise de sa fiche publique.
- `vuLe` : date ISO courte du dernier passage réussi. Pilote l'incrémental.

**D'où vient `nom` :** la source B le tient de SIRENE (`nom_complet`). La
source A ne connaît **que le slug** — vérifié le 04/08/2026 : la racine Ashby ne
porte que `{jobs, apiVersion}`, et aucune offre Lever ni Greenhouse ne contient
de champ entreprise. Pour la source A, `nom` est donc le slug remis en forme
(tirets en espaces, initiales capitalisées) : `contentsquare` → `Contentsquare`,
`loft-orbital` → `Loft Orbital`. C'est une étiquette d'affichage, imparfaite et
assumée ; la source B écrase cette valeur par la raison sociale réelle si elle
retrouve la même entreprise.

Ordre de grandeur attendu : quelques centaines d'entrées au sortir de la source A
(~300 boards, extrapolés de l'échantillon de 450), quelques milliers une fois la
source B passée. Soit quelques dizaines à quelques centaines de Ko — bien en
deçà des `rome-*.json` déjà commités (0,8 et 1,4 Mo).

### 1.2 `boards-fr-testes.json` — le mémo

La liste de tout ce qui a été essayé, succès **et** échecs, sans quoi
l'incrémental du §5 n'a rien sur quoi s'appuyer :

```json
[
  { "cle": "lever:contentsquare", "offresFR": 5, "vuLe": "2026-08" },
  { "cle": "greenhouse:boulangerie-durand", "offresFR": 0, "vuLe": "2026-08" }
]
```

- `cle` : `"<ats>:<slug>"`, l'identité stable d'un board.
- `offresFR: 0` signifie « testé, rien trouvé » — pas « jamais testé ».
- `vuLe` est ici au **mois**, pas au jour. Avec une TTL de l'ordre du mois (§5)
  et un passage
  hebdomadaire, une date au jour ferait bouger un quart des ~30 000 lignes à
  chaque exécution. Le mois suffit à piloter la TTL et réduit le bruit du diff.

Ce fichier atteindra ~30 000 entrées (~1,5 Mo). Rien ne le lit hors du script :
le supprimer ne coûte qu'un balayage complet de plus.

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

**On ne réutilise pas `resolveAts`.** Il répond « ce board existe et a au moins
une offre » — pas « au moins une offre *en France* » — et il ne rend aucun
compte. L'index a besoin des deux. La source B applique donc le même comptage
que la source A (§4) : elle récupère le board et compte les offres françaises.

La dérivation des slugs, elle, est identique à celle de la Phase 1, mais
dupliquée pour la raison technique exposée en tête de document.

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

**`per_page` est plafonné à 25** — l'API refuse toute valeur supérieure. Énumérer
les 14 651 entreprises coûte donc 587 pages, soit quelques minutes. Vérifié le
04/08/2026 qu'une page profonde répond bien (tranche 32, page 240 sur 240).

Le nom testé est `nom_complet`. Chaque couple `<ats>:<slug>` essayé est inscrit
dans le mémo (§1.2), qu'il ait abouti ou non, et n'est pas réessayé avant
l'expiration de sa TTL (§5) — sans cette trace des échecs, les 14 651 résolutions
seraient repayées à chaque passage.

## 4. Reconnaître une offre « en France »

Les quatre ATS écrivent le lieu différemment. Formats relevés sur de vraies
réponses le 04/08/2026 :

```
Greenhouse       "Berlin, Berlin, Germany"   "Frankfurt"   "Paris"
Ashby            "Paris, France"             "Anywhere in France"   "Paris"
Lever            "Paris Area, France"        "Toulouse, Occitanie"  "Remote, Brasil"
SmartRecruiters  champ structuré : { city: "Lille", country: "fr" }
Lever            champ structuré : country: "FR"   (présent, mais pas toujours)
```

**Règle, dans cet ordre :**

1. **Champ pays structuré, s'il existe.** SmartRecruiters le donne toujours
   (`location.country`), Lever souvent (`country`, code ISO : `FR`, `SA`, `PL`,
   `US`…). Quand il est là, il fait foi et on ne regarde pas le texte.
2. **Marqueur de pays dans le texte** : `France`, `, fr` en fin de segment,
   `(FR)`. Insensible à la casse et aux accents.
3. **Ville ou région française** dans le texte. La correspondance est **rejetée**
   si la chaîne porte par ailleurs un autre marqueur de pays ou un code d'état
   américain — sans cette garde, « Paris, TX » et « Paris, Texas » entrent dans
   l'index.
4. Rien de tout cela : écarté. C'est le bon comportement, `"Frankfurt"` seul est
   allemand.

**La règle 3 n'est pas un repli, elle est portante.** Mesuré le 04/08/2026 :

| Board | offres FR avec marqueur de pays | ville ou région seule |
|---|---|---|
| On Running (Greenhouse) | **0** | **8** — `"Paris"` |
| Loft Orbital (Lever) | 1 | **13** — `"Toulouse, Occitanie"` |
| Alan (Ashby) | 69 | 2 — `"Paris"` |

Sans la règle 3, On Running disparaît **entièrement** de l'index et Loft Orbital
perd 13 de ses 14 offres. La liste doit donc couvrir les villes françaises
usuelles **et les treize régions** : `"Toulouse, Occitanie"` n'a pas de marqueur
de pays, et le nom de région est une preuve plus forte qu'un nom de ville — aucune
région française n'a d'homonyme étranger, contrairement à Paris ou Nice.

Le champ structuré de Lever ne dispense pas des règles 2 et 3 : il est absent de
certains boards, Loft Orbital le premier — celui-là même dont 13 offres ne
tiennent qu'à la règle 3.

Cette logique est une fonction pure, isolée du réseau, et c'est la seule partie
de la brique réellement testée unitairement.

## 5. Incrémental

Le script relit **`boards-fr-testes.json`** — pas l'index — avant de commencer.
Une clé `<ats>:<slug>` dont le `vuLe` est **le mois courant ou le précédent**
n'est pas re-testée, qu'elle ait donné un résultat ou non.

La TTL s'exprime en mois parce que le mémo date au mois (§1.2) : une durée en
jours n'y serait pas calculable. L'ancienneté réelle tolérée oscille donc entre
30 et 60 jours selon le moment du mois — une imprécision sans conséquence, un
ATS ne changeant pas en huit semaines.

C'est le mémo, et lui seul, qui rend l'incrémental possible. L'index ne contient
que les succès ; s'appuyer sur lui laisserait sans mémoire les dizaines de
milliers de slugs testés en vain, et chaque exécution hebdomadaire repaierait
l'intégralité du balayage — 1,6 Go et ~117 000 requêtes — pour ne rien
apprendre de neuf.

Un drapeau `--complet` ignore la TTL et force le re-test intégral, pour le jour
où la logique de détection change et où l'index doit être reconstruit.

### Ce qui se passe quand un board ne répond plus

**Une erreur réseau n'écrit rien.** Timeout, DNS, 5xx, connexion coupée :
l'entrée garde sa valeur et sa date précédentes, et sera réessayée au passage
suivant.

C'est la règle la plus importante de cette section. Le code de la Phase 1 traite
une erreur réseau comme un non-match ; transposer ce comportement ici suffirait à
vider l'index un jour de réseau dégradé sur le *runner*, ou pendant une panne
d'Ashby — et comme le fichier est commité, la perte deviendrait un commit.

Seule une réponse **HTTP 200 exploitable** fait autorité :

- 200 avec au moins une offre française → l'entrée est mise à jour dans l'index.
- 200 avec zéro offre française, ou 404 → `offresFR: 0` dans le mémo, et
  l'entrée **sort de l'index** si elle y était.

L'index décrit donc l'état courant constaté, jamais un état supposé.

## 6. Exécution

Script : `scripts/build-boards-fr.mjs`, invoqué `node scripts/build-boards-fr.mjs`.

Workflow : `.github/workflows/boards-fr.yml`, **distinct de `boucle.yml`** —
une moisson réseau n'a rien à faire dans le même job qu'un agent qui écrit du
code, et l'échec de l'une ne doit pas emporter l'autre.

- Déclenchement : `schedule` hebdomadaire, plus `workflow_dispatch`.
- **`concurrency: group: boucle-autonome`** — le même groupe que la boucle. Les
  deux workflows commitent sur `main` ; sans ce verrou partagé, un `push`
  simultané échoue ou écrase. C'est la seule raison de partager le groupe.
- Le job commite les **deux** fichiers s'ils ont changé, et ne commite rien
  sinon. Un passage entièrement servi par la TTL ne produit aucun commit.

## Coûts mesurés

| | requêtes | volume | durée |
|---|---|---|---|
| Source A, balayage complet | 15 862 | 1,6 Go mesurés | ~5 min mesurées |
| Source B, 14 651 entreprises | ~117 000 | faible | ~20–40 min estimées |

La source A est mesurée. La source B est estimée, et **117 000 est un majorant,
pas une prévision** : `atsSlugs` ne rend qu'un seul slug quand la variante collée
égale la variante tiretée (« Doctolib »), et la recherche s'arrête au premier
slug qui résout. L'écrasante majorité des appels répond 404 en quelques dizaines
de millisecondes sans corps ; seuls les rares boards existants sont rapatriés,
d'où un volume faible malgré le nombre de requêtes.

**Ashby n'a pas de mode léger.** Testé le 04/08/2026 sur le board d'Alan :
`?includeCompensation=false` et `?includeContent=false` renvoient 1 666 Ko, soit
exactement le poids de l'appel nu. Les descriptions complètes sont incompressibles.
Ashby coûte donc ~1,7 Mo par board pour le rendement le plus faible des quatre
(0,7 %) — c'est admis, pas à ré-optimiser.

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
  quatre valeurs connues, `offresFR` est un entier **≥ 1** (un zéro dans l'index
  est le symptôme d'une suppression manquée, §5), aucun doublon sur `ats + slug`,
  le tableau est trié par `nom` puis `ats`.
- Le mémo `boards-fr-testes.json` n'est **pas** testé : rien ne le lit hors du
  script, et le perdre ne coûte qu'un balayage.
- La détection « France » est testée unitairement sur tous les formats réels du
  §4 — `"Paris, France"`, `"Anywhere in France"`, `"Paris Area, France"`,
  `"Toulouse, Occitanie"`, `"Paris"` seul, `"Berlin, Berlin, Germany"`,
  `"Remote, Brasil"`, `"Frankfurt"` — plus les pièges : `"Paris, TX"`,
  `"Paris, Texas"`, chaîne vide, et un champ structuré `country: "FR"` qui doit
  l'emporter sur un texte trompeur.
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
