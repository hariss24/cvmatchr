# 🤖 CLAUDE.md - Directives pour Claude (et autres IA)

Ce fichier définit les règles de base pour intervenir sur le dépôt `html-to-pdf`.

> **⚠️ IMPORTANT : TOUT EST DOCUMENTÉ DANS `PROJECT_INDEX.md`**  
> Pour comprendre l'architecture complète, la liste des fichiers, la migration HTML -> JSON en cours, et les **"Angles Morts" critiques** à ne pas casser, tu dois **impérativement lire le fichier `PROJECT_INDEX.md`**. Ne commence aucune modification sans avoir pris connaissance des règles métier (notamment la gestion des photos Base64 et du Chat IA) décrites dans ce fichier.

---

## 🛠️ Règles de Développement (Mise à jour)

1. **Avant de coder, vérifie l'architecture** : L'interface web (`static/js/app.js`, `resume-form.js`) et le backend (`app.py`) ont des rôles très stricts. Le rendu HTML se fait côté frontend, le backend ne fait que convertir en PDF.
2. **Ne casse pas la synchro JSON** : Le projet a migré vers une source de vérité JSON. Toute nouvelle fonctionnalité IA doit prioriser les endpoints JSON (ex: `/api/tailor-resume`) plutôt que les anciens endpoints HTML (`/api/tailor`).
3. **Préserver l'intégrité des données JSON** : Lors des adaptations de CV via l'IA, assure-toi de **ne jamais perdre des champs** existants (ex: `interests`, `languages`, `certifications`). Le flux de données doit préserver l'intégralité du modèle de données (Schema JSON).
4. **Fichiers lourds (Images Base64)** : Il est CRITIQUE de toujours **stripper la clé `photoBase64`** des objets JSON avant de les envoyer aux moteurs d'IA (Gemini/Anthropic) pour éviter d'exploser les limites de tokens, puis de les restaurer à la réception.
5. **Esthétique de l'UI** : Le design s'oriente vers un style soigné, avec des touches de skeuomorphisme (effets de relief, mode expert interactif, transitions douces). Ne livre pas d'UI "basique".

## 🚀 Commandes Essentielles

**Lancement du Serveur Web (Local) :**
```bash
python app.py
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
python -m py_compile app.py archive.py ai_engine.py pdf_engine.py
```

**Installation des dépendances :**
```bash
pip install -r requirements.txt
python -m playwright install chromium
```

## 🔌 Intégration MCP (Claude Desktop)

Ajouter dans `%APPDATA%\Claude\claude_desktop_config.json` :
```json
{
  "mcpServers": {
    "html-to-pdf": {
      "command": "python",
      "args": ["C:\\Users\\tahet\\projects\\html-to-pdf\\mcp_server.py"]
    }
  }
}
```

👉 **Maintenant, lis `PROJECT_INDEX.md` pour l'audit complet du projet !**
