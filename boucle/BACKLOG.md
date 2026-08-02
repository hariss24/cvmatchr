# BACKLOG

Canal de pilotage. Le propriétaire écrit ici en langage courant, sans syntaxe à
apprendre. Conventions minimales :

- une ligne commence par `- ` ;
- `!` en tête = à traiter en premier dans sa section ;
- `[feu vert requis]` = chantier bloqué tant que la ligne ne porte pas `!ok` ;
- une ligne barrée `~~…~~` est ignorée (refusée par le propriétaire).

**Les titres de section ci-dessous sont analysés par un script — ne pas les renommer.**

## Prêt à coder

*(un plan existe, le Bâtisseur peut s'y mettre — vide au démarrage)*

- Manque fonctionnel — extension navigateur (autofill de candidature Greenhouse/Lever, sans capture d'offre — voir écarté explicitement §2 de la spec) : présente chez 7 des 8 produits de référence, le manque le plus large mesuré à ce jour. Aucune dépendance npm, aucun feu vert requis. Spec : `docs/superpowers/specs/2026-08-02-extension-autofill-design.md`. Plan : `docs/superpowers/plans/2026-08-02-extension-autofill.md`.

## À planifier

*(un constat existe, l'Architecte doit en faire une spec + un plan)*

- Manque fonctionnel — préparation d'entretien par IA (mock interview) : présente chez 4 produits (Rezi, Kickresume, Enhancv, Careerflow). Ampleur : grosse, mais techniquement le plus proche de l'existant (réutilise `editor-chat` et l'offre déjà extraite en texte). Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §2.
- Manque fonctionnel — optimisation de profil LinkedIn (analyse + suggestions) : présente chez 2 produits avec outil dédié (Jobscan, Careerflow). Ampleur : moyenne, flux proche de `ats-score` si le profil est collé en texte. Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §4.
- Manque fonctionnel — CRM de networking / suivi de contacts : présent chez 4 produits (Teal, Huntr, Careerflow, Simplify), mais en tension directe avec le principe directeur du tracker actuel (statut dérivé, zéro saisie — `PROJECT_INDEX.md` §8 bis). Nécessite un arbitrage du propriétaire avant toute spec, pas une simple priorisation technique. Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §3.
- Manque fonctionnel — import direct du profil LinkedIn pour préremplir le CV : présent chez 2 produits (Rezi, Kickresume). Ampleur : moyenne, mais faisabilité technique à vérifier en premier (LinkedIn bloque activement le scraping non officiel) — risque d'être bloquant avant même d'écrire une spec. Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §5.
- Manque fonctionnel — identification des compétences manquantes vs une offre (« skill gap ») : présent chez 2 produits (Careerflow, Enhancv). Chevauchement possible avec le moteur ATS existant (`src/lib/ats/engine.ts`) à vérifier avant de chiffrer — peut-être un nouvel affichage plutôt qu'un nouveau calcul. Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §6.
- Manque fonctionnel — journal de candidature (réalisations, culture d'entreprise, questions à poser) : présent chez 2 produits (Teal, Simplify). Ampleur : petite, valeur incertaine pour un candidat isolé, saisie manuelle récurrente à contre-courant du principe « zéro coût pour l'utilisateur ». Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §7.
- Manque fonctionnel — générateur de lettre de démission : présent chez 2 produits (Rezi, Kickresume). Ampleur : négligeable (usage ponctuel, valeur faible), mention pour mémoire seulement, à ne prioriser que si un chantier lettre est déjà ouvert pour une autre raison. Voir `boucle/constats/2026-08-01-manques-fonctionnels.md` §8.
- Performance `/pack` (éditeur) : ~2,38 s pour la coquille de page sous throttling combiné réseau+CPU, sous le seuil de 2,5 s mais avec seulement 120 ms de marge, et cette mesure ne couvre probablement pas le vrai temps d'interactivité (Monaco/react-pdf chargés en dynamique, non capturés). À remesurer avec un signal d'interactivité plus fiable avant de considérer ce seuil acquis. Voir `boucle/constats/2026-07-31-performance.md`.
- Gain en secondes du chantier `/jobs` non mesuré : seul le poids a été revérifié (2 488 883 o → 1 088 377 o). Le chronométrage Slow 4G + CPU x4 qui avait servi à établir le constat initial (~3,9 s) n'a pas été refait, donc on ignore si le seuil de 2 s est désormais tenu. À remesurer avant de clore le sujet performance de `/jobs`.
- Robustesse du scan : une seule offre malformée fait échouer tout le scan en silence (`rankOffer` lève sur `contractLabel` absent, l'exception remonte et rien n'est persisté — un toast, c'est tout). Non reproduit en production, le type `JobOffer` rend le champ obligatoire ; une source tierce malformée suffirait.

## En attente de feu vert

*(spec écrite, implémentation bloquée jusqu'au `!ok` du propriétaire)*

## Idées

*(dépôt libre du propriétaire et de l'Éclaireur, à trier)*

- Alléger `/` (l'éditeur) lui-même : après le retrait de zod des 8 autres routes (plan `2026-08-01-zod-global-allegement-bundle`), `/` reste à ~1,34 Mo, zod compris — légitime (les modales d'import/tailor l'utilisent réellement), mais jamais mesuré contre le seuil de 2,5 s de `MISSION.md`. Piste : lazy-load des modales d'import (`ImportTextModal`/`TailorModal`/`ImportPdfModal`) par `import()` dynamique, sur le modèle du plan `/jobs`. Nécessiterait sa propre spec + mesure.
- Capture d'offre par l'extension navigateur (`extension/`) : écartée explicitement du chantier autofill (`docs/superpowers/specs/2026-08-02-extension-autofill-design.md` §2) parce que l'extracteur magique d'offre existant (`/api/extract-job`, coller une URL) couvre déjà l'essentiel du gain — resterait à chiffrer l'écart marginal (éviter le copier-coller d'URL) une fois l'autofill Greenhouse/Lever validé en usage réel.
- Autofill sur d'autres ATS que Greenhouse/Lever (Workday, iCIMS, SmartRecruiters, Taleo, LinkedIn Easy Apply) : hors périmètre du premier chantier autofill faute de structure DOM publiquement documentée (spec `2026-08-02-extension-autofill-design.md` §5.1/§8) — à rouvrir un ATS à la fois, une fois Greenhouse/Lever mesurés en usage réel.

## Terminé

- Performance `/jobs` (chargement paresseux de `rome-competences.json` et de `zod`/`profileSchema`) : plan `docs/superpowers/plans/2026-08-01-jobs-allegement-bundle.md` bouclé (4/4 tâches) et fusionné dans `main` le 01/08/2026 (PR #10, commit `e824235`). Poids initial de `/jobs` -56 % (2 488 883 o → 1 088 377 o). Cible de 700 Ko non atteinte (zod ~283 Ko chargé app-wide via `docStore.ts` → `lib/resume/schema.ts`, hors périmètre de ce plan) — reste une piste ouverte, voir « État actuel » de `WORK_HISTORY.md`.
- Poids de `zod` (~283 Ko) chargé sur **toutes** les pages via `docStore.ts` → `lib/resume/schema.ts` : plan `docs/superpowers/plans/2026-08-01-zod-global-allegement-bundle.md` bouclé (4/4 tâches), 01/08/2026, non encore fusionné. `DEFAULT_RESUME`/`DEFAULT_LETTER` extraits dans `lib/resume/defaults.ts` (zod-libre), 14 fichiers migrés. Mesuré sur build de prod propre : `/login`, `/help`, `/pack`, `/jobs`, `/history`, `/profil`, `/settings`, `/candidatures` perdent le chunk zod (entre -284 880 o et -286 082 o chacune) ; `/` (éditeur) le garde légitimement, poids inchangé. `/` reste à ~1,34 Mo, jamais mesuré contre le seuil de 2,5 s — piste distincte en § Idées.

## Échoué
