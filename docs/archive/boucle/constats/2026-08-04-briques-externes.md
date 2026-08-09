# Constat — briques externes au 2026-08-04

**Mesuré par :** lecture de `web/src/lib/scraper/scraper.ts`,
`web/src/lib/jobs/logos.ts`, `web/src/lib/jobs/reseau.ts` ; `curl -s
https://registry.npmjs.org/<paquet>` (métadonnées npm) ; `curl -s
https://api.github.com/repos/mozilla/readability` (activité GitHub) ; `wc -l`
sur les fichiers concernés.

## Périmètre

Le domaine du jour porte sur le code applicatif fait main dans `web/src/lib/`
qu'une bibliothèque existante ferait aussi bien, ou mieux. Six modules
examinés : extraction de contenu depuis une page web (`scraper.ts`),
résolution de logo d'entreprise (`logos.ts`), limiteur de concurrence réseau
(`reseau.ts`), génération JSON depuis l'IA (`ai/json.ts`), clé de
dédoublonnage (`applications/normKey.ts`), protection SSRF (`scraper/ssrf.ts`).
Un seul propose un gain net démontrable ; les autres sont documentés en
« examinés, non retenus » ci-dessous, avec preuve à l'appui — le rôle demande
d'inventorier, pas seulement de retenir ce qui confirme une intuition.

## Mesures

### 1. Extraction du texte d'une offre (`scraper.ts:86-129`) vs `@mozilla/readability`

`scrapeJobText` élimine le bruit d'une page HTML par une liste de sélecteurs
CSS écrite à la main (`noiseSelectors`, 9 motifs : nav/header/footer/cookie/
banner/modal/popup/sidebar/role) puis cherche un conteneur candidat dans une
seconde liste écrite à la main (`candidates`, 7 sélecteurs dont
`[class*="job-description"]`, `article`, `main`, `body` en dernier recours) —
44 lignes (`scraper.ts:90-129`). Si le texte obtenu fait moins de 200
caractères, l'extraction est jugée ratée et le code retombe sur Jina AI
Reader (`r.jina.ai`, service tiers payant au-delà d'un quota gratuit).

`@mozilla/readability` est la bibliothèque qui alimente le mode lecture de
Firefox : au lieu de sélecteurs devinés, elle score chaque nœud du DOM par
densité de texte et structure (ponctuation, longueur de paragraphe, position)
pour isoler l'article principal — sans liste de sélecteurs à maintenir par
site.

- **Licence :** Apache-2.0 (`registry.npmjs.org/@mozilla/readability`,
  champ `license`) — compatible avec un usage commercial.
- **Dernier commit :** `pushed_at: 2026-08-04T00:16:05Z` (`api.github.com/
  repos/mozilla/readability`, consulté le 04/08/2026) — actif aujourd'hui
  même.
- **Activité :** 11 378 étoiles, 308 issues/PR ouvertes (signe d'un usage
  large, pas d'un projet mort) ; mainteneur Mozilla, pas un individu isolé.
- **Dernière version publiée :** 0.6.0, le 03/03/2025 (`registry.npmjs.org`,
  champ `time`).
- **Poids ajouté :** le paquet lui-même est petit (154 574 o non compressés,
  `dist.unpackedSize`), mais Readability exige un vrai DOM (`document`), pas
  le parseur allégé de `cheerio` — il faut `jsdom` en production. `jsdom` pèse
  7 086 515 o non compressés avec 21 dépendances directes
  (`registry.npmjs.org/jsdom`, latest `30.0.1`, licence MIT, publié le
  29/07/2026). `jsdom` est déjà présent au dépôt, mais en `devDependencies`
  seulement (tests Vitest) — l'usage en production serait nouveau. `scraper.ts`
  ne s'exécute que côté serveur (route `api/extract-job/route.ts`), donc ce
  poids n'atteint jamais le navigateur, mais alourdit la fonction serverless
  (taille de déploiement, temps de cold start sur Vercel — non mesuré ici).
- **Ce qu'on retire en échange :** les 44 lignes de sélecteurs faits main
  (`noiseSelectors` + `candidates`), qui doivent aujourd'hui être mises à jour
  à la main chaque fois qu'un nouveau site à la structure inhabituelle échoue
  silencieusement (repli sur Jina, payant au-delà du quota gratuit).

### 2. Résolution de logo d'entreprise (`logos.ts`, 354 lignes) — examiné, non retenu

Système bâti après deux échecs documentés dans le code lui-même (deviner le
domaine depuis le nom, puis se fier à l'annuaire Brandfetch seul) : les deux
ont produit de faux logos (`logos.ts:8-17`, exemples cités : `nexton.com.pk`,
`nexton-net.jp` pour une seule entreprise « Nexton » réelle basée sur
`nexton-group.com`). La version actuelle combine déjà Brandfetch (annuaire) et
Google Favicons (repli) avec des filtres de plausibilité et une visite de
page pour confirmer la langue/le titre. Aucune bibliothèque ni API tierce
trouvée qui résout ce problème précis (nom d'entreprise ambigu → domaine
exact) mieux que cette combinaison déjà réglée sur des cas réels observés en
production — remplacer ce module reviendrait à réintroduire les deux échecs
déjà documentés. Non retenu.

### 3. Limiteur de concurrence (`reseau.ts:28-34`, `parVagues`) — examiné, non retenu

10 lignes qui font ce que fait `p-limit` (dernière version 7.3.1, publiée le
20/07/2026, `registry.npmjs.org/p-limit`, 14 888 o non compressés). Bien
maintenu, mais remplacer 10 lignes déjà testées (`reseau.test.ts` — non lu en
détail, hors budget de cet audit) par une dépendance externe n'apporte pas de
gain net identifié : pas de fonctionnalité manquante, pas de bug connu. Non
retenu — mentionné pour mémoire seulement.

## Ce que fait la concurrence sur ce point

Non vérifiable : l'extraction de contenu d'une offre depuis une page web et la
résolution de logo d'entreprise sont des détails d'implémentation serveur,
invisibles depuis l'extérieur d'un produit concurrent (Jobscan, Teal, Rezi,
Huntr, Kickresume, Enhancv, Careerflow, Simplify consultés le 04/08/2026 —
aucun ne publie de blog d'ingénierie décrivant sa pile technique
d'extraction). Le domaine « briques externes » porte sur le code interne face
aux bibliothèques disponibles, pas sur une capacité visible par l'utilisateur
final ; la comparaison utile ici est bibliothèque vs code maison, pas
CVMatchr vs concurrent.

## Écart au seuil de MISSION.md

Aucun seuil chiffré de `MISSION.md` ne porte directement sur ce domaine (pas
de seuil « code maison vs bibliothèque »). Le lien indirect est la fiabilité
du chasseur d'offres : un import d'offre qui échoue silencieusement sur un
site à structure inhabituelle et retombe sur un service tiers payant (Jina)
est un coût récurrent évitable, dans l'esprit du seuil « coût des appels
externes » sans en relever au sens strict (Jina AI Reader n'est pas dans la
liste des services facturés nommés par `MISSION.md`, mais fonctionne sur ce
principe au-delà d'un quota gratuit).

## Écart à la concurrence

Sans objet pour ce domaine (voir section précédente) — aucun écart mesurable
face à la concurrence, seulement un écart face à ce qu'une bibliothèque
mature ferait à la place du code actuel.

## Chantiers proposés

1. **Remplacer les sélecteurs CSS faits main de `scrapeJobText` par
   `@mozilla/readability` (+ `jsdom` en production)** — gain attendu : moins
   de repli vers Jina AI Reader (service payant au-delà du quota gratuit) sur
   les sites à structure inhabituelle, 44 lignes de sélecteurs à maintenir en
   moins. Coût : nouvelle dépendance de production (`@mozilla/readability` +
   `jsdom`, ce dernier passant de dev à production, 7 Mo non compressés) —
   soumis au feu vert du propriétaire (`MISSION.md`, sujet sensible « ajout
   d'une dépendance npm importante »). Non chiffré : l'effet réel sur le taux
   de repli vers Jina (aucune télémétrie actuelle sur la fréquence des
   replis) et l'impact sur le cold start de la fonction serverless — à mesurer
   avant de trancher, pas seulement à l'estime.
