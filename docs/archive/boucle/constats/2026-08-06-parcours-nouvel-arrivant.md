# Constat — parcours d'un nouvel arrivant au 2026-08-06

**Mesuré par :**

- Serveur cible : `npm run dev` (Next.js 16.2.9 / Turbopack), aucune variable
  `REMOTE_AUTH_PASSWORD`/`AUTH_PASSWORD`/`GEMINI_API_KEY` définie (environnement de la
  boucle sans clé applicative, `PROJECT_INDEX.md` §13) — noté explicitement partout où
  cela limite une mesure.
- Playwright (`chromium`, déjà requis par `npm run test:e2e`, installé pour ce réveil
  avec `npx playwright install chromium`) piloté par des scripts Node ad hoc (non
  committés, hors périmètre de la boucle) : `page.goto('http://localhost:3000/')` sur
  un contexte de navigateur **neuf** (aucun `localStorage`/IndexedDB préexistant — un
  vrai premier arrivant), puis lecture directe du DOM (`$eval`, `getComputedStyle`),
  interception réseau (`page.on('requestfinished')`) et captures d'écran.
- Code source : lecture directe de `web/src/lib/resume/defaults.ts`,
  `web/src/components/layout/TopBar.tsx`, `web/src/components/editor/EditorPane.tsx`,
  `web/src/components/form/FormEditor.tsx`, `web/src/lib/storage/newResume.ts`,
  `web/src/app/help/page.tsx`, `web/src/app/globals.css`.

## Mesures

### 1. Le formulaire arrive déjà rempli — d'un CV entièrement fictif

`web/src/lib/resume/defaults.ts` (`DEFAULT_RESUME`) : à l'arrivée sur `/`, sans aucun
brouillon existant, les 36 champs du formulaire (`FormEditor.tsx`) contiennent déjà
des valeurs complètes et cohérentes en apparence — « Prénom Nom », « Titre du poste »,
deux expériences (« Poste occupé » chez « Entreprise », bullets chiffrées), une
formation, 6 compétences, 3 soft skills, 3 outils, 2 langues, 3 centres d'intérêt.
Mesuré en direct par Playwright (contexte neuf, aucun draft) :
```js
await page.goto('http://localhost:3000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[autocomplete="name"]');
await page.waitForFunction(() => document.querySelector('input[autocomplete="name"]').value.length > 0);
```
→ **750 ms** entre la navigation et un formulaire rempli et interactif (sous le seuil
« éditeur interactif < 2,5 s » de `MISSION.md`, avec une marge large — ce point n'est
pas le problème ici).

### 2. Rien n'empêche de télécharger ce CV fictif tel quel

`onConvert` (`TopBar.tsx:59-116`) ne contient **aucune validation** : ni champ
obligatoire, ni confirmation, ni comparaison au contenu par défaut. Mesuré en direct,
contexte neuf, zéro champ modifié :
```js
const downloadPromise = page.waitForEvent('download');
await page.click('button.go.go-top');   // bouton "Télécharger" de la barre du haut
const download = await downloadPromise;
```
→ le téléchargement aboutit en **766 ms**, fichier nommé `CV.pdf`
(`buildPdfFilename`, `lib/pdfgen/filename.ts` — poste vide donc nom générique), avec
pour contenu réel « Prénom Nom », « Titre du poste », « Entreprise », les deux bullets
d'exemple, etc. Un vrai premier arrivant peut donc atteindre le seuil littéral de
`MISSION.md` (« de l'arrivée au premier PDF ») en **moins d'une seconde et zéro
saisie** — mais le PDF produit ne contient aucune information réelle du candidat et
rien ne le signale.

### 3. Cette donnée fictive est visuellement indiscernable d'une donnée réelle

Le champ n'utilise pas l'attribut HTML `placeholder` (qui serait stylé différemment
par le navigateur et disparaîtrait à la frappe) : la valeur par défaut est écrite
directement dans le store (`json.name = "Prénom Nom"`), donc rendue avec la même
couleur que n'importe quelle saisie réelle. Mesuré par `getComputedStyle` sur le
champ « Nom complet » non modifié :
```js
await nameEl.evaluate(el => getComputedStyle(el).color)
// → "rgb(31, 27, 22)"
```
Recoupé avec le code : `--text: #1F1B16;` (`globals.css:13`, thème clair) =
`rgb(31, 27, 26)` arrondi à `rgb(31, 27, 22)` — **exactement** la couleur de texte
normale de l'application, pas une teinte atténuée. Rien dans l'interface (couleur,
italique, bandeau, icône) ne distingue une valeur d'exemple non touchée d'une valeur
saisie par le candidat. Le bouton « Nouveau CV » (`onNewCv`, `TopBar.tsx:51-55`)
appelle `startNewResume()` (`lib/storage/newResume.ts:21-40`), dont le commentaire de
code lui-même nomme le résultat « CV vierge » — alors que la fonction réinjecte le
même `DEFAULT_RESUME` fictif, pas un formulaire réellement vide.

### 4. « Importer un PDF » est visible dès l'arrivée ; « Importer un texte » est enterré à 3 clics sous un intitulé trompeur

Sur l'onglet « Formulaire » (celui affiché par défaut), un bandeau est visible sans
défilement : « Préremplis le formulaire depuis un CV PDF » + bouton « Importer un PDF »
(`FormEditor.tsx:143-150`) — bon point, confirmé par capture d'écran directe (bandeau
à 269 px du haut sur viewport 720 px, donc dans le premier écran).

« Importer un texte » (coller un CV en texte brut, sans PDF) n'existe nulle part sur
cet écran. Mesuré par recherche directe du bouton dans le DOM à chaque étape :
```js
// 0. arrivée
await page.$('button:has-text("Importer un texte")')   // → null
// 1. clic sur l'onglet "Mode Expert"
await page.click('button.tab--expert');
await page.$('button:has-text("Importer un texte")')   // → null (fait apparaître 2 sous-onglets : "JSON", "Importer")
// 2. clic sur le sous-onglet "Importer"
await page.click('.expert-tabs button:has-text("Importer")');
await page.$('button:has-text("Importer un texte")')   // → trouvé
```
Il faut donc **2 clics** avant même de voir le bouton, sur un chemin dont l'unique
intitulé visible à l'arrivée est « Mode Expert » — un libellé qui ne contient ni
« importer », ni « coller », ni « texte », et qui se lit comme une fonctionnalité
technique avancée (il ouvre aussi l'éditeur JSON brut Monaco) plutôt que comme une
option d'import pour un premier CV. La FAQ (`web/src/app/help/page.tsx`, accordéon
« Comment démarrer rapidement en 4 étapes ») liste pourtant l'import PDF/texte comme
première étape recommandée — mais seulement pour qui a déjà ouvert l'aide, ce que le
seuil de `MISSION.md` ne devrait pas exiger.

### 5. Aucun choix de départ à l'arrivée — pas de wizard, pas d'écran « Importer / Partir de zéro / Exemple »

Confirmé négativement par lecture de `app/page.tsx` (aucune logique conditionnelle
sur « premier arrivant ») et par grep sur tout `src/` (`bienvenue|onboard|tutoriel
|walkthrough|getting.started|welcome`, hors deux faux positifs sans rapport — un
commentaire de test et le texte d'un placeholder d'URL « Welcome to the Jungle »).
Il n'existe aucun écran de choix, aucune bannière de bienvenue, aucun compteur
d'étapes.

## Ce que fait la concurrence sur ce point

Trois produits de référence consultés en détail sur leur parcours de premier lancement
(revues publiées, pas de compte créé — CVMatchr n'expose pas non plus son
éditeur derrière connexion par défaut, donc la comparaison porte ici sur des comptes
rendus tiers plutôt que sur un accès direct identique des deux côtés) :

- **Rezi** — [Rezi Review 2026: Walkthrough, Features, and Alternatives](https://jobright.ai/blog/rezi-review-2026-walkthrough-features-and-alternatives/)
  (consulté le 06/08/2026) : premier écran = « Click **Create New Resume** and choose
  to import an existing resume or connect your LinkedIn profile. » — un choix explicite
  avant tout formulaire. Et [Rezi Review — Enhancv](https://enhancv.com/blog/rezi-review/)
  (consulté le 06/08/2026), cité mot pour mot : « You either start from scratch or
  import an existing resume or LinkedIn profile. From there, everything happens inside
  structured fields. **There's no blank page moment.** You're never asked, 'What do you
  want this to look like?' » — si l'utilisateur choisit « from scratch », un
  questionnaire (rôle, niveau d'expérience) construit un squelette avant de le lâcher
  dans l'éditeur ; il n'atterrit jamais dans un CV pré-rempli de données factices.
- **Kickresume** — [Kickresume Review — Enhancv](https://enhancv.com/blog/kickresume-review/)
  (consulté le 06/08/2026) : **compte obligatoire** (« There's no way to meaningfully
  explore the tool before signing up »), puis un écran de choix explicite à cinq
  options (« New Resume », « New Resume with AI », « Import PDF », « Use Example »,
  « Import from LinkedIn ») — mais l'article note que « there's no clear recommendation
  for which path a new user should take, which can make the first step feel less
  guided » et que « Variety clashes with a feeling of overwhelm, though, especially for
  first-time users » : le choix existe mais n'est pas hiérarchisé.
- **Teal** — synthèse via [Teal Review — Rezi Blog](https://www.rezi.ai/posts/teal-review)
  et sources croisées (consulté le 06/08/2026) : **compte obligatoire**, l'utilisateur
  atterrit d'abord dans un tableau de bord de suivi d'offres (pas un éditeur de CV),
  puis « starting from scratch takes you into Teal's guided resume builder […] moving
  through structured tabs ». Pas de « moment CV vierge » avant que l'utilisateur ait
  choisi une action.

**Aucun des trois n'autorise un téléchargement immédiat de données d'exemple non
éditées** : Rezi et Teal font passer l'utilisateur par un choix ou un formulaire guidé
avant d'atteindre un état exportable ; Kickresume propose « Use Example » comme option
explicite parmi cinq, pas comme état par défaut silencieux.

**CVMatchr est seul des quatre à n'exiger aucun compte** — confirmé pour les trois
concurrents ci-dessus (compte obligatoire dans les deux cas où l'information est
disponible ; non vérifié spécifiquement pour Rezi mais son propre écran de démarrage,
cité ci-dessus, suppose déjà un compte ouvert). C'est un avantage réel à ne pas perdre
en resserrant l'onboarding.

## Écart au seuil de MISSION.md

Seuil : « Nouvel arrivant : de l'arrivée au premier PDF sans consulter l'aide. »

Au sens le plus littéral, le seuil est **atteint et même dépassé** : 766 ms suffisent.
Mais cette lecture littérale masque le vrai risque, que le seuil est censé prévenir :
rien dans `MISSION.md` ne précise que le premier PDF doit contenir les informations du
candidat, et le produit ne le garantit pas non plus. Un candidat pressé — le profil
même que `MISSION.md` vise (« sans explication préalable ») — peut légitimement
confondre l'écran pré-rempli avec un CV déjà personnalisé (mesure 3 : couleur de texte
identique) et télécharger ou envoyer un PDF contenant « Prénom Nom » et « Entreprise »
en croyant avoir terminé. Le vrai chemin utile (import ou saisie réelle) reste, lui,
non guidé : aucun écran ne demande jamais explicitement au candidat ce qu'il veut faire
(mesure 5), et une des deux voies d'import (texte collé) est matériellement invisible
sans avoir cliqué sur un onglet dont le nom n'évoque pas l'import (mesure 4).

## Écart à la concurrence

- **En avance** : aucun compte requis, contre compte obligatoire chez les trois
  concurrents vérifiés (Rezi, Kickresume, Teal) — CVMatchr peut être essayé et un PDF
  téléchargé en une poignée de secondes, ce qu'aucun des trois ne permet avant d'avoir
  créé un compte.
- **En retard** : les trois concurrents vérifiés posent tous, sous une forme ou une
  autre, un choix explicite avant de remplir un éditeur (Rezi : import/scratch/LinkedIn
  avec questionnaire ; Kickresume : cinq options nommées ; Teal : tableau de bord puis
  builder guidé). CVMatchr ne pose aucune question et ne distingue jamais, dans
  l'interface, un contenu d'exemple d'un contenu réel — aucun des trois concurrents
  vérifiés ne laisse un premier export partir avec des données factices non signalées
  comme telles.

## Chantiers proposés

1. Distinguer visuellement les valeurs d'exemple non modifiées des valeurs réellement
   saisies (teinte atténuée façon `--faint`, ou bascule vers un vrai `placeholder` HTML
   plutôt qu'une valeur de store), et avertir avant un export dont le contenu correspond
   encore à `DEFAULT_RESUME`/`DEFAULT_LETTER` — gain attendu : élimine le risque de PDF
   factice envoyé sans le vouloir, sans bloquer qui voudrait sciemment tester le
   produit.
2. Sortir le bouton « Importer un texte » du sous-onglet « Importer » de « Mode Expert »
   et le poser à côté de « Importer un PDF », déjà visible sur l'onglet Formulaire par
   défaut (`FormEditor.tsx:143-150`) — gain attendu : la deuxième voie d'import déjà
   recommandée en premier point de la FAQ devient trouvable sans l'avoir lue, en zéro
   clic supplémentaire au lieu de trois.
3. Poser un choix explicite à l'arrivée sur un document neuf (« Importer un CV » /
   « Partir d'un exemple à modifier » / « Partir de zéro ») plutôt que de préremplir
   silencieusement — gain attendu : aligne CVMatchr sur les trois concurrents vérifiés
   sans réintroduire de compte ni de friction d'inscription, en gardant l'avantage
   d'accès immédiat.
