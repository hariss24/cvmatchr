"""
Convertisseur HTML/CSS -> PDF (interface web locale).

Utilisation :
    Double-cliquez sur ce fichier. Le navigateur s'ouvre sur http://127.0.0.1:5050
    Collez votre HTML (CSS inclus dans <style>), cliquez "Convertir en PDF",
    le fichier se telecharge automatiquement.

Pour quitter :
    Cliquez sur le bouton "Quitter" dans la petite fenetre de controle,
    ou fermez-la avec la croix.
"""

import io
import sys
import threading
import time
import webbrowser

import tkinter as tk
from flask import Flask, render_template_string, request, send_file, jsonify

from pdf_engine import html_to_pdf_bytes

PORT = 5050
URL = f"http://127.0.0.1:{PORT}"

PAGE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>HTML -> PDF</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #0f1115; color: #e6e6e6; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 8px; }
  p.sub { color: #9aa0a6; margin: 0 0 20px; }
  .row { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
  label { font-size: 13px; color: #c8c8c8; }
  select, input[type=text] { background: #1b1f27; color: #e6e6e6; border: 1px solid #2a2f3a; border-radius: 6px; padding: 6px 10px; font-size: 13px; }
  textarea {
    width: 100%; min-height: 60vh; background: #1b1f27; color: #e6e6e6;
    border: 1px solid #2a2f3a; border-radius: 8px; padding: 14px;
    font-family: ui-monospace, Consolas, monospace; font-size: 13px; line-height: 1.5;
    resize: vertical;
  }
  .actions { display: flex; gap: 10px; margin-top: 14px; align-items: center; }
  button {
    background: #4f8cff; color: white; border: 0; border-radius: 8px;
    padding: 12px 22px; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  button:hover { background: #3d7af0; }
  button:disabled { background: #444; cursor: wait; }
  button.ghost { background: #2a2f3a; }
  button.ghost:hover { background: #353b48; }
  #status { font-size: 13px; color: #9aa0a6; }
  #status.ok { color: #5dd39e; }
  #status.err { color: #ff6b6b; }
  details { margin-top: 16px; }
  summary { cursor: pointer; color: #9aa0a6; font-size: 13px; }
  .opts { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 10px; }
  .opt { display: flex; gap: 6px; align-items: center; }
</style>
</head>
<body>
<div class="wrap">
  <h1>HTML/CSS -> PDF</h1>
  <p class="sub">Collez votre HTML complet (le CSS peut etre inclus dans une balise &lt;style&gt;). Cliquez "Convertir".</p>

  <textarea id="html" placeholder="<!DOCTYPE html>&#10;<html>&#10;<head><style>body { font-family: sans-serif; }</style></head>&#10;<body>&#10;  <h1>Mon CV</h1>&#10;</body>&#10;</html>"></textarea>

  <details>
    <summary>Options PDF (avancees)</summary>
    <div class="opts">
      <div class="opt">
        <label for="format">Format</label>
        <select id="format">
          <option value="A4" selected>A4</option>
          <option value="Letter">Letter</option>
          <option value="Legal">Legal</option>
        </select>
      </div>
      <div class="opt">
        <label for="margin">Marges</label>
        <select id="margin">
          <option value="0" selected>Aucune (CSS gere tout)</option>
          <option value="10mm">10 mm</option>
          <option value="15mm">15 mm</option>
          <option value="20mm">20 mm</option>
        </select>
      </div>
      <div class="opt">
        <label for="filename">Nom du fichier</label>
        <input type="text" id="filename" placeholder="cv.pdf" />
      </div>
      <div class="opt">
        <label><input type="checkbox" id="bg" checked /> Inclure les arrieres-plans</label>
      </div>
    </div>
  </details>

  <div class="actions">
    <button id="go">Convertir en PDF</button>
    <button id="clear" class="ghost" type="button">Effacer</button>
    <span id="status"></span>
  </div>
</div>

<script>
const $ = (id) => document.getElementById(id);
const setStatus = (msg, cls) => {
  const s = $('status'); s.textContent = msg; s.className = cls || '';
};

$('clear').onclick = () => { $('html').value = ''; setStatus(''); };

$('go').onclick = async () => {
  const html = $('html').value;
  if (!html.trim()) { setStatus("Collez du HTML d'abord.", 'err'); return; }
  const btn = $('go'); btn.disabled = true; btn.textContent = 'Conversion...';
  setStatus('Generation du PDF...', '');
  try {
    const res = await fetch('/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html,
        format: $('format').value,
        margin: $('margin').value,
        background: $('bg').checked,
        filename: ($('filename').value || 'document.pdf').trim(),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
      setStatus('Erreur : ' + (err.error || res.statusText), 'err');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    let name = ($('filename').value || 'document.pdf').trim();
    if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf';
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    setStatus('PDF telecharge.', 'ok');
  } catch (e) {
    setStatus('Erreur : ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Convertir en PDF';
  }
};
</script>
</body>
</html>
"""

app = Flask(__name__)


@app.route("/")
def index():
    return render_template_string(PAGE)


@app.route("/convert", methods=["POST"])
def convert():
    data = request.get_json(silent=True) or {}
    html = data.get("html", "")
    fmt = data.get("format", "A4")
    margin = data.get("margin", "0")
    background = bool(data.get("background", True))
    filename = (data.get("filename") or "document.pdf").strip()
    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"

    if not html.strip():
        return jsonify({"error": "HTML vide."}), 400

    try:
        pdf_bytes = html_to_pdf_bytes(html, page_format=fmt, margin=margin, background=background)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return send_file(
        io.BytesIO(pdf_bytes),
        mimetype="application/pdf",
        as_attachment=True,
        download_name=filename,
    )


def lancer_serveur():
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)


def lancer_navigateur():
    time.sleep(1.0)
    webbrowser.open(URL)


def fenetre_controle():
    root = tk.Tk()
    root.title("Convertisseur HTML -> PDF")
    root.resizable(False, False)
    largeur, hauteur = 360, 160
    x = (root.winfo_screenwidth() - largeur) // 2
    y = (root.winfo_screenheight() - hauteur) // 2
    root.geometry(f"{largeur}x{hauteur}+{x}+{y}")

    tk.Label(root, text="Le serveur tourne sur :", pady=8).pack()
    lien = tk.Label(root, text=URL, fg="#1a73e8", cursor="hand2", font=("Segoe UI", 10, "underline"))
    lien.pack()
    lien.bind("<Button-1>", lambda _e: webbrowser.open(URL))

    tk.Label(root, text="Fermez cette fenetre pour arreter.", fg="#666", pady=8).pack()

    def quitter():
        root.destroy()
        sys.exit(0)

    tk.Button(root, text="Quitter", width=14, command=quitter).pack(pady=6)
    root.protocol("WM_DELETE_WINDOW", quitter)
    root.mainloop()


def main():
    threading.Thread(target=lancer_serveur, daemon=True).start()
    threading.Thread(target=lancer_navigateur, daemon=True).start()
    fenetre_controle()


if __name__ == "__main__":
    main()
