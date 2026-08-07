# Constat — manques fonctionnels au 2026-08-07

**Mesuré par :** lecture directe du code (`web/src/components/modals/AtsPanel.tsx`,
`web/src/components/modals/TailorModal.tsx`, `web/src/lib/ats/engine.ts`,
`web/src/lib/ats/resumeText.ts`, `web/src/lib/jobs/boardsFr.ts`,
`web/src/lib/jobs/data/boards-fr.json`) + `grep` exhaustif sur `web/src` + recherche
web sur les pages produit/aide officielles des concurrents. Dates de consultation :
2026-08-07.

## Mesures

- `grep -n "highlight\|surlign\|mark\b" web/src/components/modals/AtsPanel.tsx
  web/src/lib/ats/engine.ts` → **zéro occurrence**. Lecture complète des deux fichiers
  (208 + 418 lignes) : le rapport ATS n'affiche les exigences couvertes/manquantes que
  sous forme de pastilles isolées (composant `Pills`, `AtsPanel.tsx:47-58` et
  `:184-192`) — jamais le terme montré *en contexte*, ni dans le texte du CV ni dans
  celui de l'offre.
- L'offre est saisie et affichée dans une `<textarea value={jobDesc}>` brute
  (`TailorModal.tsx:365`) — aucun rendu qui permettrait de surligner un passage sans
  changer ce composant pour une vue en lecture avec balisage.
- Le CV n'est jamais affiché comme un bloc de texte continu à l'utilisateur : il est
  saisi dans des champs de formulaire structurés (`FormEditor.tsx`) et prévisualisé en
  PDF (`PdfPreview.tsx`, rendu par `<canvas>`, pas du texte HTML sélectionnable) — un
  surlignage côté CV demanderait un traitement différent du côté offre, pas la même
  brique.
- `web/src/lib/jobs/data/boards-fr.json` recense l'ATS de chaque entreprise du
  « marché caché » — vérifié en tête de fichier : `10xteam` → `ashby`, `360learning` →
  `lever`, `365TALENTS` → `smartrecruiters` (14 651 entreprises ≥ 200 salariés + 49 438
  PME, `PROJECT_INDEX.md` §8).
- `grep -rl "boardsFr\|boards-fr.json" web/src --include=*.ts --include=*.tsx` (hors
  fichiers de test) ne renvoie que **deux fichiers** : `app/api/jobs/search/route.ts`
  et `app/api/jobs/ats/route.ts` — tous deux dans le pipeline de recherche d'offres.
  Aucun composant du parcours CV/lettre (`AtsPanel.tsx`, `TailorModal.tsx`,
  `FormEditor.tsx`) ne lit cette donnée : elle existe, câblée jusqu'au bout pour la
  recherche, jamais montrée au candidat quand il prépare sa candidature à cette même
  entreprise.

## Ce que fait la concurrence sur ce point

- **Jobscan** (consulté le 07/08/2026, jobscan.co/targeted-resume et
  jobscan.co/jobscan-tutorial) : la section « Highlighted Skills » permet de choisir
  un mot-clé et d'en voir **chaque occurrence surlignée à la fois dans le CV et dans
  l'offre**, en cliquant sur le terme pour voir son contexte des deux côtés. Jobscan
  détecte aussi **l'ATS précis utilisé par l'entreprise qui a publié l'offre**
  (Taleo, Lever, iCIMS, Greenhouse…) et adapte ses recommandations de formatage à ses
  règles de parsing propres — cité explicitement : « Jobscan AI detects the applicant
  tracking system on every job posting and tailors recommendations to its specific
  parsing rules and ranking weights ».
- **Teal** (consulté le 07/08/2026, tealhq.com/tool/job-description-keyword-finder et
  tealhq.com) : le « Keyword Finder » scanne l'offre et **surligne** les compétences et
  formulations qui reviennent le plus, directement dans le texte de l'offre bookmarkée.
  Pas de détection d'ATS par entreprise trouvée dans les pages consultées — sur ce
  second point, seul Jobscan est confirmé à ce jour.
- **Kickresume** (consulté le 07/08/2026, kickresume.com/en/ats-resume-checker) :
  simule un scan ATS générique (plus de 20 vérifications de mise en forme/police/
  structure), mais rien qui identifie l'ATS *spécifique* de l'entreprise ciblée ni qui
  surligne les mots-clés en contexte dans les deux textes — fonctionnalité différente
  de celles de Jobscan/Teal, non comparable directement.
- Enhancv, Careerflow, Rezi, Huntr, Simplify : non vérifiés sur ces deux points précis
  faute de temps dans ce créneau ; à confirmer ou infirmer par un futur passage.

## Écart au seuil de MISSION.md

- **Surlignage des mots-clés en contexte** : présent chez 2 des 8 produits de
  référence vérifiés (Jobscan, Teal), absent à 100 % chez CVMatchr (mesuré ci-dessus)
  → manque au sens strict du seuil « Couverture fonctionnelle » de `MISSION.md`.
- **ATS de l'entreprise affiché + conseils adaptés** : confirmé chez un seul produit
  à ce stade (Jobscan) — **sous le seuil formel des deux produits** de la définition
  de `MISSION.md`. Signalé quand même : la donnée qui l'alimenterait
  (`boards-fr.json`) est déjà construite et à jour (rafraîchie chaque lundi,
  `PROJECT_INDEX.md` §8), donc son coût de réalisation serait très inhabituel pour ce
  qu'elle apporterait — à l'Arbitre de juger si ce déséquilibre coût/apport compense
  la preuve de marché plus faible.

## Écart à la concurrence

En retard sur les deux points : zéro surlignage en contexte, zéro exploitation
candidat-facing d'une donnée d'ATS pourtant déjà en base.

## Chantiers proposés

1. **Surligner les mots-clés en contexte, dans l'offre et dans le CV** (pas
   seulement une liste de pastilles) — gain attendu : le candidat voit *où* et
   *comment* un terme apparaît (ou n'apparaît pas), au lieu d'une liste plate à
   interpréter seul. Ampleur asymétrique : côté offre, la `<textarea>` actuelle
   devrait passer en vue de lecture avec balisage — chantier moyen ; côté CV, aucun
   texte continu n'est aujourd'hui affiché à l'utilisateur (formulaire structuré +
   aperçu PDF en `<canvas>`), un surlignage y demanderait une approche différente
   (par exemple indiquer le champ concerné plutôt que surligner un texte) — chantier
   plus incertain, non chiffré ici.
2. **Afficher l'ATS détecté de l'entreprise ciblée dans le panneau ATS, avec un
   conseil de mise en forme adapté** — gain attendu : réutilise une donnée déjà
   construite et entretenue (`boards-fr.json`) pour un coût de câblage a priori
   faible (une recherche par nom d'entreprise + un texte d'aide par ATS), sans
   toucher au moteur de score. Confirmé chez un seul produit (Jobscan) à ce stade,
   à signaler comme tel.
