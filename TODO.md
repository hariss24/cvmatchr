# TODO — html-to-pdf CV Builder

Suivi des fonctionnalités : ce qui est fait, ce qui est prévu, ce qui est en réflexion.

---

## ✅ Fait

### IA & Adaptation
- [x] Chat IA intégré dans l'éditeur (propose / preview / apply)
- [x] 3 niveaux d'adaptation IA : Subtil / Modéré / Hyper-adapté
- [x] Règle anti-détection : interdiction de citer l'entreprise cible
- [x] Règles HTML/CSS strictes sur tous les niveaux (CSS préservé, structure intacte, photo base64 jamais tronquée)
- [x] Restriction du chat IA au périmètre CV/lettre de motivation uniquement
- [x] Possibilité de générer du contenu fictif sur demande explicite
- [x] Modèle Gemini 3.1 Flash Lite (plus rapide)

### Score ATS
- [x] Panneau ATS avec score, mots-clés présents/absents, sections détectées
- [x] Stop words étendus (~100 mots RH génériques filtrés : babyfoot, bienveillance, mutuelle…)
- [x] N-grammes : "machine learning" → `machine-learning`, "react native", "node.js", "ci/cd"…
- [x] Split sur `/` : "React/Node.js" → `react` + `nodejs`
- [x] Détection de sections via balises `<h1>`–`<h6>` (plus de faux positifs sur le texte brut)
- [x] Matching pluriel/singulier (ex: `frameworks` ↔ `framework`)
- [x] Échappement HTML des mots-clés affichés (protection XSS)

### Éditeur & UI
- [x] Éditeur Monaco avec preview HTML en temps réel
- [x] Toggle `@media print` sur la preview (simuler le rendu PDF sans exporter)
- [x] Champ CSS séparé dans l'éditeur (onglets HTML / CSS)
- [x] Diff visuel avant/après adaptation IA
- [x] Historique de versions par CV (Snapshots automatiques/manuels)
- [x] Toast notifications (remplace les statuts discrets)
- [x] Auto-collapse des images base64 au chargement (évite de noyer l'éditeur)

- [x] Strip base64 des payloads envoyés à l'IA (réduit les tokens consommés)
- [x] Indicateur de chargement animé pendant les appels IA
- [x] Timeout 120s sur les appels Gemini avec message d'erreur clair

### Infrastructure
- [x] Déploiement Vercel (serverless)
- [x] Système de quota / rate limiting
- [x] Archive locale + Vercel Blob Storage
- [x] Historique des CVs avec job_desc associée

### Migration JSON (source de vérité)
- [x] Stockage du JSON + templateId dans IndexedDB à côté du HTML
- [x] Capture du JSON à la génération du PDF
- [x] Détection auto du mode au chargement (Formulaire si JSON, Expert si HTML seul)
- [x] Avertissement « éjection » avant de passer un CV-formulaire en mode Expert
- [x] Export/import qui conserve le JSON
- [x] **Brouillon : sauvegarde du JSON du formulaire à chaque modif + reconstruction au rechargement** — avant, le JSON n'était persisté qu'à l'export PDF ; un F5 sans export rouvrait le CV en mode Expert et perdait le formulaire (corrigé dans `app.js`, brouillon localStorage).

---

## 🔵 Priorité haute — à faire

- [x] **Score ATS piloté par l'IA** (optionnel, côté serveur)
  L'IA extrait les vrais prérequis du poste (hard skills, nice-to-have) et retourne un JSON `{ score, matched_skills, missing_hard_skills, missing_nice_to_have }`. Endpoint `POST /api/ats-score` (`ai_engine.score_ats`), bouton « 🤖 Analyser avec l'IA » dans le panneau ATS (le score lexical gratuit reste affiché par défaut).

- [x] **Compteur de tokens estimé** avant envoi
  Les CVs avec photo base64 sont énormes. Afficher "≈ 12 000 tokens" aide l'utilisateur à comprendre sa consommation.

- [x] **Tirets-bas dans les noms de fichier qui remplace les espaces et les apostrophes**
  Par exemple: "CV de John Doe" -> "CV_de_John_Doe.pdf" dans les champs entreprise ou poste

---

## 🟡 Priorité moyenne — bonnes idées

- [ ] **Multi-modèles de mise en page (template)**
  Aujourd'hui `ResumeForm.getTemplateId()` renvoie toujours `'sobre'` en dur (`resume-form.js`). Le champ `templateId` est déjà stocké partout (IndexedDB, export/import) mais inutile tant qu'il n'existe qu'un seul modèle. À activer le jour où on ajoute d'autres mises en page (Moderne / Classique / Minimal).

- [ ] **Découper `static/js/app.js` (2378 lignes)**
  Fichier devenu un mastodonte qui mélange éditeur Monaco, chat IA, ATS, IndexedDB, tailoring… Chaque modif est plus risquée. Extraire des modules (ex: `idb.js`, `tailor.js`, `ats.js`). Refacto à faire prudemment, avec tests à l'appui — pas en aveugle.

- [x] **Raccourcis clavier**
  `Ctrl+Enter` = convertir PDF (déjà présent), `Ctrl+S` = sauvegarder brouillon (snapshot manuel), `Ctrl+Shift+A` = lancer l'analyse ATS sur le CV + l'offre courants.

- [ ] **Modèle IA upgradeable**
  Permettre de choisir le modèle Gemini (Flash Lite / Flash / Pro) selon le besoin. Pro pour l'adaptation hyper, Lite pour le chat rapide.

- [ ] **Preview page-break**
  Afficher des lignes pointillées sur la preview HTML à chaque saut de page A4 estimé.

---

## 🟢 Idées en réflexion (backlog)

- [ ] Export `.docx` — certains recruteurs exigent encore Word
- [ ] Présets de thème CSS (Moderne / Classique / Minimal) en un clic
- [ ] Drag & drop d'un fichier `.html` ou `.md` dans l'éditeur
- [ ] Sidebar "Récents" dans l'éditeur (5 derniers CVs)
- [ ] Import depuis LinkedIn (très complexe, dépend de l'API)

---

## 💡 Nouvelles features "Killer" (À évaluer)

- [ ] **📏 L'Ajustement Magique (Auto-Fit Page)**
  *Problème :* Le texte déborde légèrement sur une deuxième page, obligeant l'utilisateur à ajuster manuellement les marges et la police pendant de longues minutes.
  *Solution :* Un algorithme qui calcule la hauteur réelle du contenu et ajuste dynamiquement des variables CSS globales (ex: `--base-font-size`) pour que le CV tienne parfaitement et automatiquement sur une seule page A4.

- [ ] **🧲 Le "White-Fonting" Intelligent (Hack ATS)**
  *Problème :* L'ATS signale des mots-clés manquants, mais l'utilisateur ne veut pas les forcer artificiellement dans le texte visible au risque d'alerter le recruteur.
  *Solution :* Une option "Booster ATS invisible" qui injecte automatiquement les mots-clés manquants en police 1px, blanche sur fond blanc, à la fin du document lors de l'export PDF. L'ATS les lit, l'humain ne voit rien.

- [x] **🎯 Génération du "Pack Candidature" (CV + Lettre + Mail unifiés)**
  *Problème :* Le CV est beau, mais la lettre de motivation envoyée en parallèle est souvent un vieux document Word basique, cassant la cohérence visuelle.
  *Solution :* Bouton « Créer le Pack candidature » dans le panneau d'adaptation. Génère via `POST /api/generate-pack` (`ai_engine.generate_pack`) une lettre de motivation reprenant la police/couleur d'accent/header du CV adapté + un brouillon d'email d'accroche. Modale d'aperçu : prévisualisation de la lettre, email copiable, et chargement de la lettre dans l'éditeur (type « Lettre »).

- [ ] **🕵️ "Roast my CV" & Prépa Entretien**
  *Problème :* Le candidat a passé le filtre RH grâce au CV, mais ne sait pas quelles questions pièges le recruteur prépare en voyant son profil.
  *Solution :* Un onglet "Prépa Entretien" où l'IA croise le profil avec l'offre pour identifier les faiblesses perçues et générer des questions d'entretien probables avec des suggestions de défense.

- [x] **🌐 Extracteur Magique d'Offre (Scraper URL)**
  *Problème :* Le copier-coller d'offres LinkedIn ou Welcome to the Jungle ramène beaucoup de texte parasite (menus, boutons) qui perturbe l'IA.
  *Solution :* Un champ pour coller directement l'URL de l'offre. L'outil scrape la page web, nettoie le bruit, et extrait uniquement les missions et prérequis structurés.

---

## ❌ Décidé de ne pas faire (pour l'instant)

- Collaboration temps réel — trop de complexité, usage solo
- Galerie de templates — scope trop large
- Linter CSS print — trop technique pour le public cible

---

*Dernière mise à jour : 2026-05-29*
