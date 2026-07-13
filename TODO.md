# TODO — CV Tailor

Suivi des fonctionnalités de l'application (version Next.js).

---

## ✅ Fait

### IA & Adaptation
- [x] Chat IA intégré dans l'éditeur (propose / preview / apply)
- [x] 3 niveaux d'adaptation IA : Subtil / Modéré / Hyper-adapté
- [x] Restriction du chat IA au périmètre CV/lettre de motivation uniquement
- [x] Règle anti-détection : interdiction de citer l'entreprise cible
- [x] Modèle Gemini intégré via Vercel AI SDK

### Score ATS & UI
- [x] Panneau ATS avec score, mots-clés présents/absents, sections détectées
- [x] Score ATS piloté par l'IA (analyse des prérequis via Gemini)
- [x] Éditeur de profil avec preview PDF en temps réel (React PDF)
- [x] Historique local des CVs (IndexedDB via Dexie)
- [x] Toast notifications (uiStore)

### Architecture Next.js
- [x] Déploiement Vercel
- [x] Refonte totale de la génération PDF : passage de Playwright/HTML à React PDF (génération pure client)
- [x] Suppression de l'ancien backend Python/Flask

---

## 🔵 Priorité haute — à faire

- [ ] **Déplacement haut/bas des champs formulaire du CV**
  Mettre en place des flèches haut/bas pour déplacer les champs du formulaire du CV de haut en bas et vice versa comprenant les sections, expériences, formations, compétences et centres d'intérêt etc..

  - [ ] **Vider les champs entreprises et nom de poste quand on clique sur supprimer ou créer un nouveau CV**
  Quand l'utilisateur clique sur supprimer ou créer un nouveau CV, vider les champs entreprises et nom de poste.

  - [ ] **Bug lettre de motivation IA**
  Y'a un bug quand je génere une lettre de motivation via le chat IA à partir d'une description de poste. L'IA met "Hariss HAFEJI" dans la case "formule de politesse" et il met "Prénom Nom" dans la case "signature".

  - [x] **Tonalité de l'IA**
  Faire en sorte que l'IA génere du texte moins robotique et plus authentique et humain pour les CV et Lettres de motivation. Eviter les tournures de phrases ou mots qui ne sont pas naturels. Voir le skill : "C:\Users\tahet\projects\cv-tailor\.claude\commands\humanize.md" pour s'inspirer
  → Fait : règle `HUMAN_TONE_RULE` dans `web/src/lib/ai/prompts.ts`, injectée dans les trois
  prompts qui rédigent (adaptation CV, chat éditeur, adaptation de la lettre). Vérifié en réel
  contre Gemini : 3 tirages de lettre, 2 à 4 clichés avant la règle, 0 après.

- [x] **Annuler / Rétablir (Ctrl+Z / Ctrl+Shift+Z)**
  Permettre de revenir en arrière (Ctrl+Z) et de rétablir (Ctrl+Shift+Z) les
  modifications du CV, pour récupérer après une fausse manipulation ou une
  adaptation IA ratée.

- [ ] **Supprimer la modal de re-saisie de l'offre pour le Pack candidature**
  Le clic sur « Créer le pack candidature » ouvre une modal qui redemande la
  description du poste — la supprimer et réutiliser directement l'offre déjà
  fournie.

---

## 🟡 Priorité moyenne — bonnes idées

- [x] **Raccourcis clavier**
- [ ] **Preview page-break** — ⏸️ *différé : complexe à simuler avec précision dans React PDF avant rendu final.*

---

## 🟢 Idées en réflexion (backlog)

- [x] **Le "White-Fonting" Intelligent (Hack ATS)** : Injection de mots-clés manquants en blanc transparent à la fin du PDF.
- [x] **Génération du "Pack Candidature" (CV + Lettre + Mail unifiés)** : Génère une lettre de motivation et un mail assortis au CV adapté.
- [x] **Extracteur Magique d'Offre (Scraper URL)** : Scrape et nettoie le bruit d'une URL (LinkedIn, WTTJ) pour l'IA.
- [ ] **🕵️ "Roast my CV" & Prépa Entretien** : Croise le profil avec l'offre pour identifier les faiblesses et préparer des questions d'entretien.
- [ ] **📏 L'Ajustement Magique (Auto-Fit Page)** : Mesure le contenu et ajuste dynamiquement la taille de la police pour éviter un saut de page pour une seule ligne.
- [ ] **Intégration SaaS Multi-utilisateurs** : Préparation de la base pour gérer des comptes, si l'application s'ouvre au public (actuellement mono-utilisateur local/Vercel).

---

*Dernière mise à jour : 7 juillet 2026*
