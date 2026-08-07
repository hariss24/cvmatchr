# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-07 (Éclaireur, deuxième réveil de l'Éclaireur ce jour)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « cohérence visuelle » (premier passage de la
  boucle sur ce domaine). Lu `web/src/app/globals.css` (2896 lignes) en entier via `grep`
  ciblé sur `border-radius`, `font-size`, `padding`, `gap`, vérifié chaque sélecteur
  trouvé en contexte et son appelant `.tsx` réel. Quatre constats chiffrés : (1) 19
  valeurs de `border-radius` distinctes sans aucun token `--radius-*`, dont deux valeurs
  différentes (999px/9999px) pour le même « entièrement arrondi » ; (2) 20 valeurs de
  `font-size` distinctes sans token, dont six au demi-pixel ; (3) la couleur d'état
  `.ats-mid` (`#f5a623`) figée hors du système de thème alors que ses deux voisines
  `--success`/`--error` s'ajustent entre thème clair et sombre — contraste vs fond mesuré
  à 1,94:1 (clair) contre 7,79:1 (sombre), écart ×4 non choisi ; (4) le bouton d'action
  orange (`var(--cta-grad)`) redéfini dans ~13 sélecteurs séparés au lieu d'une classe
  partagée, dont un seul reprend le jeton `--on-orange` (idée n°6 déjà classée) — explique
  pourquoi ce correctif ne s'est pas propagé. Comparaison concurrentielle : CSS de
  production de Rezi téléchargé et compté (`cdn.prod.website-files.com/…`, 772 004
  octets) — 47 des 50 `border-radius` suivent un pas régulier de 0,25rem, contre les 19
  valeurs sans pas commun de CVMatchr ; Kickresume décrit qualitativement (page publique,
  pas de CSS statique récupérable) ; Jobscan et Simplify bloquent le robot (HTTP 403),
  Careerflow redirige, Enhancv et Huntr n'exposent pas de CSS statique sans exécuter leur
  JS — signalé comme tel plutôt qu'ignoré. Quatre idées non notées ajoutées en fin
  d'`IDEES.md` (section « À noter »), à charge de l'Arbitre de les noter et intégrer au
  classement au prochain réveil. Détail complet dans
  `boucle/constats/2026-08-07-coherence-visuelle.md` et
  `boucle/journal/2026-08-07-eclaireur-2.md`.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet +
  « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer. Vérifié `## Écartées`
  d'`IDEES.md` : aucune des quatre idées n'y figure déjà. Recompté chaque grep cité dans
  le constat avant de l'écrire (border-radius, font-size, ats-mid/ok/low, cta-grad,
  on-orange) et vérifié l'appelant réel de `.ats-mid`/`.ats-ok`/`.ats-low`
  (`AtsPanel.tsx:29`, `scoreClass()`). Contraste calculé par un script Node inline
  (formule de luminance relative WCAG), pas estimé de tête. `git status --short` vérifié
  avant ce commit : seuls `boucle/constats/2026-08-07-coherence-visuelle.md`,
  `boucle/IDEES.md`, `boucle/ETAT.md` et le journal du jour sont
  modifiés/créés, rien hors de `boucle/`.
- **Domaine audité en dernier (Éclaireur) :** cohérence visuelle (07/08/2026), pas
  encore noté par l'Arbitre. Prochain domaine pour l'Éclaireur (après notation par
  l'Arbitre) : sécurité. Rotation : hygiène du dépôt → manques fonctionnels →
  performance → briques externes → manques fonctionnels → accessibilité → parcours
  d'un nouvel arrivant → manques fonctionnels → cohérence visuelle →
  **sécurité (prochain domaine pour l'Éclaireur)** → manques fonctionnels →
  (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
