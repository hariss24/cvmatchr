# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-07 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « manques fonctionnels » (3ᵉ tour sur
  trois de la rotation). Écrit le constat
  `boucle/constats/2026-08-07-manques-fonctionnels-4.md` et ajouté deux idées non
  notées en fin de `## Classement` d'`IDEES.md` (section « À noter (Éclaireur, non
  notées) ») : « Surligner les mots-clés en contexte, dans l'offre et dans le CV »
  (le panneau ATS n'affiche aujourd'hui que des pastilles isolées, jamais un terme en
  contexte — confirmé chez 2 produits, Jobscan et Teal) et « Afficher l'ATS détecté de
  l'entreprise ciblée + conseil de mise en forme adapté » (`boards-fr.json` connaît déjà
  l'ATS de 64 000+ entreprises mais cette donnée n'alimente que la recherche d'offres,
  jamais le parcours CV/lettre — confirmé chez un seul produit à ce stade, Jobscan,
  signalé comme tel car sous le seuil formel des deux produits de `MISSION.md`).
  Vérifié qu'aucune des deux n'existe déjà dans le classement ni en `## Écartées`.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet +
  « Écartées ») et `boucle/roles/eclaireur.md` avant de commencer. Lu les sections
  pertinentes de `PROJECT_INDEX.md` (§1, §7, §8, §8 bis, §8 ter) pour cartographier ce
  qu'offre déjà CVMatchr avant de chercher des manques. Relu les trois constats
  « manques fonctionnels » précédents (01/08, 03/08, 05/08, `grep` sur leurs sections
  « Chantiers proposés ») pour ne pas reproposer une idée déjà couverte. Vérifié par
  lecture de code que deux pistes explorées étaient en réalité déjà construites avant
  de les écarter : gabarits de CV multiples (`lib/resume/templates.ts`, 4 modèles) et
  choix de ton de lettre (`lib/letter/tone.ts`, 3 registres) — ni l'un ni l'autre n'est
  un manque. `grep` exhaustif confirmant l'absence de surlignage
  (`AtsPanel.tsx`/`engine.ts`) et l'usage réel de `boardsFr`/`boards-fr.json` limité à
  deux routes de recherche d'offres. Recherche concurrentielle par `WebSearch`,
  citations avec adresse et date de consultation (07/08/2026) pour chaque affirmation
  sur Jobscan, Teal et Kickresume — signalé franchement quand un seul produit
  confirmait un point (ATS par entreprise) plutôt que d'arrondir à « la concurrence ».
  `git status --short` vérifié avant ce commit : seuls le constat du jour,
  `boucle/IDEES.md`, `boucle/ETAT.md` et le journal du jour sont modifiés/créés, rien
  hors de `boucle/`.
- **Domaine audité en dernier (Éclaireur) :** manques fonctionnels (07/08/2026), en
  attente de notation par l'Arbitre. Rotation : coût des appels externes → hygiène du
  dépôt → manques fonctionnels → performance → briques externes → manques
  fonctionnels → accessibilité → parcours d'un nouvel arrivant → manques fonctionnels →
  **cohérence visuelle (prochain domaine pour l'Éclaireur)** → sécurité → manques
  fonctionnels → (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
