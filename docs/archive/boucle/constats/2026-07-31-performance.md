# Constat — performance au 2026-07-31

**Domaine :** performance (premier tour de rotation de l'Éclaireur, précédent domaine
audité : aucun)

**Mesuré par :**
- Build de production réel : `cd web && npm run build && npm run start` (serveur
  vérifié up, `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` → `200`
  avant toute mesure).
- Chronométrage navigateur réel (Playwright + Chromium 149, piloté via CDP) avec
  throttling réseau/CPU explicite — pas de simple `curl`, qui ne mesure que la
  réponse HTML brute et ne dit rien du temps perçu par l'utilisateur (JS, CSS,
  hydratation). Profil réseau **« Slow 4G »** = profil mobile par défaut de
  Lighthouse : 1,6 Mbps descendant, 750 kbps montant, RTT 150 ms.
  `Emulation.setCPUThrottlingRate({rate:4})` pour le CPU.
- Poids réel transféré : script Playwright interceptant chaque réponse `.js`/`.css`
  et mesurant `(await response.body()).length` (taille décompressée, donc taille
  d'exécution — pas la taille sur le fil, forcément plus petite en gzip/br).
- Concurrence : `curl -s -o /dev/null -w "code=%{http_code} time_total=%{time_total}s
  size=%{size_download}"` sur les pages d'accueil publiques, 3 relevés par site,
  le 2026-07-31.

## Mesures

### `/jobs` (recherche d'offres) — seuil MISSION.md : premier résultat visible < 2 s

Atterrissage → page chargée (`waitUntil: "load"`), 3 relevés par condition :

| Condition | Relevés (ms) |
|---|---|
| Sans throttling (référence machine) | 175, 210, 192 |
| CPU x4 seul (réseau normal) | 318, 335, 331 |
| **Réseau Slow 4G seul (CPU normal)** | **3890, 3913, 4020** |
| Réseau Slow 4G + CPU x4 (condition mobile combinée) | 3885, 4072, 3877 |

Une fois la page chargée, clic sur « Rechercher » (mot-clé « Webmaster » saisi,
réponse `/api/jobs/search` mockée comme dans `tests/e2e/jobs.spec.ts` — aucune clé
d'API de recherche d'offres n'est configurée dans cet environnement, donc le
temps réseau externe francetravail/adzuna/jsearch n'est **pas** mesuré ici,
seulement le rendu côté app) → première `job-card` visible, sous Slow 4G + CPU x4 :
174, 241, 180 ms. **Ce n'est pas le goulot** : le chargement de la page l'est.

Poids JS+CSS décompressé chargé par `/jobs` au premier atterrissage : **1024 KB**
sur 12 fichiers (`2w9bjs17pyc72.js` 281 KB — contient ~485 occurrences du mot
`zod`, donc probablement des schémas de validation embarqués côté client —,
`3j9pm5otqxm82.js` 221 KB, `373yfygk3klou.js` 135 KB, une feuille CSS de 107 KB,
etc.).

### `/pack` (éditeur CV/lettre) — seuil MISSION.md : interactif < 2,5 s

Atterrissage → premier élément interactif visible (`textarea, [contenteditable],
canvas, iframe, button`), 3 relevés par condition :

| Condition | Relevés (ms) |
|---|---|
| Sans throttling (référence machine) | 196, 200, 200 |
| CPU x4 seul (réseau normal) | 503, 551, 584 |
| Réseau Slow 4G seul (CPU normal) | 2201, 2185, 2185 |
| Réseau Slow 4G + CPU x4 (condition mobile combinée) | 2381, 2381, 2376 |

Poids JS+CSS décompressé au premier atterrissage : **198 KB** sur 5 fichiers
(bien inférieur à `/jobs` — Monaco et react-pdf sont chargés paresseusement,
donc absents de cette première mesure).

**Limite de cette mesure** : le sélecteur `button` apparaît dès l'affichage de la
coquille de la page ; il ne garantit pas que Monaco (éditeur de code) et
react-pdf (aperçu) — chargés en dynamique — soient déjà prêts. Le vrai temps
« interactif pour éditer/exporter » est probablement supérieur aux chiffres
ci-dessus ; non mesuré ici faute de sélecteur fiable identifié dans le temps
imparti à cet audit.

## Ce que fait la concurrence sur ce point

Accès direct (curl) :

| Site | Code | Temps (3 relevés) | Poids transféré |
|---|---|---|---|
| rezi.ai | 200 | 0.062s / 0.049s / 0.064s | 713 KB |
| kickresume.com | 200 (1 redirect) | **1.712s / 1.722s / 1.751s** | 321 KB |
| enhancv.com | 200 | 0.060s / 0.032s / 0.080s | 328 KB |
| jobscan.co | **403** (pare-feu anti-bot) | — | — |
| tealhq.com | **403** (pare-feu anti-bot, même avec en-tête `User-Agent` navigateur) | — | — |

Ces mesures ne portent que sur la **page d'accueil marketing**, pas sur l'éditeur
ou le scanner derrière connexion — aucun compte disponible pour ces produits
dans cet environnement, donc le vrai point de comparaison (leur `/jobs` ou leur
`/pack` à eux) est **non vérifiable sans compte**. La méthode n'est donc pas
strictement comparable à mes mesures Playwright sur CVMatchr (curl ne charge ni
JS ni CSS ni n'exécute d'hydratation) : elle donne un ordre de grandeur du
temps de réponse serveur, rien de plus. kickresume.com est notablement plus
lent en TTFB brut (~1,7 s) que rezi.ai et enhancv.com (~50-80 ms) depuis ce
réseau — écart qui peut aussi venir du routage CDN propre à cette machine, pas
forcément représentatif d'un utilisateur français.

Recherche complémentaire (Google, 2026-07-31, requêtes « Jobscan OR Teal OR Rezi
resume builder slow loading reviews performance 2026 » et « Kickresume Enhancv
app speed reviews "slow" OR "fast" editor ») : aucun résultat ne documente de
vrai problème de performance chiffré pour ces outils. Les seules mentions sont
des affirmations marketing non vérifiées techniquement (« Kickresume excels in
speed and design », Teal noté 4.9/5 sur le Chrome Web Store pour son ergonomie
générale, pas spécifiquement sa vitesse). Traiter ces affirmations comme du
marketing, pas comme une mesure — je ne les cite que parce que l'absence de
plainte publique sur la lenteur est en soi une donnée : si un concurrent majeur
avait un problème de chargement comparable à celui mesuré ici sur `/jobs`, on
s'attendrait à le voir remonter dans des avis G2/Capterra/Trustpilot ; recherche
non poussée jusqu'à ces plateformes faute de temps dans ce tour d'audit.

Sources :
- https://www.rezi.ai/posts/best-ai-resume-builders (consulté 2026-07-31)
- https://www.tealhq.com/post/best-ai-resume-builders (consulté 2026-07-31)
- https://enhancv.com/blog/kickresume-review/ (consulté 2026-07-31)

## Écart au seuil de MISSION.md

- `/jobs` : seuil « premier résultat visible < 2 s ». Mesuré : **~3,9 s** pour le
  seul chargement de la page sous Slow 4G (profil mobile standard), avant même
  de saisir une recherche. **Dépassement d'un facteur ~2**, imputable au réseau
  (poids JS+CSS ~1 Mo décompressé), pas au CPU (le CPU seul x4 ne coûte que
  ~130 ms de plus que la référence).
- `/pack` : seuil « interactif < 2,5 s ». Mesuré : **~2,38 s** en condition
  mobile combinée — **sous le seuil, mais de 120 ms seulement**, et cette
  mesure ne couvre que la coquille de page, pas Monaco/react-pdf (probablement
  sous-estimée, voir limite ci-dessus). À traiter comme un quasi-échec plutôt
  qu'une marge confortable.

## Écart à la concurrence

**Non tranchable avec les données recueillies** : la seule mesure technique
comparable obtenue (TTFB de la page d'accueil marketing, pas de l'app) place
CVMatchr dans la moyenne haute (rezi.ai et enhancv.com répondent plus vite en
TTFB brut, kickresume.com plus lentement) — mais ce chiffre ne dit rien du
temps réel jusqu'à l'interactivité de leurs outils, qui est la vraie mesure
pertinente et qui reste non vérifiable sans compte chez ces quatre produits.
Jobscan et Teal n'ont pas pu être consultés du tout (pare-feu anti-bot). Aucune
plainte publique chiffrée sur la lenteur de ces produits n'a été trouvée, ce qui
est un signal faible mais réel que 3,9 s de chargement pour voir un premier
résultat serait probablement perçu comme lent en comparaison.

## Chantiers proposés

1. **Réduire le poids JS/CSS initial de `/jobs`** (actuellement ~1 Mo décompressé,
   contre 198 Ko pour `/pack`) — gain attendu : ramener le chargement sous 2 s
   sur Slow 4G, probablement en vérifiant si le chunk de 281 Ko chargeant des
   schémas `zod` doit vraiment être exécuté côté client sur cette page, et si le
   chunk partagé de 221 Ko (chargé sur presque toutes les routes) peut être
   scindé pour ne livrer que ce que `/jobs` utilise réellement.
2. **Mesurer le vrai temps d'interactivité de `/pack`** en attendant que Monaco
   et react-pdf soient chargés (pas seulement la coquille) — gain attendu :
   savoir si le seuil de 2,5 s est réellement tenu ou seulement en apparence ;
   la marge actuelle (120 ms) est trop faible pour trancher sans cette mesure.
3. *(mineur)* Vérifier pourquoi `2w9bjs17pyc72.js` (schémas zod, 281 Ko) est
   référencé sur `/login`, `/help`, `/`, `/pack` mais ne s'est pas chargé lors
   de la mesure directe de `/pack` — signe possible d'un chargement conditionnel
   qui pourrait aussi bénéficier à `/jobs` s'il est généralisé.
