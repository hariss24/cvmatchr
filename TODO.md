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

- [ ] **Nettoyage et stabilisation globale**
  Vérifier l'intégrité de bout en bout de l'application post-migration.

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

*Dernière mise à jour : Juillet 2026 (Post-migration Next.js)*
