
with open("static/js/resume-form.js", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Add DEFAULT_LETTER
default_letter_code = """
  const DEFAULT_LETTER = {
    sender_name: 'Prénom Nom',
    sender_address: 'Adresse, Ville',
    sender_contact: 'email@example.com &middot; +33 6 00 00 00 00',
    date: 'Ville, le JJ/MM/AAAA',
    recipient_name: "Nom de l'entreprise",
    recipient_service: 'Service Recrutement',
    recipient_address: "Adresse de l'entreprise",
    subject: 'Candidature au poste de [Intitulé du poste]',
    greeting: 'Madame, Monsieur,',
    body: "[Accroche : présentez-vous brièvement et expliquez pourquoi ce poste et cette entreprise vous intéressent particulièrement.]\\n\\n[Argumentaire : décrivez vos compétences et expériences les plus pertinentes, avec des exemples concrets.]\\n\\n[Conclusion : réaffirmez votre motivation, mentionnez votre disponibilité pour un entretien et remerciez pour l'attention portée à votre candidature.]",
    signoff: "Dans l'attente de votre réponse, je reste à votre disposition pour tout échange.\\n\\nVeuillez agréer, Madame, Monsieur, l'expression de mes salutations distinguées.",
    signature: 'Prénom Nom'
  };

  let _currentDocType = 'CV';
"""
code = code.replace("let resumeData = null;", default_letter_code + "\n  let resumeData = null;")

# 2. Add renderLetter
render_letter_code = """
  // ----- Rendu Lettre : données → markup du template Lettre -----
  function renderLetter(d) {
    const paragraphs = (d.body || '').split('\\n').filter(p => p.trim() !== '').map(p => `<p>${esc(p)}</p>`).join('\\n  ');
    const signoffParagraphs = (d.signoff || '').split('\\n').filter(p => p.trim() !== '').map(p => `<p>${esc(p)}</p>`).join('\\n  ');

    return `<div style="font-family: Georgia, 'Times New Roman', serif; max-width: 680px; margin: 40px auto; color: #222; line-height: 1.7; font-size: 14px;" class="resume-template-renderer">

  <div style="text-align: right; margin-bottom: 48px;">
    <p style="margin: 0;">${esc(d.sender_name)}<br>
    ${esc(d.sender_address)}<br>
    ${esc(d.sender_contact)}</p>
    <p style="margin: 16px 0 0;">${esc(d.date)}</p>
  </div>

  <div style="margin-bottom: 32px;">
    <p style="margin: 0;"><strong>${esc(d.recipient_name)}</strong><br>
    ${esc(d.recipient_service)}<br>
    ${esc(d.recipient_address)}</p>
  </div>

  <p><strong>Objet : ${esc(d.subject)}</strong></p>

  <p>${esc(d.greeting)}</p>

  ${paragraphs}

  ${signoffParagraphs}

  <br><br>
  <p>${esc(d.signature)}</p>

</div>`;
  }
"""
code = code.replace("// ----- Persistance des données du formulaire -----", render_letter_code + "\n  // ----- Persistance des données du formulaire -----")

# 3. Update loadStoredData to use DEFAULT_LETTER if _currentDocType == 'Lettre'
code = code.replace("""
  function loadStoredData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DATA);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return JSON.parse(JSON.stringify(DEFAULT_RESUME));
  }
""", """
  function loadStoredData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DATA);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return JSON.parse(JSON.stringify(_currentDocType === 'Lettre' ? DEFAULT_LETTER : DEFAULT_RESUME));
  }
""")

# 4. Update applyToEditor
code = code.replace("""
  function applyToEditor() {
    if (typeof htmlModel === 'undefined' || !htmlModel) return;
    ensureCss();
    htmlModel.setValue(renderResume(resumeData)); // déclenche autosave + aperçu
    persist();
  }
""", """
  function applyToEditor() {
    if (typeof htmlModel === 'undefined' || !htmlModel) return;
    if (_currentDocType === 'Lettre') {
      if (typeof cssModel !== 'undefined' && cssModel) cssModel.setValue('');
      htmlModel.setValue(renderLetter(resumeData));
    } else {
      ensureCss();
      htmlModel.setValue(renderResume(resumeData)); // déclenche autosave + aperçu
    }
    persist();
  }
""")

# 5. Modify buildForm for Lettre fields
build_form_start = code.find("function buildForm() {")
build_form_end = code.find("pane.innerHTML = html.join('');", build_form_start)
build_form_code = code[build_form_start:build_form_end]

new_build_form_code = build_form_code.replace("""
    // Modèle de mise en page
    const _tplId = currentTemplateId();
""", """
    if (_currentDocType === 'Lettre') {
      // Formulaire Lettre
      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Expéditeur</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'sender_name', 'Nom', d.sender_name)}
          ${field('lettre', null, 'sender_address', 'Adresse', d.sender_address)}
          ${field('lettre', null, 'sender_contact', 'Contact (Email / Tél)', d.sender_contact)}
        </div>
      </section>`);

      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Date et Lieu</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'date', 'Lieu et Date', d.date)}
        </div>
      </section>`);

      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Destinataire</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'recipient_name', 'Entreprise', d.recipient_name)}
          ${field('lettre', null, 'recipient_service', 'Service', d.recipient_service)}
          ${field('lettre', null, 'recipient_address', 'Adresse', d.recipient_address)}
        </div>
      </section>`);

      html.push(`<section class="rf-group">
        <div class="rf-group-head"><span>Contenu de la lettre</span></div>
        <div class="rf-grid">
          ${field('lettre', null, 'subject', 'Objet', d.subject)}
          ${field('lettre', null, 'greeting', 'Salutation', d.greeting)}
        </div>
        ${textarea('lettre', null, 'body', 'Corps de la lettre (sauts de ligne conservés)', d.body, 10)}
        ${textarea('lettre', null, 'signoff', 'Formule de politesse', d.signoff, 3)}
        <div class="rf-grid" style="margin-top: 8px;">
          ${field('lettre', null, 'signature', 'Signature', d.signature)}
        </div>
      </section>`);

    } else {
      // Formulaire CV
      // Modèle de mise en page
      const _tplId = currentTemplateId();
""")

new_build_form_code = new_build_form_code + """
    }
"""

code = code.replace(build_form_code, new_build_form_code)

# 6. Update updateField
code = code.replace("""
  function updateField(section, index, key, value) {
    if (section === 'basics') {
""", """
  function updateField(section, index, key, value) {
    if (section === 'lettre') {
      resumeData[key] = value;
    } else if (section === 'basics') {
""")

# 7. Update normalizeIncoming
code = code.replace("""
  function normalizeIncoming(obj) {
    obj = obj || {};
    const arr = (v) => Array.isArray(v) ? v : [];
    return {
      name: obj.name || '', title: obj.title || '', location: obj.location || '',
""", """
  function normalizeIncoming(obj) {
    obj = obj || {};
    if (_currentDocType === 'Lettre') {
      return {
        sender_name: obj.sender_name || DEFAULT_LETTER.sender_name,
        sender_address: obj.sender_address || DEFAULT_LETTER.sender_address,
        sender_contact: obj.sender_contact || DEFAULT_LETTER.sender_contact,
        date: obj.date || DEFAULT_LETTER.date,
        recipient_name: obj.recipient_name || DEFAULT_LETTER.recipient_name,
        recipient_service: obj.recipient_service || DEFAULT_LETTER.recipient_service,
        recipient_address: obj.recipient_address || DEFAULT_LETTER.recipient_address,
        subject: obj.subject || DEFAULT_LETTER.subject,
        greeting: obj.greeting || DEFAULT_LETTER.greeting,
        body: obj.body || DEFAULT_LETTER.body,
        signoff: obj.signoff || DEFAULT_LETTER.signoff,
        signature: obj.signature || DEFAULT_LETTER.signature
      };
    }
    const arr = (v) => Array.isArray(v) ? v : [];
    return {
      name: obj.name || '', title: obj.title || '', location: obj.location || '',
""")

# 8. Update window.ResumeForm API
code = code.replace("""
    init() {
      resumeData = loadStoredData();
""", """
    setDocType(type) {
      _currentDocType = type;
      built = false; // force rebuild
    },
    init() {
      resumeData = loadStoredData();
""")

with open("static/js/resume-form.js", "w", encoding="utf-8") as f:
    f.write(code)

print("resume-form.js updated")
