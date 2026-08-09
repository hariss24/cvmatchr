# Journal — Éclaireur, 2026-08-02

## Domaine audité

Coût des appels externes — deuxième domaine de la rotation à neuf tours
(`boucle/roles/eclaireur.md`), après « manques fonctionnels » le 01/08. Aucun constat
antérieur sur ce domaine précis dans `boucle/constats/`.

## Méthode

Lecture directe du code réel, pas de tête et pas d'exécution (aucune clé API
configurée dans cet environnement de boucle — `GEMINI_API_KEY`, `FT_CLIENT_ID`,
`ADZUNA_APP_ID`, `JSEARCH_API_KEY` toutes absentes) :
- toutes les routes IA (`web/src/app/api/*/route.ts`) et la couche client
  (`web/src/lib/ai/client.ts`, `clients.ts`) ;
- les trois sources job-board (`web/src/lib/jobs/francetravail.ts`, `adzuna.ts`,
  `jsearch.ts`) et leurs quotas gratuits documentés en commentaire ;
- Google Maps (`lib/jobs/maps.ts`) et Brandfetch (`lib/jobs/logos.ts`), déjà bien
  traités par un chantier antérieur (cache client 30 jours pour les trajets, cache
  process + traitement par vagues pour les logos) — vérifiés, pas de défaut trouvé,
  non repris au constat ;
- les composants qui déclenchent ces appels (`PackView.tsx`, `TailorModal.tsx`,
  `ChatPanel.tsx`, `AtsPanel.tsx`, `JobsView.tsx`) pour suivre le fil réel d'un
  parcours utilisateur, pas seulement compter les appels côté serveur.

Deux recherches web (Jobscan, Teal) pour la comparaison concurrentielle demandée par
le rôle sur ce domaine : leurs pages de tarifs publiques suffisent à établir qu'ils
plafonnent chaque geste IA dès l'offre gratuite — pas besoin d'un compte payant pour
vérifier ce point précis.

## Résultat

4 mesures écrites dans `boucle/constats/2026-08-02-cout-appels-externes.md`, dont
deux violent directement le seuil `MISSION.md` (« aucun appel facturé répété pour une
même donnée dans un même parcours ») de façon reproductible à la lecture du code (pas
une hypothèse) :

1. `/api/extract-meta` appelé jusqu'à 3 fois pour la même offre sur `/pack`
   (`onExtracted`, `onBlur` du textarea, et dans `adaptWithAi`), dont 2 dans le même
   clic sur « Adapter » à cause de l'ordre `blur`-puis-`click` du navigateur.
2. Le même appel se déclenche même quand l'entreprise/le poste sont déjà connus
   gratuitement (venus des champs structurés de l'offre via « Candidater » depuis
   `/jobs`) — et `resolveMeta` fait pire : il laisse la réponse IA écraser la donnée
   déjà exacte.
3. `/api/editor-chat` : le CV/lettre entier repart en JSON à chaque message du chat,
   même non modifié depuis le tour précédent, en plus d'un historique non borné —
   croissance quadratique du prompt sur une conversation longue.
4. Aucun plafond ni compteur sur les 8 routes IA (seuls les 3 job-boards ont un
   compteur, et il est explicitement indicatif dans son propre commentaire) — à
   l'inverse de Jobscan (5 scans/mois gratuits) et Teal (10 crédits IA gratuits), qui
   plafonnent chaque geste IA dès leur palier gratuit.

4 idées ajoutées à `IDEES.md` (non notées, c'est le mandat de l'Arbitre) : #12
(dédupliquer/éviter `/api/extract-meta` sur `/pack`), #13 (plafonner les appels IA —
signalée comme sujet sensible, touche potentiellement au modèle économique), #14
(élaguer l'historique/le `doc_json` du chat éditeur).

## Ce que je n'ai pas fait

Je n'ai touché à aucun fichier de `web/`, y compris pour corriger ce qui m'a paru
trivial (le cache manquant sur `fetchJobMeta` aurait pu se corriger en une ligne sur
le modèle de `AtsPanel.tsx:39`, mais ce n'est pas mon rôle — signalé dans le constat
et l'idée #12 à la place). Je n'ai pas chiffré précisément le gain de l'idée #14 (chat
éditeur) faute de données réelles sur la longueur moyenne d'une conversation en
usage — je l'ai dit franchement plutôt que d'inventer un chiffre. Je n'ai pas vérifié
Google Maps/Brandfetch en détail au-delà de confirmer qu'un chantier antérieur les a
déjà bien traités (cache 30 jours documenté dans le code lui-même,
`db.ts:402` `COMMUTE_TTL_MS`).

## Fichiers modifiés

- `boucle/constats/2026-08-02-cout-appels-externes.md` (nouveau)
- `boucle/IDEES.md` (3 entrées ajoutées en fin de `## Classement`, non notées)
- `boucle/ETAT.md` (écrasé)
- `boucle/journal/2026-08-02-eclaireur.md` (ce fichier)
