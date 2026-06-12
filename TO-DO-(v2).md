# TO-DO (v2) — Roadmap d'optimisations `html-to-pdf`

> **Document autoportant destiné à une IA exécutante (Gemini, Claude, etc.).**
> État des lieux vérifié le 2026-06-12 : 104 tests pytest verts (~2,6 s), CI GitHub Actions (`ruff` + `pytest`), Tailwind CSS v4 intégré, migration HTML→JSON à ~70 %.

## ⚠️ À lire AVANT toute modification

1. **Lire `FILE_MAP.md`** (carte du dépôt) puis **`PROJECT_INDEX.md`** (architecture, angles morts critiques). La carte des routes API est dans la docstring de `app.py`.
2. **Respecter les guidelines Karpathy** de `CLAUDE.md` : hypothèses explicites, minimum de code, changements chirurgicaux (ne pas « nettoyer » le code adjacent), critères de succès vérifiables.
3. **Vérification obligatoire après CHAQUE tâche** : `ruff check .` ET `pytest` (104 tests, tous verts). Une tâche n'est terminée que si ces deux commandes passent.
4. **Commits atomiques** avec préfixe conventionnel (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`).
5. **NE JAMAIS toucher** au mécanisme strip/restore de `photoBase64` : les objets JSON sont strippés de cette clé avant tout appel IA puis restaurés à la réception (limites de tokens). Voir `PROJECT_INDEX.md`.
6. **NE JAMAIS supprimer** l'endpoint `/api/tailor` (pipeline HTML) : décision actée, le mode Expert l'utilise. Le pipeline JSON (`/api/tailor-resume`) est prioritaire pour les nouveautés, mais les deux coexistent.
7. **Jamais** de `alert()`/`confirm()`/`prompt()` natifs : utiliser `uiConfirm()`/`uiPrompt()`/`uiAlert()` de `static/js/ui-dialogs.js`.
8. Après tout ajout de classe Tailwind : `npm run build:css` (l'artefact CSS est commité).

---

## Phase 0 — Hygiène du dépôt (S, ~30 min)

### T0.1 — Supprimer `templates/cv_template.html` et sa route
- **Fichiers** : `templates/cv_template.html` (fichier non suivi par git, ~399 lignes, CV personnel), `app.py:230-232` (route `/cv-template` qui le sert).
- **Action** : supprimer le fichier `templates/cv_template.html` ET la route associée dans `app.py` :
  ```python
  @app.route("/cv-template")
  def cv_template():
      return render_template("cv_template.html")
  ```
- **Vérif** : `pytest` vert ; `git status` ne montre plus `templates/cv_template.html` ; `grep -r "cv_template" .` (hors `.git`) ne retourne rien.

### T0.2 — Committer les modifications en attente
- **Fichiers** : `CLAUDE.md`, `TODO.md`, `ai_engine.py`, `app.py`, `static/css/main.css`, `static/js/app.js`, `static/js/resume-form.js`, `templates/index.html` (modifiés non commités).
- **Action** : **lire le diff complet** (`git diff`) avant de committer. Regrouper en commits cohérents par sujet (ne pas tout mettre dans un seul commit fourre-tout). La suppression de la route `/cv-template` (T0.1) fait partie du diff d'`app.py` — l'inclure dans un commit dédié.
- **Vérif** : `git status` propre ; CI verte après push.

> Note : l'ancien audit listait « créer `requirements-dev.txt` » — **déjà fait**, le fichier existe et la CI (`.github/workflows/ci.yml:23`) l'installe. Rien à faire.

---

## Phase 1 — Intégrité des données (CRITIQUE)

### T1.1 — Vérifier et verrouiller la parité du schéma JSON (M)
- **Contexte** : les sections `projects`, `certifications`, `volunteer` ont déjà été ajoutées à `ai_engine.py` (`_RESUME_SCHEMA_DESC` ~lignes 481-485, `_normalize_resume()` ~lignes 541-595) et au rendu/formulaire `static/js/resume-form.js`. Des tests existent dans `tests/test_ai_engine.py` et `tests/test_resume_form.spec.js`. **La tâche restante est un audit de complétude, pas une implémentation from scratch.**
- **Action** :
  1. Lister tous les champs du schéma déclaré dans `_RESUME_SCHEMA_DESC` (`ai_engine.py`).
  2. Vérifier que CHAQUE champ : (a) survit à `_normalize_resume()` sans perte, (b) est rendu par `static/js/resume-form.js` (HTML et formulaire), (c) est couvert par la fixture `tests/resume_form_test.html` et par un test.
  3. Combler tout trou trouvé en écrivant **d'abord un test rouge** (un CV JSON complet qui traverse `_normalize_resume` puis le rendu sans perdre de champ), puis le correctif.
- **Vérif** : `pytest tests/test_ai_engine.py` vert ; test du formulaire (`tests/test_resume_form.spec.js`) vert ; aucun champ du schéma absent du round-trip JSON → normalisation → rendu.

### T1.2 — Test de non-régression du remboursement de quota (S)
- **Contexte** : le remboursement est **déjà implémenté** dans `app.py` — chaque endpoint IA appelle `quota.decrement()` sur exception (ex. `app.py:629-642` pour `/api/tailor-resume`). Mais **aucun test** ne couvre ce comportement (`tests/test_quota.py` ne teste que la mécanique de base).
- **Action** : ajouter dans `tests/test_quota.py` ou `tests/test_endpoints.py` un test : appel d'un endpoint IA (ex. `/api/tailor-resume`) avec `ai_engine` mocké pour lever une exception → vérifier que `quota.remaining()` est inchangé après l'appel (le décompte a été remboursé). Cas sans `X-Api-Key` (clé serveur) uniquement : avec une clé utilisateur, le quota n'est pas décompté.
- **Vérif** : nouveau test vert ; `pytest` complet vert.

---

## Phase 2 — Réduction de la duplication backend (M, ~½ j)

> Note : le strip des balises ```` ```json ```` est **déjà factorisé** dans `_loads_ai_json()` (`ai_engine.py:599`), utilisé partout. Ne reste que ce qui suit.

### T2.1 — Factoriser les vérifications dupliquées dans `ai_engine.py`
- **Duplication 1** : le check « clé API manquante » est dupliqué **6×** (`ai_engine.py` lignes ~36-40, 222-226, 334-338, 431-435, 636-640, 743-747) : même `key = api_key or os.environ.get("GEMINI_API_KEY", "")` + même `ValueError("Aucune clé API configurée. ...")`. → Extraire une fonction `_require_key(api_key) -> str`.
- **Duplication 2** : la gestion d'erreur quota Gemini (test `"429" / "RESOURCE_EXHAUSTED" / "quota"` + `_parse_retry_delay` + `RuntimeError("Quota Gemini épuisé...")`) est dupliquée **2×** (`_stream_gemini` lignes ~96-105 et `_complete_gemini` lignes ~182-191). → Extraire une fonction ou un décorateur commun.
- **Contrainte** : **zéro changement de comportement** (mêmes messages d'erreur, mêmes types d'exception). Refactor pur.
- **Vérif** : `pytest tests/test_ai_engine.py` vert sans modification des tests ; `ruff check .` vert.

### T2.2 — Unifier les règles de tailoring dans `prompts.py`
- **Contexte** : `_TAILOR_SYSTEMS` (prompts du pipeline HTML) vit déjà dans `prompts.py:231` et est importé par `app.py`. Mais `_RESUME_TAILOR_RULES` (prompts du pipeline JSON, mêmes niveaux peu/adapte/hyper/sur-mesure) vit dans `ai_engine.py:652`.
- **Action** : déplacer `_RESUME_TAILOR_RULES` vers `prompts.py` (à côté de `_TAILOR_SYSTEMS`), importer depuis `ai_engine.py`. Si des règles métier sont textuellement dupliquées entre les deux dictionnaires, les factoriser en constantes partagées dans `prompts.py`.
- **⚠️ NE PAS supprimer `/api/tailor`** ni modifier le contenu des prompts (déplacement pur).
- **Vérif** : `pytest` vert ; `python -m py_compile app.py ai_engine.py prompts.py` OK.

---

## Phase 3 — Filet de sécurité frontend (M, ~1 j) — **prérequis de la Phase 4**

### T3.1 — Tests de caractérisation du rendu `resume-form.js`
- **Fichiers** : `static/js/resume-form.js`, `tests/test_resume_form.spec.js` (existant, à étendre), `tests/resume_form_test.html` (fixture existante).
- **Action** : compléter les tests Playwright avec des golden files JSON→HTML couvrant **chaque** section du schéma (`profile`, `experience`, `education`, `skills`, `languages`, `interests`, `projects`, `certifications`, `volunteer`), plus : photo Base64 présente/absente, champs vides, caractères spéciaux HTML.
- **Vérif** : suite Playwright verte ; chaque section du schéma apparaît dans au moins un test.

### T3.2 — Tests Playwright des flux critiques d'`app.js`
- **Fichiers** : `static/js/app.js` (2 529 lignes), nouveaux fichiers `tests/*.spec.js`.
- **Action** : couvrir les flux : switch de `doc_type` (CV ↔ lettre), conversion PDF (backend mocké), strip/restore `photoBase64` avant/après appel IA, snapshot/restore IndexedDB.
- **Vérif** : suite Playwright verte, reproductible en local.

### T3.3 — Linter JS + job CI
- **Action** : ajouter ESLint (flat config minimale) ou Biome — **détection d'erreurs uniquement** (undefined vars, syntaxe), pas de règles stylistiques. Ajouter le job dans `.github/workflows/ci.yml`.
- **Vérif** : lint vert en local et en CI sur le code actuel (corriger les vraies erreurs détectées, ne pas désactiver les règles en masse).

---

## Phase 4 — Découpage de `app.js` (XL, 2-3 j) — **BLOQUÉ tant que la Phase 3 n'est pas verte**

### T4.1 — Modules ES
- **Fichier** : `static/js/app.js` (2 529 lignes, ~190 fonctions).
- **Découpage proposé** : `editor.js` (Monaco), `chat.js` (chat IA), `tailor.js` (adaptation à l'offre), `ats.js` (score ATS + white fonting), `snapshots.js` (IndexedDB), `pdf.js` (export), `app.js` résiduel (orchestrateur).
- **Méthode** : déplacements purs, **zéro changement de comportement**, **un module par commit**, tests Playwright (Phase 3) verts après chaque commit. Attention aux variables d'état globales partagées (ex. `_atsBoostEnabled`, `_atsMissingKeywords`) : les exposer via le module propriétaire, pas en global.
- **Vérif** : après chaque commit, suite Playwright complète verte + test manuel de la page.

---

## Phase 5 — Performance & UX (S-M, au fil de l'eau)

### T5.1 — Compression des photos à l'upload
- **Fichiers** : gestionnaire d'upload photo dans `static/js/resume-form.js` (ou `app.js`).
- **Action** : avant stockage Base64, redimensionner via `<canvas>` (max ~800 px de côté) et réencoder en JPEG qualité 0,8. Un upload de 10 MB explose actuellement IndexedDB et les payloads réseau.
- **Vérif** : uploader une image >5 MB → la chaîne Base64 résultante fait <500 KB ; la photo s'affiche correctement dans le rendu et le PDF.

### T5.2 — Lazy-load de Monaco Editor
- **Action** : charger Monaco à la première ouverture de l'éditeur au lieu du chargement initial de la page (gain estimé ~0,5 s).
- **Vérif** : la page se charge sans Monaco dans le réseau initial ; l'éditeur fonctionne à la première ouverture.

### T5.3 — Transparence du fallback Jina Reader
- **Contexte** : le fallback de scraping (`scraper.py`) envoie l'URL de l'offre d'emploi à `r.jina.ai`, alors que le README affirme « HTML stays local ».
- **Action** : corriger le README pour décrire ce fallback, ET ajouter un `uiConfirm()` côté frontend avant de déclencher le fallback (consentement explicite de l'utilisateur).
- **Vérif** : README exact ; le fallback ne part jamais sans confirmation.

### T5.4 — Documenter `SECRET_KEY`
- **Action** : ajouter au README qu'en déploiement remote (Render), `SECRET_KEY` doit être définie en variable d'environnement, sinon les sessions sont invalidées à chaque redémarrage.
- **Vérif** : section présente dans le README.

---

## Phase 6 — Durcissement optionnel (backlog, ne pas commencer avant les phases 1-5)

- CSP basique (en-tête `Content-Security-Policy`) en mode remote.
- Timeouts réseau homogènes (120 s) sur tous les appels IA (Gemini en a déjà via `HttpOptions(timeout=120_000)` — vérifier Anthropic et les `fetch` frontend).
- En-têtes de sécurité supplémentaires (X-Content-Type-Options, etc.) en mode remote uniquement.

---

## Récapitulatif priorité / effort / dépendances

| Tâche | Effort | Impact | Dépend de |
|---|---|---|---|
| T0.1 Supprimer cv_template + route | S | Hygiène | — |
| T0.2 Committer le diff en attente | S | Hygiène | T0.1 |
| T1.1 Audit parité schéma JSON | M | **CRITIQUE** (perte de données silencieuse) | T0.2 |
| T1.2 Test remboursement quota | S | Fiabilité | — |
| T2.1 Factoriser checks `ai_engine.py` | S | Maintenabilité | — |
| T2.2 Unifier prompts dans `prompts.py` | S | Maintenabilité | — |
| T3.1 Tests rendu resume-form | M | Filet de sécurité | T1.1 |
| T3.2 Tests flux app.js | M | Filet de sécurité | — |
| T3.3 Linter JS + CI | S | Qualité | — |
| T4.1 Découpage app.js en modules | XL | Maintenabilité | **Phase 3 verte** |
| T5.1 Compression photos | S | Perf/robustesse | — |
| T5.2 Lazy-load Monaco | S | Perf | — |
| T5.3 Transparence Jina | S | Confiance/privacy | — |
| T5.4 Doc SECRET_KEY | S | Doc | — |
| Phase 6 Durcissement | M | Sécurité remote | Phases 1-5 |

**Ordre recommandé** : Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 (parallélisable) → Phase 6.
