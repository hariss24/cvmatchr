# Détecteur d'ATS (Greenhouse / Lever) — Phase 1

**Goal:** à partir d'un nom d'entreprise, deviner si elle publie ses offres sur un
board Greenhouse ou Lever public, et le signaler sur la carte d'offre — première
brique d'un futur annuaire entreprise → ATS.

**Architecture:** une fonction pure de résolution (essaie des slugs candidats
contre les endpoints publics des deux ATS), un cache Dexie par navigateur pour ne
jamais résoudre deux fois la même entreprise, et une fonction d'export JSON pour
ne pas perdre ces données tant qu'aucun annuaire partagé n'existe.

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

**Fichier :** `web/src/lib/jobs/ats/resolve.ts`, fonction
`resolveAts(companyName: string, fetchImpl = fetch): Promise<AtsMatch>` — le
paramètre `fetchImpl` permet aux tests d'injecter un faux `fetch` sans requête
réseau réelle.

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

Quand `JobsView` affiche des résultats de recherche, pour chaque entreprise
**pas encore en cache**, on appelle `resolveAts` en tâche de fond (une par
entreprise, sans bloquer l'affichage des résultats déjà connus), puis on
enregistre le résultat.

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

**Ce que Phase 1 fournit :** une fonction d'export qui produit un fichier JSON
téléchargeable, format stable et directement réimportable dans une future base
partagée :

```json
[
  { "companyKey": "leboncoin", "ats": "lever", "slug": "leboncoin", "resolvedAt": 1754208000000 },
  { "companyKey": "doctolib", "ats": "greenhouse", "slug": "doctolib", "resolvedAt": 1754208500000 }
]
```

- Fonction : `exportAtsDirectory(): Promise<AtsDirectoryEntry[]>` dans
  `web/src/lib/storage/db.ts`, qui lit toute la table et retourne le tableau
  (ne filtre pas les `"none"` : savoir qu'une entreprise a déjà été essayée sans
  succès évite de la retester plus tard).
- Déclenchement : un bouton "Exporter l'annuaire ATS" dans les réglages/débug
  de l'app (même emplacement que les autres exports de données existants s'il y
  en a, sinon une nouvelle petite section dans `/settings`), qui déclenche le
  téléchargement du JSON via un blob — pas d'upload automatique, pas de serveur
  destinataire : l'utilisateur (le propriétaire, dans un premier temps) récupère
  le fichier et l'agrège manuellement.
- Ce mécanisme est délibérément manuel. Automatiser l'envoi vers un serveur
  partagé suppose ce serveur — hors de portée de cette phase, et une décision
  d'infra à prendre séparément le jour où l'annuaire doit devenir commun.

## Testing

- `resolve.ts` : tests unitaires avec un `fetch` factice injecté — cas
  "premier candidat matche", "aucun candidat ne matche", "erreur réseau traitée
  comme non-match", "dérivation de slug" (accents, espaces, apostrophes).
- `db.ts` (ajouts) : tests Dexie existants déjà en place pour `commuteCache` /
  `apiUsage` servent de modèle — tester `getAtsEntry`/`saveAtsEntry` et
  `exportAtsDirectory` avec `fake-indexeddb` (déjà utilisé dans le projet).
- Pas de test réseau réel : toute la suite doit passer hors-ligne.

## Hors scope (explicitement reporté)

- Récupération effective des offres depuis les boards détectés (Phase 2).
- Annuaire partagé / base serveur / synchronisation automatique entre
  utilisateurs.
- Autres ATS (Workable, Ashby, SmartRecruiters…) — Greenhouse et Lever
  couvrent la majorité des entreprises tech, on étend plus tard si utile.
- Revérification périodique des entrées `"none"`.
