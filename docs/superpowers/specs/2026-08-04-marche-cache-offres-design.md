# Marché caché — Brique 2 : moissonner les offres — Design

> Brique 1 (`docs/superpowers/specs/2026-08-04-marche-cache-index-design.md`) a
> produit `boards-fr.json` — 448 boards ATS publics ayant au moins une offre en
> France. Cette brique consomme cet index pour faire apparaître ces offres dans
> l'onglet « Offres », comme une quatrième source au même titre que France
> Travail, Adzuna et JSearch.

## 1. Décision d'architecture (validée par Hariss le 04/08/2026)

Trois options ont été posées :

1. **Index léger hebdo + texte en direct** — le rafraîchissement hebdomadaire ne
   committe qu'un index léger (titre/entreprise/lieu/url/date). Au moment d'une
   recherche, seules les offres dont le **titre** matche déjà les mots-clés du
   profil voient leur texte complet récupéré en direct auprès du board.
2. Tout committer chaque semaine (titre + texte complet), à l'image exact de
   `boards-fr.json` aujourd'hui.
3. Stocker le texte complet hors git (Vercel Blob ou équivalent), rafraîchi
   chaque semaine.

**Retenu : l'option 1.** Raison : committer ~9 700 descriptions complètes
gonflerait le dépôt de plusieurs dizaines de Mo *à chaque rafraîchissement
hebdomadaire* (git conserve chaque version dans l'historique — de l'ordre du
Go par an). L'option 3 réglerait ce problème mais ajoute une dépendance et un
service jamais utilisés dans ce projet, contrairement à la contrainte « aucune
dépendance ajoutée » suivie jusqu'ici. L'option 1 ne coûte qu'une recherche
« Marché caché » plus lente (de l'ordre de JSearch, ~15-20 s) — acceptable
pour une source optionnelle, décochée par défaut.

## 2. Ce que l'index léger contient

Nouveau fichier **`web/src/lib/jobs/data/boards-offres.json`**, produit par
`node scripts/build-boards-offres.mjs`, lu par le rafraîchissement hebdomadaire
existant (`.github/workflows/boards-fr.yml`, exécuté après la mise à jour de
`boards-fr.json`).

```ts
interface OffreLegere {
  ats: "greenhouse" | "lever" | "ashby" | "smartrecruiters";
  slug: string;      // slug du board — permet de refaire un appel ciblé
  id: string;         // identifiant de l'offre chez l'ATS
  entreprise: string;  // repris de boards-fr.json au moment du passage
  titre: string;
  lieu: string;        // libellé lisible, ce que l'ATS a donné
  url: string;
  publieLe: string;    // ISO 8601 ; "" si l'ATS n'a rien donné d'exploitable
}
```

**Pas de texte, pas de logo, pas de salaire.** Le texte est le seul champ qui
justifiait l'option 3 (poids) ; les autres champs sont réutilisés tels quels
côté app.

## 3. Champs réels par ATS — vérifiés en direct le 04/08/2026

Vérification faite par appels réels (`curl`) sur des boards déjà dans l'index :
onrunning (Greenhouse), contentsquare (Lever), alan (Ashby), accor
(SmartRecruiters).

| ATS | Endpoint liste (harvest léger) | id | titre | lieu | url | date |
|---|---|---|---|---|---|---|
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` | `id` | `title` | `location.name` | `absolute_url` | `updated_at` (ISO) |
| Lever | `api.lever.co/v0/postings/{slug}?mode=json` | `id` | `text` | `categories.location` | `hostedUrl` | `createdAt` (**epoch ms**, pas ISO) |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{slug}` | `id` | `title` | `location` | `jobUrl` | `publishedAt` (ISO) |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{slug}/postings?country=fr&limit=100` (paginé) | `id` | `name` | `location.fullLocation` | *(voir ci-dessous)* | `releasedDate` (ISO) |

⚠️ **SmartRecruiters ne donne pas d'URL publique dans la liste** (`ref` est
l'URL de l'API, pas la page candidat). Vérifié en direct : l'URL publique se
construit et résout en 200 sans appel supplémentaire :
`https://jobs.smartrecruiters.com/{slug}/{id}` (`slug` = celui déjà connu de
`boards-fr.json`, insensible à la casse). Testé sur Accor : les deux formes
`Accor` et `accor` répondent 200.

⚠️ **Lever et Ashby donnent DÉJÀ le texte complet dans cette même réponse liste**
(`descriptionPlain` chez les deux). Il est délibérément jeté au harvest léger
(§1) et redemandé en direct au moment d'une recherche (§4) — c'est le prix
assumé de l'option 1, pas un oubli.

## 4. Texte complet à la recherche — un fetch par ATS, groupé par board

Une fois les offres candidates sélectionnées (titre qui matche les mots-clés du
profil, cf. §5), leur texte est récupéré :

| ATS | Stratégie | Coût |
|---|---|---|
| Greenhouse | `GET .../jobs/{id}?content=true` — endpoint par offre, vérifié en direct (renvoie `content`, HTML) | 1 appel / offre candidate |
| Ashby | `GET .../posting-api/job-board/{slug}` — pas d'endpoint par id documenté ; on refait l'appel liste et on prend `descriptionPlain` de l'offre demandée | 1 appel / **board** touché (groupé : plusieurs offres candidates du même board ne coûtent qu'un appel) |
| Lever | `GET .../postings/{slug}?mode=json` — même raison qu'Ashby, `descriptionPlain` déjà dedans | 1 appel / board touché |
| SmartRecruiters | `GET .../postings/{id}` — endpoint par offre, vérifié en direct (`jobAd.sections.{companyDescription,jobDescription,qualifications,additionalInformation}`, à concaténer) | 1 appel / offre candidate |

Greenhouse et SmartRecruiters ont un vrai endpoint par offre : pas de gain à
grouper. Lever et Ashby n'en ont pas : grouper par board évite de refaire N
fois le même appel liste pour N offres candidates du même board.

## 5. Filtrage — deux passes, parce que le texte arrive en second

1. **Avant fetch (sur l'index léger seul)** : le titre doit matcher au moins un
   mot-clé de `profile.keywords` (même logique insensible accent/casse que
   `includeFilter.ts`) ; les mots de `profile.excludedWords` ne doivent pas
   apparaître dans le titre ; si `publieLe` est renseigné, l'offre ne doit pas
   dépasser `profile.maxAgeDays`. **Une offre sans `publieLe` exploitable n'est
   pas exclue** — absence de date ≠ preuve d'ancienneté, même principe que
   `null` ≠ `0` en Brique 1.
2. **Après fetch (texte en main)** : `isExcludedText(titre + texte, ...)`
   revérifié — un mot exclu qui n'apparaît que dans la description (ex.
   « stage ») doit encore pouvoir écarter l'offre.

**Aucun filtrage géographique fin** (commune/rayon) : les offres de l'index
sont déjà toutes en France (c'est la définition même de `boards-fr.json`),
et aucun ATS ne donne de coordonnées exploitables sauf SmartRecruiters
(`location.latitude/longitude`, repris quand présent). Filtrer plus finement
demanderait un géocodage hors périmètre de cette brique.

## 6. Garde-fou de volume

Le nombre d'offres dont le texte est effectivement récupéré est **plafonné à
60** par recherche. Au-delà, l'excédent est simplement ignoré (les recherches
réelles — un ou deux intitulés de poste — en trouvent rarement plus d'une
poignée dans 9 700 titres ; le plafond protège contre un mot-clé pathologique
générique, sans quoi une recherche pourrait déclencher des centaines d'appels
vers des APIs publiques et gratuites qu'on ne veut pas maltraiter).

## 7. Intégration au pipeline existant

- `SourceId` (`offer.ts`) gagne `"boards"`.
- `SOURCES`/`DEFAULT_SOURCES` (`sources.ts`) : `{ id: "boards", label: "Marché caché", monthlyQuota: null }`, **décochée par défaut** — comme Adzuna/JSearch à leur introduction, personne n'est surpris par une source qui s'active toute seule.
- `dedupe.ts` PRIORITY : `{ francetravail: 0, boards: 1, jsearch: 2, adzuna: 3 }` — le texte d'un board vient directement de l'employeur, plus complet qu'un extrait d'agrégateur ; il prime donc sur JSearch/Adzuna en cas de doublon, mais pas sur France Travail (source structurée, ROME).
- `/api/jobs/search/route.ts` : nouveau runner `boards: () => searchBoards(profile)` — **aucune clé requise**, donc absent de la vérification `missing`.
- `JobsView.tsx` : nouveau groupe de scan dédié (ni le groupe rapide FT+Adzuna, ni le groupe JSearch) — son profil de latence (texte en direct, jusqu'à 60 fetches) ne ressemble à aucun des deux.
- `SourcePicker.tsx` : `SOURCE_DOMAIN.boards` — pas de domaine unique pertinent (quatre ATS différents) ; `BoardIcon` reçoit `""` et retombe sur son initiale, comme pour toute entreprise sans logo résolu.

## 8. Réserves

- Le plafond de 60 (§6) n'a pas été mesuré sur un usage réel — à ajuster si des
  mots-clés larges (« développeur ») s'avèrent tronqués en pratique.
- `contractLabel`/`salaryLabel` restent vides pour cette source : aucun des
  quatre ATS n'expose une distinction CDI/CDD fiable dans les champs vérifiés
  ici (SmartRecruiters a `typeOfEmployment.label`, en anglais et incomplet
  pour une pastille française) — non traité, hors périmètre.
- Le harvest léger hebdomadaire ne re-visite pas la fraîcheur des offres
  individuellement (pas de TTL par offre comme le mémo de Brique 1) : chaque
  passage hebdomadaire réécrit entièrement `boards-offres.json` à partir des
  448 boards de `boards-fr.json` — un board qui sort de l'index (retombé à
  zéro) sort aussi de `boards-offres.json` au passage suivant.
- `profile.contractTypes`, `qualification` et `tempsPlein` ne filtrent pas
  cette source : aucun des quatre ATS n'expose ces champs de façon fiable et
  uniforme dans les endpoints vérifiés ici. Une offre boards apparaît donc
  quel que soit le réglage de ces pastilles — même limitation, déjà acceptée,
  que d'autres champs pour Adzuna/JSearch (spec §2.6 de la refonte offres).
