# 🤖 CLAUDE.md - Directives pour Claude (et autres IA)

Ce fichier définit les règles de base pour intervenir sur le dépôt `cv-tailor`.

> **🗺️ NAVIGATION RAPIDE : commence par `FILE_MAP.md`**
> C'est la carte du dépôt : rôle de chaque fichier + table « quel fichier pour quelle tâche ». Lis-la AVANT d'explorer le code — elle évite de balayer des fichiers inutiles. La carte des routes API est dans la docstring de `app.py`.

> **⚠️ IMPORTANT : TOUT EST DOCUMENTÉ DANS `PROJECT_INDEX.md`**  
> Pour comprendre l'architecture complète, la liste des fichiers, la migration HTML -> JSON en cours, et les **"Angles Morts" critiques** à ne pas casser, tu dois **impérativement lire le fichier `PROJECT_INDEX.md`**. Ne commence aucune modification sans avoir pris connaissance des règles métier (notamment la gestion des photos Base64 et du Chat IA) décrites dans ce fichier.

---

## 🧠 Guidelines Karpathy (obligatoires pour tout travail de code)

1. **Think Before Coding** — pose tes hypothèses explicitement. Si c'est ambigu, demande avant d'agir.
2. **Simplicity First** — minimum de code. Aucune abstraction, flexibilité ou gestion d'erreur non demandée.
3. **Surgical Changes** — ne touche que ce qui est nécessaire. Ne "nettoie" pas le code adjacent.
4. **Goal-Driven Execution** — définis des critères de succès vérifiables avant d'implémenter (ex : `ruff check .` + `pytest` verts).

## 🛠️ Règles de Développement (Mise à jour)

1. **Avant de coder, vérifie l'architecture** : L'interface web (`static/js/app.js`, `resume-form.js`) et le backend (`app.py`) ont des rôles très stricts. Le rendu HTML se fait côté frontend, le backend ne fait que convertir en PDF.
2. **Ne casse pas la synchro JSON** : Le projet a migré vers une source de vérité JSON. Toute nouvelle fonctionnalité IA doit prioriser les endpoints JSON (ex: `/api/tailor-resume`) plutôt que les anciens endpoints HTML (`/api/tailor`).
3. **Préserver l'intégrité des données JSON** : Lors des adaptations de CV via l'IA, assure-toi de **ne jamais perdre des champs** existants (ex: `interests`, `languages`, `certifications`). Le flux de données doit préserver l'intégralité du modèle de données (Schema JSON).
4. **Fichiers lourds (Images Base64)** : Il est CRITIQUE de toujours **stripper la clé `photoBase64`** des objets JSON avant de les envoyer aux moteurs d'IA (Gemini/Anthropic) pour éviter d'exploser les limites de tokens, puis de les restaurer à la réception.
5. **Esthétique et UI (Tailwind v4)** : Le projet intègre progressivement **Tailwind CSS v4** avec un thème *Neumorphique* et supporte le mode Light/Dark via des variables CSS (`--bg`, `--text`, etc.). Les couleurs ne doivent **jamais être hardcodées**.
6. **Accessibilité & UX** : Assure un focus visible, prévois des boutons de fermeture pour les modales, utilise des scrollbars affinées (`var(--faint)`), et garantis que les toolbars sont responsives (wrap).
7. **Dialogues UI personnalisés** : N'utilise **JAMAIS** les fonctions natives `alert()`, `confirm()` ou `prompt()`. Utilise impérativement le module `ui-dialogs.js` qui fournit `uiConfirm()`, `uiPrompt()` et `uiAlert()` basées sur des promesses.
8. **SDKs IA & Modèles** : Le projet utilise le NOUVEAU SDK officiel `google-genai` (et non l'ancien `google-generativeai`). Le modèle Gemini par défaut est `gemini-3.1-flash-lite`. Les appels Anthropic utilisent quant à eux le SDK `anthropic`.

## 🚀 Commandes Essentielles

**Lancement du Serveur Web (Local) :**
```bash
python app.py
```

**Build Tailwind CSS (Local) :**
```bash
npm run build:css
```

**Lancement du Serveur FastMCP (Intégration Claude Desktop) :**
```bash
python mcp_server.py
```

**Lancement de la Suite de Tests :**
```bash
pytest
```

**Vérification syntaxique rapide :**
```bash
python -m py_compile app.py archive.py ai_engine.py pdf_engine.py scraper.py prompts.py quota.py mcp_server.py
```

**Installation des dépendances :**
```bash
pip install -r requirements.txt
npm install
python -m playwright install chromium
```

## 🔌 Intégration MCP (Claude Desktop)

Ajouter dans `%APPDATA%\Claude\claude_desktop_config.json` :
```json
{
  "mcpServers": {
    "html-to-pdf": {
      "command": "python",
      "args": ["C:\\Users\\tahet\\projects\\cv-tailor\\mcp_server.py"]
    }
  }
}
```

👉 **Maintenant, lis `PROJECT_INDEX.md` pour l'audit complet du projet !**
