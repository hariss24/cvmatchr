# Sources d'offres multi-plateformes — design

**Date :** 2026-07-27
**Statut :** validé, prêt pour le plan d'implémentation
**Maquette :** `docs/design/jobs/` (page-light, page-dark, states) — également poussée
sur Claude Design, projet « Design System », groupe **Offres**.

---

## 1. Problème

L'onglet « Offres » n'interroge que France Travail. La couverture est donc limitée
aux offres déposées sur ce seul canal : ni LinkedIn, ni Indeed, ni Glassdoor, ni les
jobboards privés. Un utilisateur qui cherche réellement un poste va voir plus
d'offres sur Indeed que dans Cvmatchr, et repart.

Contrainte parallèle : l'écran actuel est déjà chargé (formulaire de critères à onze
champs, cinq boutons par offre). Ajouter des sources sans alléger l'interface
aggraverait le problème au lieu de le résoudre.

## 2. Objectif

Élargir la recherche à deux sources supplémentaires, sans multiplier le coût IA ni
alourdir l'écran, et en laissant l'utilisateur maître de sa consommation de quota.

Critères de succès vérifiables :

1. Une recherche avec les trois sources actives renvoie des offres provenant des
   trois, fusionnées dans une seule liste triée par score.
2. Décocher une source garantit qu'aucun appel réseau n'est émis vers elle.
3. Le nombre d'appels IA par recherche reste plafonné à `aiShortlist`, quel que
   soit le nombre de sources actives.
4. Une panne d'une source n'empêche pas les autres de renvoyer leurs offres.
5. Deux publications de la même offre sur deux sources produisent une seule carte.

## 3. Sources retenues

| | France Travail | Adzuna | JSearch (Google for Jobs) |
|---|---|---|---|
| Couverture | offres FT | 270+ jobboards partenaires | LinkedIn, Indeed, Glassdoor… via l'index Google |
| Quota gratuit | illimité | 1 000 appels/mois | 200 appels/mois |
| Logo entreprise | non fourni | non fourni | `employer_logo` (souvent rempli) |
| Rayon géographique | oui (`distance`) | oui (`distance`) | non |
| Statut des clés | en place | **en place** (`.env.local`) | **à créer — prérequis bloquant** |

`ADZUNA_APP_ID` / `ADZUNA_APP_KEY` sont déjà renseignés et vérifiés en direct
(2 258 offres pour « développeur » à Paris). La clé JSearch reste à obtenir : c'est
un prérequis à lever avant d'implémenter le provider correspondant.

## 4. Architecture

### 4.1 Un module par source, un contrat commun

Chaque source devient un module de `lib/jobs/` exposant la même fonction :

```ts
search(profile: JobSearchProfile): Promise<JobOffer[]>
```

Le module traduit le profil unique vers les paramètres de son API et renvoie des
`JobOffer` normalisées. Toute la chaîne en aval — pré-tri, notation IA, seuil,
stockage, affichage — reste strictement inchangée.

- `francetravail.ts` — existant, refactorisé pour exposer ce contrat.
- `adzuna.ts` — nouveau.
- `jsearch.ts` — nouveau.

Ce choix prolonge le découpage déjà en place plutôt que d'en inventer un autre : la
surface de code neuf se limite à « aller chercher les offres », là où le risque est
le plus faible et le comportement le plus testable.

### 4.2 Orchestration

`POST /api/jobs/search` appelle en parallèle les seules sources activées, via
`Promise.allSettled` : une source en échec est journalisée et ignorée, les autres
répondent normalement (critère de succès n° 4). La réponse devient :

```ts
{ offers: JobOffer[], calls: Record<SourceId, number>, failed: SourceId[] }
```

`calls` alimente le compteur de quota local ; `failed` permet d'avertir sans faire
échouer la recherche entière.

### 4.3 Extension du type `JobOffer`

Champs ajoutés, tous alimentés par les providers :

```ts
source: "francetravail" | "adzuna" | "jsearch";
logoUrl: string;        // "" si la source n'en fournit pas
contractLabel: string;  // "CDI · Plein temps", "CDD · 8 mois", "" si inconnu
salaryLabel: string;    // "33–36 k€ / an", "" si non précisé
```

`JobEntry` (Dexie) reçoit les mêmes quatre champs afin que l'affichage survive au
rechargement. Migration **Dexie v9**, sans `upgrade` : les offres déjà stockées
n'ont pas ces champs, l'UI retombe sur ses valeurs de repli (initiale de
l'entreprise, « Salaire non précisé »). Aucun index nouveau — on ne filtre ni ne
trie par source.

### 4.4 Traduction du profil vers chaque API

| Critère du profil | France Travail | Adzuna | JSearch |
|---|---|---|---|
| `keywords` | `motsCles`, une requête par mot-clé | `what`, une requête par mot-clé | `query`, une requête par mot-clé |
| `location` + `radiusKm` | `commune`+`distance` / `departement` / `region` | `where` + `distance` | `location` (pas de rayon) |
| `maxAgeDays` | `minCreationDate`/`maxCreationDate` | `max_days_old` | `date_posted` : le plus grand palier ne dépassant pas `maxAgeDays` (`today`=1, `3days`=3, `week`=7, `month`=30) — 30 j → `month`, 5 j → `3days` |
| `contractTypes` | `typeContrat` | voir 4.5 | non filtré |
| `salaireMin` | `salaireMin`+`periodeSalaire` | `salary_min` | non filtré |
| `excludedWords`, `includeKeywords` | filtre app-side | filtre app-side | filtre app-side |

Les deux derniers filtres restent appliqués uniformément après normalisation, comme
aujourd'hui : ils ne dépendent d'aucune API et garantissent un comportement
identique quelle que soit la source.

**Perte de fidélité assumée :** JSearch ignore rayon, contrat et salaire. Ses
offres traversent donc les filtres app-side (`excludedWords`, `includeKeywords`)
puis le pré-tri par mots-clés, mais peuvent inclure des contrats non souhaités. Le
scoring IA, qui reçoit le profil complet, absorbe l'essentiel de cet écart.

### 4.5 Contrats côté Adzuna

Adzuna n'a pas de notion de CDD : seulement `permanent` (booléen) et `full_time`.
Règle retenue :

- CDI **seul** coché → `permanent=1`.
- Tout autre cas (dont CDI+CDD, le défaut) → **aucun filtre de contrat**.

Filtrer sur `permanent=1` dès que CDI est présent exclurait des CDD légitimes ; ne
pas filtrer laisse `excludedWords` écarter le bruit (stages, alternances).

### 4.6 Dédoublonnage inter-source

Une même offre peut remonter de deux sources (un jobboard partenaire d'Adzuna
republie une offre FT ; Google indexe les deux). Le dédoublonnage par `id`
d'origine ne peut rien contre ça — les identifiants diffèrent.

On réutilise donc la mécanique de `normKey(company, role)` déjà éprouvée par le
tracker de candidatures : normalisation NFD, suppression des diacritiques,
minuscules, réduction aux alphanumériques. À clé identique, une seule offre est
retenue, selon cet ordre de priorité :

1. **France Travail** — description la plus complète et lien direct.
2. **JSearch** — apporte le logo.
3. **Adzuna**.

L'offre retenue **adopte le `logoUrl` d'un doublon écarté** si elle n'en a pas.
Sans cette règle, une offre présente à la fois sur France Travail et sur JSearch
perdrait son logo au profit de la source prioritaire — on garderait la meilleure
description en jetant la seule information visuelle disponible. Aucun autre champ
n'est fusionné : la source gagnante reste la référence.

Le dédoublonnage intervient **avant** le pré-tri, donc avant tout appel IA : deux
publications de la même offre ne consomment jamais deux notations.

Ce choix accepte un risque connu : deux postes réellement distincts au même
intitulé dans la même entreprise fusionnent. C'est le compromis déjà retenu pour
les candidatures, où il n'a pas posé de problème en usage réel.

### 4.7 Plafond IA inchangé

`aiShortlist` (20 par défaut) s'applique au **pool fusionné**, après dédoublonnage
et pré-tri. Trois sources actives ne triplent donc pas le coût IA : elles
améliorent la qualité des vingt offres notées, elles n'en augmentent pas le nombre
(critère de succès n° 3).

### 4.8 Suivi de quota

Nouvelle table Dexie `apiUsage`, clé `"<source>-<YYYY-MM>"`, valeur `{ count }`.
Incrémentée côté client après chaque recherche à partir du champ `calls` de la
réponse. Affichée dans le panneau des sources (« 183/200 ce mois »).

Compteur **local et indicatif** : il compte ce que ce navigateur a consommé, pas ce
que le fournisseur a facturé. Il sert à éviter d'épuiser un quota gratuit sans s'en
rendre compte, pas à faire autorité. Cette limite est assumée et documentée dans
l'interface.

## 5. Interface

Parti pris directeur : **n'afficher que l'essentiel**. Un utilisateur qui cherche du
travail doit voir des offres, pas un tableau de bord de réglages.

### 5.1 Écran principal — une seule ligne

Bouton discret « Mes critères » · résumé textuel des critères actifs
(*Webmaster • Intégrateur web • Paris + 20 km • CDI, CDD*) · bouton « Chercher des
offres ». Rien d'autre au-dessus de la liste.

Le résumé rend le panneau inutile en usage courant : on voit ses réglages sans
avoir à les ouvrir.

### 5.2 Choix des sources — dans le panneau replié

Les trois cases vivent **à l'intérieur** du panneau « Mes critères », déjà replié par
défaut. Zéro élément permanent ajouté à l'écran. Chaque case porte la pastille de
sa source, son nom et son quota consommé.

Décocher une source signifie **ne pas l'interroger** — pas simplement masquer ses
résultats. C'est la seule sémantique qui préserve réellement le quota (critère de
succès n° 2).

Défauts : France Travail activée, Adzuna et JSearch désactivées. L'utilisateur
existant retrouve exactement le comportement actuel tant qu'il n'a rien changé, et
aucun quota n'est consommé à son insu.

Persistance : trois booléens dans `JobSearchProfile`, sauvegardés avec le reste du
profil.

### 5.3 Carte d'offre

Grille deux colonnes, repliée en une seule sous 900 px.

- **En-tête** — vignette d'entreprise, titre (2 lignes max), pastille de source +
  nom d'entreprise ; à droite le score `/100` et la date relative.
- **Faits** — pastilles sur une ligne : lieu, contrat, salaire, temps de trajet.
  Un fait absent s'affiche en gris (« Salaire non précisé ») plutôt que de
  disparaître : l'absence d'information est elle-même une information.
- **Description** — trois lignes, dépliables par « Voir plus ».
- **Pied** — « Adapter mon CV » (action principale, compacte) et « Voir l'offre » ;
  le menu « ⋯ » regroupe Candidater, Suivre et Pas intéressé.

Deux actions visibles au lieu de cinq. Les trois autres restent à un clic
supplémentaire, sans encombrer la grille.

### 5.4 Vignette d'entreprise

`logoUrl` quand la source le fournit (JSearch uniquement) ; sinon l'initiale de
l'entreprise sur fond neutre, et « ? » si l'entreprise est inconnue. Si le
chargement de l'image échoue, on retombe sur l'initiale.

Aucune tentative de deviner un domaine à partir du nom d'entreprise : France
Travail et Adzuna ne fournissent pas de domaine, et la devinette produit
régulièrement le logo d'une autre société. Un logo fiable sur une source vaut mieux
qu'un logo douteux sur les trois.

En thème sombre, la tuile reste claire : les logos d'entreprise sont presque
toujours de l'encre sombre sur fond transparent et disparaîtraient sur fond sombre.

### 5.5 États

- **Recherche en cours** — une ligne (phase, barre de progression, compteur), pas
  un panneau.
- **Aucune offre** — invite à renseigner un poste.
- **Offres trouvées mais aucune retenue** — indique le nombre écarté et oriente
  vers le seuil ou les postes. Ce message existe déjà et doit être conservé : un
  « 0 offre » muet est le pire des retours.
- **Source en échec** — avertissement non bloquant nommant la source ; les autres
  résultats s'affichent normalement.

## 6. Tests

Chaque provider est testé isolément, `fetch` bouchonné, sur trois axes : traduction
du profil vers les paramètres attendus, normalisation d'une réponse réaliste vers
`JobOffer`, et tolérance à une réponse non-200 (renvoie `[]`, ne jette pas).

Au niveau de la route :

- Seules les sources activées sont appelées — vérifié en comptant les appels
  `fetch` par hôte, ce qui teste le critère de succès n° 2 directement plutôt que
  par procuration.
- Une source qui échoue n'empêche pas les autres de renvoyer leurs offres.
- Deux offres de sources différentes partageant `normKey` produisent une seule
  offre, celle de la source la plus prioritaire.
- Le pool fusionné reste plafonné à `aiShortlist`.

Le mapping des contrats Adzuna (4.5) est testé sur ses deux branches.

## 7. Hors périmètre

- Scraping direct de Google, LinkedIn ou Indeed : contraire à leurs CGU, cassant au
  moindre changement de page, et inutile puisque JSearch expose légalement le même
  index.
- Enrichissement de logo par un service tiers (cf. 5.4).
- Filtrage ou tri par source dans la liste : le score reste le seul ordre. Une
  source n'est pas une qualité.
- Refonte du formulaire de critères lui-même : seul l'ajout du bloc « Où chercher »
  le touche.
