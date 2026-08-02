# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-02 (Architecte)
- **Rôle joué :** Architecte
- **PR en cours :** aucune ouverte encore — branche `claude/reveil-20260801-1857`
  (Bâtisseur) toujours en attente du workflow (push + PR). Ce réveil n'a rien codé
  sous `web/src/`, seulement écrit une spec + un plan sous `docs/superpowers/` et
  mis à jour `boucle/`.
- **Ce qui a été fait :** a pris la première ligne de `BACKLOG.md` § À planifier
  (aucune ligne préfixée `!`) — « Manque fonctionnel — extension navigateur
  (capture d'offre + autofill de candidature) », le manque le plus large mesuré
  par l'Éclaireur le 01/08 (présent chez 7 des 8 produits de référence). A
  d'abord vérifié, par une nouvelle consultation directe (WebSearch + WebFetch,
  02/08/2026), les champs réels du formulaire Greenhouse (documentation
  officielle de l'API + une offre réelle) et le peu d'information publique sur le
  DOM de Lever (centre d'aide Lever confirme seulement Nom/Email obligatoires,
  aucun sélecteur HTML publié) avant d'écrire quoi que ce soit — cohérent avec le
  principe du dépôt « rien n'est supposé, tout est mesuré » déjà appliqué dans les
  specs zod/jobs.
  Décision de tranchage (§5 de la spec) : le chantier ne couvre que
  l'**autofill**, pas la capture d'offre (déjà couverte à l'essentiel par
  l'extracteur magique d'offre existant, `/api/extract-job` — gain marginal
  d'une extension sur ce point précis) ; cible Greenhouse + Lever seulement
  (Workday et les autres exclus, DOM non documenté/dynamique par tenant) ;
  reconnaissance de champ **générique** (nom documenté → `autocomplete` →
  texte de label) plutôt que des sélecteurs figés par ATS, pour ne pas deviner
  la structure DOM de Lever faute de preuve publique ; jamais de soumission
  automatique du formulaire. Zéro dépendance npm (JavaScript vanilla, Manifest
  V3, chargé en mode développeur) — donc **aucun feu vert requis** au sens de
  `MISSION.md`, la ligne va directement dans `## Prêt à coder`.
  Spec : `docs/superpowers/specs/2026-08-02-extension-autofill-design.md`.
  Plan (4 tâches) : `docs/superpowers/plans/2026-08-02-extension-autofill.md`
  — Task 1 (scaffold `extension/` : manifeste, pont CVMatchr↔`chrome.storage.local`,
  popup), Task 2 (`web/src/lib/extension/` : construction pure du paquet + bouton
  « Préparer pour l'extension » dans `PackView.tsx`), Task 3 (reconnaissance de
  champ générique + remplissage Greenhouse/Lever, avec protocole de vérification
  manuelle sur deux offres réelles — aucun test automatisé possible pour du DOM
  de page tierce sans jsdom, comme documenté ailleurs dans ce dépôt), Task 4
  (documentation `PROJECT_INDEX.md`). Deux lignes ajoutées à `BACKLOG.md`
  § Idées pour les axes écartés (capture d'offre, autres ATS), à rouvrir plus
  tard si le premier usage réel le justifie.
- **Domaine audité en dernier :** manques fonctionnels (Éclaireur, 01/08/2026).
  Rotation inchangée par ce réveil (l'Architecte ne choisit pas de domaine, il
  traite le backlog) : manques fonctionnels → coût des appels externes
  (prochain domaine pour l'Éclaireur) → hygiène du dépôt → manques fonctionnels
  → performance → briques externes → manques fonctionnels → accessibilité →
  parcours d'un nouvel arrivant → manques fonctionnels → cohérence visuelle →
  sécurité → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR de ce
  réveil, l'Architecte ne code pas sous `web/src/`).
