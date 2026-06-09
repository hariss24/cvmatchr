"""
Convertisseur HTML/CSS -> PDF (interface web locale).

Utilisation :
    Double-cliquez sur ce fichier. Le navigateur s'ouvre sur http://127.0.0.1:5050

Pour quitter :
    Cliquez sur le bouton "Quitter" dans la petite fenetre de controle.
"""

import io
import ipaddress
import json as _json
import logging as _logging
import os
import re as _re
import secrets
import socket
import sys
import threading
import time
import uuid
import webbrowser
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

try:
    import tkinter as tk
    _HAS_TKINTER = True
except ImportError:
    _HAS_TKINTER = False

from flask import (
    Flask, Response, abort, jsonify, redirect,
    render_template, request, send_file, session, stream_with_context,
)

import archive
from pdf_engine import html_to_pdf_bytes, VALID_FORMATS, VALID_MARGINS
import ai_engine
import quota
import json as _json_ai

PORT = 5050
URL  = f"http://127.0.0.1:{PORT}"
MAX_HTML_BYTES = 8 * 1024 * 1024   # 8 Mo
MAX_PDF_BYTES  = 20 * 1024 * 1024  # 20 Mo

# ---------------------------------------------------------------------------
# Flask app
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)




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
    notes           = (data.get("notes") or "").strip()
    job_desc        = (data.get("job_desc") or "").strip()
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

_CV_HTML_SKELETON = """\
<div class="resume-template-1 resume-template-renderer">

  <section class="resume-template-renderer-section personal-data">
    <h2 class="resume-template-renderer-section__title">Informations personnelles</h2>
    <div class="personal-data__photo" style="background:#eee;">
      <!-- URL_DE_VOTRE_PHOTO_ICI -->
    </div>
    <div class="personal-data__title-row">
      <span class="personal-data__name">Prenom Nom</span><span class="personal-data__desired-job-title">Titre du poste</span>
    </div>
    <div class="personal-data__contact-row">
      Ville, Pays &middot; email@example.com &middot; +33 6 00 00 00 00 &middot; linkedin.com/in/profil
    </div></section>

  <section class="resume-template-renderer-section summary-objective">
    <h2 class="resume-template-renderer-section__title summary-objective__title">A propos</h2>
    <div class="summary-objective__content">
      Bref resume professionnel.
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Experience</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Poste occupe</span>
      <span class="entry-list__date">Jan 2024 - Present</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Entreprise</span><span class="entry-list__location">Ville</span>
      </div>
      <div class="entry-list__description">
        <ul>
          <li>Realisation.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Formation</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Diplome</span>
      <span class="entry-list__date">2020 - 2022</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Etablissement</span><span class="entry-list__location">Ville</span>
      </div>
      <div class="entry-list__description">
        <p>Description, specialites ou matieres principales.</p>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Competences</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Competence 1</span>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Projets</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Nom du projet</span>
      <span class="entry-list__date">2024</span>
      <div class="entry-list__description">
        <p>Description du projet.</p>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Certifications</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Certification 1</span>
    </div>
  </section>

  <section class="resume-template-renderer-section entry-list">
    <h2 class="resume-template-renderer-section__title">Benevolat</h2>
    <div class="entry-list__item">
      <span class="entry-list__title">Role</span>
      <span class="entry-list__date">2023 - 2024</span>
      <div class="entry-list__company-row">
        <span class="entry-list__subtitle">Organisation</span><span class="entry-list__location">Ville</span>
      </div>
      <div class="entry-list__description">
        <ul>
          <li>Activite.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section languages">
    <h2 class="resume-template-renderer-section__title">Langues</h2>
    <div class="languages__items">
      <div class="languages__item">
        <span class="languages__name">Francais</span>
        <span class="languages__description">Natif</span>
      </div>
    </div>
  </section>

  <section class="resume-template-renderer-section plain-list">
    <h2 class="resume-template-renderer-section__title">Centres d'interet</h2>
    <div class="plain-list__items">
      <span class="plain-list__item">Interet 1</span>
    </div>
  </section>

</div>"""

_LETTRE_SKELETON = """\
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Lettre de Motivation</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Helvetica", "Arial", sans-serif; font-size: 9.5pt; line-height: 1.6; color: #333; padding: 48px 58px 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 36px; }
    .sender strong, .recipient strong { font-size: 10.5pt; color: #000; }
    .sender p, .recipient p { margin-top: 2px; color: #555; font-size: 9pt; }
    .recipient { text-align: right; }
    .subject { font-weight: 600; font-size: 9.5pt; color: #000; margin-bottom: 24px; border-bottom: 2px solid #c9c6c1; padding-bottom: 8px; }
    .salutation { margin-bottom: 16px; }
    .body p { margin-bottom: 16px; text-align: justify; }
    .closing { margin-top: 32px; }
    .closing p { margin-bottom: 6px; }
    .signature { margin-top: 24px; font-weight: 600; font-size: 10pt; color: #000; }
  </style>
</head>
<body>
  <div class="header">
    <div class="sender">
      <strong>Prenom Nom</strong>
      <p>Titre du poste</p>
      <p>Ville, Pays</p>
      <p>+33 6 00 00 00 00</p>
      <p>email@example.com</p>
    </div>
    <div class="recipient">
      <strong>A l'attention du responsable de recrutement</strong>
      <p>Ville, le JJ mois AAAA</p>
    </div>
  </div>
  <div class="subject">Objet : Candidature au poste de [Poste]</div>
  <div class="salutation">Madame, Monsieur,</div>
  <div class="body">
    <p>Paragraphe d'introduction.</p>
    <p>Paragraphe sur les competences et experiences.</p>
    <p>Paragraphe de conclusion.</p>
  </div>
  <div class="closing">
    <p>Je vous adresse mes sinceres salutations,</p>
  </div>
  <div class="signature">Prenom Nom</div>
</body>
</html>"""

_SYSTEM_CV_IMPORT = (
    "Tu reçois le contenu d'un CV (texte ou image). Remplis ce squelette HTML avec les données du CV fourni.\n\n"
    "RÈGLES — RESPECTE-LES À LA LETTRE :\n"
    "1. Conserve EXACTEMENT la structure HTML et toutes les classes CSS du squelette. Ne les modifie jamais.\n"
    "2. Remplace uniquement le contenu textuel par les données réelles du CV.\n"
    "3. Blocs répétables — inclus TOUS les éléments du CV, sans en omettre aucun :\n"
    "   • entry-list__item : un bloc par expérience, par diplôme, par projet, par activité bénévole\n"
    "     → Pour chaque diplôme/projet : inclus la description dans entry-list__description si présente dans le CV.\n"
    "     → Pour chaque expérience/bénévolat : inclus TOUTES les réalisations dans entry-list__description.\n"
    "   • plain-list__item : un <span> par compétence, par certification, par centre d'intérêt\n"
    "   • languages__item : un bloc par langue\n"
    "4. Si une section est absente du CV (pas de projets, pas de certifications, pas de bénévolat,\n"
    "   pas de centres d'intérêt, pas de résumé, pas de langues…), omets la section entière.\n"
    "5. Sous-éléments optionnels — si un sous-élément du squelette (entry-list__description, entry-list__company-row…)\n"
    "   n'a pas de contenu correspondant dans le CV, supprime entièrement cette balise.\n"
    "   Ne laisse jamais de balise vide ni de texte placeholder.\n"
    "6. N'ajoute AUCUNE balise <style>, AUCUN attribut style inline (sauf style=\"background:#eee;\" déjà présent).\n"
    "7. Laisse <!-- URL_DE_VOTRE_PHOTO_ICI --> exactement tel quel, sans le modifier.\n"
    "8. Retourne UNIQUEMENT le HTML rempli, sans balise markdown, sans commentaire, sans explication.\n\n"
    "Squelette à remplir :\n" + _CV_HTML_SKELETON
)

_SYSTEM_LETTRE_IMPORT = (
    "Tu reçois le contenu d'une lettre de motivation (texte ou image). Remplis ce squelette HTML.\n\n"
    "RÈGLES — RESPECTE-LES À LA LETTRE :\n"
    "1. Conserve EXACTEMENT la structure HTML, toutes les classes CSS, et la balise <style> du squelette.\n"
    "2. Remplace uniquement le contenu textuel par les données réelles de la lettre.\n"
    "3. Ne modifie PAS les styles CSS.\n"
    "4. Retourne le document HTML COMPLET (DOCTYPE inclus), sans markdown, sans commentaire.\n\n"
    "Squelette à remplir :\n" + _LETTRE_SKELETON
)

_PRESERVE_RULE = (
    "RÈGLE PRIMORDIALE — PRÉSERVATION INTÉGRALE : "
    "Tu dois retourner la TOTALITÉ du CV sans exception. "
    "Il est ABSOLUMENT INTERDIT de supprimer, omettre ou masquer une seule section, "
    "expérience, compétence, langue, formation ou centre d'intérêt présent dans le CV original. "
    "Chaque section du CV original doit être présente dans ta réponse. "
    "Tu adaptes le contenu — tu ne supprimes JAMAIS. "
)

_ELAGUE_RULE = (
    "RÈGLE DE SÉLECTION (CV MAÎTRE) : "
    "Tu reçois un CV 'Maître' exhaustif qui contient tout l'historique du candidat. "
    "Ton rôle est d'ÉLAGUER et de SÉLECTIONNER uniquement ce qui est pertinent pour l'offre d'emploi. "
    "Tu DOIS SUPPRIMER les expériences, compétences, ou projets qui n'ont aucun rapport avec le poste visé "
    "pour que le CV final soit concis, percutant et tienne sur 1 à 2 pages maximum. "
    "Conserve et mets en valeur ce qui est utile, retire le reste. "
)

_TAILOR_SYSTEMS = {
    "peu": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : SUBTIL (peu adapté). "
        "Tu peux UNIQUEMENT modifier : "
        "(1) le titre/tagline sous le nom (pour refléter le poste visé de façon générique) ; "
        "(2) la section résumé/accroche pour l'orienter vers ce type de poste avec 2-3 mots-clés naturels. "
        "Le résumé doit rester générique : il reflète le profil du candidat orienté vers ce type de poste, "
        "PAS une candidature spécifique à une entreprise. "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "INTERDIT : toucher aux compétences (ni en ajouter, ni en retirer, ni les réordonner), "
        "modifier les descriptions de postes ou les listes à puces des expériences, "
        "supprimer ou modifier les langues, les centres d'intérêt, la formation, "
        "les dates, les entreprises du parcours, les intitulés de poste. "
        "Le CV doit rester à 95% identique à l'original."
    ),
    "adapte": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : MODÉRÉ (adapté). "
        "Tu peux : "
        "(1) ajuster le titre/tagline sous le nom pour refléter le poste visé de façon générique ; "
        "(2) réécrire le résumé/accroche pour ce type de poste ; "
        "(3) réordonner les compétences existantes pour mettre les plus pertinentes en premier "
        "(SANS EN AJOUTER NI EN SUPPRIMER) ; "
        "(4) enrichir et reformuler les puces des expériences existantes (maximum 4 puces par expérience). "
        "Pour les puces : développe et enrichis ce qui est déjà écrit (ajoute contexte, métriques si disponibles "
        "dans le reste du CV), mais ne fabrique pas de contenu absent du CV original. "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "Le résumé doit rester générique : profil orienté vers ce type de poste, pas une candidature nominative. "
        "INTERDIT : inventer ou supprimer des compétences, "
        "toucher à la section langues (doit rester intacte avec TOUTES les langues listées), "
        "toucher à la section centres d'intérêt (doit rester intacte), "
        "modifier les dates, entreprises du parcours, intitulés de poste ou diplômes."
    ),
    "hyper": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : MAXIMUM (hyper-adapté). "
        "Tu peux : "
        "(1) ajuster le titre/tagline sous le nom pour refléter le poste visé de façon générique ; "
        "(2) réécrire complètement le résumé/accroche ; "
        "(3) réorganiser ET reformuler les compétences existantes pour maximiser la pertinence "
        "(SANS en inventer de nouvelles, uniquement celles déjà présentes dans le CV original) ; "
        "(4) réécrire entièrement les puces d'expériences pour aligner au maximum avec les mots-clés "
        "du poste (maximum 4 puces par expérience, sans fabriquer de contenu absent du CV). "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "Le résumé doit rester générique : profil orienté vers ce type de poste, pas une candidature nominative. "
        "ABSOLUMENT INTERDIT : "
        "supprimer la section langues ou retirer une seule langue (toutes doivent rester), "
        "supprimer ou modifier la section centres d'intérêt, "
        "inventer des compétences absentes du CV original, "
        "modifier les dates, entreprises du parcours, intitulés de poste, diplômes ou noms propres."
    ),
    "sur-mesure": (
        _PRESERVE_RULE +
        "Tu reçois un CV en HTML et une offre d'emploi. "
        "Niveau d'adaptation : SUR-MESURE (invention autorisée). "
        "Ton objectif est de rendre le CV le PLUS pertinent possible pour cette offre, quitte à "
        "embellir et inventer. Tu peux : "
        "(1) ajuster le titre/tagline sous le nom pour refléter le poste visé ; "
        "(2) réécrire complètement le résumé/accroche ; "
        "(3) AJOUTER des compétences demandées par l'offre même si elles sont absentes du CV original, "
        "et réorganiser le tout pour maximiser la pertinence ; "
        "(4) réécrire et ENRICHIR les puces d'expériences en ajoutant des réalisations, "
        "responsabilités et résultats chiffrés crédibles qui collent à l'offre, même s'ils ne "
        "figurent pas dans le CV original (maximum 5 puces par expérience). "
        "Reste crédible et cohérent avec le parcours (secteur, séniorité, dates). "
        "RÈGLE ABSOLUE ANTI-DÉTECTION : N'écris JAMAIS le nom de l'entreprise ciblée, "
        "ni 'chez [entreprise]', ni 'au sein de [entreprise]', ni aucune référence directe à l'employeur cible "
        "dans le résumé, le titre, ou n'importe quelle autre section. "
        "Le résumé doit rester générique : profil orienté vers ce type de poste, pas une candidature nominative. "
        "INTERDIT : modifier les dates, les entreprises du parcours, les intitulés de poste ou les diplômes."
    ),
}

_COMMON_HTML_RULES = (
    "\n\nRÈGLES TECHNIQUES STRICTES (NON NÉGOCIABLES) :\n"
    "1. BALISES FIGÉES : Ne change JAMAIS le type d'une balise existante (ne transforme pas "
    "un <span> en <div>, un <td> en autre chose, etc.). N'ajoute JAMAIS de balise wrapper "
    "autour du contenu existant. N'invente JAMAIS de nouvelles classes CSS absentes du HTML reçu. "
    "Si tu dois ajouter un item (puce, compétence), utilise EXACTEMENT le même type de balise "
    "et les mêmes classes que les autres items du même niveau dans le HTML original. "
    "Conserve intégralement <html> (avec lang), <head>, toutes les balises <meta> et <link>.\n"
    "2. CSS INTOUCHABLE : Conserve la balise <style> et son contenu pixel pour pixel. "
    "Ne modifie AUCUNE classe CSS, AUCUN id, et aucun attribut style=\"...\". "
    "Le rendu visuel doit être identique à l'original.\n"
    "3. PHOTO DE PROFIL : Ne modifie jamais l'attribut src d'une balise <img>. "
    "Les src des images ont été remplacés par des placeholders du type "
    "[IMAGE_BASE64_0], [IMAGE_BASE64_1], etc. Recopie-les EXACTEMENT tels quels "
    "(avec les crochets, sans guillemets internes, sans modification).\n"
    "4. INTÉGRALITÉ DU CONTENU : Ne supprime AUCUNE expérience, compétence, langue, "
    "formation ou centre d'intérêt. Si le CV est long, reformule — n'efface JAMAIS. "
    "Chaque section présente dans le CV original doit exister dans ta réponse.\n"
    "5. ATTRIBUTS HTML : Conserve tous les attributs data-*, aria-* et autres attributs "
    "personnalisés exactement tels qu'ils sont dans le HTML reçu.\n"
    "6. RÉSUMÉ/ACCROCHE : Le texte de la section résumé ou accroche ('À propos', 'Profil', etc.) "
    "ne doit JAMAIS dépasser 400 mots. Si ta version dépasse cette limite, condense sans perdre "
    "les informations clés.\n"
    "7. COMMENTAIRES DE NAVIGATION : Si le HTML original ne contient pas déjà de commentaires "
    "de section, insère un commentaire HTML avant chaque <section> principale, "
    "au format <!-- ===== NOM DE LA SECTION ===== --> (nom en majuscules, en français). "
    "Si des commentaires existent déjà, conserve-les tels quels sans les modifier.\n"
    "8. ORDRE DES SECTIONS : Conserve les expériences et les formations DANS LE MÊME ORDRE que "
    "le HTML original. Ne les réordonne JAMAIS, ne les trie pas par pertinence : l'ordre "
    "chronologique d'origine doit être préservé à l'identique.\n"
    "9. RÉSUMÉ GÉNÉRIQUE : Dans le résumé/accroche, ne recopie pas les phrases ou expressions "
    "exactes de l'offre. Le résumé décrit le profil du candidat orienté vers ce TYPE de métier, "
    "pas une candidature à une offre précise. Évite l'effet 'CV taillé sur mesure'.\n"
    "10. FORMAT DE SORTIE : Retourne UNIQUEMENT le code HTML complet, du <!DOCTYPE html> "
    "jusqu'à </html>. Zéro bloc markdown (```html), zéro commentaire global, zéro texte avant ou après."
)


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
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
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
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
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
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
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
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
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
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 429
    except Exception as exc:
        return jsonify({"error": f"Erreur IA : {exc}"}), 500

    return jsonify(result)


# ---------------------------------------------------------------------------
# Extracteur d'offre d'emploi (scraping URL)
# ---------------------------------------------------------------------------

_logger = _logging.getLogger(__name__)

_EXTRACT_MAX_CHARS = 15_000
_EXTRACT_TIMEOUT_MS = 20_000
_SCRAPE_SEMAPHORE = threading.Semaphore(2)

# Toutes les plages IP à bloquer (SSRF) — RFC 1918, 6598, 3927, 5737, etc.
_BLOCKED_NETWORKS: list[ipaddress.IPv4Network | ipaddress.IPv6Network] = [
    ipaddress.ip_network("0.0.0.0/8"),       # "This" network
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("100.64.0.0/10"),   # RFC 6598 CGN
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.0.0.0/24"),    # IETF protocol
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("198.18.0.0/15"),   # benchmarking RFC 2544
    ipaddress.ip_network("224.0.0.0/4"),     # multicast
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::ffff:0:0/96"),   # IPv4-mapped IPv6
]


def _is_blocked_ip(addr: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    # Normalise les adresses IPv4-mapped (::ffff:127.0.0.1 → 127.0.0.1)
    # pour que le test d'appartenance aux réseaux IPv4 fonctionne correctement.
    if isinstance(addr, ipaddress.IPv6Address) and addr.ipv4_mapped is not None:
        addr = addr.ipv4_mapped
    if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_multicast or addr.is_unspecified:
        return True
    return any(addr in net for net in _BLOCKED_NETWORKS if addr.version == net.version)


def _validate_url(url: str) -> tuple[str, str | None]:
    """Valide l'URL et retourne (url_nettoyée, erreur_ou_None).

    Supprime les credentials embarqués, vérifie le schéma et toutes les adresses
    résolues (IPv4 + IPv6) contre la liste de plages bloquées.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return url, "URL invalide : seuls http et https sont autorisés."
    hostname = parsed.hostname
    if not hostname:
        return url, "URL invalide : hôte manquant."

    # Supprime les credentials (user:pass@host → host) avant de passer à Playwright
    clean_netloc = hostname + (f":{parsed.port}" if parsed.port else "")
    clean_url = urlunparse((parsed.scheme, clean_netloc, parsed.path, parsed.params, parsed.query, ""))

    try:
        # getaddrinfo couvre IPv4 et IPv6, contrairement à gethostbyname
        results = socket.getaddrinfo(hostname, None)
        for result in results:
            addr = ipaddress.ip_address(result[4][0])
            if _is_blocked_ip(addr):
                return clean_url, "URL non autorisée."
    except OSError:
        return clean_url, "Impossible de résoudre l'hôte."

    return clean_url, None


def _make_route_guard():
    """Retourne un handler Playwright qui re-valide l'IP au moment de chaque requête.

    Défense en profondeur contre le DNS rebinding : la validation initiale peut
    être contournée si le TTL DNS expire entre la vérification et la connexion.
    """
    def _guard(route, _request):
        try:
            req_host = urlparse(_request.url).hostname or ""
            if req_host:
                for result in socket.getaddrinfo(req_host, None):
                    if _is_blocked_ip(ipaddress.ip_address(result[4][0])):
                        route.abort("blockedbyclient")
                        return
        except Exception:
            pass
        route.continue_()
    return _guard


def _scrape_job_text(url: str) -> tuple[str, str]:
    """Scrape une page d'offre d'emploi via Playwright. Retourne (texte, titre)."""
    from playwright.sync_api import sync_playwright

    if not _SCRAPE_SEMAPHORE.acquire(timeout=5):
        raise RuntimeError("Trop de requêtes simultanées. Réessayez dans quelques secondes.")
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(
                    user_agent="Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36"
                )
                page.route("**/*", _make_route_guard())
                page.goto(url, wait_until="domcontentloaded", timeout=_EXTRACT_TIMEOUT_MS)
                page.wait_for_timeout(1500)
                title = page.title() or ""

                page.evaluate("""() => {
                    const noise = ['nav','header','footer','aside','script','style',
                        '[class*="cookie"]','[class*="Cookie"]','[id*="cookie"]',
                        '[class*="banner"]','[class*="modal"]','[class*="popup"]',
                        '[class*="sidebar"]','[class*="Sidebar"]',
                        '[role="navigation"]','[role="banner"]','[role="complementary"]'];
                    noise.forEach(s => {
                        try { document.querySelectorAll(s).forEach(el => el.remove()); } catch(_) {}
                    });
                }""")

                text = page.evaluate("""() => {
                    const candidates = [
                        document.querySelector('[class*="job-description"]'),
                        document.querySelector('[class*="offer-description"]'),
                        document.querySelector('[class*="jobDescription"]'),
                        document.querySelector('[class*="posting-description"]'),
                        document.querySelector('[data-qa="job-description"]'),
                        document.querySelector('article'),
                        document.querySelector('main'),
                        document.body,
                    ];
                    for (const el of candidates) {
                        const t = el && el.innerText && el.innerText.trim();
                        if (t && t.length > 100) return t;
                    }
                    return '';
                }""")

                text = _re.sub(r"\n{3,}", "\n\n", text or "").strip()
                
                is_blocked = (
                    len(text) < 200 or 
                    "Sign Up" in title or 
                    "Connexion" in title or 
                    "S'inscrire" in title or
                    "Security" in title or 
                    "Cloudflare" in title
                )

                if is_blocked:
                    import urllib.request
                    try:
                        req = urllib.request.Request(
                            f"https://r.jina.ai/{url}",
                            headers={"User-Agent": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36"}
                        )
                        jina_resp = urllib.request.urlopen(req, timeout=15).read().decode('utf-8')
                        if len(jina_resp) > 500 and "Sign Up | LinkedIn" not in jina_resp and "Connexion | LinkedIn" not in jina_resp and "S'inscrire" not in jina_resp and "Requête bloquée" not in jina_resp and "Vous avez été bloqué" not in jina_resp:
                            # Nettoyage du Markdown pour réduire le bruit (menus, images, listes d'autres offres)
                            jina_resp = _re.sub(r'!\[[^\]]*\]\([^)]+\)', '', jina_resp) # Supprime les images
                            jina_resp = _re.sub(r'\[([^\]]*)\]\([^)]+\)', r'\1', jina_resp) # Garde le texte des liens (même vides)
                            
                            footer_markers = [
                                "annonces similaires", "offres similaires", "ces offres peuvent",
                                "plan du site", "gestion des cookies", "mentions légales",
                                "inscription à la newsletter", "politique de confidentialité"
                            ]
                            nav_noise = [
                                "espace candidat", "espace entreprise", "déposer son cv", "nouvelle recherche",
                                "qui sommes-nous", "répondre en ligne", "connexion inscription", "mot de passe oublié",
                                "entreprises qui recrutent", "faq des", "enregistrer vos annonces", "nos tarifs",
                                "inscriptionconnexion", "taille du texte"
                            ]
                            exact_noise = {
                                "×", "menu", "offres d'emploi", "statistiques", "contact", 
                                "news les dernières news", "aa+aa-", "imprimer", "site internet",
                                "actualité", "vidéos", "défilés", "galeries", "podcasts", "agenda", "partenaires"
                            }
                            
                            lines = []
                            for line in jina_resp.split('\n'):
                                line_clean = line.strip()
                                content = line_clean.lstrip('*>- ').strip()
                                line_lower = content.lower()
                                
                                # Coupe la fin du document dès qu'on tombe sur le footer ou les suggestions
                                if any(marker in line_lower for marker in footer_markers) and len(lines) > 10:
                                    break
                                    
                                # Ignore les puces très courtes typiques de menus ou annonces annexes
                                if line_clean.startswith('*'):
                                    words = content.split()
                                    if len(words) < 5: # Puce très courte (Menu)
                                        continue
                                    if 'il y a' in line_lower or 'news' in line_lower or 'offre' in line_lower or 'dans quelques' in line_lower:
                                        continue
                                
                                # Ignore les lignes de navigation pures
                                if len(content) < 40 and any(nav in line_lower for nav in nav_noise):
                                    continue
                                    
                                # Retire les lignes inutiles isolées
                                if line_lower in exact_noise:
                                    continue
                                    
                                # Ignorer les lignes de fil d'Ariane
                                if '›' in line_clean and 'accueil' in line_lower:
                                    continue
                                    
                                lines.append(line_clean)
                                
                            text = '\n'.join(lines)
                            text = _re.sub(r'\n{3,}', '\n\n', text).strip()
                            for line in text.split('\n')[:10]:
                                if line.startswith("Title: "):
                                    title = line[7:].strip()
                                    break
                    except Exception as e:
                        _logger.warning("Jina Reader fallback failed: %s", str(e))
                
                # Ultime vérification : si le texte final est un message de blocage Cloudflare/Datadome
                if "Requête bloquée" in text or "Vous avez été bloqué" in text or "Just a moment" in text or "Cloudflare" in text:
                    raise ValueError("BLOCKED")

                return text[:_EXTRACT_MAX_CHARS], title
            finally:
                browser.close()
    finally:
        _SCRAPE_SEMAPHORE.release()


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
