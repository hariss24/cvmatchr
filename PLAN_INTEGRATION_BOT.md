# 🔌 Plan d'intégration : bot `agent-taff` → app web `cv-tailor`

> **À lire par toute IA qui exécute ce plan.** Ce document est autonome : il contient le
> contexte, le code de référence et les étapes. Il est découpé en **6 lots indépendants**
> (LOT 1 → LOT 6). Chaque lot peut être confié à une IA différente. Faites les lots
> **dans l'ordre** (chaque lot suppose le précédent terminé), mais un seul lot tient dans
> une conversation courte.

---

## 🎯 Objectif

Fusionner deux projets Python complémentaires :

- **`C:\Users\tahet\projects\agent-taff\`** = *chasseur d'offres*. Script en boucle qui :
  récupère des offres France Travail, élimine stages/alternances, calcule les temps de
  trajet (Google Maps), note chaque offre sur 100 avec Gemini selon le profil de Hariss,
  écrit les bonnes (score ≥ 70) dans `offers.csv`.
- **`C:\Users\tahet\projects\cv-tailor\`** = *fabricant de CV* (app web Flask). Sait
  déjà lire une offre depuis une URL (`/api/extract-job`) et adapter le CV à une offre
  (`/api/tailor-resume`).

**Résultat attendu :** depuis l'app web, un onglet « Offres » avec un bouton
« Chercher des offres » qui lance la recherche + le scoring en tâche de fond, affiche les
offres notées sous forme de cartes, et un bouton **« Adapter mon CV »** sur chaque offre
qui enchaîne sur le tailoring **déjà existant**.

**Décisions déjà prises (ne pas les remettre en question) :**
1. Le bot devient un **module backend de l'app** (pas un script séparé).
2. Le scoring garde le **profil de Hariss écrit en dur** (repris tel quel du bot).
3. On **garde** le calcul des temps de trajet (Google Maps).

---

## 🧱 Règles d'or de l'app `cv-tailor` (à respecter absolument)

Issues de `PROJECT_INDEX.md` du projet :
1. **Ne pas casser la synchro JSON/HTML.** Le CV est un objet JSON (source de vérité) ;
   le HTML n'est généré qu'à la volée côté frontend.
2. **Le frontend est le moteur de rendu HTML.** Ne **jamais** créer de template Jinja
   pour le CV côté backend.
3. **photoBase64** : avant d'envoyer un CV à l'IA, on strippe `photoBase64` (non concerné
   ici car le scoring d'offre utilise un profil en dur, pas le CV).
4. Toute l'IA vit dans `ai_engine.py`, tout le stockage dans `archive.py`, les routes dans
   `app.py`. **Réutiliser** ces modules, ne pas créer d'architecture parallèle.

Règles Karpathy (du `CLAUDE.md` global de l'utilisateur) :
- Simplicité maximale, aucune abstraction non demandée.
- Changements chirurgicaux : ne pas « nettoyer » le code adjacent.

---

## 🗺️ Vue d'ensemble des fichiers

| Fichier | Action | Lot |
|---|---|---|
| `requirements.txt` | ajouter `googlemaps`, `requests` | LOT 1 |
| `job_scout.py` | **créer** (logique France Travail + trajet) | LOT 2 |
| `ai_engine.py` | ajouter `score_job_offer()` | LOT 3 |
| `archive.py` | ajouter table `jobs` + fonctions | LOT 4 |
| `app.py` | ajouter 4 routes + tâche de fond | LOT 5 |
| `templates/index.html`, `static/js/jobs.js` | onglet « Offres » + bouton Adapter | LOT 6 |
| `CLAUDE.md` / `README.md` | documenter les variables d'env | LOT 6 |

**Nouvelles variables d'environnement** (lues au moment du scan, pas à l'import) :
`FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `GOOGLE_MAPS_API_KEY`.
`GEMINI_API_KEY` est déjà gérée par l'app.

---

## 📦 LOT 1 — Dépendances

**Fichier :** `requirements.txt`
**Action :** ajouter deux lignes (`google-genai` est déjà présent) :

```
googlemaps
requests
```

Ne pas ajouter `python-dotenv` ni `pytest` du bot : l'app lit `os.environ` directement.

**Vérification :** `pip install -r requirements.txt` réussit.

---

## 📦 LOT 2 — `job_scout.py` (NOUVEAU)

Créer `C:\Users\tahet\projects\cv-tailor\job_scout.py`. Reprend la logique de
`agent-taff/bot.py` **sans** la boucle CLI, sans `offers.csv`, sans `seen.txt`.

### Ce qu'on reprend tel quel depuis `agent-taff/bot.py`

**Constantes** (liste de mots-clés métier de Hariss) :

```python
KEYWORDS = [
    "Chargé SEO", "Référenceur web", "Intégrateur WordPress", "Développeur Shopify",
    "Chargé communication digital", "Webmaster", "Webmaster éditorial",
    "Chargé contenu web", "Chargé mission digital", "Gestionnaire contenu CMS",
    "Chargé marketing digital", "Chargé projet digital",
    "Gestionnaire de contenu digital", "Spécialiste contenu digital",
    "Rédacteur web SEO", "Chargé de contenu éditorial", "Community Manager SEO",
    "Gestionnaire de sites web", "Référencement naturel", "Analyste de contenu web",
    "Chargé SEO Junior", "Chargé de webmarketing", "Content manager",
    "Content strategist", "Marketing digital", "Marketing digital Junior",
    "Chef de projet digital", "Chef de projet marketing digital",
]
MIN_SCORE = 70
MAX_DESCRIPTION_CHARS = 3000
HOME_ADDRESS = "4 rue jean bouton 75012 Paris"
```

**Fonction `get_ft_token(client_id, client_secret) -> str`** (OAuth France Travail) :

```python
import requests
from datetime import datetime, timedelta

def get_ft_token(client_id, client_secret):
    url = "https://entreprise.francetravail.fr/connexion/oauth2/access_token"
    response = requests.post(url, params={"realm": "/partenaire"}, data={
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "api_offresdemploiv2 o2dsoffre",
    })
    response.raise_for_status()
    return response.json()["access_token"]
```

**Fonction `fetch_offers(token, keyword) -> list[dict]`** :

```python
def fetch_offers(token, keyword):
    url = "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search"
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    min_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    response = requests.get(url, headers=headers, params={
        "motsCles": keyword, "region": "11", "typeContrat": "CDI,CDD",
        "natureContrat": "E1", "minCreationDate": min_date, "range": "0-99",
    })
    if response.status_code in (200, 206):
        return response.json().get("resultats", [])
    return []
```

**Fonction `get_commute_times(offer, gmaps) -> dict`** (transit/vélo/marche depuis
`HOME_ADDRESS`) — reprise telle quelle de `bot.py` lignes 116-144 (utilise
`gmaps.distance_matrix`). Retourne `{"transit": "...", "bicycling": "...", "walking": "..."}`.

**Filtre stages/alternances** (repris de `bot.py` lignes 251-268), à appliquer sur
chaque offre :

```python
EXCLUDED_WORDS = ["alternan", "apprenti", "stagiaire", "professionnalisation", "cfa"]

def is_excluded(offer):
    if offer.get("alternance", False):
        return True
    text = (offer.get("intitule", "") + " " + offer.get("description", "") + " "
            + offer.get("typeContratLibelle", "")).lower()
    if any(kw in text for kw in EXCLUDED_WORDS):
        return True
    return "stage" in text.replace("-", " ").split()
```

### Nouveauté : `run_scan(progress_cb)` — l'orchestrateur

Remplace la boucle `main()` du bot. **N'écrit plus de CSV** : il persiste via
`archive.py` (LOT 4) et appelle `ai_engine.score_job_offer` (LOT 3).

```python
import os, time
import googlemaps
import ai_engine
import archive

def run_scan(progress_cb=lambda **k: None):
    client_id = os.environ.get("FT_CLIENT_ID")
    client_secret = os.environ.get("FT_CLIENT_SECRET")
    gmaps_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not (client_id and client_secret and gmaps_key):
        raise RuntimeError("Clés manquantes : FT_CLIENT_ID / FT_CLIENT_SECRET / GOOGLE_MAPS_API_KEY")

    token = get_ft_token(client_id, client_secret)
    gmaps = googlemaps.Client(key=gmaps_key)
    fetched = scored = retained = 0

    for keyword in KEYWORDS:
        progress_cb(phase=f"Recherche : {keyword}", fetched=fetched, scored=scored, retained=retained)
        for offer in fetch_offers(token, keyword):
            fetched += 1
            offer_id = offer.get("id", "")
            if not offer_id or archive.job_exists(offer_id):
                continue
            if is_excluded(offer):
                continue
            # scoring avec retry anti-quota (65s, comme le bot)
            result = commute = None
            for attempt in range(3):
                try:
                    commute = get_commute_times(offer, gmaps)
                    result = ai_engine.score_job_offer(offer, commute)
                    break
                except Exception:
                    time.sleep(65)
            if result is None:
                continue
            scored += 1
            score = result.get("total_score", 0)
            if score >= MIN_SCORE:
                archive.save_job({
                    "id": offer_id,
                    "title": offer.get("intitule", ""),
                    "company": offer.get("entreprise", {}).get("nom", ""),
                    "location": offer.get("lieuTravail", {}).get("libelle", ""),
                    "commute": f"TC: {commute.get('transit','?')} | Vélo: {commute.get('bicycling','?')}",
                    "score": score,
                    "url": offer.get("origineOffre", {}).get("urlOrigine", ""),
                    "job_text": offer.get("description", "")[:MAX_DESCRIPTION_CHARS],
                })
                retained += 1
            progress_cb(phase=f"Recherche : {keyword}", fetched=fetched, scored=scored, retained=retained)

    progress_cb(phase="Terminé", fetched=fetched, scored=scored, retained=retained)
    return {"fetched": fetched, "scored": scored, "retained": retained}
```

**Vérification :** `python -m py_compile job_scout.py`.

---

## 📦 LOT 3 — `ai_engine.py` : ajouter `score_job_offer()`

**Fichier :** `ai_engine.py`. **Contexte existant à réutiliser :**
- `GEMINI_MODEL` (variable de module, ex. `"gemini-3.1-flash-lite"`).
- Le module importe déjà `from google import genai` et `from google.genai import types`.
- Helper `_loads_ai_json(raw)` existe déjà pour parser du JSON IA.
- Pattern de clé : `key = api_key or os.environ.get("GEMINI_API_KEY", "")`.

**Ajouter cette fonction** (le prompt + schema viennent de `agent-taff/bot.py`
lignes 147-201, profil Hariss en dur). ⚠️ On utilise `GEMINI_MODEL` de l'app, pas le
`gemini-3.5-flash` codé en dur dans le bot.

```python
_JOB_SCORE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "score_tech": {"type": "INTEGER"},
        "score_seniority": {"type": "INTEGER"},
        "score_sector": {"type": "INTEGER"},
        "score_geo": {"type": "INTEGER"},
        "score_red_flags": {"type": "INTEGER"},
        "total_score": {"type": "INTEGER"},
        "red_flags_reasons": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["score_tech", "score_seniority", "score_sector", "score_geo",
                 "score_red_flags", "total_score", "red_flags_reasons"],
}

_JOB_SCORE_SYSTEM = (
    "Tu es un recruteur expert. Évalue cette offre pour le candidat suivant :\n"
    "Nom: Hariss Hafeji (Paris 75012)\n"
    "Titre: Webmaster / Chargé de projet Web\n"
    "Formation: Master 2 E-commerce (UPEC)\n"
    "Expériences: 3 stages/alternances (Webmastering Drupal/WP, SEO/SEA, Analytics, UI/UX, Gestion de projet agile).\n"
    "Compétences: HTML/CSS/JS/PHP, CMS (Drupal, WordPress), SEO on-page, SEA (Google Ads), Analytics (GA4, Looker), UI/UX (Figma).\n\n"
    "Évalue sur 100 :\n"
    "score_tech (0-40) : Match avec sa stack (CMS, intégration, SEO, analytics).\n"
    "score_seniority (0-20) : Adapté à un profil Junior (Bac+5 avec 1-2 ans d'expérience en stage).\n"
    "score_sector (0-15) : Pertinence dans le secteur web/e-commerce.\n"
    "score_geo (0-15) : Ajuste avec les temps de trajet fournis (pénalise si > 45 min depuis Paris 12e).\n"
    "score_red_flags (0-10) : 10 = aucun piège (salaire flou, travail dissimulé, ou alternance masquée)."
)

def score_job_offer(offer: dict, commute_times: dict, api_key: str | None = None) -> dict:
    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise ValueError("Ajoutez GEMINI_API_KEY dans les variables d'environnement.")
    title = offer.get("intitule", "")
    company = offer.get("entreprise", {}).get("nom", "Inconnue")
    description = offer.get("description", "")[:3000]
    commute_info = (
        f"Temps de trajet estimé depuis domicile (4 rue jean bouton 75012 Paris):\n"
        f"- Transports en commun: {commute_times.get('transit', 'N/A')}\n"
        f"- Vélo: {commute_times.get('bicycling', 'N/A')}\n"
        f"- Marche: {commute_times.get('walking', 'N/A')}"
    )
    prompt = f"Titre: {title}\nEntreprise: {company}\n{commute_info}\nDescription:\n{description}"
    client = genai.Client(api_key=key)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=_JOB_SCORE_SCHEMA,
            system_instruction=_JOB_SCORE_SYSTEM,
        ),
    )
    return _loads_ai_json(response.text)
```

> Si `_loads_ai_json` n'accepte pas exactement ce format, utiliser `json.loads(response.text)`
> comme le fait `bot.py`. Vérifier la signature réelle dans `ai_engine.py` avant.

**Vérification :** `python -m py_compile ai_engine.py`.

---

## 📦 LOT 4 — `archive.py` : table `jobs`

**Fichier :** `archive.py`. **Réutiliser** le pattern SQLite déjà présent :
`_get_db()` (connexion WAL), `ensure_archive_dir()`, `_DB_PATH`. Le code existant crée la
table `documents` dans `_sqlite_init()` ; ajouter la création de `jobs` au même endroit.

**Table à ajouter** (dans `_sqlite_init`, après la création de `documents`) :

```python
_CREATE_JOBS_TABLE = """
CREATE TABLE IF NOT EXISTS jobs (
    id         TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    title      TEXT DEFAULT '',
    company    TEXT DEFAULT '',
    location   TEXT DEFAULT '',
    commute    TEXT DEFAULT '',
    score      INTEGER DEFAULT 0,
    url        TEXT DEFAULT '',
    job_text   TEXT DEFAULT '',
    status     TEXT DEFAULT 'new'
)
"""
```

**Fonctions publiques à ajouter** (calquées sur `save_document`/`list_documents`/
`delete_document`) :

```python
from datetime import datetime

def job_exists(job_id: str) -> bool:
    ensure_archive_dir()
    with _get_db() as conn:
        return conn.execute("SELECT 1 FROM jobs WHERE id=?", (job_id,)).fetchone() is not None

def save_job(entry: dict) -> None:
    ensure_archive_dir()
    with _get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO jobs VALUES (?,?,?,?,?,?,?,?,?,?)",
            (entry["id"], datetime.now().isoformat(timespec="seconds"),
             entry.get("title", ""), entry.get("company", ""), entry.get("location", ""),
             entry.get("commute", ""), int(entry.get("score", 0)), entry.get("url", ""),
             entry.get("job_text", ""), "new"),
        )
        conn.commit()

def list_jobs(status: str = "new") -> list[dict]:
    ensure_archive_dir()
    with _get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM jobs WHERE status=? ORDER BY score DESC, created_at DESC", (status,)
        ).fetchall()
        return [dict(r) for r in rows]

def set_job_status(job_id: str, status: str) -> bool:
    ensure_archive_dir()
    with _get_db() as conn:
        cur = conn.execute("UPDATE jobs SET status=? WHERE id=?", (status, job_id))
        conn.commit()
        return cur.rowcount > 0
```

> ⚠️ Le serveur peut tourner en mode MongoDB/serverless (`_history_collection`). Pour
> rester simple et conforme à l'usage local de Hariss, ces fonctions ciblent **SQLite
> uniquement**. Si MongoDB est actif, `ensure_archive_dir` + SQLite local fonctionnent
> quand même. Ne pas complexifier avec un routage Mongo pour les jobs sauf demande.

**Vérification :** `python -m py_compile archive.py`, puis test rapide :
`save_job({...})` → `list_jobs()` renvoie l'entrée → `job_exists(id)` == True.

---

## 📦 LOT 5 — `app.py` : routes + tâche de fond

**Fichier :** `app.py`. **Réutiliser** : `_auth_protect`, `_csrf_protect`,
`_check_quota` (déjà définis), `threading` (déjà importé), `jsonify`, `request`.

Ajouter en haut (imports) : `import job_scout`.

**État du scan** (variable de module + lock) :

```python
import threading
_scan_lock = threading.Lock()
_scan_state = {"running": False, "phase": "", "fetched": 0, "scored": 0, "retained": 0, "error": ""}

def _run_scan_thread():
    def progress(**kw):
        _scan_state.update(kw)
    try:
        job_scout.run_scan(progress_cb=progress)
    except Exception as exc:
        _scan_state["error"] = str(exc)
    finally:
        _scan_state["running"] = False
```

**4 routes** (ajouter là où sont les autres `@app.route("/api/...")`) :

```python
@app.route("/api/jobs/scan", methods=["POST"])
def api_jobs_scan():
    with _scan_lock:
        if _scan_state["running"]:
            return jsonify({"error": "Une recherche est déjà en cours."}), 409
        _scan_state.update({"running": True, "phase": "Démarrage…",
                            "fetched": 0, "scored": 0, "retained": 0, "error": ""})
    threading.Thread(target=_run_scan_thread, daemon=True).start()
    return jsonify({"started": True})

@app.route("/api/jobs/scan/status", methods=["GET"])
def api_jobs_scan_status():
    return jsonify(_scan_state)

@app.route("/api/jobs", methods=["GET"])
def api_jobs_list():
    return jsonify({"jobs": archive.list_jobs("new")})

@app.route("/api/jobs/<job_id>/dismiss", methods=["POST"])
def api_jobs_dismiss(job_id):
    ok = archive.set_job_status(job_id, "dismissed")
    return (jsonify({"ok": True}) if ok else (jsonify({"error": "Introuvable"}), 404))
```

> Respecter le décorateur/hook d'auth global s'il existe (`_auth_protect` est appelé via
> `@app.before_request` ou similaire — vérifier comment les autres routes `/api/` sont
> protégées et faire pareil). Les routes POST JSON sont protégées CSRF par le pattern
> Content-Type existant.

**Vérification :** `python app.py` démarre ; `POST /api/jobs/scan` puis
`GET /api/jobs/scan/status` renvoie un état qui évolue.

---

## 📦 LOT 6 — Frontend (onglet « Offres ») + doc

### Frontend

**Objectif :** un onglet/section « Offres » avec :
1. Bouton « Chercher des offres » → `POST /api/jobs/scan`, puis poll
   `GET /api/jobs/scan/status` toutes les 3 s pour afficher la progression
   (`phase`, `fetched`, `scored`, `retained`). Quand `running` repasse à `false`,
   recharger la liste via `GET /api/jobs`.
2. Liste de cartes : titre, entreprise, lieu, trajet, **score**, lien vers l'offre.
3. Sur chaque carte, deux boutons :
   - **« Adapter mon CV »** → met le champ `job_text` de l'offre dans le champ offre
     d'emploi existant de l'éditeur, puis déclenche le flux Tailor déjà codé dans
     `app.js` (celui qui appelle `/api/tailor-resume` avec le CV JSON courant). **C'est
     le point de jonction des deux projets.**
   - **« Masquer »** → `POST /api/jobs/<id>/dismiss` puis retire la carte.

**Comment faire (réutiliser l'existant) :**
- Créer `static/js/jobs.js` calqué sur `static/js/history.js` (même style d'appels fetch
  et de rendu de cartes).
- Repérer dans `static/js/app.js` la fonction qui lance le tailoring (cherchez l'appel à
  `/api/tailor-resume` et le champ `job_desc`). Exposer/réutiliser cette fonction pour le
  bouton « Adapter mon CV ». **Ne pas dupliquer** la logique de tailoring.
- Ajouter la section « Offres » dans `templates/index.html` (un onglet à côté des
  existants) et charger `jobs.js`. **Pas de template Jinja pour le CV** (règle d'or n°2).

**Dégradation propre :** si le premier `GET /api/jobs/scan/status` ou le scan renvoie une
erreur « Clés manquantes », afficher dans l'onglet : « Configurez vos clés France Travail
et Google Maps dans les variables d'environnement » au lieu de planter.

### Documentation

Dans `CLAUDE.md` et/ou `README.md`, ajouter une section « Recherche d'offres
(job scout) » documentant les 3 variables d'environnement requises :
`FT_CLIENT_ID`, `FT_CLIENT_SECRET`, `GOOGLE_MAPS_API_KEY` (en plus de `GEMINI_API_KEY`).

---

## ✅ Vérification finale (bout en bout)

1. **L'app démarre sans les clés du bot** : `python app.py` fonctionne même si
   `FT_CLIENT_ID` etc. sont absents ; l'onglet Offres affiche le message de config.
2. **Compilation** :
   `python -m py_compile app.py archive.py ai_engine.py job_scout.py` → aucune erreur.
3. **Scan complet** (avec les clés) : « Chercher des offres » → la progression avance →
   des cartes notées apparaissent → elles sont en base (`jobs`).
4. **Jonction** : « Adapter mon CV » sur une carte remplit le champ offre et lance le
   tailoring ; le CV affiché est adapté à l'offre choisie.
5. **Dédoublonnage** : relancer un scan ne recrée pas les offres déjà vues
   (`archive.job_exists`).
6. **Tests** : `pytest` passe. Ajouter au moins un test `archive.save_job`/`list_jobs` et
   un test de `score_job_offer` (mocker `genai.Client`).

---

## 🚫 Hors périmètre (pour rester simple)

- Pas de scan automatique/planifié (l'utilisateur clique).
- Pas de scoring basé sur le CV chargé (profil en dur, décision validée).
- Pas de worker/file de tâches externe : un simple thread in-process suffit (usage local
  mono-utilisateur).
- Pas de routage MongoDB pour la table `jobs` (SQLite local suffit).
