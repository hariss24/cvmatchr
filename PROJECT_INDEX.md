# 🗂️ Index du Projet : cv-tailor (Audit & Architecture)

Ce fichier répertorie l'architecture complète, l'historique des modifications majeures et la cartographie des fichiers du projet. Il permet aux développeurs et aux IA de comprendre instantanément comment le projet est structuré et comment les différentes briques interagissent.

---

## 🏗️ 1. Architecture Globale & Évolution

Le projet a grandement évolué depuis sa création. Voici l'état actuel de l'architecture :

- **Frontend (Web UI)** : Interface native (HTML/JS/CSS) qui sépare désormais la logique en plusieurs modules (`app.js`, `resume-form.js`, `history.js`). Il intègre **Monaco Editor** pour l'édition de code (Mode Expert) et un générateur de formulaire dynamique pour l'édition JSON (Mode Formulaire).
- **Backend (API Flask)** : Serveur local propulsé par Flask (`app.py`), qui gère les endpoints IA, l'interface Web et la génération PDF.
- **Génération PDF (`pdf_engine.py`)** : Utilise **Playwright** (Chromium) par défaut pour un rendu pixel-perfect. Contient un fallback sur **WeasyPrint** pour les environnements serverless.
- **Intelligence Artificielle (`ai_engine.py`)** : Supporte **Gemini** (streaming, parsing JSON, lecture d'images) et **Anthropic (Claude)**. Gère l'ATS, la rédaction de lettres, et le "Tailoring" (adaptation de CV).
- **Stockage & Historique** :
  - *Frontend* : Utilise **IndexedDB** pour stocker les brouillons locaux (Snapshots) et l'historique utilisateur.
  - *Backend* : Utilise **SQLite** (`history.db`) via `archive.py`, avec un support optionnel pour **MongoDB**. (Le backend ne sauvegarde l'historique que pour le serveur MCP).
- **Intégration Agentique** : Serveur **FastMCP** (`mcp_server.py`) pour interagir localement avec Claude Desktop.

> **🛑 Changement de Paradigme Actuel (Migration JSON)** : Le projet est en cours de migration. Historiquement, le code HTML était la source de vérité. Le projet bascule vers une architecture où un objet **JSON** (généré par `resume-form.js`) est la source de vérité, et le HTML n'est généré qu'à la volée pour l'export.

---

## 📂 2. Cartographie des Fichiers (Audit complet)

### 🌐 Backend & Points d'Entrée
- **`app.py`** : Cœur de l'application Flask. Gère les routes (`/`, `/convert`, `/api/*`). Lance également l'UI de contrôle Tkinter en mode local. *(Note : L'ancien routage Vercel `api/index.py` a été supprimé)*.
- **`mcp_server.py`** : Serveur MCP autonome exposant la conversion PDF et la lecture d'archive à Claude Desktop.

### 🧠 Moteurs de Traitement (Engines)
- **`pdf_engine.py`** : Point d'interaction avec Playwright & WeasyPrint. Expose `html_to_pdf_bytes()`. Protégé contre les injections (whitelists de formats/marges).
- **`ai_engine.py`** : Moteur IA massif. Contient :
  - `stream_completion` : Streaming brut.
  - `complete_chat` : Chat IA (Modification de code).
  - `tailor_resume` : Adaptation JSON -> JSON.
  - `score_ats` : Calcul de matching avec une offre.
  - `generate_pack` : Génération de lettre + email.
  - `pdf_to_resume` : OCR et extraction de PDF vers JSON structuré (Vision).
- **`archive.py`** : Gère SQLite (`history.db`) et MongoDB.
- **`quota.py`** : Limiteur de requêtes journalier (en mémoire) pour l'API IA.

### 🎨 Frontend (`static/` & `templates/`)
*(La logique UI a été extraite de `app.py` vers des fichiers dédiés).*
- **`templates/`** : `index.html` (L'éditeur), `history.html` (Grille des archives), `login.html`.
- **`static/js/app.js`** : Le mastodonte. Gère Monaco Editor, le Splitter, l'envoi vers `/convert`, le Chat IA, le bouton Tailor, l'affichage ATS, et IndexedDB (Snapshots).
- **`static/js/resume-form.js`** : Gère le "Mode Formulaire". Construit le JSON interactif.
- **`static/js/history.js`** : Lit IndexedDB pour repeupler la page d'historique.
- **`static/css/index.css`** : Styles globaux.

### 🧪 Tests & Configuration
- **`tests/`** : Suite de tests Pytest (`test_ai_engine.py`, `test_pdf_engine.py`, etc.).
- **`requirements.txt`** : Dépendances Python.
- **`Dockerfile` / `render.yaml`** : Configuration pour le déploiement.

---

## 🚨 3. Règles d'Or et Angles Morts (Blind Spots)

Pour tout développeur ou IA intervenant sur le code, voici les pièges à éviter :

1. **Ne pas casser la synchro JSON/HTML** : 
   - L'utilisateur en "Mode Formulaire" a un JSON.
   - S'il utilise le Chat IA (`/api/editor-chat`), l'IA ne doit pas renvoyer du HTML, sinon on ne peut pas mettre à jour le formulaire.
2. **Le Frontend est le Moteur de Rendu HTML** : 
   - Lors de la conversion en PDF (`/convert`), c'est le frontend JS qui génère la chaîne HTML finale à partir du JSON et l'envoie au serveur. Ne codez jamais de templates Jinja pour les CV côté backend.
3. **Photos en Base64** : 
   - Les images doivent toujours être compressées via un `<canvas>` JS avant d'être sauvegardées.
   - Avant d'envoyer le CV JSON à l'IA (`tailor_resume`, `score_ats`), il faut "stripper" le champ photoBase64 pour économiser les tokens, puis le remettre à la réception.
4. **Historique local vs Serveur** :
   - `/convert` ne sauvegarde PLUS le CV sur le serveur. Il renvoie le fichier et c'est `app.js` qui le stocke dans IndexedDB.

---

*Fin de l'index. Pour un résumé rapide des commandes, consultez le `README.md`.*
