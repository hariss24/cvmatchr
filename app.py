"""
Convertisseur HTML/CSS -> PDF (interface web locale).

Utilisation :
    Double-cliquez sur ce fichier. Le navigateur s'ouvre sur http://127.0.0.1:5050

Pour quitter :
    Cliquez sur le bouton "Quitter" dans la petite fenetre de controle.
"""

import io
import json as _json
import logging as _logging
import os
import secrets
import socket
import sys
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlparse

try:
    import tkinter as tk
    _HAS_TKINTER = True
except ImportError:
    _HAS_TKINTER = False

from flask import (
    Flask, Response, abort, jsonify, redirect,
    render_template, request, send_file, session, stream_with_context,
)

from prompts import (
    _SYSTEM_CV_IMPORT, _SYSTEM_LETTRE_IMPORT,
    _PRESERVE_RULE, _ELAGUE_RULE, _TAILOR_SYSTEMS, _COMMON_HTML_RULES
)
from scraper import _validate_url, _scrape_job_text
import archive
from pdf_engine import html_to_pdf_bytes, VALID_FORMATS, VALID_MARGINS
import ai_engine
import quota
import json as _json_ai
from werkzeug.middleware.proxy_fix import ProxyFix

_logger = _logging.getLogger(__name__)

PORT = 5050
URL  = f"http://127.0.0.1:{PORT}"
MAX_HTML_BYTES = 8 * 1024 * 1024   # 8 Mo
MAX_PDF_BYTES  = 20 * 1024 * 1024  # 20 Mo

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)

if os.environ.get("APP_MODE", "").lower() == "remote" or bool(os.environ.get("RENDER")):
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)




# ---- Jeton CSRF léger -------------------------------------------------------
# Les endpoints JSON (Content-Type: application/json) sont implicitement sûrs
# contre le CSRF car les navigateurs ne peuvent pas envoyer ce content-type
# depuis une autre origine via un formulaire HTML.
# Les requêtes multipart (upload PDF) vérifient le header X-CSRF-Token.

def _get_csrf_token() -> str:
    if "_csrf" not in session:
        session["_csrf"] = secrets.token_hex(32)
    return session["_csrf"]

# Expose csrf_token() aux templates Jinja2
app.jinja_env.globals["csrf_token"] = _get_csrf_token


@app.before_request
def _csrf_protect() -> None:
    if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
        return
    ct = request.content_type or ""
    if "application/json" in ct:
        return  # safe : Content-Type non-simple bloque le CSRF cross-origin
    # Tout autre Content-Type (multipart, form, text/plain) peut être envoyé
    # cross-origin sans préflight : il DOIT présenter un jeton CSRF valide.
    client_token = request.headers.get("X-CSRF-Token", "")
    server_token = session.get("_csrf", "")
    if not server_token or not secrets.compare_digest(client_token, server_token):
        abort(403)


# ---------------------------------------------------------------------------
# Authentification (mode "remote" uniquement)
# ---------------------------------------------------------------------------
# En local (lancement desktop) : aucune authentification.
# En remote (APP_MODE=remote ou variable RENDER présente) : tout est protégé
# par un mot de passe unique (REMOTE_AUTH_PASSWORD), sauf la page de connexion.

_PAGE_PATHS = {"/", "/history"}            # requêtes "navigateur" → redirige vers /login
_AUTH_EXEMPT_PATHS = {"/login", "/logout"}

_LOGIN_MAX_FAILURES = 10
_LOGIN_WINDOW_S = 900  # 15 minutes
_login_attempts: dict[str, list[float]] = {}
_login_lock = threading.Lock()


def _is_remote_mode() -> bool:
    return os.environ.get("APP_MODE", "").lower() == "remote" or bool(os.environ.get("RENDER"))


def _remote_password() -> str:
    return os.environ.get("REMOTE_AUTH_PASSWORD") or os.environ.get("AUTH_PASSWORD") or ""


def _login_rate_limit_ok() -> bool:
    """True si l'IP courante n'a pas dépassé le nombre d'échecs autorisés."""
    ip = request.remote_addr or "unknown"
    now = time.time()
    with _login_lock:
        recent = [t for t in _login_attempts.get(ip, []) if now - t < _LOGIN_WINDOW_S]
        _login_attempts[ip] = recent
        return len(recent) < _LOGIN_MAX_FAILURES


def _record_login_failure() -> None:
    ip = request.remote_addr or "unknown"
    with _login_lock:
        _login_attempts.setdefault(ip, []).append(time.time())


@app.before_request
def _auth_protect():
    if not _is_remote_mode():
        return
    if request.path.startswith("/static/") or request.path in _AUTH_EXEMPT_PATHS:
        return
    if session.get("_authed"):
        return
    if not _remote_password():
        return jsonify({
            "error": "Le serveur remote n'a pas de mot de passe configuré "
                     "(REMOTE_AUTH_PASSWORD)."
        }), 503
    if request.method == "GET" and request.path in _PAGE_PATHS:
        return redirect("/login?next=" + quote(request.path, safe="/"))
    return jsonify({"error": "Authentication required."}), 401


@app.route("/login", methods=["GET", "POST"])
def login():
    if not _is_remote_mode():
        return redirect("/")
    if request.method == "GET":
        return render_template("login.html")

    password = _remote_password()
    if not password:
        return jsonify({
            "error": "Le serveur remote n'a pas de mot de passe configuré "
                     "(REMOTE_AUTH_PASSWORD)."
        }), 503
    if not _login_rate_limit_ok():
        return jsonify({"error": "Trop de tentatives. Réessayez plus tard."}), 429

    data = request.get_json(silent=True) or {}
    if not secrets.compare_digest(str(data.get("password", "")), password):
        _record_login_failure()
        return jsonify({"error": "Invalid password."}), 401

    session["_authed"] = True
    return jsonify({"ok": True}), 200


@app.route("/logout", methods=["POST"])
def logout():
    session.pop("_authed", None)
    return jsonify({"ok": True}), 200


# ---------------------------------------------------------------------------
# Pages HTML
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/history")
def history_page():
    return render_template("history.html")


# ---------------------------------------------------------------------------
# Conversion PDF
# ---------------------------------------------------------------------------

@app.route("/convert", methods=["POST"])
def convert():
    if request.content_length and request.content_length > MAX_HTML_BYTES:
        return jsonify({"error": f"Corps de requête trop grand (max {MAX_HTML_BYTES // 1024} Ko)."}), 413

    data = request.get_json(silent=True) or {}
    html = data.get("html", "")
    if not html.strip():
        return jsonify({"error": "HTML vide."}), 400
    if len(html.encode()) > MAX_HTML_BYTES:
        return jsonify({"error": "HTML trop grand."}), 413

    fmt    = data.get("format", "A4")
    margin = data.get("margin", "0")
    if fmt not in VALID_FORMATS:
        return jsonify({"error": f"Format invalide : {fmt!r}. Valeurs acceptées : {sorted(VALID_FORMATS)}"}), 400
    if margin not in VALID_MARGINS:
        return jsonify({"error": f"Marge invalide : {margin!r}. Valeurs acceptées : {sorted(VALID_MARGINS)}"}), 400

    background      = bool(data.get("background", True))
    doc_type        = data.get("doc_type", "CV")
    company         = (data.get("company") or "").strip()
    role            = (data.get("role") or "").strip()
    custom_filename = (data.get("filename") or "").strip()

    try:
        pdf_bytes = html_to_pdf_bytes(html, page_format=fmt, margin=margin, background=background)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({
            "error": f"Erreur de rendu PDF : {e}",
            "hint": "Vérifiez que le HTML est valide et ne contient pas de ressources externes bloquées.",
        }), 500

    # Générer les métadonnées de téléchargement (pas de persistance serveur)
    when = datetime.now()
    doc_type_safe = doc_type if doc_type in archive.DOC_TYPES else "Autre"
    filename = (
        archive._safe_filename(custom_filename)
        if custom_filename
        else archive.make_filename(doc_type_safe, company, role, when)
    )
    entry = {
        "id":         str(uuid.uuid4()),
        "filename":   filename,
        "created_at": when.isoformat(timespec="seconds"),
    }

    response = send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=entry["filename"],
    )
    response.headers["X-Archive-Entry"] = _json.dumps({
        "id":         entry.get("id", ""),
        "filename":   entry.get("filename", "document.pdf"),
        "created_at": entry.get("created_at", ""),
    })
    response.headers["Access-Control-Expose-Headers"] = "X-Archive-Entry"
    return response


# ---------------------------------------------------------------------------
# Historique — fallback fichiers locaux (anciens CVs pré-migration IDB)
# ---------------------------------------------------------------------------

@app.route("/api/history/<doc_id>/html", methods=["GET"])
def history_html(doc_id: str):
    """Sert le fichier HTML d'un document archivé sur disque.

    Utilisé comme fallback quand le navigateur n'a pas le contenu dans IndexedDB
    (entrées créées avant la migration vers le stockage 100 % navigateur).
    """
    doc = archive.get_document(doc_id)
    if not doc:
        return jsonify({"error": "Document introuvable."}), 404
    html_path_str = doc.get("html_path", "")
    if not html_path_str:
        return jsonify({"error": "Chemin HTML absent de l'entrée."}), 404
    html_path = Path(html_path_str)
    if not html_path.exists():
        return jsonify({"error": "Fichier HTML introuvable sur le disque."}), 404
    return send_file(str(html_path), mimetype="text/html; charset=utf-8")


# ---------------------------------------------------------------------------
# API IA
# ---------------------------------------------------------------------------



def _stream_ai(generator_fn):
    """Wrapper SSE commun pour tous les endpoints IA."""
    return Response(
        stream_with_context(generator_fn()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _check_quota(user_key: str | None) -> Response | None:
    """Retourne une réponse d'erreur si le quota est dépassé, None sinon."""
    if not user_key and not quota.check_and_increment():
        return jsonify({"error": (
            "Quota journalier atteint. Colle ton texte manuellement "
            "ou ajoute ta propre clé dans les paramètres."
        )}), 429
    return None


@app.route("/api/status", methods=["GET"])
def api_status():
    key = os.environ.get("GEMINI_API_KEY", "")
    return jsonify({
        "server_key_configured": bool(key),
        "server_key_preview":    (key[:4] + "…") if key else None,
        "quota_remaining":       quota.remaining(),
        "quota_limit":           quota.DAILY_LIMIT,
    })


@app.route("/api/text-to-html", methods=["POST"])
def api_text_to_html():
    data     = request.get_json(silent=True) or {}
    text     = (data.get("text") or "").strip()
    doc_type = (data.get("doc_type") or "CV").strip()
    if not text:
        return jsonify({"error": "Texte vide."}), 400
    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    system = _SYSTEM_LETTRE_IMPORT if doc_type == "Lettre" else _SYSTEM_CV_IMPORT

    def generate():
        try:
            for chunk in ai_engine.stream_completion(text, system, api_key=user_key):
                yield f"data: {_json_ai.dumps(chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            if not user_key:
                quota.decrement()
            yield f"data: [ERROR] {exc}\n\n"

    return _stream_ai(generate)


@app.route("/api/pdf-to-html", methods=["POST"])
def api_pdf_to_html():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu."}), 400
    f = request.files["file"]
    if not f.filename or not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Le fichier doit être un PDF (.pdf)."}), 400
    pdf_bytes = f.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        return jsonify({"error": "PDF trop volumineux (max 20 Mo)."}), 413

    doc_type = (request.form.get("doc_type") or "CV").strip()
    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    system = _SYSTEM_LETTRE_IMPORT if doc_type == "Lettre" else _SYSTEM_CV_IMPORT

    def generate():
        import fitz
        doc = None
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            images = []
            for page_num in range(len(doc)):
                pix = doc[page_num].get_pixmap(dpi=150)
                images.append(pix.tobytes("png"))
            n = len(images)
            prompt = (
                f"Voici le document en {n} page{'s' if n > 1 else ''}. "
                "Remplis le squelette avec TOUTES les informations visibles. "
                "N'omet AUCUN détail : descriptions de formations, spécialités, sous-matières, "
                "réalisations des expériences, dates précises, coordonnées complètes."
            )
            for chunk in ai_engine.stream_completion(prompt, system, images=images, api_key=user_key):
                yield f"data: {_json_ai.dumps(chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            if not user_key:
                quota.decrement()
            yield f"data: [ERROR] {exc}\n\n"
        finally:
            if doc is not None:
                doc.close()

    return _stream_ai(generate)


@app.route("/api/tailor", methods=["POST"])
def api_tailor():
    data     = request.get_json(silent=True) or {}
    html     = (data.get("html") or "").strip()
    job_desc = (data.get("job_desc") or "").strip()
    level    = (data.get("level") or "adapte").strip()
    is_master = bool(data.get("is_master", False))
    if level not in _TAILOR_SYSTEMS:
        level = "adapte"
    if not html or not job_desc:
        return jsonify({"error": "Le HTML du CV et la description du poste sont requis."}), 400

    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    system_prompt = _TAILOR_SYSTEMS[level] + _COMMON_HTML_RULES
    if is_master:
        system_prompt = system_prompt.replace(_PRESERVE_RULE, _ELAGUE_RULE)
        # Assouplir les interdictions strictes qui contredisent l'élagage
        system_prompt = system_prompt.replace("INTERDIT : inventer ou supprimer des compétences,", "INTERDIT : inventer des compétences (mais tu peux en supprimer),")
        system_prompt = system_prompt.replace("supprimer la section langues ou retirer une seule langue (toutes doivent rester),", "")
        system_prompt = system_prompt.replace("supprimer ou modifier la section centres d'intérêt,", "")
        system_prompt = system_prompt.replace("toucher à la section langues (doit rester intacte avec TOUTES les langues listées),", "")
        system_prompt = system_prompt.replace("toucher à la section centres d'intérêt (doit rester intacte),", "")

    prompt = f"CV HTML :\n{html}\n\nOffre d'emploi :\n{job_desc}"

    def generate():
        try:
            for chunk in ai_engine.stream_completion(prompt, system_prompt, api_key=user_key):
                yield f"data: {_json_ai.dumps(chunk, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            if not user_key:
                quota.decrement()
            yield f"data: [ERROR] {exc}\n\n"

    return _stream_ai(generate)


_MAX_CHAT_PAYLOAD = 1_000_000  # 1 Mo


@app.route("/api/editor-chat", methods=["POST"])
def api_editor_chat():
    if request.content_length and request.content_length > _MAX_CHAT_PAYLOAD:
        return jsonify({"error": "Payload trop grand (max 1 Mo)."}), 413

    data       = request.get_json(silent=True) or {}
    html       = (data.get("html")       or "").strip()
    css        = (data.get("css")        or "").strip()
    messages   = data.get("messages")   or []
    doc_type   = (data.get("doc_type")   or "CV").strip()
    job_desc   = (data.get("job_desc")   or "").strip()
    active_tab = (data.get("active_tab") or "html").strip()

    if not html:
        return jsonify({"error": "Le HTML du document est requis."}), 400
    if not messages or not isinstance(messages, list):
        return jsonify({"error": "Le champ 'messages' (liste non vide) est requis."}), 400
    if len(html.encode()) + len(css.encode()) > _MAX_CHAT_PAYLOAD:
        return jsonify({"error": "Document trop grand pour le chat IA (max 1 Mo)."}), 413

    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    try:
        result = ai_engine.complete_chat(
            messages=messages,
            html=html,
            css=css,
            doc_type=doc_type,
            job_desc=job_desc,
            active_tab=active_tab,
            api_key=user_key,
        )
    except ValueError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": f"Erreur IA : {exc}"}), 500

    return jsonify(result)


@app.route("/api/ats-score", methods=["POST"])
def api_ats_score():
    if request.content_length and request.content_length > _MAX_CHAT_PAYLOAD:
        return jsonify({"error": "Payload trop grand (max 1 Mo)."}), 413

    data     = request.get_json(silent=True) or {}
    html     = (data.get("html") or "").strip()
    job_desc = (data.get("job_desc") or "").strip()
    if not html or not job_desc:
        return jsonify({"error": "Le HTML du CV et la description du poste sont requis."}), 400

    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    try:
        result = ai_engine.score_ats(cv_html=html, job_desc=job_desc, api_key=user_key)
    except ValueError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": f"Erreur IA : {exc}"}), 500

    return jsonify(result)


@app.route("/api/generate-pack", methods=["POST"])
def api_generate_pack():
    if request.content_length and request.content_length > _MAX_CHAT_PAYLOAD:
        return jsonify({"error": "Payload trop grand (max 1 Mo)."}), 413

    data     = request.get_json(silent=True) or {}
    html     = (data.get("html") or "").strip()
    css      = (data.get("css") or "").strip()
    job_desc = (data.get("job_desc") or "").strip()
    company  = (data.get("company") or "").strip()
    role     = (data.get("role") or "").strip()
    if not html or not job_desc:
        return jsonify({"error": "Le HTML du CV et la description du poste sont requis."}), 400
    if len(html.encode()) + len(css.encode()) > _MAX_CHAT_PAYLOAD:
        return jsonify({"error": "Document trop grand (max 1 Mo)."}), 413

    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    try:
        result = ai_engine.generate_pack(
            cv_html=html, cv_css=css, job_desc=job_desc,
            company=company, role=role, api_key=user_key,
        )
    except ValueError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": f"Erreur IA : {exc}"}), 500

    return jsonify(result)


@app.route("/api/tailor-resume", methods=["POST"])
def api_tailor_resume():
    if request.content_length and request.content_length > _MAX_CHAT_PAYLOAD:
        return jsonify({"error": "Payload trop grand (max 1 Mo)."}), 413

    data     = request.get_json(silent=True) or {}
    resume   = data.get("resume")
    job_desc = (data.get("job_desc") or "").strip()
    level    = (data.get("level") or "adapte").strip()
    if level not in ("peu", "adapte", "hyper", "sur-mesure"):
        level = "adapte"
    if not isinstance(resume, dict) or not job_desc:
        return jsonify({"error": "Le CV structuré (resume) et l'offre d'emploi sont requis."}), 400

    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    try:
        result = ai_engine.tailor_resume(resume, job_desc, level, api_key=user_key)
    except ValueError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": f"Erreur IA : {exc}"}), 500

    return jsonify(result)


@app.route("/api/pdf-to-resume", methods=["POST"])
def api_pdf_to_resume():
    if "file" not in request.files:
        return jsonify({"error": "Aucun fichier reçu."}), 400
    f = request.files["file"]
    if not f.filename or not f.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Le fichier doit être un PDF (.pdf)."}), 400
    pdf_bytes = f.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        return jsonify({"error": "PDF trop volumineux (max 20 Mo)."}), 413

    user_key = (request.headers.get("X-Api-Key") or "").strip() or None
    err = _check_quota(user_key)
    if err:
        return err

    import fitz
    doc = None
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        images = [doc[i].get_pixmap(dpi=150).tobytes("png") for i in range(len(doc))]
    except Exception as exc:
        if doc is not None:
            doc.close()
        return jsonify({"error": f"PDF illisible : {exc}"}), 400
    finally:
        if doc is not None:
            doc.close()

    try:
        result = ai_engine.pdf_to_resume(images, api_key=user_key)
    except ValueError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
        if not user_key:
            quota.decrement()
        return jsonify({"error": f"Erreur IA : {exc}"}), 500

    return jsonify(result)



@app.route("/api/extract-job", methods=["POST"])
def api_extract_job():
    data = request.get_json(silent=True) or {}
    url = (data.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL vide."}), 400

    clean_url, err = _validate_url(url)
    if err:
        return jsonify({"error": err}), 400

    try:
        text, title = _scrape_job_text(clean_url)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 429
    except ValueError as e:
        if str(e) == "BLOCKED":
            domain = urlparse(clean_url).hostname or ""
            domain = domain.replace("www.", "")
            return jsonify({"error": f"La requête a été bloquée par le système de protection anti-bot de {domain}. Collez le contenu de l'offre directement dans le champ de texte."}), 422
        return jsonify({"error": str(e)}), 400
    except Exception:
        _logger.exception("Erreur scraping url=%s", clean_url)
        return jsonify({"error": "Impossible d'extraire la page."}), 502

    if not text:
        return jsonify({"error": "Aucun contenu trouvé. La page requiert peut-être une connexion."}), 422

    return jsonify({"text": text, "title": title})


# ---------------------------------------------------------------------------
# Lanceur local (desktop)
# ---------------------------------------------------------------------------

def _wait_for_port(port: int, host: str = "127.0.0.1", timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.1):
                return
        except OSError:
            time.sleep(0.05)


def lancer_serveur() -> None:
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)


def lancer_navigateur() -> None:
    _wait_for_port(PORT)
    webbrowser.open(URL)


def fenetre_controle() -> None:
    if not _HAS_TKINTER:
        print(f"Serveur disponible sur {URL}  (Ctrl-C pour quitter)")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            sys.exit(0)
        return

    root = tk.Tk()
    root.title("Convertisseur HTML -> PDF")
    root.resizable(False, False)
    largeur, hauteur = 360, 160
    x = (root.winfo_screenwidth()  - largeur) // 2
    y = (root.winfo_screenheight() - hauteur) // 2
    root.geometry(f"{largeur}x{hauteur}+{x}+{y}")

    tk.Label(root, text="Le serveur tourne sur :", pady=8).pack()
    lien = tk.Label(root, text=URL, fg="#1a73e8", cursor="hand2", font=("Segoe UI", 10, "underline"))
    lien.pack()
    lien.bind("<Button-1>", lambda _e: webbrowser.open(URL))
    tk.Label(root, text="Fermez cette fenetre pour arreter.", fg="#666", pady=8).pack()

    def quitter() -> None:
        root.destroy()
        sys.exit(0)

    tk.Button(root, text="Quitter", width=14, command=quitter).pack(pady=6)
    root.protocol("WM_DELETE_WINDOW", quitter)
    root.mainloop()


def main() -> None:
    archive.ensure_archive_dir()
    threading.Thread(target=lancer_serveur,    daemon=True).start()
    threading.Thread(target=lancer_navigateur, daemon=True).start()
    fenetre_controle()


if __name__ == "__main__":
    main()
