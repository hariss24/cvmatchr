# Constat — manques fonctionnels (5e passage) au 2026-08-08

**Mesuré par :** `grep` exhaustif sur `web/src/`, `web/package.json` et `extension/`
pour vérifier l'absence côté code, confronté à une consultation directe (WebSearch +
WebFetch) des sites/aides officiels des produits de référence. Dates de consultation :
2026-08-08. Ce constat complète ceux du 2026-08-01, 2026-08-03, 2026-08-05 et 2026-08-07
sans les répéter — vérifié contre `IDEES.md` (classement + section « Écartées ») avant
d'écrire : les deux manques ci-dessous sont **nouveaux**, jamais mentionnés dans
`IDEES.md`.

## Mesures

Vérification côté code que chaque capacité est bien absente de CVMatchr :

- **Export au format Word (.docx)** : `grep -rn "docx" web/src --include=*.ts
  --include=*.tsx` → **zéro occurrence**. `grep -n "docx\|mammoth\|officegen"
  web/package.json` → **zéro occurrence**, aucune dépendance de génération Word.
  `web/src/lib/pdfgen/` (le seul moteur d'export, `PROJECT_INDEX.md` §6) ne contient
  que `generatePdf.tsx`, `ResumeDocument.tsx`, `LetterDocument.tsx` et les gabarits
  `templates/*.tsx` — un seul format de sortie existe dans tout le produit, le PDF via
  `@react-pdf/renderer`.
- **Génération IA de réponses aux questions ouvertes du formulaire de candidature**
  (l'extension autofill) : `grep -niE "question|open.?ended|réponse"
  extension/content-autofill.js extension/lib/fieldMatch.js` → **zéro occurrence**.
  Le document de conception de l'autofill lui-même exclut explicitement ce terrain,
  et pas seulement la génération IA : « Remplissage des questions personnalisées
  Greenhouse (`question_[ID]`, varient par offre) et des questions Lever configurables
  par l'employeur — non génériques par nature, hors du mécanisme de reconnaissance de
  §5.2 » (`docs/superpowers/specs/2026-08-02-extension-autofill-design.md` §8, « Hors
  périmètre »). L'extension actuelle ne touche donc même pas ces champs pour y coller
  une réponse déjà écrite, a fortiori pas pour en générer une par IA.

## Ce que fait la concurrence sur ce point

### 1. Export au format Word (.docx), en plus du PDF

- **Rezi** — https://www.rezi.ai/pricing (consulté 2026-08-08) : « Microsoft Word
  .DOCX File » listé comme inclus sur les trois offres (Free, Pro, Enterprise) — export
  éditable en plus du PDF.
- **Kickresume** — https://www.kickresume.com/en/help-center/general/ (consulté
  2026-08-08) : « you can also export your documents to MS Word » (FAQ « How can I
  download my resume? »), avec une réserve documentée : « .doc documents don't support
  our graphic elements […] it will only be plain text » — export réel mais dégradé sur
  les gabarits visuels.
- **Huntr** — https://huntr.co/product-updates/font-customizations-custom-resume-sections-docx-export
  (consulté 2026-08-08, mise à jour datée du 2 décembre 2025, toujours documentée
  aujourd'hui) : « You can now export your resume as a .docx file directly from the
  download menu » — présenté comme un format distinct du PDF, pensé pour l'édition
  finale ou une demande explicite d'un recruteur.
- Jobscan, Teal, Enhancv, Careerflow, Simplify : non vérifiés sur ce point précis faute
  de temps dans ce créneau (page Teal inaccessible en direct, HTTP 403 sur
  `tealhq.com/tool/resume-builder` au moment du test) ; à confirmer ou infirmer par un
  futur passage.

### 2. Génération IA de réponses aux questions ouvertes du formulaire de candidature

- **Simplify Copilot** — https://simplify.jobs/copilot (consulté 2026-08-08) : « Craft
  personalized responses with AI. Our AI analyzes the job description you're applying
  to and helps you write tailored answers to questions like 'why are you a good fit
  for this role?' in 1-click » — distinct de l'autofill des champs standards
  (nom/email/expérience).
- **Teal** — https://www.tealhq.com/tools/autofill-job-applications (contenu obtenu par
  recherche indexée le 2026-08-08, la page a refusé l'accès direct — HTTP 403 sur
  WebFetch) : « Open-Ended Question Responses: The tool uses AI to analyze job
  descriptions and your career history to create tailored responses for application
  questions […] with you always having the option to review and modify your answers
  before hitting submit ».
- **Careerflow** — page consultée (`careerflow.ai/autofill`, 2026-08-08) : ne confirme
  que le remplissage des champs structurés (« The extension detects form fields
  automatically », « Review anything the tool flags for manual input ») — pas de
  génération IA de réponse aux questions ouvertes trouvée sur cette page précise,
  malgré une mention en résumé de recherche à vérifier séparément. Retiré du décompte
  par prudence : seuls Simplify et Teal sont confirmés par une citation directe de leur
  propre page.
- Jobscan, Rezi, Huntr, Kickresume, Enhancv : non vérifiés sur ce point précis (leur
  produit n'a pas d'extension d'autofill de candidature aussi développée, ou le point
  n'a pas été cherché faute de temps dans ce créneau).

## Écart au seuil de MISSION.md

Seuil : « aucune capacité présente chez ≥ 2 des produits de référence et absente ici ».
Les deux manques franchissent le seuil au sens strict : export Word (3/8 confirmés —
Rezi, Kickresume, Huntr), réponses IA aux questions ouvertes (2/8 confirmés — Simplify,
Teal).

## Écart à la concurrence

En retard sur les deux points : CVMatchr n'a qu'un seul format de sortie (PDF) quand
trois concurrents vérifiés en offrent un second généralement demandé par les
recruteurs pour des retouches finales ; et l'extension autofill de CVMatchr, déjà
construite pour Greenhouse/Lever, s'arrête aux champs structurés là où deux
concurrents équipés d'une extension comparable vont jusqu'à générer une réponse aux
questions ouvertes propres à chaque offre — précisément le type de champ que le
document de conception de l'autofill actuel a sciemment laissé de côté.

## Chantiers proposés

1. **Ajouter un export .docx du CV et de la lettre, en plus du PDF existant** — gain
   attendu : couvre le cas fréquent d'un recruteur qui exige un fichier Word éditable,
   ou d'un candidat qui veut retoucher son document dans un traitement de texte
   classique après l'avoir généré ici. Ampleur non chiffrée par ce constat : suppose
   soit une bibliothèque de génération `.docx` (ex. `docx` sur npm — ajout d'une
   dépendance npm, sujet sensible nommé par `MISSION.md`, feu vert requis), soit un
   second rendu à écrire pour chacun des 4 gabarits CV existants + celui de la lettre,
   à l'image de ce que fait Kickresume (rendu dégradé, sans les éléments graphiques).
2. **Générer par IA une réponse aux questions ouvertes du formulaire de candidature,
   dans l'extension autofill** — gain attendu : prolonge un chantier déjà construit et
   validé (Greenhouse/Lever) vers le terrain explicitement exclu à l'origine (§8 de sa
   propre spec), en réutilisant l'infra IA déjà en place (offre déjà extraite en texte,
   CV déjà structuré) plutôt qu'une nouvelle intégration externe. Ampleur non chiffrée
   ici : suppose de détecter ces champs dans le DOM (aujourd'hui non reconnus du tout,
   `content-autofill.js`) avant même de leur proposer un contenu.
