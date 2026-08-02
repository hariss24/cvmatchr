# Constat — coût des appels externes au 2026-08-02

**Mesuré par :** lecture directe du code (`web/src/lib/ai/`, `web/src/lib/jobs/`,
`web/src/app/api/`, `web/src/components/pack/`, `web/src/components/modals/`) — pas
d'exécution serveur : aucune clé (`GEMINI_API_KEY`, `FT_CLIENT_ID`, `ADZUNA_APP_ID`,
`JSEARCH_API_KEY`) n'est configurée dans cet environnement de boucle, donc pas d'appel
réel possible. Chaque constat ci-dessous cite le fichier et la ligne exacte du code qui
le prouve.

## Mesures

### 1. `/api/extract-meta` (IA, extraction entreprise/poste) appelé jusqu'à 3 fois pour
la même offre, dans le même clic, sur `/pack`

`web/src/components/pack/PackView.tsx` appelle `fetchJobMeta` (→ `POST /api/extract-meta`,
un appel IA complet, jusqu'à 30 000 caractères de prompt — `extract-meta/route.ts:19`) à
trois endroits distincts, sans aucun cache entre eux :

- ligne 219 : `onExtracted` de `JobExtractor` → `prefillFromJob(text)`, au retour de
  l'extraction d'une offre par URL.
- ligne 226 : `onBlur` du `<textarea>` de l'offre → `prefillFromJob(jobDesc)`, à **chaque
  perte de focus** du champ.
- ligne 115 (dans `adaptWithAi`) : un troisième appel à `fetchJobMeta(desc)`, juste avant
  d'adapter la lettre.

Séquence reproduite à la lecture : l'utilisateur colle une offre au clavier, puis clique
directement sur « ✨ Adapter le corps à l'offre » (ligne 248) sans avoir cliqué ailleurs
avant. Le clic sur ce bouton déclenche d'abord un `blur` du textarea encore focus (comportement
standard du navigateur : `mousedown` sur un autre élément cliquable blur l'élément actif
avant que `onClick` ne s'exécute) → appel IA n°1 (`onBlur`, ligne 226). Puis `onClick`
s'exécute → `adaptWithAi` → appel IA n°2 (ligne 115). **Deux appels `/api/extract-meta`
pour la même chaîne de caractères, dans le même clic**, alors que la deuxième réponse ne
peut être différente de la première (même modèle, même prompt, `temperature` du store
inchangée entre les deux). Si l'utilisateur est arrivé via `JobExtractor` (ligne 219), un
troisième appel a déjà eu lieu avant celui-ci.

Avec le fixture de test `web/tests/fixtures/job_sharkninja.txt` (6 934 caractères), c'est
~6,9 Ko de prompt répétés à l'identique 2 à 3 fois — sans compter le prompt système
(`SYSTEM_EXTRACT_META`).

### 2. Le même appel IA est parfois fait pour une donnée déjà connue gratuitement

Le parcours principal du produit — « Candidater » depuis une carte d'offre sur `/jobs` —
connaît déjà l'entreprise et le poste, extraits **structurellement** (pas par IA) de la
réponse de France Travail / Adzuna / JSearch :

`web/src/components/jobs/JobsView.tsx:304-306` (fonction `apply`) :
```
if (job.company) setCompany(job.company);
if (job.title) setRole(job.title);
router.push("/pack");
```

Ces valeurs atterrissent dans le `docStore`, et `PackView.tsx:31-32` les relit au montage
(`company`/`role` initialisés depuis `useDocStore.getState()`). Elles sont donc déjà
exactes et gratuites quand `showAdapt` s'ouvre automatiquement (ligne 42-44, parce que
`pendingJobDesc` est présent).

Pourtant, si l'utilisateur clique « Adapter le corps à l'offre » sans toucher au texte de
l'offre, `adaptWithAi` (ligne 115) appelle quand même `fetchJobMeta(desc)` — un appel IA —
pour re-déduire du texte libre une information déjà connue avec certitude. Pire :
`resolveMeta` (`web/src/lib/letter/adapt.ts:26-31`) fait primer la réponse de l'IA sur la
valeur déjà connue :
```
company: fromJob?.company.trim() || current.company.trim(),
```
Une extraction IA imparfaite (raison sociale reformulée, tronquée, ou différente de
l'intitulé exact renvoyé par l'API source) peut donc **remplacer** une donnée exacte et
gratuite par une donnée payante et potentiellement moins fiable, sans qu'aucune condition
ne le prévienne.

### 3. `/api/editor-chat` : le CV/lettre complet et tout l'historique repartent en entier
à chaque message, sans jamais être élagués

`web/src/components/modals/ChatPanel.tsx` :
- ligne 32 : `historyRef.current` accumule tous les messages de la conversation, sans
  limite de taille ni de nombre.
- lignes 78-82 : chaque envoi (`postJson("/api/editor-chat", ...)`) repart avec
  `messages: historyRef.current` (l'historique complet) **et** `doc_json: strippedJson`
  (le CV/lettre entier, photo exclue).

Côté serveur, `web/src/app/api/editor-chat/route.ts:40-48` reconstruit à chaque appel un
préambule `context` avec le JSON du document en entier, préfixé devant tout l'historique.
Rien ne compare le `doc_json` envoyé à celui du tour précédent : s'il n'a pas changé
(l'utilisateur pose plusieurs questions à la suite sans appliquer de proposition), le même
bloc JSON est répété intégralement à chaque tour.

Mesure : `web/tests/fixtures/base_resume.json` sans la photo pèse 4 742 caractères
(`python3 -c "import json; d=json.load(open('base_resume.json')); d.pop('photo',None);
print(len(json.dumps(d)))"` → `4742`). Sur une conversation de 10 messages sans
modification du document, c'est ~47 Ko de JSON identique répétés en pure perte, en plus de
l'historique qui grossit lui-même de façon quadratique (chaque tour renvoie tous les tours
précédents).

### 4. Aucun plafond ni compteur sur les appels IA — seuls les appels aux job-boards sont
comptés, et seulement à titre indicatif

`web/src/middleware.ts` ne fait qu'une chose : vérifier un mot de passe partagé
(`AUTH_PASSWORD`/`REMOTE_AUTH_PASSWORD`). Aucune limite de débit, aucun quota par
utilisateur ou par IP sur les routes `/api/tailor-resume`, `/api/adapt-letter`,
`/api/ats-score`, `/api/editor-chat`, `/api/pdf-to-resume`, `/api/text-to-resume`,
`/api/text-to-letter`, `/api/extract-meta` — les huit routes qui appellent
`complete`/`streamCompletion` (`web/src/lib/ai/clients.ts`).

Le seul compteur de quota du produit (`web/src/lib/storage/db.ts:614-659`,
`bumpApiUsage`/`getApiUsage`) ne couvre que `francetravail`/`adzuna`/`jsearch`, et le
commentaire du code le dit lui-même : « compteur **local et indicatif** […] pas à faire
autorité » (ligne 627-629) — rien ne bloque un dépassement, il est seulement affiché.
Sans clé personnelle configurée dans les Paramètres, tous les appels IA d'un utilisateur
retombent sur `GEMINI_API_KEY`, la clé du serveur (`web/src/lib/ai/clients.ts:64`) :
rien dans le code n'empêche un utilisateur (ou un script) d'appeler `/api/tailor-resume`
en boucle et de consommer ce quota partagé sans jamais être ralenti ni compté.

Pour les sources job-board elles-mêmes, un calcul simple à partir du code : JSearch
annonce un quota gratuit de 200 appels/mois (`web/src/lib/jobs/jsearch.ts:12`), et
`calls = profile.keywords.length` par scan (`jsearch.ts:99`) — un profil à 3 mots-clés
épuise ce quota gratuit en 66 scans, soit ~2 scans/jour sur un mois, sans qu'aucune alerte
ni blocage ne prévienne l'utilisateur avant le refus de l'API.

## Ce que fait la concurrence sur ce point

- **Jobscan** — plan gratuit : 5 scans ATS par mois, plans payants à partir de 29,98
  $/mois (facturé trimestriellement) ou 49,95 $/mois. Chaque scan (l'équivalent de notre
  `/api/ats-score`) est un geste compté et plafonné dès le palier gratuit — signe qu'ils
  traitent chaque appel comme une ressource dont le coût doit être maîtrisé dès la
  conception, pas ajouté après coup. Sources : PitchMeAI
  (https://pitchmeai.com/blog/jobscan-pricing-plans, consulté le 02/08/2026),
  onlineatschecker.com (https://onlineatschecker.com/blog/jobscan-pricing-2026-free-plan-worth-it,
  consulté le 02/08/2026).
- **Teal (Teal HQ)** — plan gratuit : fonctionnalités IA (génération de CV, score de
  correspondance à une offre) plafonnées à 10 « crédits IA » au total ; Teal+ (≈ 29
  $/mois) débloque des crédits illimités. Même logique : toute action qui déclenche un
  appel IA est comptée nommément, avec un plafond dur avant le palier payant. Source :
  resumeoptimizerpro.com
  (https://resumeoptimizerpro.com/blog/resume-optimizer-pro-vs-teal, consulté le
  02/08/2026).

Les deux plafonnent l'action utilisateur elle-même (scan, génération), pas seulement un
sous-ensemble de leurs fournisseurs externes comme le fait CVMatchr avec son compteur
`francetravail`/`adzuna`/`jsearch` — aucun des deux ne laisserait un utilisateur relancer
un scan ATS ou une génération IA sans compter le geste, quand CVMatchr ne compte aucun
appel IA du tout.

## Écart au seuil de MISSION.md

Seuil : « aucun appel facturé répété pour une même donnée dans un même parcours ». Les
constats §1 (2-3 appels `/api/extract-meta` identiques dans un seul clic sur `/pack`) et
§2 (appel IA pour une donnée déjà connue gratuitement) violent ce seuil directement et de
façon reproductible à la lecture du code — pas une hypothèse, une séquence d'événements
DOM standard (`blur` avant `click`) déclenchée par l'ordre du JSX lui-même.

## Écart à la concurrence

En retard sur le plafonnement des appels IA : Jobscan et Teal comptent et plafonnent
chaque geste IA dès leur offre gratuite (§ « Ce que fait la concurrence »), CVMatchr n'en
compte et n'en plafonne aucun — seuls les trois job-boards ont un compteur, purement
indicatif. Sur la duplication d'appels en revanche, rien n'indique que Jobscan ou Teal
fassent mieux ou moins bien : c'est un défaut interne au code de CVMatchr, pas un terrain
de comparaison publique observable de l'extérieur.

## Chantiers proposés

1. **Dédupliquer `/api/extract-meta` sur `/pack`** — un seul appel par offre distincte :
   mémoriser le dernier `(jobDesc, résultat)` comme le fait déjà `AtsPanel.tsx:39`
   (`derniere`), et ne pas relancer l'appel si le texte n'a pas changé depuis la dernière
   résolution. Supprime aussi le déclenchement en cascade `onBlur` + clic du bouton.
   Gain attendu : jusqu'à 2 appels IA évités par adaptation de lettre sur `/pack`.
2. **Ne jamais appeler `/api/extract-meta` quand `company`/`role` sont déjà connus** (venu
   de `/jobs` via « Candidater », donc structurellement exacts) — inverser la priorité
   dans `resolveMeta` pour que la valeur déjà connue prime sur la déduction IA, ou sauter
   l'appel entièrement quand les deux champs sont déjà renseignés. Gain attendu : l'appel
   IA le plus fréquent du parcours « Candidater » disparaît complètement.
3. **Tronquer/résumer l'historique et ne pas répéter un `doc_json` inchangé sur
   `/api/editor-chat`** — n'envoyer le JSON du document que s'il a changé depuis le dernier
   tour (hash simple côté client), et limiter l'historique envoyé aux N derniers échanges.
   Gain non chiffré précisément ici (dépend de la longueur réelle des conversations en
   usage), mais la croissance est quadratique et non bornée aujourd'hui.
4. **Compter/plafonner les appels IA comme les job-boards** — étendre
   `bumpApiUsage`/`getApiUsage` (`db.ts:614-659`) aux appels IA (par route, par mois), et
   décider d'un seuil (avertissement, puis blocage) quand aucune clé personnelle n'est
   configurée — c'est la clé serveur partagée qui est en jeu. Sujet le plus proche d'une
   décision produit (relève potentiellement d'un vrai plafond, pas seulement d'un
   compteur) : à trancher par le propriétaire.
