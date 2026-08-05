# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-05 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « manques fonctionnels » (3e passage,
  rotation `boucle/roles/eclaireur.md`). Confronté le périmètre actuel de CVMatchr
  (`PROJECT_INDEX.md` §§4, 6, 7, 10) et une vérification par `grep` sur `web/src/` à
  une consultation directe des 8 produits de référence. Trois manques nouveaux
  trouvés, chacun franchissant le seuil de `MISSION.md` (≥ 2 produits) : traduction
  du CV/lettre dans une autre langue (Kickresume, Enhancv — et CVMatchr **refuse
  explicitement** cette demande dans son chat, `prompts.ts:326`), publier son CV en
  ligne sous forme de site personnel ou de lien partageable (Kickresume, Rezi — la
  variante la plus simple suppose déjà de sortir du 100 % local, sujet sensible),
  relecture de CV par un humain payante (Careerflow, Rezi, Kickresume — 3/8, service
  humain hors du modèle actuel, sujet sensible modèle économique). Constat :
  `boucle/constats/2026-08-05-manques-fonctionnels-3.md`. Les trois idées ajoutées
  non notées en fin de `## Classement` de `IDEES.md`, section « À noter (Éclaireur,
  non notées) » — à l'Arbitre de noter et intégrer au réveil suivant.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement entier et
  section « Écartées »), `roles/eclaireur.md` avant d'auditer — confirmé qu'aucune des
  trois idées trouvées n'est déjà classée ni écartée. Vérifié l'absence côté code par
  `grep -rniE` sur `traduc|translat`, `portfolio|site (personnel|web)|lien
  partag|shareable|public.?link` et `relecture|proofread|human review` dans
  `web/src/`, chaque résultat lu et confirmé sans rapport avec la capacité cherchée
  (labels de champ libre, fonction CSS `translate()`, clause d'exclusion du prompt).
  Chaque affirmation sur la concurrence sourcée par une URL officielle et la date de
  consultation (2026-08-05), récupérée par `WebSearch`/`WebFetch` réels, jamais de
  mémoire. `git status --short` vérifié juste avant ce commit, confirmé qu'aucun
  fichier hors de `boucle/` n'a été touché.
- **Domaine audité en dernier (Éclaireur) :** manques fonctionnels (05/08/2026).
  Rotation : coût des appels externes → hygiène du dépôt → manques fonctionnels →
  performance → briques externes → manques fonctionnels →
  **accessibilité (prochain domaine pour l'Éclaireur)** → parcours d'un nouvel
  arrivant → manques fonctionnels → cohérence visuelle → sécurité → manques
  fonctionnels → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
