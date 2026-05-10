"""Point d'entrée Vercel — expose l'application Flask du projet.

Vercel détecte automatiquement le WSGI handler via la variable `app`.
"""
import os
import sys

# Rend la racine du projet importable (api/../ → racine)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force le backend WeasyPrint (Playwright / Chromium indisponible sur Vercel)
os.environ.setdefault("PDF_ENGINE", "weasyprint")

from app import app  # noqa: E402

# Alias attendu par @vercel/python
handler = app
