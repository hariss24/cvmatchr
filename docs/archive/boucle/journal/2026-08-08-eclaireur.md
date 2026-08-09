# Journal — Éclaireur, 2026-08-08

## Contexte

`ETAT.md` (avant mise à jour) indiquait « sécurité » comme prochain domaine de la
rotation (`boucle/roles/eclaireur.md`) — jamais audité par la boucle jusqu'ici (aucun
fichier `boucle/constats/*securite*` avant ce réveil).

## Démarche

1. Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet + section
   « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer. Noté que
   « sécurité » n'a pas de méthodologie dédiée dans `eclaireur.md` (contrairement aux
   quatre domaines détaillés : manques fonctionnels, coût des appels externes,
   hygiène du dépôt, briques externes) — appliqué la règle générale du rôle
   (« aucun constat sans chiffre ni reproduction ») plutôt qu'un gabarit spécifique.
2. Listé `boucle/constats/` pour confirmer qu'aucun audit sécurité n'existe déjà.
3. Lu `web/src/middleware.ts` et `web/src/app/api/login/route.ts` (mécanisme
   d'authentification par mot de passe partagé) en entier.
4. `grep` des patterns dangereux classiques (`eval(`, `new Function(`, `exec(`,
   `child_process`, `.innerHTML =`, `dangerouslySetInnerHTML`) sur `web/src/` — deux
   occurrences de `dangerouslySetInnerHTML` trouvées et vérifiées une par une par
   lecture directe : toutes deux sur du contenu statique (icônes SVG en dur, script
   de thème inline), pas de donnée utilisateur — écartées comme non exploitables
   aujourd'hui plutôt que signalées à tort.
5. Repéré et lu en entier le garde-fou SSRF existant (`web/src/lib/scraper/ssrf.ts`,
   `scraper.ts`, `ssrf.test.ts`) sur `/api/extract-job`. Identifié un TOCTOU/DNS
   rebinding : la validation résout et vérifie l'IP, mais `fetch()` ensuite refait sa
   propre résolution DNS sur le même hostname, sans épingler l'IP validée — vérifié
   qu'aucun des 8 cas de `ssrf.test.ts` ne couvre une résolution DNS qui change entre
   la validation et l'usage.
6. Cherché si ce même garde-fou est répliqué sur les autres routes serveur qui font
   un `fetch` piloté par l'utilisateur (`grep -rln "fetch(" web/src/app/api web/src/lib/jobs`).
   Trouvé `web/src/lib/jobs/logos.ts` (`fetchAccueil`, `domainesAnnuaire`) : aucun
   appel à `validateUrlForScraping` (`grep` : 0 correspondance). Remonté la chaîne
   d'appel jusqu'à la route `POST /api/jobs/logos` (`runtime = "nodejs"`, tableau
   `companies` en texte libre non validé au-delà de `typeof === "string"`) et
   confirmé, en lisant `domainCandidates`/`domaineProche`/`tldPlausible`, qu'un nom
   d'entreprise choisi pour ressembler à un domaine (`"mon-domaine.io"`) passe tous
   les filtres et atteint `fetch(`https://${domain}`)` sans aucune vérification —
   SSRF serveur reproductible en une requête API, sans compte particulier au-delà du
   mot de passe partagé de l'app.
7. `npm audit --production` dans `web/` : 9 vulnérabilités (6 hautes). Croisé chaque
   paquet avec `package.json`/`package-lock.json` pour les versions exactes installées
   et vérifié la pertinence produit de chacune (en particulier `pdfjs-dist`, dont la
   RCE navigateur touche directement `web/src/lib/pdf/pdfToImages.ts`, appelé côté
   client sur tout PDF importé par le candidat).
8. Vérifié une règle explicite de `CLAUDE.md` (« la photo de profil, en base64, n'est
   jamais envoyée à une IA ») par lecture de `web/src/lib/ai/base64.ts` et de ses
   appelants (`ChatPanel.tsx`, `EditorPane.tsx`, `tailor-resume/route.ts`). Confirmé
   que la règle est bien respectée sur les trois chemins vérifiés (photo retirée côté
   client avant l'appel réseau, restaurée après) — écarté ce point du constat plutôt
   que de signaler à tort une violation, après avoir failli l'écrire en voyant que
   `editor-chat/route.ts` lui-même ne filtre rien côté serveur (le filtrage est
   entièrement porté par le client, `ChatPanel.tsx` — noté pour mémoire mais pas
   retenu comme chantier séparé : contourner son propre client pour s'auto-exposer sa
   propre photo n'a pas de valeur d'attaque réelle).
9. Recherche concurrentielle (`WebSearch`/`WebFetch`) sur Rezi, Jobscan et Teal —
   pages de confidentialité/mentions légales, 08/08/2026. Une des trois
   (`tealhq.com/privacy-policy`) a renvoyé 403 en lecture directe ; signalé
   explicitement comme non vérifié de première main plutôt que reformulé en
   affirmation.
10. Écrit `boucle/constats/2026-08-08-securite.md`.
11. Ajouté les six chantiers non notés en fin de `## Classement` d'`IDEES.md`
    (section « À noter (Éclaireur, non notées) »), après avoir vérifié qu'aucun des
    six n'apparaît déjà dans le classement ni dans `## Écartées`.

## Décisions et raisons

- Le domaine « sécurité » n'a pas de gabarit dédié dans `boucle/roles/eclaireur.md` —
  appliqué le format générique du constat (celui de la fin du fichier) plutôt que
  d'en inventer un nouveau, et la règle générale « chiffre ou reproduction » plutôt
  que celle, plus spécifique, des quatre domaines détaillés (qui ne s'applique pas
  telle quelle ici : une SSRF ne se compte pas comme un appel facturé, elle se prouve
  par le code).
- Pas d'attaque réelle lancée contre une instance déployée (hors périmètre — je n'ai
  ni URL de production ni autorisation explicite pour ça, et ce n'est de toute façon
  pas mon rôle : je propose, je ne construis ni n'exploite). Les reproductions sont
  documentées comme des chemins de code vérifiés par lecture + `grep`, jamais
  présentées comme une exploitation confirmée en conditions réelles — signalé
  explicitement dans le constat.
- Le point « rate limiting du login en mémoire de process » repose sur une inférence
  (présence de `@vercel/analytics`) et pas une confirmation directe de l'infra de
  déploiement — écrit comme hypothèse forte à vérifier par le propriétaire, pas comme
  fait établi.
- Deux `dangerouslySetInnerHTML` trouvés par `grep` puis écartés après lecture
  complète du contexte (données statiques, non exploitables) — pour ne pas faire
  perdre de temps à l'Arbitre avec un faux positif.
- Failli signaler une violation de la règle CLAUDE.md sur la photo (le serveur
  `editor-chat/route.ts` ne filtre rien lui-même), mais vérifié la chaîne complète
  jusqu'au client avant d'écrire quoi que ce soit : la règle est respectée en
  pratique aujourd'hui. Un constat qui aurait affirmé une violation sans remonter
  jusqu'au bout de la chaîne d'appel aurait été faux.

## Vérifications faites

- Lu en entier `MISSION.md`, `ETAT.md`, `IDEES.md` (classement + « Écartées ») et
  `boucle/roles/eclaireur.md` avant de commencer.
- `ls boucle/constats/` → confirmé qu'aucun audit sécurité n'existe déjà.
- `grep -rn "eval(\|new Function(\|child_process\|exec(\|execSync\|\.innerHTML\s*="
  web/src` → aucune occurrence dangereuse hors `RegExp.prototype.exec`, sans rapport.
- `grep -rn "dangerouslySetInnerHTML" web/src` → 2 occurrences, les deux lues et
  confirmées non exploitables (contenu statique).
- Lu en entier `web/src/lib/scraper/ssrf.ts` (98 lignes), `scraper.ts` (198 lignes),
  `ssrf.test.ts` (52 lignes, 8 cas) pour confirmer précisément la nature du TOCTOU.
- `grep -n "validateUrlForScraping" web/src/lib/jobs/logos.ts
  web/src/app/api/jobs/logos/*.ts` → 0 correspondance, confirmant l'absence totale de
  garde-fou sur ce chemin.
- Lu en entier `web/src/lib/jobs/logos.ts` (353 lignes) pour retracer précisément le
  chemin `company` (texte libre) → `domainCandidates` → `domaineProche`/
  `tldPlausible` → `siteConfirme` → `fetchAccueil` → `fetch()`, et vérifié à la main
  qu'un nom d'entreprise identique à un domaine passe les deux filtres.
- Lu `web/src/app/api/jobs/logos/route.ts` en entier pour confirmer `runtime =
  "nodejs"` et l'absence de validation du tableau `companies` au-delà du type.
- `npm audit --production` exécuté dans `web/`, sortie lue en entier (9
  vulnérabilités). Versions exactes croisées avec `package.json` et
  `package-lock.json` (recherche par paquet).
- `grep -rn "NEXT_PUBLIC_" web/src` → aucune occurrence, pas de secret exposé au
  client par ce mécanisme.
- `git ls-files | grep -iE "\.env($|\.)"` et recherche de motifs de clés API
  (`AIza…`, `sk-…`, `AKIA…`) dans `web/src` → rien de suivi par git, aucune clé en
  dur trouvée.
- Lu `web/src/lib/ai/base64.ts` en entier et ses trois appelants
  (`ChatPanel.tsx`, `EditorPane.tsx`, `tailor-resume/route.ts`) pour confirmer que la
  règle « photo jamais envoyée à l'IA » de `CLAUDE.md` est bien respectée.
- Lu `web/next.config.ts` en entier pour l'état exact des en-têtes de sécurité posés.
- Recherche concurrentielle sur sources publiées et citées (adresse + date de
  consultation, 08/08/2026) pour Rezi, Jobscan, Teal — signalé explicitement le cas
  où la page n'a pas pu être lue directement (Teal, 403).
- Vérifié qu'aucune des six idées ajoutées n'apparaît déjà dans le classement ni dans
  `## Écartées` d'`IDEES.md`.
- `git status --short` vérifié avant ce commit : uniquement `boucle/constats/2026-08-08-securite.md`,
  `boucle/IDEES.md`, `boucle/ETAT.md` et ce journal — rien hors de `boucle/`.
