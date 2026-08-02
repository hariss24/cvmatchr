# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-02 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/`.
- **Ce qui a été fait :** audit du domaine « coût des appels externes » (deuxième tour
  de la rotation à neuf domaines). Constat écrit dans
  `boucle/constats/2026-08-02-cout-appels-externes.md` : 4 mesures, dont deux violent
  directement le seuil `MISSION.md` (« aucun appel facturé répété pour une même donnée
  dans un même parcours ») — `/api/extract-meta` appelé jusqu'à 3 fois pour la même
  offre sur `/pack` (dont 2 dans le même clic, ordre `blur`-puis-`click` du navigateur)
  et déclenché même quand l'entreprise/le poste sont déjà connus gratuitement (venus
  de `/jobs` via « Candidater »). Deux mesures supplémentaires : le chat éditeur
  (`/api/editor-chat`) resend le CV/lettre entier et tout l'historique à chaque
  message sans jamais élaguer ; aucune des 8 routes IA n'a de plafond ni de compteur,
  contrairement à Jobscan (5 scans/mois gratuits) et Teal (10 crédits IA gratuits),
  vérifiés en direct sur leurs pages de tarifs publiques. Google Maps et Brandfetch
  vérifiés à part : déjà bien traités par un chantier antérieur (cache 30 jours pour
  les trajets, cache process pour les logos), rien à ajouter au constat sur ces deux
  points. 3 idées ajoutées à `boucle/IDEES.md` (non notées) : #12 (dédupliquer/éviter
  `/api/extract-meta` sur `/pack`), #13 (plafonner les appels IA — signalée sensible,
  touche au modèle économique), #14 (élaguer le chat éditeur).
- **Vérifications :** aucune exécution possible (pas de clés API dans cet
  environnement) — chaque mesure du constat est une lecture directe du code source
  citée par fichier et ligne, et pour §1 une séquence d'événements DOM standard
  (`blur` avant `click`) déductible du JSX lui-même, pas une hypothèse non vérifiable.
  Comparaison concurrentielle (Jobscan, Teal) faite par recherche web sur leurs pages
  de tarifs publiques, sources citées avec date dans le constat.
- **Domaine audité en dernier :** coût des appels externes (Éclaireur, 02/08/2026).
  Rotation : manques fonctionnels → coût des appels externes → hygiène du dépôt
  (**prochain domaine pour l'Éclaireur**) → manques fonctionnels → performance →
  briques externes → manques fonctionnels → accessibilité → parcours d'un nouvel
  arrivant → manques fonctionnels → cohérence visuelle → sécurité → (retour au
  début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
