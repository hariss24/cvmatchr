# TODO — CVMatchr

Suivi des fonctionnalités de l'application (version Next.js).

> Ce fichier liste ce qu'on **veut faire**. Pour ce qui est **empêché** — limites
> mesurées et non résolues, fonctionnalités bloquées faute de comptes et de base
> serveur — voir `LIMITES.md`. Plusieurs lignes ci-dessous y renvoient : la
> faille du quota et l'extraction LinkedIn/Indeed, notamment, n'attendent pas
> une décision mais une brique d'infrastructure.

---

## ✅ Fait

### IA & Adaptation
- [x] Chat IA intégré dans l'éditeur (propose / preview / apply)
- [x] 3 niveaux d'adaptation IA : Subtil / Modéré / Hyper-adapté
- [x] Restriction du chat IA au périmètre CV/lettre de motivation uniquement
- [x] Règle anti-détection : interdiction de citer l'entreprise cible
- [x] Modèle Gemini intégré via Vercel AI SDK
- [x] **Bug lettre : le nom dans la formule de politesse** — le chat ne recevait aucune définition
      des champs d'une lettre (le CV, si). Corrigé par `LETTER_FIELDS_RULE` : rôle explicite des
      12 champs, `signoff` ne contient jamais de nom. Vérifié : 1 tirage fautif sur 3 avant,
      0 sur 6 après.
- [x] **Tonalité de l'IA** — règle `HUMAN_TONE_RULE` (`web/src/lib/ai/prompts.ts`) injectée dans
      les trois prompts qui rédigent (adaptation CV, chat éditeur, adaptation de la lettre) :
      clichés de candidature, vocabulaire d'IA, participe présent en fin de phrase et
      énumérations par trois bannis. Vérifié contre Gemini : 3 tirages de lettre, 2 à 4 clichés
      avant la règle, 0 après. Inspiré de `.claude/commands/humanize.md`, transposé en français.

### Score ATS & UI
- [x] Panneau ATS avec score, mots-clés présents/absents, sections détectées
- [x] Score ATS piloté par l'IA (analyse des prérequis via Gemini)
- [x] Éditeur de profil avec preview PDF en temps réel (React PDF)
- [x] Historique local des CVs (IndexedDB via Dexie)
- [x] Toast notifications (uiStore)
- [x] Annuler / Rétablir (Ctrl+Z / Ctrl+Shift+Z) — historique global du CV
- [x] Page Aide / FAQ (« Comment ça marche »)
- [x] TopBar minimaliste façon SaaS (3 zones)

### CV & import
- [x] Import « zéro perte » : sections libres, infos personnelles libres
      (permis, portfolio, mobilité…), extraction cloisonnée
- [x] Ordre des sections et en-tête pilotés par le CV — flèches ↑/↓ pour réordonner les sections
- [x] Masquer une section sans l'effacer (l'œil dans le formulaire)
- [x] Les 4 modèles itèrent sur les sections du CV (plus aucune liste en dur)
- [x] **Réordonner les éléments à l'intérieur d'une section** — glisser-déposer (dnd-kit) sur les
      12 listes du formulaire : expériences, formations, projets, bénévolat, sections libres,
      compétences, soft skills, outils, certifications, centres d'intérêt, langues, infos
      complémentaires. Poignée en gouttière gauche, pilotable au clavier ; sur mobile, `touch-action`
      n'est neutralisé que sur la poignée (le reste de la carte laisse défiler la page). Le bloc
      « Ordre des sections », lui, garde ses flèches ↑/↓.

### Lettre & offres
- [x] Pack candidature : page dédiée `/pack`, plus de modal qui redemande l'offre
      (l'offre déjà fournie est réutilisée telle quelle)
- [x] Éditeur à étiquettes (VariableEditor) pour le corps de la lettre
- [x] Profil « Mes informations » — pré-remplissage CV et lettre
- [x] Onglet **Offres** : recherche France Travail, pré-filtre et scoring des annonces

### Architecture Next.js
- [x] Déploiement Vercel (production sur `main` depuis le 13/07)
- [x] Refonte totale de la génération PDF : passage de Playwright/HTML à React PDF (génération pure client)
- [x] Suppression de l'ancien backend Python/Flask

---

## 🔵 Priorité haute — à faire

- [ ] Faille détectée : Le quota de requete peut etre facilement reset si l'utilisateur vide son cache navigateur. Réfléchir à une solution intelligente et efficace.

- [ ] Trouver une solution pour que l'app enregistres automatiquement les offres d'emploi qu'il a trouvé via le chercheur d'offre ou bien ceux que l'utilisateur à enregistré manuellement. Peut etre dans un nouvel onglet "Mes Candidatures"

- [ ] Enlever l'export reactive-resume

- [ ] améliorer l'adaptation IA, actuellement l'IA invente un nouveau titre de poste au lieu de reprendre celui du poste : Content & UX Manager au lieu de Product Information Manager : ![alt text](image-1.png). J'aime pas du tout l'affichage avant/après des CV aussi, faudra proposer une refonte pour qu'ils prennent toute la largeur de l'écran en desk et en mobile un slider droite/gauche. ![alt text](image-2.png). Et le bouton "Voir les modifications est minuscules et horrible en terme de UI. Faudra agrandir le bouton et mettre une flèche vers la droite à coté.

- [ ] améliorer interface chatbot IA

- [ ] **Trouver une solution pour extraire les offres d'emploi via linkedin et indeed, qui bloquent les bots. ** 

- [ ] **Mettre des ancres pour que le document soit plus lisible et naviguable.** Par exemple dans le formulaire dans la section "ordre des sections" ou changer l'ordre des sections en table de matières, pour que chaque section soit accessible avec un ancre. Puis avoir un bouton pour remonter facilement. A brainstormer.

- [x] **Vider les champs entreprise et nom de poste quand on supprime ou crée un nouveau CV**
  Quand l'utilisateur clique sur supprimer ou créer un nouveau CV, vider les champs entreprise
  et nom de poste. *(17/07 — `onNewCv` de la TopBar vide `company`/`role`.)*

- [ ] **Validation de bout en bout sur un vrai CV**
  Le chantier « zéro perte » est terminé côté code, mais reste à éprouver sur un CV réellement
  importé (rubriques inhabituelles, ordre, sections masquées, rendu dans les 4 modèles).

- [x] **Analyse ATS automatique par l'IA via le premier filtre**
  L'analyse ATS doit se faire uniquement par IA, mais en gardant le premier filtre algorithmique utilisé pour le score sans IA. Lorsqu'on clique "analyse ATS", ça doit passer le premier filtre en arrière-plan puis demander directement à l'IA sans étape manuelle. *(17/07 — un seul bouton « Analyse ATS », IA directe, moteur local en secours si l'IA échoue.)*

---

## 🟡 Priorité moyenne — bonnes idées

- [ ] **Mise en page titre + date + lieu mal équilibrée (ex. FORMATIONS)**
  Observé le 14/08/2026 lors de la vérification manuelle du groupement des compétences,
  sur le template Marine, section FORMATIONS : le titre du diplôme, l'établissement et le
  lieu s'écrasent visuellement contre la date quand le sous-titre est long (ex. « Computer
  and Telecommunications Engineer » + « ENSIL-ENSCI (École Nationale Supérieure
  d'Ingénieurs de Limoges) — Limoges »). Composant concerné : `TimelineItem`
  (`web/src/lib/pdfgen/templates/primitives.tsx`) — titre+date sur une ligne (`tlHead`,
  `flexDirection: row`), sous-titre+lieu sur la ligne suivante. À compacter/optimiser ;
  capture d'écran de référence fournie par l'utilisateur (formation ENSIL-ENSCI, PC/PSCI).

- [x] **Raccourcis clavier**
- [ ] **Preview page-break** — ⏸️ *différé : complexe à simuler avec précision dans React PDF avant rendu final.*
- [x] **Déplacement dans l'aperçu PDF (outil "main")**
  Permettre de se déplacer dans l'aperçu du PDF avec un glisser-déposer de la souris, comme l'outil "main" sur Photoshop. Utile surtout avec le zoom et sur mobile, pour éviter d'utiliser les barres de défilement. *(17/07 — pan à la souris via pointer events ; au tactile, défilement natif conservé.)*

---

## 🟢 Idées en réflexion (backlog)

- [x] ~~**Le "White-Fonting" Intelligent (Hack ATS)** : Injection de mots-clés manquants en blanc transparent à la fin du PDF.~~ *(Supprimé post-audit)*
- [x] **Génération du "Pack Candidature" (CV + Lettre + Mail unifiés)** : Génère une lettre de motivation et un mail assortis au CV adapté.
- [x] **Extracteur Magique d'Offre (Scraper URL)** : Scrape et nettoie le bruit d'une URL (LinkedIn, WTTJ) pour l'IA.
- [ ] **🕵️ "Roast my CV" & Prépa Entretien** : Croise le profil avec l'offre pour identifier les faiblesses et préparer des questions d'entretien.
- [ ] **📏 L'Ajustement Magique (Auto-Fit Page)** : Mesure le contenu et ajuste dynamiquement la taille de la police pour éviter un saut de page pour une seule ligne.
- [ ] **Intégration SaaS Multi-utilisateurs** : Préparation de la base pour gérer des comptes, si l'application s'ouvre au public (actuellement mono-utilisateur local/Vercel).

---

*Dernière mise à jour : 17 juillet 2026*
