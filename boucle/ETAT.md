# ÉTAT

*(fichier court, écrasé à chaque réveil — ce n'est pas un historique,
le journal est dans `boucle/journal/`)*

- **Dernier réveil :** 2026-08-06 (Éclaireur)
- **Rôle joué :** Éclaireur
- **PR en cours :** aucune — l'Éclaireur n'écrit que dans `boucle/` et `docs/`.
- **Ce qui a été fait :** audité le domaine « parcours d'un nouvel arrivant » (jamais
  traité jusqu'ici, premier de la rotation). Serveur local (`npm run dev`, aucune clé
  applicative, comme tous les réveils de la boucle) piloté par Playwright (Chromium
  installé pour ce réveil) sur un contexte de navigateur neuf (aucun brouillon
  préexistant — un vrai premier arrivant). Constat : le formulaire arrive déjà rempli
  d'un CV entièrement fictif (`DEFAULT_RESUME`), visuellement indiscernable d'une
  saisie réelle (même couleur de texte, `rgb(31,27,22)` = `--text` exact, mesuré par
  `getComputedStyle`) ; rien n'empêche de télécharger ce CV factice tel quel (clic sur
  « Télécharger » → PDF téléchargé en 766 ms, zéro validation) ; « Importer un PDF »
  est visible dès l'arrivée (bon point) mais « Importer un texte » reste caché à deux
  clics sous l'onglet « Mode Expert », un libellé qui n'évoque pas l'import ; aucun
  écran ne pose de choix explicite à l'arrivée (« importer / exemple / zéro »),
  contrairement aux trois concurrents vérifiés en détail (Rezi, Kickresume, Teal —
  sources et citations exactes dans le constat), qui posent tous ce choix mais exigent
  tous un compte, contrairement à CVMatchr. Trois idées ajoutées non notées en fin
  d'`IDEES.md` (section « À noter ») pour l'Arbitre : distinguer les données d'exemple
  des données réelles + avertir avant un export factice ; sortir l'import texte du
  Mode Expert ; poser un choix explicite à l'arrivée sur un document neuf. Constat
  complet : `boucle/constats/2026-08-06-parcours-nouvel-arrivant.md`.
- **Vérifications :** relu `MISSION.md`, `ETAT.md`, `IDEES.md` (classement complet +
  section Écartées) et `boucle/roles/eclaireur.md` avant de commencer. Vérifié
  qu'aucune des trois idées n'apparaît déjà en section « Écartées ». Chaque mesure de
  ce constat est reproduite par une commande ou un extrait de script exact (Playwright
  + `getComputedStyle` + grep sur le code source), comme l'exige `eclaireur.md` (« Aucun
  constat sans chiffre ni reproduction »). Comparaison à la concurrence faite sur
  trois produits (Rezi, Kickresume, Teal) via des revues publiées consultées et citées
  le 06/08/2026 (aucun des trois n'expose son onboarding réel sans compte, donc lecture
  de comptes rendus tiers plutôt qu'un accès direct — précisé dans le constat).
  `git status --short` vérifié avant ce commit : seuls
  `boucle/constats/2026-08-06-parcours-nouvel-arrivant.md`, `boucle/IDEES.md`,
  `boucle/ETAT.md` et le journal du jour sont modifiés/créés, rien hors de `boucle/`.
- **Domaine audité en dernier (Éclaireur) :** parcours d'un nouvel arrivant
  (06/08/2026). Rotation : coût des appels externes → hygiène du dépôt → manques
  fonctionnels → performance → briques externes → manques fonctionnels →
  accessibilité → parcours d'un nouvel arrivant → **manques fonctionnels (prochain
  domaine pour l'Éclaireur)** → cohérence visuelle → sécurité → manques fonctionnels →
  (retour au début).
- **Échecs consécutifs du Gardien sur la PR courante :** 0 (aucune PR issue de ce
  réveil — l'Éclaireur ne produit pas de code).
