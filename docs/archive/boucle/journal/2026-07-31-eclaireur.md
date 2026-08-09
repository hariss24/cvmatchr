# Journal — Éclaireur, 2026-07-31

Premier tour de rotation réel du rôle (ÉTAT.md indiquait « aucun » domaine audité
précédemment) → domaine choisi : **performance**.

## Ce qui a été fait

- Build de production (`npm run build && npm run start`) pour mesurer des temps
  représentatifs plutôt que le mode dev (compilation à la volée qui fausserait
  les chiffres).
- Installation de Chromium pour Playwright (absent de l'environnement) afin de
  mesurer un vrai temps de chargement navigateur, pas seulement un TTFB curl —
  le mandat prévient explicitement qu'un `curl` seul peut mentir sur ce qui est
  réellement vu par l'utilisateur.
- Mesures sous throttling réseau (« Slow 4G », profil mobile Lighthouse) et CPU
  (x4) séparés puis combinés, sur `/jobs` et `/pack`, 3 relevés par condition.
- Isolation de la cause : `/jobs` dépasse le seuil de MISSION.md (2 s) d'un
  facteur ~2 sous Slow 4G, et c'est le réseau (poids JS+CSS ~1 Mo) qui domine,
  pas le CPU (CPU seul : +130 ms à peine). `/pack` reste sous son seuil (2,5 s)
  mais avec une marge faible (120 ms) et une mesure d'interactivité qui ne
  couvre probablement pas Monaco/react-pdf (chargés en dynamique).
- Comparaison concurrentielle : tentative d'accès à Jobscan, Teal, Rezi,
  Kickresume, Enhancv. Jobscan et Teal bloquent les requêtes automatisées
  (403, même avec en-tête navigateur) — noté comme non vérifiable plutôt
  qu'inventé. Rezi et Enhancv répondent très vite en TTFB brut ; Kickresume
  nettement plus lentement (~1,7 s) — mais seulement sur leur page d'accueil
  marketing, pas leur outil réel (aucun compte disponible pour vérifier
  l'équivalent de `/jobs` ou `/pack` chez eux). Recherche web complémentaire :
  aucune plainte publique chiffrée sur la lenteur trouvée pour ces produits.
- Constat écrit : `boucle/constats/2026-07-31-performance.md`.
- Deux lignes ajoutées à `BACKLOG.md` § À planifier, la plus grave (`/jobs`)
  en premier.

## Décisions et ce qui a été écarté

- Écarté : mesurer la vraie recherche d'offres via les API externes
  (francetravail/adzuna/jsearch) — aucune clé n'est configurée dans cet
  environnement (`/api/status` confirme `server_key_configured: false` pour la
  clé IA, et aucune clé de recherche d'offres n'est présente). J'ai donc mocké
  la réponse `/api/jobs/search` exactement comme le fait déjà
  `tests/e2e/jobs.spec.ts`, pour isoler le temps de rendu app du temps réseau
  externe — et je l'ai dit explicitement dans le constat plutôt que de laisser
  croire à une mesure de bout en bout.
- Écarté : creuser plus loin la cause exacte des deux gros chunks partagés
  (281 Ko avec des schémas `zod`, 221 Ko). J'ai identifié la piste (`zod`
  détecté par grep dans le premier) mais l'attribution précise demande de lire
  du code d'architecture applicative, hors mandat de l'Éclaireur (« aucune
  ligne de code applicatif », et surtout hors du domaine strict de la mesure) —
  laissé comme chantier à trancher par l'Architecte.
- Écarté : pousser la recherche concurrentielle jusqu'à des comptes payants ou
  des avis G2/Capterra/Trustpilot détaillés, faute de temps dans ce tour ; noté
  comme limite plutôt que remplie par supposition.

## Fichiers touchés

- `boucle/constats/2026-07-31-performance.md` (nouveau)
- `boucle/BACKLOG.md` (deux lignes ajoutées à « À planifier »)
- `boucle/ETAT.md` (mis à jour)
- `boucle/journal/2026-07-31-eclaireur.md` (ce fichier)

Aucun fichier applicatif (`web/`) n'a été modifié — seuls des scripts de mesure
temporaires ont été créés puis supprimés avant ce commit (vérifié par
`git status`).
