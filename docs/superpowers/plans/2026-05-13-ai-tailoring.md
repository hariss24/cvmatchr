# Import CV + Tailoring IA — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à l'app Flask existante l'import de CV (texte ou PDF) et le tailoring IA via Gemini/Anthropic, avec streaming progressif dans l'éditeur Monaco.

**Architecture:** Approach A — purement additif. Deux nouveaux modules Python (`ai_engine.py`, `quota.py`) + trois nouveaux endpoints Flask dans `app.py` + nouveaux blocs HTML/CSS/JS ajoutés dans la variable `PAGE` de `app.py`. Aucun fichier existant (archive.py, pdf_engine.py, mcp_server.py, api/index.py) n'est modifié.

**Tech Stack:** Python/Flask (existant), google-generativeai (Gemini), anthropic SDK, pymupdf (PDF→PNG), Server-Sent Events pour le streaming.

---

## Fichiers créés ou modifiés

| Fichier | Action | Responsabilité |
|---|---|---|
| `quota.py` | Créer | Compteur journalier d'utilisation de la clé serveur |
| `ai_engine.py` | Créer | Appels Gemini et Anthropic avec streaming |
| `tests/test_quota.py` | Créer | Tests unitaires de quota.py |
| `tests/test_ai_engine.py` | Créer | Tests unitaires de ai_engine.py (avec mocks) |
| `tests/test_endpoints.py` | Créer | Tests des 3 nouveaux endpoints Flask |
| `requirements.txt` | Modifier | Ajouter pymupdf, google-generativeai, anthropic |
| `app.py` | Modifier | Imports + 3 endpoints + UI dans PAGE |

---

## Task 1 : Installer les dépendances

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1 : Ajouter les dépendances dans requirements.txt**

Remplacer le contenu actuel de `requirements.txt` par :

```
flask>=3.0
playwright>=1.40
gunicorn>=21.2.0
pymongo>=4.6.3
dnspython>=2.6.1
pymupdf>=1.24.0
google-generativeai>=0.8.0
anthropic>=0.40.0
```

- [ ] **Step 2 : Installer**

```bash
cd C:/Users/tahet/projects/cv-tailor
pip install -r requirements.txt
```

- [ ] **Step 3 : Vérifier que les imports fonctionnent**

```bash
python -c "import fitz; import google.generativeai; import anthropic; print('OK')"
```

Résultat attendu : `OK`

- [ ] **Step 4 : Commit**

```bash
git add requirements.txt
git commit -m "deps: add pymupdf, google-generativeai, anthropic"
```

---

## Task 2 : quota.py

**Files:**
- Create: `quota.py`
- Create: `tests/test_quota.py`

- [ ] **Step 1 : Créer le dossier tests avec conftest.py**

Créer `tests/__init__.py` (vide) et `tests/conftest.py` :

```python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

- [ ] **Step 2 : Écrire les tests (d'abord, avant le code)**

Créer `tests/test_quota.py` :

```python
import importlib
import pytest


def _fresh(limit=3):
    import quota
    importlib.reload(quota)
    quota._state["date"] = ""
    quota._state["count"] = 0
    quota.DAILY_LIMIT = limit
    return quota


def test_allows_requests_up_to_limit():
    q = _fresh(3)
    assert q.check_and_increment() is True
    assert q.check_and_increment() is True
    assert q.check_and_increment() is True


def test_blocks_after_limit_reached():
    q = _fresh(3)
    q.check_and_increment()
    q.check_and_increment()
    q.check_and_increment()
    assert q.check_and_increment() is False


def test_resets_on_new_day():
    q = _fresh(1)
    q._state["date"] = "1999-01-01"
    q._state["count"] = 1
    # Un nouveau jour → reset → doit autoriser
    assert q.check_and_increment() is True


def test_remaining_decrements():
    q = _fresh(5)
    assert q.remaining() == 5
    q.check_and_increment()
    assert q.remaining() == 4


def test_remaining_on_new_day_returns_full_limit():
    q = _fresh(5)
    q._state["date"] = "1999-01-01"
    q._state["count"] = 5
    assert q.remaining() == 5
```

- [ ] **Step 3 : Vérifier que les tests échouent (quota.py n'existe pas encore)**

```bash
cd C:/Users/tahet/projects/cv-tailor
python -m pytest tests/test_quota.py -v
```

Résultat attendu : erreur `ModuleNotFoundError: No module named 'quota'`

- [ ] **Step 4 : Créer quota.py**

```python
"""Compteur journalier d'utilisation de la clé API serveur."""
import os
from datetime import date as _date

_state: dict = {"date": "", "count": 0}
DAILY_LIMIT: int = int(os.environ.get("DAILY_QUOTA", "50"))


def check_and_increment() -> bool:
    """Vérifie si le quota est disponible et l'incrémente si oui.

    Returns True si l'appel est autorisé, False si le quota est épuisé.
    Le compteur se remet à zéro automatiquement chaque nouveau jour.
    """
    today = str(_date.today())
    if _state["date"] != today:
        _state["date"] = today
        _state["count"] = 0
    if _state["count"] >= DAILY_LIMIT:
        return False
    _state["count"] += 1
    return True


def remaining() -> int:
    """Retourne le nombre de requêtes restantes aujourd'hui."""
    today = str(_date.today())
    if _state["date"] != today:
        return DAILY_LIMIT
    return max(0, DAILY_LIMIT - _state["count"])
```

- [ ] **Step 5 : Vérifier que les tests passent**

```bash
python -m pytest tests/test_quota.py -v
```

Résultat attendu : 5 tests PASSED

- [ ] **Step 6 : Commit**

```bash
git add quota.py tests/
git commit -m "feat: add daily quota module with tests"
```

---

## Task 3 : ai_engine.py — Gemini texte

**Files:**
- Create: `ai_engine.py`
- Create: `tests/test_ai_engine.py`

- [ ] **Step 1 : Écrire les tests Gemini texte**

Créer `tests/test_ai_engine.py` :

```python
import importlib
import pytest
from unittest.mock import MagicMock, patch


def test_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    import ai_engine
    importlib.reload(ai_engine)
    with pytest.raises(ValueError, match="Aucune clé API"):
        list(ai_engine.stream_completion("test", "system"))


def test_is_anthropic_key_true():
    import ai_engine
    assert ai_engine._is_anthropic_key("sk-ant-abc123") is True


def test_is_anthropic_key_false():
    import ai_engine
    assert ai_engine._is_anthropic_key("AIzaSyAbc123") is False


def test_stream_gemini_text():
    mock_chunk = MagicMock()
    mock_chunk.text = "<h1>Test</h1>"
    mock_model = MagicMock()
    mock_model.generate_content.return_value = [mock_chunk]
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model

    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("prompt", "system", [], "fake-key"))

    assert result == ["<h1>Test</h1>"]
    mock_genai.configure.assert_called_once_with(api_key="fake-key")
    mock_genai.GenerativeModel.assert_called_once_with(
        model_name="gemini-2.0-flash",
        system_instruction="system",
    )


def test_stream_gemini_skips_empty_chunks():
    chunk1 = MagicMock()
    chunk1.text = ""
    chunk2 = MagicMock()
    chunk2.text = "<p>Contenu</p>"
    mock_model = MagicMock()
    mock_model.generate_content.return_value = [chunk1, chunk2]
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model

    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("p", "s", [], "k"))

    assert result == ["<p>Contenu</p>"]
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
python -m pytest tests/test_ai_engine.py::test_raises_without_api_key tests/test_ai_engine.py::test_is_anthropic_key_true tests/test_ai_engine.py::test_is_anthropic_key_false tests/test_ai_engine.py::test_stream_gemini_text tests/test_ai_engine.py::test_stream_gemini_skips_empty_chunks -v
```

Résultat attendu : `ModuleNotFoundError: No module named 'ai_engine'`

- [ ] **Step 3 : Créer ai_engine.py avec le support Gemini texte**

```python
"""Appels IA (Gemini et Anthropic) avec streaming.

Usage :
    for chunk in stream_completion(prompt, system, api_key="AIza..."):
        print(chunk, end="", flush=True)
"""
import os
from typing import Generator


def stream_completion(
    prompt: str,
    system: str,
    images: list[bytes] | None = None,
    api_key: str | None = None,
) -> Generator[str, None, None]:
    """Appelle l'IA et génère les chunks de réponse un par un.

    Args:
        prompt:   Texte envoyé à l'IA (contenu du CV, offre d'emploi…)
        system:   Instructions système définissant le comportement de l'IA
        images:   Liste d'images PNG en bytes (pour la conversion PDF page par page)
        api_key:  Clé utilisateur. Si absente, utilise GEMINI_API_KEY env var.

    Yields:
        Morceaux de texte HTML au fur et à mesure qu'ils arrivent.

    Raises:
        ValueError: si aucune clé API n'est disponible, ou si Anthropic reçoit des images.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise ValueError(
            "Aucune clé API configurée. "
            "Ajoutez GEMINI_API_KEY ou une clé dans ⚙️ Paramètres."
        )

    if _is_anthropic_key(key):
        if images:
            raise ValueError(
                "La clé Anthropic ne supporte pas la conversion PDF. "
                "Utilisez une clé Gemini pour cette fonction."
            )
        yield from _stream_anthropic(prompt, system, key)
    else:
        yield from _stream_gemini(prompt, system, images or [], key)


def _is_anthropic_key(key: str) -> bool:
    return key.startswith("sk-ant-")


def _stream_gemini(
    prompt: str,
    system: str,
    images: list[bytes],
    api_key: str,
) -> Generator[str, None, None]:
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(
        model_name="gemini-2.0-flash",
        system_instruction=system,
    )
    contents: list = []
    for img_bytes in images:
        contents.append({"mime_type": "image/png", "data": img_bytes})
    contents.append(prompt)
    response = model.generate_content(contents, stream=True)
    for chunk in response:
        if chunk.text:
            yield chunk.text


def _stream_anthropic(
    prompt: str,
    system: str,
    api_key: str,
) -> Generator[str, None, None]:
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    with client.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            yield text
```

- [ ] **Step 4 : Vérifier que les tests Gemini passent**

```bash
python -m pytest tests/test_ai_engine.py::test_raises_without_api_key tests/test_ai_engine.py::test_is_anthropic_key_true tests/test_ai_engine.py::test_is_anthropic_key_false tests/test_ai_engine.py::test_stream_gemini_text tests/test_ai_engine.py::test_stream_gemini_skips_empty_chunks -v
```

Résultat attendu : 5 tests PASSED

- [ ] **Step 5 : Commit**

```bash
git add ai_engine.py tests/test_ai_engine.py
git commit -m "feat: add ai_engine with Gemini text streaming"
```

---

## Task 4 : ai_engine.py — Gemini vision (PDF pages)

**Files:**
- Modify: `tests/test_ai_engine.py` (ajouter 2 tests)

- [ ] **Step 1 : Ajouter les tests vision dans tests/test_ai_engine.py**

Ajouter à la fin du fichier `tests/test_ai_engine.py` :

```python
def test_stream_gemini_with_images():
    mock_chunk = MagicMock()
    mock_chunk.text = "<p>Page 1</p>"
    mock_model = MagicMock()
    mock_model.generate_content.return_value = [mock_chunk]
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model
    fake_png = b"\x89PNG\r\n\x1a\n"

    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("Page 1 du CV :", "system", [fake_png], "key"))

    assert result == ["<p>Page 1</p>"]
    call_contents = mock_model.generate_content.call_args[0][0]
    assert {"mime_type": "image/png", "data": fake_png} in call_contents
    assert "Page 1 du CV :" in call_contents


def test_anthropic_rejects_images():
    import ai_engine
    importlib.reload(ai_engine)
    with pytest.raises(ValueError, match="ne supporte pas la conversion PDF"):
        list(ai_engine.stream_completion(
            "test", "system", images=[b"png"], api_key="sk-ant-fake"
        ))
```

- [ ] **Step 2 : Vérifier que les nouveaux tests passent (le code vision est déjà dans _stream_gemini)**

```bash
python -m pytest tests/test_ai_engine.py -v
```

Résultat attendu : 7 tests PASSED

- [ ] **Step 3 : Commit**

```bash
git add tests/test_ai_engine.py
git commit -m "test: add vision and Anthropic tests for ai_engine"
```

---

## Task 5 : ai_engine.py — Anthropic

**Files:**
- Modify: `tests/test_ai_engine.py` (ajouter 1 test)

- [ ] **Step 1 : Ajouter le test Anthropic dans tests/test_ai_engine.py**

Ajouter à la fin du fichier :

```python
def test_stream_anthropic():
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = ["<h2>Expé", "rience</h2>"]
    mock_client = MagicMock()
    mock_client.messages.stream.return_value = mock_stream
    mock_anthropic_mod = MagicMock()
    mock_anthropic_mod.Anthropic.return_value = mock_client

    with patch.dict("sys.modules", {"anthropic": mock_anthropic_mod}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_anthropic("prompt", "system", "sk-ant-key"))

    assert result == ["<h2>Expé", "rience</h2>"]
    mock_anthropic_mod.Anthropic.assert_called_once_with(api_key="sk-ant-key")
    call_kwargs = mock_client.messages.stream.call_args[1]
    assert call_kwargs["model"] == "claude-haiku-4-5-20251001"
    assert call_kwargs["system"] == "system"
```

- [ ] **Step 2 : Vérifier que tous les tests passent**

```bash
python -m pytest tests/test_ai_engine.py -v
```

Résultat attendu : 8 tests PASSED

- [ ] **Step 3 : Commit**

```bash
git add tests/test_ai_engine.py
git commit -m "test: add Anthropic streaming test"
```

---

## Task 6 : Endpoint /api/text-to-html

**Files:**
- Modify: `app.py` — imports ligne 32, + nouveaux modules + endpoint
- Create: `tests/test_endpoints.py`

- [ ] **Step 1 : Écrire les tests de l'endpoint dans tests/test_endpoints.py**

Créer `tests/test_endpoints.py` :

```python
import pytest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def client():
    import app as flask_app
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as c:
        yield c


def test_text_to_html_empty_body_returns_400(client):
    resp = client.post("/api/text-to-html", json={"text": ""})
    assert resp.status_code == 400


def test_text_to_html_quota_exceeded_returns_429(client):
    with patch("app.quota.check_and_increment", return_value=False):
        resp = client.post("/api/text-to-html", json={"text": "Jean Dupont"})
    assert resp.status_code == 429


def test_text_to_html_streams_sse(client):
    def fake_stream(prompt, system, images=None, api_key=None):
        yield "<h1>Jean"
        yield " Dupont</h1>"

    with patch("app.ai_engine.stream_completion", side_effect=fake_stream), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post("/api/text-to-html", json={"text": "Jean Dupont\nDéveloppeur"})

    assert resp.status_code == 200
    assert "text/event-stream" in resp.content_type
    body = resp.data.decode()
    assert "Jean" in body
    assert "[DONE]" in body


def test_text_to_html_user_key_bypasses_quota(client):
    def fake_stream(prompt, system, images=None, api_key=None):
        yield "<h1>Test</h1>"

    with patch("app.ai_engine.stream_completion", side_effect=fake_stream), \
         patch("app.quota.check_and_increment") as mock_quota:
        resp = client.post(
            "/api/text-to-html",
            json={"text": "some CV"},
            headers={"X-Api-Key": "AIzaUserKey"},
        )

    mock_quota.assert_not_called()
    assert resp.status_code == 200
```

- [ ] **Step 2 : Vérifier que les tests échouent (endpoint pas encore créé)**

```bash
python -m pytest tests/test_endpoints.py -v
```

Résultat attendu : 4 tests FAILED avec `404 NOT FOUND`

- [ ] **Step 3 : Ajouter stream_with_context aux imports Flask dans app.py**

Trouver la ligne 32 dans `app.py` :
```python
from flask import Flask, Response, abort, jsonify, redirect, render_template_string, request, send_file
```

La remplacer par :
```python
from flask import Flask, Response, abort, jsonify, redirect, render_template_string, request, send_file, stream_with_context
```

- [ ] **Step 4 : Ajouter les imports des nouveaux modules dans app.py**

Trouver la ligne 35 dans `app.py` :
```python
from pdf_engine import html_to_pdf_bytes, VALID_FORMATS, VALID_MARGINS
```

Après cette ligne, ajouter :
```python

import ai_engine
import quota
import json as _json_ai
```

- [ ] **Step 5 : Ajouter les constantes et l'endpoint /api/text-to-html dans app.py**

Trouver dans `app.py` la dernière route existante :
```python
@app.route("/api/history/<doc_id>", methods=["DELETE"])
def api_history_delete(doc_id):
```

Après le bloc complet de cette fonction (chercher la ligne suivante qui commence une nouvelle fonction `def _wait_for_port`), insérer avant `def _wait_for_port` :

```python
# ---------------------------------------------------------------------------
# Constantes IA
# ---------------------------------------------------------------------------
_SYSTEM_TEXT_TO_HTML = (
    "Tu reçois le contenu texte brut d'un CV. "
    "Retourne uniquement le HTML structuré correspondant : utilise des balises sémantiques "
    "(h1, h2, h3, p, ul, li, strong). Ne génère pas de CSS. Ne génère pas de design. "
    "Uniquement la structure HTML du contenu, fidèle au texte fourni."
)

_SYSTEM_PDF_PAGE = (
    "Voici une page d'un CV en image. "
    "Retourne uniquement le HTML structuré du contenu visible : titres, paragraphes, listes, "
    "dates, intitulés. Pas de CSS, pas de style inline, uniquement les balises HTML sémantiques. "
    "Texte en français si c'est en français, anglais si c'est en anglais."
)

_SYSTEM_TAILOR = (
    "Tu reçois un CV en HTML et une offre d'emploi. "
    "Adapte le CV pour ce poste : réécris le résumé/accroche, réordonne et ajuste les "
    "compétences pour mettre en avant celles qui correspondent à l'offre, adapte légèrement "
    "les descriptions d'expériences pour coller aux mots-clés du poste. "
    "Ne supprime aucune expérience. Ne mens pas. Ne change pas les dates, les entreprises, "
    "les diplômes. Retourne uniquement le HTML complet modifié, rien d'autre."
)

MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 Mo


# ---------------------------------------------------------------------------
# Endpoints IA
# ---------------------------------------------------------------------------

@app.route("/api/text-to-html", methods=["POST"])
def api_text_to_html():
    data = request.get_json(force=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Texte vide."}), 400

    user_key = request.headers.get("X-Api-Key") or None

    if not user_key:
        if not quota.check_and_increment():
            return jsonify({"error": (
                "Quota journalier atteint — colle ton texte manuellement "
                "ou ajoute ta propre clé dans ⚙️ Paramètres."
            )}), 429

    def generate():
        try:
            for chunk in ai_engine.stream_completion(
                text, _SYSTEM_TEXT_TO_HTML, api_key=user_key
            ):
                yield f"data: {_json_ai.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: [ERROR] {exc}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 6 : Vérifier que les tests passent**

```bash
python -m pytest tests/test_endpoints.py::test_text_to_html_empty_body_returns_400 tests/test_endpoints.py::test_text_to_html_quota_exceeded_returns_429 tests/test_endpoints.py::test_text_to_html_streams_sse tests/test_endpoints.py::test_text_to_html_user_key_bypasses_quota -v
```

Résultat attendu : 4 tests PASSED

- [ ] **Step 7 : Commit**

```bash
git add app.py tests/test_endpoints.py
git commit -m "feat: add /api/text-to-html endpoint with SSE streaming"
```

---

## Task 7 : Endpoint /api/pdf-to-html

**Files:**
- Modify: `app.py` (ajouter l'endpoint après text-to-html)
- Modify: `tests/test_endpoints.py` (ajouter 2 tests)

- [ ] **Step 1 : Ajouter les tests PDF dans tests/test_endpoints.py**

Ajouter à la fin du fichier :

```python
def test_pdf_to_html_no_file_returns_400(client):
    resp = client.post("/api/pdf-to-html", data={})
    assert resp.status_code == 400


def test_pdf_to_html_non_pdf_returns_400(client):
    data = {"file": (b"not a pdf", "document.txt")}
    resp = client.post(
        "/api/pdf-to-html",
        data={"file": (b"content", "document.txt")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400


def test_pdf_to_html_streams_sse(client):
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    def fake_fitz_open(**kwargs):
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_pix = MagicMock()
        mock_pix.tobytes.return_value = fake_png
        mock_page.get_pixmap.return_value = mock_pix
        mock_doc.__len__ = MagicMock(return_value=1)
        mock_doc.__getitem__ = MagicMock(return_value=mock_page)
        mock_doc.close = MagicMock()
        return mock_doc

    def fake_stream(prompt, system, images=None, api_key=None):
        yield "<h1>CV</h1>"

    with patch("app.quota.check_and_increment", return_value=True), \
         patch("app.ai_engine.stream_completion", side_effect=fake_stream):
        import fitz
        with patch("fitz.open", side_effect=fake_fitz_open):
            resp = client.post(
                "/api/pdf-to-html",
                data={"file": (b"fake pdf bytes", "cv.pdf")},
                content_type="multipart/form-data",
            )

    assert resp.status_code == 200
    assert "[DONE]" in resp.data.decode()
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
python -m pytest tests/test_endpoints.py::test_pdf_to_html_no_file_returns_400 tests/test_endpoints.py::test_pdf_to_html_non_pdf_returns_400 tests/test_endpoints.py::test_pdf_to_html_streams_sse -v
```

Résultat attendu : 3 tests FAILED avec `404 NOT FOUND`

- [ ] **Step 3 : Ajouter l'endpoint /api/pdf-to-html dans app.py**

Dans `app.py`, après la fonction `api_text_to_html` (après son `return Response(...)`), ajouter :

```python

@app.route("/api/pdf-to-html", methods=["POST"])
def api_pdf_to_html():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu."}), 400

    f = request.files["file"]
    if not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Le fichier doit être un PDF (.pdf)."}), 400

    pdf_bytes = f.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        return jsonify({"error": "PDF trop volumineux (max 20 Mo)."}), 413

    user_key = request.headers.get("X-Api-Key") or None

    if not user_key:
        if not quota.check_and_increment():
            return jsonify({"error": (
                "Quota journalier atteint — colle ton texte manuellement "
                "ou ajoute ta propre clé dans ⚙️ Paramètres."
            )}), 429

    def generate():
        try:
            import fitz
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            for page_num in range(len(doc)):
                page = doc[page_num]
                pix = page.get_pixmap(dpi=150)
                img_bytes = pix.tobytes("png")
                for chunk in ai_engine.stream_completion(
                    f"Page {page_num + 1} du CV :",
                    _SYSTEM_PDF_PAGE,
                    images=[img_bytes],
                    api_key=user_key,
                ):
                    yield f"data: {_json_ai.dumps(chunk)}\n\n"
            doc.close()
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: [ERROR] {exc}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 4 : Vérifier que les tests passent**

```bash
python -m pytest tests/test_endpoints.py::test_pdf_to_html_no_file_returns_400 tests/test_endpoints.py::test_pdf_to_html_non_pdf_returns_400 tests/test_endpoints.py::test_pdf_to_html_streams_sse -v
```

Résultat attendu : 3 tests PASSED

- [ ] **Step 5 : Commit**

```bash
git add app.py tests/test_endpoints.py
git commit -m "feat: add /api/pdf-to-html endpoint with page-by-page Gemini Vision"
```

---

## Task 8 : Endpoint /api/tailor

**Files:**
- Modify: `app.py` (ajouter l'endpoint)
- Modify: `tests/test_endpoints.py` (ajouter 3 tests)

- [ ] **Step 1 : Ajouter les tests tailor dans tests/test_endpoints.py**

Ajouter à la fin :

```python
def test_tailor_missing_html_returns_400(client):
    resp = client.post("/api/tailor", json={"job_desc": "Développeur Python"})
    assert resp.status_code == 400


def test_tailor_missing_job_desc_returns_400(client):
    resp = client.post("/api/tailor", json={"html": "<h1>CV</h1>"})
    assert resp.status_code == 400


def test_tailor_streams_sse(client):
    def fake_stream(prompt, system, images=None, api_key=None):
        assert "<h1>CV</h1>" in prompt
        assert "Développeur Python" in prompt
        yield "<h1>CV adapté</h1>"

    with patch("app.ai_engine.stream_completion", side_effect=fake_stream), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post(
            "/api/tailor",
            json={"html": "<h1>CV</h1>", "job_desc": "Développeur Python senior"},
        )

    assert resp.status_code == 200
    body = resp.data.decode()
    assert "CV adapté" in body
    assert "[DONE]" in body
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```bash
python -m pytest tests/test_endpoints.py::test_tailor_missing_html_returns_400 tests/test_endpoints.py::test_tailor_missing_job_desc_returns_400 tests/test_endpoints.py::test_tailor_streams_sse -v
```

Résultat attendu : 3 tests FAILED avec `404 NOT FOUND`

- [ ] **Step 3 : Ajouter l'endpoint /api/tailor dans app.py**

Après la fonction `api_pdf_to_html`, ajouter :

```python

@app.route("/api/tailor", methods=["POST"])
def api_tailor():
    data = request.get_json(force=True) or {}
    html = (data.get("html") or "").strip()
    job_desc = (data.get("job_desc") or "").strip()

    if not html or not job_desc:
        return jsonify({"error": "Le HTML du CV et la description du poste sont requis."}), 400

    user_key = request.headers.get("X-Api-Key") or None

    if not user_key:
        if not quota.check_and_increment():
            return jsonify({"error": (
                "Quota journalier atteint — colle ton texte manuellement "
                "ou ajoute ta propre clé dans ⚙️ Paramètres."
            )}), 429

    prompt = f"CV HTML :\n{html}\n\nOffre d'emploi :\n{job_desc}"

    def generate():
        try:
            for chunk in ai_engine.stream_completion(
                prompt, _SYSTEM_TAILOR, api_key=user_key
            ):
                yield f"data: {_json_ai.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: [ERROR] {exc}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
python -m pytest tests/ -v
```

Résultat attendu : tous les tests PASSED (environ 17-18 tests)

- [ ] **Step 5 : Commit**

```bash
git add app.py tests/test_endpoints.py
git commit -m "feat: add /api/tailor endpoint with SSE streaming"
```

---

## Task 9 : UI — CSS + Panneau Import + Bouton ⚙️

**Files:**
- Modify: `app.py` (variable PAGE — CSS + HTML topbar + HTML panneau import)

- [ ] **Step 1 : Vérifier la structure actuelle de PAGE pour confirmer les points d'insertion**

```bash
python -c "
import app
idx_style = app.PAGE.find('</style>')
idx_topbar_end = app.PAGE.find('</div>', app.PAGE.find('class=\"topbar\"'))
idx_split = app.PAGE.find('class=\"split\"')
idx_tailor_insert = app.PAGE.find('  <details open>')
print('</style> at char:', idx_style)
print('topbar end at char:', idx_topbar_end)
print('.split at char:', idx_split)
print('<details open> at char:', idx_tailor_insert)
"
```

Résultat attendu : 4 positions positives (non -1).

- [ ] **Step 2 : Ajouter le CSS dans PAGE — avant `</style>`**

Dans `app.py`, dans la variable `PAGE`, trouver la ligne :
```
</style>
```
(à la ligne 145 du fichier app.py)

Avant cette ligne, insérer :

```css
  /* ---- Panneau Import ---- */
  #import-panel { border: 1px solid #2a2f3a; border-radius: 8px; background: #14181f; padding: 14px 16px; }
  #import-collapse-bar { display: none; background: #1b1f27; border: 1px solid #2a2f3a; border-radius: 6px; padding: 7px 14px; cursor: pointer; font-size: 12px; color: #9aa0a6; text-align: left; width: 100%; }
  #import-collapse-bar:hover { background: #2a2f3a; color: #e6e6e6; }
  .import-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
  .import-tab { background: transparent; border: 1px solid #2a2f3a; border-radius: 6px; padding: 6px 14px; font-size: 12px; color: #9aa0a6; cursor: pointer; }
  .import-tab.active { background: #2a2f3a; color: #e6e6e6; border-color: #4f8cff; }
  .import-content { display: none; }
  .import-content.active { display: block; }
  #cv-text-input { width: 100%; min-height: 110px; resize: vertical; font-family: monospace; font-size: 12px; margin-bottom: 4px; }
  .import-btn { background: #4f8cff; color: white; border: 0; border-radius: 6px; padding: 7px 18px; font-size: 13px; cursor: pointer; margin-top: 8px; }
  .import-btn:hover { background: #3a7ae0; }
  .import-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .import-status { font-size: 12px; color: #9aa0a6; margin-top: 6px; min-height: 18px; }
  /* ---- Panneau Tailoring ---- */
  #tailor-panel { border: 1px solid #2a2f3a; border-radius: 8px; background: #14181f; overflow: hidden; }
  .tailor-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; cursor: pointer; font-size: 12px; color: #9aa0a6; }
  .tailor-header:hover { background: #1b1f27; }
  .tailor-body { padding: 12px 14px; display: none; }
  .tailor-body.open { display: block; }
  #job-desc-input { width: 100%; min-height: 80px; resize: vertical; font-size: 13px; margin-bottom: 4px; }
  .tailor-btn { background: #f5a623; color: #0f1115; border: 0; border-radius: 6px; padding: 7px 18px; font-size: 13px; cursor: pointer; font-weight: 600; margin-top: 6px; }
  .tailor-btn:hover { background: #e09510; }
  .tailor-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .tailor-status { font-size: 12px; color: #9aa0a6; margin-top: 6px; min-height: 18px; }
  /* ---- Modal Paramètres ---- */
  #modal-settings { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000; align-items: center; justify-content: center; }
  #modal-settings.open { display: flex; }
  .settings-content { background: #1b1f27; border: 1px solid #2a2f3a; border-radius: 12px; padding: 24px; width: 420px; max-width: 95vw; position: relative; }
  .settings-content h2 { margin: 0 0 8px; font-size: 16px; }
  .settings-desc { font-size: 13px; color: #9aa0a6; margin: 0 0 14px; line-height: 1.5; }
  .settings-content input[type=password] { width: 100%; font-family: monospace; font-size: 13px; }
  .settings-actions { display: flex; gap: 8px; margin-top: 12px; }
  .settings-actions button { flex: 1; padding: 8px; border-radius: 6px; border: 0; cursor: pointer; font-size: 13px; }
  #btn-settings-save { background: #4f8cff; color: white; }
  #btn-settings-clear { background: #2a2f3a; color: #e6e6e6; }
  .key-active { font-size: 11px; color: #4caf50; margin-top: 6px; display: none; }
  /* ---- Bouton paramètres topbar ---- */
  #btn-settings { background: transparent; border: 0; color: #9aa0a6; font-size: 15px; cursor: pointer; padding: 4px 6px; border-radius: 4px; line-height: 1; }
  #btn-settings:hover { color: #e6e6e6; background: #2a2f3a; }
```

- [ ] **Step 3 : Ajouter le bouton ⚙️ dans la topbar de PAGE**

Dans `PAGE`, trouver :
```html
      <a href="/history">Historique &rsaquo;</a>
    </div>
  </div>
```

Remplacer par :
```html
      <a href="/history">Historique &rsaquo;</a>
      <button id="btn-settings" type="button" title="Paramètres API">⚙️</button>
    </div>
  </div>
```

- [ ] **Step 4 : Ajouter le panneau import dans PAGE**

Dans `PAGE`, trouver le début de `<div class="meta">` :
```html
  <div class="meta">
```

Avant cette ligne, insérer :

```html
  <!-- Panneau d'import CV (visible au départ, se replie après conversion) -->
  <div id="import-panel">
    <div class="import-tabs">
      <button class="import-tab active" data-tab="text">📋 Coller le texte</button>
      <button class="import-tab" data-tab="pdf">📄 Importer un PDF</button>
    </div>
    <div id="import-tab-text" class="import-content active">
      <textarea id="cv-text-input" placeholder="Colle ici le contenu texte de ton CV (copié depuis Word, PDF, n'importe quoi)..."></textarea>
      <div><button id="btn-text-to-html" class="import-btn" type="button">Convertir en HTML</button></div>
      <div class="import-status" id="import-text-status"></div>
    </div>
    <div id="import-tab-pdf" class="import-content">
      <input type="file" id="pdf-upload-input" accept=".pdf" style="display:none">
      <button id="btn-pdf-pick" class="import-btn" type="button">📁 Choisir un fichier PDF</button>
      <span id="pdf-filename" style="font-size:12px; color:#9aa0a6; margin-left:10px;"></span>
      <div><button id="btn-pdf-to-html" class="import-btn" type="button" disabled>Convertir le PDF</button></div>
      <div class="import-status" id="import-pdf-status"></div>
    </div>
  </div>
  <button id="import-collapse-bar" type="button">▶ Importer un autre CV</button>

```

- [ ] **Step 5 : Vérifier la syntaxe Python (pas de démarrage du serveur)**

```bash
python -m py_compile app.py && echo "Syntaxe OK"
```

Résultat attendu : `Syntaxe OK`

- [ ] **Step 6 : Commit**

```bash
git add app.py
git commit -m "feat: add import panel CSS and HTML to PAGE"
```

---

## Task 10 : UI — Panneau Tailoring + Modal Paramètres HTML

**Files:**
- Modify: `app.py` (variable PAGE — HTML tailoring panel + settings modal)

- [ ] **Step 1 : Ajouter le panneau tailoring dans PAGE**

Dans `PAGE`, trouver :
```html
  <details open>
    <summary>Options PDF (avancées)</summary>
```

Avant cette ligne, insérer :

```html
  <!-- Panneau tailoring (toujours accessible) -->
  <div id="tailor-panel">
    <div class="tailor-header" id="tailor-toggle">
      <span>🎯 Adapter à une offre d'emploi</span>
      <span id="tailor-chevron">▼</span>
    </div>
    <div class="tailor-body" id="tailor-body">
      <textarea id="job-desc-input" placeholder="Colle l'offre d'emploi ici..."></textarea>
      <div><button id="btn-tailor" class="tailor-btn" type="button">Adapter le CV</button></div>
      <div class="tailor-status" id="tailor-status"></div>
    </div>
  </div>

```

- [ ] **Step 2 : Ajouter le modal Paramètres dans PAGE**

Dans `PAGE`, trouver :
```html
<div id="toast-container"></div>
```

Après cette ligne, insérer :

```html

<!-- Modal Paramètres -->
<div id="modal-settings">
  <div class="settings-content">
    <span id="close-settings" style="position:absolute;top:14px;right:16px;cursor:pointer;font-size:18px;color:#9aa0a6;">&times;</span>
    <h2>⚙️ Paramètres</h2>
    <p class="settings-desc">Clé Gemini ou Anthropic personnelle. Jamais stockée sur le serveur — conservée dans ton navigateur uniquement. Pas de limite de quota avec ta propre clé.</p>
    <input type="password" id="settings-api-key" placeholder="AIza… (Gemini) ou sk-ant-… (Anthropic)" autocomplete="off" />
    <div class="key-active" id="key-active-indicator">✓ Clé personnelle active — quota non appliqué</div>
    <div class="settings-actions">
      <button id="btn-settings-save" type="button">Enregistrer</button>
      <button id="btn-settings-clear" type="button">Effacer</button>
    </div>
  </div>
</div>
```

- [ ] **Step 3 : Vérifier la syntaxe**

```bash
python -m py_compile app.py && echo "Syntaxe OK"
```

Résultat attendu : `Syntaxe OK`

- [ ] **Step 4 : Commit**

```bash
git add app.py
git commit -m "feat: add tailoring panel and settings modal HTML to PAGE"
```

---

## Task 11 : UI — JavaScript (streaming, interactions, paramètres)

**Files:**
- Modify: `app.py` (variable PAGE — JS avant `</script>`)

- [ ] **Step 1 : Confirmer que htmlModel est dans la portée globale du script**

`htmlModel` est déclaré `let htmlModel;` à la ligne 744 de `app.py`, dans la portée principale du `<script>`. Il est accessible directement dans tout le script. Pas d'action requise.

- [ ] **Step 2 : Ajouter tout le JavaScript dans PAGE — avant `</script>`**

Dans `PAGE`, trouver la ligne :
```
</script>
```
(c'est la dernière occurrence dans PAGE, à la ligne 1217 du fichier)

Avant cette ligne, insérer :

```javascript

// ============================================================
// Clé API utilisateur (localStorage — jamais envoyée au serveur de façon persistante)
// ============================================================
const STORAGE_KEY_APIKEY = 'userApiKey';

function getUserApiKey() {
  return localStorage.getItem(STORAGE_KEY_APIKEY) || '';
}

function getApiHeaders() {
  const key = getUserApiKey();
  return key ? { 'X-Api-Key': key } : {};
}

// Ouvrir modal Paramètres
document.getElementById('btn-settings').addEventListener('click', () => {
  const key = getUserApiKey();
  document.getElementById('settings-api-key').value = '';
  document.getElementById('key-active-indicator').style.display = key ? '' : 'none';
  document.getElementById('modal-settings').classList.add('open');
});
document.getElementById('close-settings').addEventListener('click', () => {
  document.getElementById('modal-settings').classList.remove('open');
});
document.getElementById('modal-settings').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-settings')) {
    document.getElementById('modal-settings').classList.remove('open');
  }
});
document.getElementById('btn-settings-save').addEventListener('click', () => {
  const val = document.getElementById('settings-api-key').value.trim();
  if (val) {
    localStorage.setItem(STORAGE_KEY_APIKEY, val);
    document.getElementById('key-active-indicator').style.display = '';
    showToast('Clé enregistrée dans votre navigateur.', 'ok');
  }
  document.getElementById('modal-settings').classList.remove('open');
});
document.getElementById('btn-settings-clear').addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY_APIKEY);
  document.getElementById('settings-api-key').value = '';
  document.getElementById('key-active-indicator').style.display = 'none';
  showToast('Clé effacée.', 'ok');
  document.getElementById('modal-settings').classList.remove('open');
});

// ============================================================
// Streaming SSE → Monaco (texte JSON-encodé)
// ============================================================
async function _readSseStream(resp, onChunk) {
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let accumulated = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6);
      if (data === '[DONE]') return accumulated;
      if (data.startsWith('[ERROR]')) throw new Error(data.slice(8).trim() || 'Erreur serveur');
      try {
        const chunk = JSON.parse(data);
        accumulated += chunk;
        if (onChunk) onChunk(accumulated);
      } catch {}
    }
  }
  return accumulated;
}

async function streamToMonaco(url, body, extraHeaders, onChunk) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = 'Erreur serveur';
    try { msg = (await resp.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return _readSseStream(resp, onChunk);
}

async function streamFormToMonaco(url, formData, extraHeaders, onChunk) {
  const resp = await fetch(url, { method: 'POST', headers: extraHeaders, body: formData });
  if (!resp.ok) {
    let msg = 'Erreur serveur';
    try { msg = (await resp.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return _readSseStream(resp, onChunk);
}

// ============================================================
// Panneau Import — gestion des onglets
// ============================================================
document.querySelectorAll('.import-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.import-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('import-tab-' + tab.dataset.tab).classList.add('active');
  });
});

function markCvLoaded() {
  document.getElementById('import-panel').style.display = 'none';
  document.getElementById('import-collapse-bar').style.display = '';
}

document.getElementById('import-collapse-bar').addEventListener('click', () => {
  document.getElementById('import-panel').style.display = '';
  document.getElementById('import-collapse-bar').style.display = 'none';
});

// ============================================================
// Import texte → HTML
// ============================================================
document.getElementById('btn-text-to-html').addEventListener('click', async () => {
  const text = document.getElementById('cv-text-input').value.trim();
  if (!text) { showToast("Colle d'abord le contenu de ton CV.", 'error'); return; }

  const btn = document.getElementById('btn-text-to-html');
  const status = document.getElementById('import-text-status');
  btn.disabled = true;
  status.textContent = '⏳ Conversion en cours…';

  try {
    const html = await streamToMonaco(
      '/api/text-to-html',
      { text },
      getApiHeaders(),
      (partial) => { if (htmlModel) htmlModel.setValue(partial); }
    );
    if (htmlModel) htmlModel.setValue(html);
    markCvLoaded();
    showToast('CV converti en HTML avec succès.', 'ok');
    status.textContent = '';
  } catch (err) {
    showToast(err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Import PDF → HTML
// ============================================================
let _selectedPdfFile = null;

document.getElementById('btn-pdf-pick').addEventListener('click', () => {
  document.getElementById('pdf-upload-input').click();
});

document.getElementById('pdf-upload-input').addEventListener('change', (e) => {
  _selectedPdfFile = e.target.files[0] || null;
  document.getElementById('pdf-filename').textContent = _selectedPdfFile ? _selectedPdfFile.name : '';
  document.getElementById('btn-pdf-to-html').disabled = !_selectedPdfFile;
  e.target.value = '';
});

document.getElementById('btn-pdf-to-html').addEventListener('click', async () => {
  if (!_selectedPdfFile) return;

  const btn = document.getElementById('btn-pdf-to-html');
  const status = document.getElementById('import-pdf-status');
  btn.disabled = true;
  status.textContent = '⏳ Lecture du PDF…';

  const formData = new FormData();
  formData.append('file', _selectedPdfFile);

  try {
    const html = await streamFormToMonaco(
      '/api/pdf-to-html',
      formData,
      getApiHeaders(),
      (partial) => {
        if (htmlModel) htmlModel.setValue(partial);
        status.textContent = `⏳ ${partial.length} caractères générés…`;
      }
    );
    if (htmlModel) htmlModel.setValue(html);
    markCvLoaded();
    showToast('PDF converti en HTML avec succès.', 'ok');
    status.textContent = '';
  } catch (err) {
    showToast(err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
  }
});

// ============================================================
// Tailoring — adapter à une offre
// ============================================================
document.getElementById('tailor-toggle').addEventListener('click', () => {
  const body = document.getElementById('tailor-body');
  const chevron = document.getElementById('tailor-chevron');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  chevron.textContent = isOpen ? '▼' : '▲';
});

document.getElementById('btn-tailor').addEventListener('click', async () => {
  const jobDesc = document.getElementById('job-desc-input').value.trim();
  if (!jobDesc) { showToast("Colle d'abord une offre d'emploi.", 'error'); return; }
  if (typeof htmlModel === 'undefined' || !htmlModel.getValue().trim()) {
    showToast("Charge d'abord un CV dans l'éditeur.", 'error'); return;
  }

  const btn = document.getElementById('btn-tailor');
  const status = document.getElementById('tailor-status');
  btn.disabled = true;
  status.textContent = '⏳ Adaptation en cours…';

  try {
    const adapted = await streamToMonaco(
      '/api/tailor',
      { html: htmlModel.getValue(), job_desc: jobDesc },
      getApiHeaders(),
      (partial) => {
        if (htmlModel) htmlModel.setValue(partial);
        status.textContent = `⏳ ${partial.length} caractères générés…`;
      }
    );
    if (htmlModel) htmlModel.setValue(adapted);
    showToast('CV adapté avec succès.', 'ok');
    status.textContent = '';
  } catch (err) {
    showToast(err.message, 'error');
    status.textContent = '';
  } finally {
    btn.disabled = false;
  }
});
```

- [ ] **Step 3 : Vérifier la syntaxe Python**

```bash
python -m py_compile app.py && echo "Syntaxe OK"
```

Résultat attendu : `Syntaxe OK`

- [ ] **Step 4 : Vérifier que tous les tests Python passent encore**

```bash
python -m pytest tests/ -v
```

Résultat attendu : tous les tests PASSED

- [ ] **Step 5 : Commit**

```bash
git add app.py
git commit -m "feat: add streaming JS, import panel and tailoring panel interactions"
```

---

## Task 12 : Test end-to-end + Variables d'environnement Vercel

**Files:**
- Modify: `.env` (local, créer s'il n'existe pas)

- [ ] **Step 1 : Créer le fichier .env local (si absent)**

Vérifier si `.env` existe :
```bash
ls .env 2>/dev/null || echo "absent"
```

Si absent, créer `.env` avec :
```
GEMINI_API_KEY=ta_cle_google_ai_studio_ici
```

Obtenir une clé gratuite sur : https://aistudio.google.com/apikey

- [ ] **Step 2 : Lancer l'app en local**

```bash
python app.py
```

L'app s'ouvre sur http://127.0.0.1:5050

- [ ] **Step 3 : Tester le workflow complet — Import texte**

1. Sur l'app, coller dans le champ "Coller le texte" :
   ```
   Jean Dupont
   Développeur Full-Stack — Paris
   
   Expériences
   2022-2024 : Senior Dev chez Acme Corp — React, Python, AWS
   2020-2022 : Dev chez StartupXYZ — Vue.js, Django
   
   Compétences : Python, React, TypeScript, Docker, Git
   
   Formation : Master Informatique, Université Paris-Saclay, 2020
   ```
2. Cliquer "Convertir en HTML"
3. Vérifier que le texte HTML apparaît progressivement dans Monaco
4. Vérifier que le panneau import se replie en barre

- [ ] **Step 4 : Tester le workflow tailoring**

1. Cliquer sur "🎯 Adapter à une offre d'emploi" pour ouvrir le panneau
2. Coller dans le champ :
   ```
   Nous recherchons un développeur Python senior pour rejoindre notre équipe cloud.
   Stack : Python, FastAPI, AWS Lambda, Docker. Expérience CI/CD requise.
   ```
3. Cliquer "Adapter le CV"
4. Vérifier que Monaco se met à jour progressivement avec le CV adapté

- [ ] **Step 5 : Tester le modal Paramètres**

1. Cliquer sur ⚙️ en haut à droite
2. Entrer une fausse clé : `AIzaTestKey123`
3. Cliquer Enregistrer — vérifier le toast "Clé enregistrée"
4. Rouvrir les paramètres — vérifier que "✓ Clé personnelle active" s'affiche
5. Cliquer Effacer — vérifier le toast "Clé effacée"

- [ ] **Step 6 : Ajouter la variable GEMINI_API_KEY sur Vercel**

```bash
npx vercel env add GEMINI_API_KEY production
```

Ou via le dashboard Vercel : Settings → Environment Variables → Add → `GEMINI_API_KEY`

- [ ] **Step 7 : Déployer sur Vercel**

```bash
npx vercel --prod
```

- [ ] **Step 8 : Tester la conversion texte sur Vercel**

Ouvrir l'URL de production, répéter le test de l'étape 3 pour vérifier que le streaming fonctionne en production.

- [ ] **Step 9 : Commit et push final**

```bash
git add .env.example  # créer .env.example avec GEMINI_API_KEY=your_key_here (sans la vraie clé)
git commit -m "feat: complete AI import and tailoring feature — text, PDF, and job adaptation"
git push
```

---

## Résumé des commits attendus

1. `deps: add pymupdf, google-generativeai, anthropic`
2. `feat: add daily quota module with tests`
3. `feat: add ai_engine with Gemini text streaming`
4. `test: add vision and Anthropic tests for ai_engine`
5. `test: add Anthropic streaming test`
6. `feat: add /api/text-to-html endpoint with SSE streaming`
7. `feat: add /api/pdf-to-html endpoint with page-by-page Gemini Vision`
8. `feat: add /api/tailor endpoint with SSE streaming`
9. `feat: add import panel CSS and HTML to PAGE`
10. `feat: add tailoring panel and settings modal HTML to PAGE`
11. `feat: add streaming JS, import panel and tailoring panel interactions`
12. `feat: complete AI import and tailoring feature`
