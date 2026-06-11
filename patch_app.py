
with open("static/js/app.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update window.ResumeForm initialization
code = code.replace("""
  if (window.ResumeForm && window.ResumeForm.init) window.ResumeForm.init();
""", """
  if (window.ResumeForm && window.ResumeForm.setDocType) window.ResumeForm.setDocType(_activeDocType);
  if (window.ResumeForm && window.ResumeForm.init) window.ResumeForm.init();
""")

# 2. Update doc_type change listener
code = code.replace("""
    _isSwitchingDoc = true; // Empêcher l'autosave de polluer le nouveau document
    _activeDocType = newType;
    try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }
""", """
    _isSwitchingDoc = true; // Empêcher l'autosave de polluer le nouveau document
    _activeDocType = newType;
    try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }

    if (window.ResumeForm && window.ResumeForm.setDocType) {
      window.ResumeForm.setDocType(_activeDocType);
    }
""")

# 3. We also need to fix what happens when the _activeDocType is loaded from history or when the page loads
# In line 1072
code = code.replace("""
    if (localEntry) {
      _activeDocType = localEntry.doc_type || 'CV';
      if ($('doc_type')) $('doc_type').value = _activeDocType;
      try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }
""", """
    if (localEntry) {
      _activeDocType = localEntry.doc_type || 'CV';
      if ($('doc_type')) $('doc_type').value = _activeDocType;
      try { localStorage.setItem(STORAGE_KEY_LAST_TYPE, _activeDocType); } catch (_) { }
      if (window.ResumeForm && window.ResumeForm.setDocType) {
        window.ResumeForm.setDocType(_activeDocType);
      }
""")

with open("static/js/app.js", "w", encoding="utf-8") as f:
    f.write(code)

print("app.js updated")
