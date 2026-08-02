# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-02 (Architecte)
- **Rôle joué :** Architecte
- **PR en cours :** aucune ouverte — celle du Bâtisseur précédent
  (`claude/reveil-20260802-0809`, extension autofill, 4 commits) n'a pas encore été
  poussée/fusionnée par le workflow. Ce réveil ne la touche pas (rôle Architecte,
  branche/commits séparés).
- **Ce qui a été fait :** transformé la première ligne de `BACKLOG.md` § À planifier
  (« Manque fonctionnel — optimisation de profil LinkedIn (analyse + suggestions) »,
  constat `boucle/constats/2026-08-01-manques-fonctionnels.md` §4) en spec + plan :
  - `docs/superpowers/specs/2026-08-02-linkedin-optimisation-design.md`
  - `docs/superpowers/plans/2026-08-02-linkedin-optimisation.md`
  Décision de conception centrale : réutiliser `src/lib/ats/engine.ts` (extraction de
  mots-clés pondérés, présence dans un texte, forme du rapport `AtsReport`) plutôt
  qu'un moteur neuf — le profil LinkedIn n'est qu'un second texte à analyser, pas un
  second problème. Le plan prévoit en Task 1 une extraction préparatoire sans
  changement de comportement (exporter `contains`/`normalize`, déplacer la coercition
  JSON de `/api/ats-score` dans `src/lib/ai/coerceAi.ts`, extraire l'affichage du
  rapport `AtsPanel.tsx` dans `src/components/shared/ScoreReportParts.tsx`), avant le
  nouveau domaine `src/lib/linkedin/` (Task 2), la route `/api/linkedin-score`
  (Task 3), la page `/linkedin` (Task 4) et la documentation (Task 5). Ne couvre que
  l'analyse d'un profil collé en texte — l'import automatique du profil (scraping ou
  connexion LinkedIn) reste une ligne distincte du backlog (§5 du constat),
  explicitement écartée en spec §4.1 (faisabilité technique non validée).
  `BACKLOG.md` : ligne déplacée de `## À planifier` vers `## Prêt à coder`.
- **Vérifications :** aucune commande de vérification à faire tourner pour ce rôle
  (l'Architecte n'écrit aucun code applicatif, `boucle/roles/architecte.md`). La spec
  et le plan ont été relus contre le code source existant (`src/lib/ats/engine.ts`,
  `src/lib/ai/prompts.ts`, `src/app/api/ats-score/route.ts`,
  `src/components/modals/AtsPanel.tsx`, `src/components/profile/ProfileView.tsx`,
  `src/components/layout/UserMenu.tsx`) pour vérifier que les fonctions/types cités
  existent réellement et que les classes CSS réutilisées (`.ats-*`, `.form-textarea`,
  `.pane`, `.pack-page`, etc.) sont déjà définies — aucune nouvelle dépendance ni CSS
  neuf nécessaire. Les valeurs numériques des tests du moteur local (Task 2 du plan)
  ont été calculées à la main et vérifiées deux fois (65, 48, 57, 66).
- **Domaine audité en dernier :** manques fonctionnels (Éclaireur, 01/08/2026).
  Rotation inchangée par ce réveil (l'Architecte planifie un constat existant, il ne
  choisit pas de domaine) : manques fonctionnels → coût des appels externes
  (prochain domaine pour l'Éclaireur) → hygiène du dépôt → manques fonctionnels →
  performance → briques externes → manques fonctionnels → accessibilité →
  parcours d'un nouvel arrivant → manques fonctionnels → cohérence visuelle →
  sécurité → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Architecte ne produit pas de code, la PR viendra du Bâtisseur qui
  exécutera ce plan à un prochain réveil).
