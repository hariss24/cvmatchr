# Détecteur d'ATS (Greenhouse / Lever) — Phase 1

**Goal:** à partir d'un nom d'entreprise, deviner si elle publie ses offres sur un
board Greenhouse ou Lever public, et le signaler sur la carte d'offre — première
brique d'un futur annuaire entreprise → ATS.

**Architecture:** une fonction de résolution côté serveur (essaie des slugs
candidats contre les endpoints publics des deux ATS), exposée par une route API
sur le modèle de `/api/jobs/logos`, un cache Dexie par navigateur pour ne jamais
résoudre deux fois la même entreprise, et un export JSON pour ne pas perdre ces
données tant qu'aucun annuaire partagé n'existe.

**Pourquoi côté serveur :** appeler `boards-api.greenhouse.io` depuis le
navigateur dépend du bon vouloir CORS de deux services tiers, qui peuvent le
retirer sans préavis. La route API supprime cette dépendance et suit le chemin
déjà tracé par la résolution des logos.

**Tech Stack:** TypeScript, Dexie (existant), `fetch` natif — aucune dépendance
nouvelle.

## Global Constraints

- Aucune nouvelle dépendance npm.
- Aucune base serveur : tout reste local (Dexie), comme `apiUsage` et
  `commuteCache` aujourd'hui.
- Aucun scan en fond ni robot planifié : la résolution se déclenche à la demande,
  quand une offre avec une entreprise inconnue apparaît dans les résultats.
- Le format d'export doit être ré-important tel quel dans une future base
  partagée (serveur) sans transformation — champs simples, types stables.

---

## 1. Résolution d'un nom d'entreprise vers un ATS

**Entrée :** un nom d'entreprise brut (ex. "Doctolib", "Leboncoin").

**Sortie :** l'un de trois états — `{ ats: "greenhouse", slug }`,
`{ ats: "lever", slug }`, ou `{ ats: "none" }`.

**Méthode :**

1. Dériver 2 à 3 slugs candidats depuis le nom : minuscules, accents retirés,
   espaces/apostrophes remplacés par des tirets ou supprimés (ex. "Leboncoin" →
   `leboncoin`; "Groupe SEB" → `groupe-seb`, `groupeseb`).
2. Pour chaque candidat, tenter dans l'ordre :
   - `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs`
   - `GET https://api.lever.co/v0/postings/{slug}?mode=json`
3. Un match est confirmé si la requête répond 200 **et** le corps contient au
   moins une offre (`jobs.length > 0` pour Greenhouse, tableau non vide pour
   Lever). Un 404 ou une liste vide n'est pas une erreur — juste "pas ce
   candidat".
4. Premier candidat qui matche → résultat retenu, on arrête. Aucun candidat ne
   matche → `{ ats: "none" }`.
5. Toute erreur réseau (timeout, DNS) est traitée comme "pas ce candidat", pas
   comme une exception qui remonte à l'appelant.

**Fichiers :**
- `web/src/lib/jobs/ats.ts` — `atsSlugs(companyName: string): string[]` (pure) et
  `resolveAts(companyName: string, fetchImpl?: typeof fetch): Promise<AtsMatch>`.
  Le paramètre `fetchImpl` permet aux tests d'injecter un faux `fetch` sans
  requête réseau réelle.
- `web/src/app/api/jobs/ats/route.ts` — `POST { companies: string[] }` →
  `{ ats: { "<raison sociale>": { ats, slug } } }`, calquée sur
  `/api/jobs/logos/route.ts` (runtime Node.js, plafond d'entreprises par appel,
  entreprises non résolues simplement absentes de la réponse).

## 2. Cache local (table Dexie)

Chaque entreprise n'est résolue qu'une fois par navigateur. Nouvelle table,
même famille que `commuteCache` :

```ts
interface AtsDirectoryEntry {
  companyKey: string;   // nom normalisé (même normalisation que resolveAts)
  ats: "greenhouse" | "lever" | "none";
  slug: string;         // "" si ats === "none"
  resolvedAt: number;   // Date.now()
}
```

- Nouvelle version Dexie (`v11`) : `atsDirectory: "companyKey"`.
- `getAtsEntry(companyKey)` / `saveAtsEntry(entry)` dans `web/src/lib/storage/db.ts`,
  au même endroit que les fonctions `commuteCache` existantes.
- Pas de TTL : un ATS ne change pratiquement jamais pour une entreprise donnée.
  Une entrée `"none"` reste "none" tant que l'utilisateur n'a pas de raison de
  la revérifier (pas de mécanisme de rafraîchissement en Phase 1).

## 3. Déclenchement et affichage

Quand `JobsView` affiche des résultats de recherche, les entreprises **pas
encore en cache** sont envoyées en un seul appel à `/api/jobs/ats`, en tâche de
fond, sans bloquer l'affichage — exactement le déroulé de `completerLogos`. Les
réponses sont écrites dans la table Dexie.

Sur `JobCard`, si l'entrée en cache pour cette entreprise a `ats !== "none"`,
afficher un lien discret : "Offres directes chez {entreprise}" pointant vers :
- Greenhouse : `https://job-boards.greenhouse.io/{slug}`
- Lever : `https://jobs.lever.co/{slug}`

Si l'entrée n'existe pas encore (résolution en cours) ou vaut `"none"`, aucun
lien n'apparaît — pas d'état de chargement visible, pour rester discret.

## 4. Export — ne pas perdre les données accumulées

Le cache est local à chaque navigateur : sans export, les entreprises
résolues restent enfermées dans le poste de l'utilisateur qui les a
découvertes, et rien ne profite au reste de la base d'utilisateurs.

**Deux mécanismes, deux besoins distincts :**

**(a) Survivre à un vidage de cache.** `exportDatabase()` /`importDatabase()`
(`web/src/lib/storage/backup.ts`) existent déjà et sont branchés sur la page
`/settings` — c'est le filet anti-perte de l'app, et la page prévient déjà que
tout vider fait tout perdre. La table `atsDirectory` y est ajoutée comme les six
autres. Sans ça, l'annuaire serait la seule donnée non sauvegardée.

**(b) Extraire l'annuaire seul, pour l'agréger ailleurs.** Un export dédié
produit un fichier JSON au format plat, directement réimportable dans une future
base partagée :

```json
[
  { "companyKey": "leboncoin", "ats": "lever", "slug": "leboncoin", "resolvedAt": 1754208000000 },
  { "companyKey": "doctolib", "ats": "greenhouse", "slug": "doctolib", "resolvedAt": 1754208500000 }
]
```

- Fonction : `exportAtsDirectory(): Promise<void>` dans
  `web/src/lib/storage/backup.ts`, qui lit toute la table et déclenche le
  téléchargement du blob, sur le patron exact d'`exportDatabase`. Elle ne filtre
  pas les `"none"` : savoir qu'une entreprise a déjà été essayée sans succès
  évite de la retester plus tard.
- Déclenchement : un bouton « Exporter l'annuaire ATS » dans la section
  « Gestion des données » de `/settings`, à côté du bouton « Exporter »
  existant. Pas d'upload automatique, pas de serveur destinataire : le
  propriétaire récupère le fichier et l'agrège lui-même.
- Ce mécanisme est délibérément manuel. Automatiser l'envoi vers un serveur
  partagé suppose ce serveur — hors de portée de cette phase, et une décision
  d'infra à prendre séparément le jour où l'annuaire doit devenir commun.

## Testing

Le projet **ne teste pas ses fonctions Dexie** : `apiUsage.test.ts` ne couvre que
le helper pur `usageKey`, et `fake-indexeddb` n'est pas installé. On suit cette
convention — aucune dépendance nouvelle ne sera ajoutée pour tester la base.

- `ats.test.ts` : `atsSlugs` (accents, espaces, apostrophes, casse) et
  `resolveAts` avec un `fetch` factice injecté — « premier candidat matche »,
  « Greenhouse répond 200 mais liste vide → on continue », « aucun candidat ne
  matche → none », « erreur réseau traitée comme non-match ».
- Les helpers Dexie (`getAtsEntry`, `saveAtsEntry`, `allAtsEntries`) ne sont pas
  testés unitairement, comme les autres helpers de `db.ts`.
- Pas de test réseau réel : toute la suite doit passer hors-ligne.

## Hors scope (explicitement reporté)

- Récupération effective des offres depuis les boards détectés (Phase 2).
- Annuaire partagé / base serveur / synchronisation automatique entre
  utilisateurs.
- Autres ATS (Workable, Ashby, SmartRecruiters…) — Greenhouse et Lever
  couvrent la majorité des entreprises tech, on étend plus tard si utile.
- Revérification périodique des entrées `"none"`.
