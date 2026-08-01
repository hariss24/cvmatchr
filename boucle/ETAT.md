# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-01 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune ouverte encore — branche `claude/reveil-20260801-1857`
  (Bâtisseur) toujours en attente du workflow (push + PR). Ce réveil n'a rien codé,
  seulement audité et écrit dans `boucle/`.
- **Ce qui a été fait :** audit du domaine « manques fonctionnels » (premier tour de
  la nouvelle rotation à neuf domaines). Consultation directe (WebSearch + WebFetch)
  des 8 produits de référence de `MISSION.md` : Jobscan, Teal, Rezi, Huntr,
  Kickresume, Enhancv, Careerflow, Simplify. **8 manques confirmés** au sens du
  seuil MISSION.md (capacité chez ≥ 2 concurrents, absente ici), classés par
  gravité : extension navigateur + autofill de candidature (7/8 produits, le plus
  large manque mesuré à ce jour), préparation d'entretien par IA (4 produits), CRM
  de networking/contacts (4 produits, mais en tension avec le principe « zéro
  saisie » du tracker actuel — arbitrage propriétaire nécessaire), optimisation de
  profil LinkedIn (2 produits), import direct LinkedIn (2 produits, faisabilité
  technique incertaine — LinkedIn bloque le scraping), skill gap analyzer (2
  produits, chevauchement possible avec le moteur ATS existant), journal de
  candidature (2 produits, petite ampleur), générateur de lettre de démission (2
  produits, négligeable). À l'inverse, un point où CVMatchr est en avance sur les
  8 produits consultés : le tracker à statut dérivé automatiquement — aucun
  concurrent n'a d'équivalent, tous demandent une saisie manuelle du statut.
  Constat complet et sourcé (URL + date par affirmation) :
  `boucle/constats/2026-08-01-manques-fonctionnels.md`. 8 lignes ajoutées à
  `BACKLOG.md` section `## À planifier`, la plus grave en premier, avant les
  items techniques déjà présents (aucun ne dépasse son seuil d'un facteur 2,
  donc le manque fonctionnel prime — règle de `MISSION.md`).
- **Domaine audité en dernier :** manques fonctionnels (ce réveil). Rotation :
  manques fonctionnels → **coût des appels externes** (prochain domaine) →
  hygiène du dépôt → manques fonctionnels → performance → briques externes →
  manques fonctionnels → accessibilité → parcours d'un nouvel arrivant →
  manques fonctionnels → cohérence visuelle → sécurité → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR de ce réveil,
  l'Éclaireur ne code pas).
