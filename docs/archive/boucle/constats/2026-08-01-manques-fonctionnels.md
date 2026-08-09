# Constat — manques fonctionnels au 2026-08-01

**Mesuré par :** inventaire des fonctionnalités actuelles de CVMatchr (lecture de
`PROJECT_INDEX.md`, sections 3 à 10) confronté à une consultation directe des sites
officiels (WebSearch + WebFetch) de 8 produits de référence : Jobscan, Teal, Rezi,
Huntr, Kickresume, Enhancv, Careerflow, Simplify. Chaque affirmation ci-dessous est
sourcée par une URL précise et la date de consultation (2026-08-01). Les points non
vérifiables (mur payant, page non chargée) sont signalés comme tels, jamais présentés
comme des faits.

## Ce que fait CVMatchr aujourd'hui (périmètre de comparaison)

Adaptation CV/lettre par IA, export PDF (4 templates CV + 1 lettre), score ATS local
(+ variante IA), chasseur d'offres multi-sources (France Travail/Adzuna/JSearch) avec
notation automatique sans IA, tracker de candidatures à **statut dérivé** (zéro saisie
manuelle), chat IA dans l'éditeur, import CV depuis PDF/texte, extracteur d'offre
depuis URL, modèles de lettre/email à variables, snapshots manuels. Mono-utilisateur,
100 % local (IndexedDB), pas de compte.

## Mesures — capacités absentes chez ≥ 2 produits de référence

Pour chaque ligne : produits qui l'offrent (avec URL + date), ce que ça apporte à un
candidat, ampleur estimée.

### 1. Extension navigateur avec autofill de candidature — **grosse**

Offert par **7 des 8 produits consultés** :
- Jobscan — https://www.jobscan.co/job-tracker (2026-08-01) : capture d'offre + autofill.
- Jobscan Auto Apply — https://www.jobscan.co/auto-apply (2026-08-01) : dépôt semi-auto sur Lever/Workable/20+ ATS.
- Teal — extension Chrome « Job Search Companion » (citée via recherche référençant tealhq.com, 2026-08-01) : capture offre + contact depuis LinkedIn/Indeed/Glassdoor.
- Rezi — https://www.rezi.ai/rezi-chrome-extension (2026-08-01) : « Apply to jobs in one click across every major ATS — Workday, Greenhouse, Lever… ».
- Huntr « Job Clipper » — https://huntr.co/pricing (2026-08-01) : autofill illimité même en gratuit.
- Enhancv — https://enhancv.com/features/ai-job-application-tracker-chrome-extension/ (2026-08-01) : capture offre depuis LinkedIn/Indeed/Glassdoor/Greenhouse/Workday.
- Careerflow — https://careerflow.ai/job-tracker (2026-08-01) : autofill + sauvegarde en un clic.
- Simplify Copilot — https://simplify.jobs/copilot (2026-08-01) : autofill sur 100+ portails/ATS, génération IA de réponses aux questions ouvertes.

Apport concret : élimine la ressaisie manuelle des formulaires de candidature
(souvent le vrai point de friction, plus que la rédaction du CV) et capture l'offre
sans copier-coller d'URL. C'est la fonctionnalité la plus universellement présente
chez la concurrence et totalement absente de CVMatchr, qui reste un outil « on ouvre
un onglet à part » pour tout scan/extraction d'offre.

### 2. Préparation d'entretien par IA (mock interview) — **grosse**

Offert par **4 produits** :
- Rezi — https://www.rezi.ai/rezi-chrome-extension (2026-08-01) : questions générées à partir de l'offre consultée.
- Kickresume — https://www.kickresume.com/en/online-ai-career-coach/ (2026-08-01) : générateur de questions d'entretien IA + coach conversationnel.
- Enhancv — https://enhancv.com/career-counseling/mock-interview-service/ (2026-08-01) : questions probables selon le poste, méthode STAR, recherche entreprise.
- Careerflow — https://careerflow.ai/mock-interview (2026-08-01, fonctionnalité payante Premium Plus) : questions générées à partir de l'offre/entreprise, feedback sur la clarté des réponses.

Apport concret : CVMatchr s'arrête à l'envoi de la candidature ; aucun produit de
référence ne fait ce choix, l'entretien est vu comme la suite logique du même
parcours. Techniquement proche de l'existant : CVMatchr a déjà l'infra IA
(`editor-chat`, `tailor-resume`) et l'offre déjà extraite en texte — un nouveau flux
de questions/réponses simulées réutiliserait cette base sans nouvelle intégration
externe.

### 3. CRM de networking / suivi de contacts — **moyenne**

Offert par **4 produits** :
- Teal — « Job Search CRM » (citée via recherche référençant tealhq.com/tool/job-search-crm, 2026-08-01) : contacts LinkedIn, objectifs de networking, relances.
- Huntr — https://huntr.co/product/job-tracker (2026-08-01) : suivi recruteurs/décideurs, illimité même en gratuit.
- Careerflow — https://careerflow.ai/networking-tracker (2026-08-01) : base de contacts, import LinkedIn/e-mail/CSV, rappels de relance, recommandations IA de qui contacter.
- Simplify « Networking Copilot » (via help.simplify.jobs, 2026-08-01) : identification de hiring managers, génération de messages d'outreach.

Apport concret : le réseau (recruteur, contact interne) est un canal de candidature à
part entière ; CVMatchr n'a aucune notion de contact, seulement des candidatures.
Tension à trancher par l'Architecte/propriétaire : cela ajoute de la saisie manuelle,
à l'opposé du principe directeur « le suivi ne doit rien coûter à l'utilisateur »
(`PROJECT_INDEX.md` §8 bis) qui gouverne le tracker actuel — donc pas un « oui »
automatique malgré la présence chez 4 concurrents.

### 4. Optimisation de profil LinkedIn — **moyenne**

Offert par **2 produits** avec un outil dédié :
- Jobscan — https://www.jobscan.co/linkedin-optimization (2026-08-01) : scan du profil contre une offre, score, générateur de titre/résumé par IA.
- Careerflow — https://careerflow.ai/linkedin-optimizer (2026-08-01) : score sur 14 sections, checklist, feedback temps réel, rédacteur de posts LinkedIn.
- (Confirmé absent chez Teal par la propre page comparative de Jobscan : https://www.jobscan.co/blog/jobscan-vs-teal/, 2026-08-01 — donc pas un standard universel, mais réel chez 2 acteurs sérieux.)

Apport concret : le CV n'est qu'une candidature parmi d'autres canaux ; LinkedIn est
la vitrine que les recruteurs consultent en premier pour beaucoup de postes. Absent à
100 % de CVMatchr aujourd'hui.

### 5. Import direct du profil LinkedIn pour préremplir le CV — **moyenne**

Offert par **2 produits** :
- Rezi — https://www.rezi.ai/linkedin-resume-builder (2026-08-01) : « Import your LinkedIn profile directly — no manual data entry ».
- Kickresume — page d'accueil https://www.kickresume.com/en/ (2026-08-01) : import LinkedIn natif.

Apport concret : réduit la friction du premier CV (aujourd'hui import PDF/texte
seulement chez CVMatchr). Point de vigilance à vérifier avant tout chantier :
LinkedIn bloque activement le scraping non officiel de profils (conditions
d'utilisation, rate-limiting) — les deux concurrents n'exposent pas comment ils
contournent cette contrainte, donc la faisabilité technique reste à valider avant
d'écrire une spec.

### 6. Identification des compétences manquantes vs une offre (« skill gap ») — **moyenne**

Offert par **2 produits** :
- Careerflow — « Skill Gap Analyzer », cité en page d'accueil https://careerflow.ai (2026-08-01).
- Enhancv — « AI Skills Finder », cité en page d'accueil https://www.enhancv.com/ (2026-08-01).

Apport concret : identifie les compétences que l'offre demande et que le candidat n'a
pas encore, au-delà du score de correspondance. Chevauchement partiel possible avec
le moteur ATS existant (`src/lib/ats/engine.ts`, qui extrait déjà les « exigences »
de l'offre) — à vérifier avant de spécifier un nouveau chantier, il s'agirait
peut-être d'un nouvel angle d'affichage du même calcul plutôt que d'une brique neuve.

### 7. Journal de candidature (réalisations, culture d'entreprise, questions à poser) — **petite**

Offert par **2 produits** :
- Teal — « Job Search Journal », cité via recherche référençant tealhq.com/tool/job-search-journal (2026-08-01).
- Simplify — « Career Journal », cité en page d'accueil https://simplify.jobs (2026-08-01).

Apport concret : capitalise sur les réalisations au fil du temps pour nourrir de
futures candidatures. Valeur plus incertaine pour un candidat isolé (charge de
saisie manuelle récurrente) — à confirmer avant de le prioriser.

### 8. Générateur de lettre de démission — **petite**

Offert par **2 produits** :
- Rezi — https://www.rezi.ai/pricing (2026-08-01) : illimité même en plan gratuit.
- Kickresume — page d'accueil https://www.kickresume.com/en/ (2026-08-01).

Apport concret : faible (usage ponctuel, une fois le candidat déjà embauché ailleurs)
mais coût d'implémentation quasi nul si un chantier lettre est déjà ouvert — mention
pour mémoire, pas prioritaire.

## Ce que fait la concurrence sur ce point (déjà détaillé ligne par ligne ci-dessus)

Au-delà des manques ci-dessus, deux axes où CVMatchr a une fonctionnalité mais où la
concurrence affiche une exécution plus fine (pas un manque au sens strict, donc hors
seuil MISSION.md, mais à surveiller) :
- **Score ATS documenté et granulaire** : Rezi annonce 23 métriques par section
  (https://www.rezi.ai, 2026-08-01), Enhancv annonce 27 vérifications en 7 catégories
  (https://enhancv.com/resources/resume-checker/, 2026-08-01). Le moteur ATS de
  CVMatchr (`src/lib/ats/engine.ts`) n'a pas de méthodologie publiée en dehors du
  dépôt.
- **Volume de templates** : Kickresume annonce 40+ modèles CV et 1 500+ exemples de
  CV réels par métier (https://www.kickresume.com/en/, 2026-08-01), contre 4 templates
  CV chez CVMatchr.

À l'inverse, un point où CVMatchr est en avance et qu'il faut préserver dans tout
arbitrage futur : le tracker de candidatures à **statut dérivé automatiquement**
(`PROJECT_INDEX.md` §8 bis) n'a d'équivalent chez **aucun** des 8 produits consultés —
tous (Teal, Huntr, Kickresume, Careerflow confirmés explicitement) demandent une
saisie manuelle du statut. C'est un différenciateur réel, pas un manque.

## Écart au seuil de MISSION.md

Seuil : « aucune capacité présente chez ≥ 2 des produits de référence et absente ici ».
**8 manques confirmés** au sens strict du seuil (liste ci-dessus, §1 à 8), le premier
(extension navigateur) présent chez 7 des 8 produits consultés — l'écart le plus large
mesuré sur ce domaine depuis le début de la boucle.

## Écart à la concurrence

En retard sur : acquisition de candidature assistée (extension/autofill), préparation
d'entretien, réseau/contacts, présence LinkedIn. À parité ou en avance sur : le
tailoring CV/lettre par IA (fonctionnalité cœur, présente partout mais CVMatchr ne
semble pas en retrait sur l'exécution d'après les pages consultées) et le tracker de
candidatures (CVMatchr est seul à dériver le statut automatiquement — avantage réel,
pas un rattrapage à faire).

## Chantiers proposés

1. **Extension navigateur (capture d'offre + autofill de candidature)** — gain
   attendu : élimine le point de friction le plus universellement traité par la
   concurrence (7/8 produits) ; nécessite une spec dédiée (manifeste V3, permissions,
   quels ATS cibler en premier) — chantier lourd, hors périmètre d'un simple plan.
2. **Préparation d'entretien par IA** — gain attendu : complète le parcours
   candidature→entretien avec l'infra IA déjà en place (`editor-chat`, offre déjà
   extraite en texte) ; le plus proche de l'existant techniquement parmi les 8 manques.
3. **Optimisation de profil LinkedIn (analyse + suggestions)** — gain attendu : couvre
   un canal de candidature aujourd'hui ignoré à 100 %, avec un flux proche de
   `ats-score` (texte en entrée, suggestions IA en sortie) si le profil est collé en
   texte plutôt que scrapé.
4. **CRM de networking / suivi de contacts** — gain attendu : couvre un canal de
   candidature présent chez 4 concurrents, mais **en tension avec le principe
   directeur du tracker actuel** (statut zéro-saisie) — nécessite un arbitrage
   explicite du propriétaire avant toute spec, pas un simple constat technique.
5. **Import direct du profil LinkedIn** — gain attendu : réduit la friction du premier
   CV ; **faisabilité technique à vérifier en premier** (blocage du scraping par
   LinkedIn) avant d'écrire une spec, risque d'être bloquant.
6. **Skill Gap Analyzer** — gain attendu : à chiffrer après vérification du
   chevauchement avec le moteur ATS existant — possible qu'il s'agisse d'un nouvel
   affichage plutôt que d'un nouveau calcul.
7. **Journal de candidature** — gain attendu : faible priorité, valeur incertaine pour
   un candidat isolé, saisie manuelle récurrente à contre-courant du principe
   directeur « zéro coût pour l'utilisateur ».
8. **Générateur de lettre de démission** — gain attendu : négligeable, mention pour
   mémoire seulement.
