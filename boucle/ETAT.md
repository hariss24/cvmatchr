# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-08 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** premier audit du domaine « sécurité » de la rotation (jamais
  audité par la boucle jusqu'ici). Lu le code serveur en entier sur les zones à risque
  (auth, routes API qui font des requêtes réseau sortantes pilotées par l'utilisateur,
  protection SSRF existante, dépendances). Six manques trouvés et vérifiés par lecture
  directe + `grep`, le plus sérieux étant une SSRF totalement non protégée sur
  `/api/jobs/logos` (aucun appel à `validateUrlForScraping`, contrairement à
  `/api/extract-job` qui, lui, l'appelle) : un attaquant possédant un domaine dans l'une
  des extensions acceptées peut faire émettre au serveur une requête HTTP vers une IP
  interne de son choix, en un seul appel API. Second manque : la protection SSRF qui
  existe (`ssrf.ts`) ne résiste pas au DNS rebinding (validation par résolution DNS puis
  `fetch()` qui re-résout indépendamment, sans épingler l'IP). Troisième : `npm audit
  --production` remonte 9 vulnérabilités connues (6 hautes), dont une RCE navigateur sur
  `pdfjs-dist` directement pertinente puisque le produit fait rendre par cette lib, dans
  le navigateur du candidat, tout PDF qu'il importe. Trois manques secondaires : jeton
  d'authentification statique (SHA-256 du mot de passe partagé, non révocable
  individuellement, valable 30 jours), rate limiting du login en mémoire de process
  (probablement inefficace en environnement serverless multi-instances, non confirmé
  sans accès à l'infra), CSP limité à `frame-ancestors` seul. Écrit le constat
  `boucle/constats/2026-08-08-securite.md` et ajouté les six idées non notées en fin de
  `## Classement` d'`IDEES.md` (section « À noter (Éclaireur, non notées) »). Détail
  complet dans `boucle/journal/2026-08-08-eclaireur.md`.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet +
  « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer. Vérifié qu'aucune des
  six idées ajoutées ne figure déjà dans le classement ni dans `## Écartées`. Chaque
  affirmation de manque vérifiée par lecture directe du fichier concerné et/ou `grep`
  (ex. `grep -rn "validateUrlForScraping" web/src/lib/jobs/logos.ts
  web/src/app/api/jobs/logos/` → 0 correspondance ; `npm audit --production` exécuté
  dans `web/`, sortie lue en entier). Comparaison concurrentielle faite sur sources
  publiées et citées avec adresse + date de consultation (Rezi, Jobscan, Teal,
  08/08/2026), avec mention explicite des points non vérifiables de première main.
  `git status --short` vérifié avant ce commit : uniquement des fichiers sous `boucle/`
  (le constat du jour, `IDEES.md`, `ETAT.md`, ce journal) — rien hors de `boucle/`.
- **Domaine audité en dernier (Éclaireur) :** sécurité (08/08/2026), en attente de
  notation par l'Arbitre. Prochain domaine pour l'Éclaireur : manques fonctionnels.
  Rotation : hygiène du dépôt → manques fonctionnels → performance → briques externes →
  manques fonctionnels → accessibilité → parcours d'un nouvel arrivant → manques
  fonctionnels → cohérence visuelle → sécurité → **manques fonctionnels (prochain
  domaine pour l'Éclaireur)** → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
