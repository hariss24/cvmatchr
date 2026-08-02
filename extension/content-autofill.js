// Bouton flottant + remplissage sur Greenhouse/Lever. Injecté après lib/fieldMatch.js
// (voir manifest.json — l'ordre des scripts dans "js" les charge dans cet ordre,
// donc window.CVMatchrFieldMatch existe déjà ici).
(function () {
  const STORAGE_KEY = "cvmatchrAutofillPackage";

  function injectButton(pkg) {
    if (document.getElementById("cvmatchr-autofill-btn")) return;
    const btn = document.createElement("button");
    btn.id = "cvmatchr-autofill-btn";
    btn.textContent = `Remplir avec CVMatchr (${pkg.role || "poste"} · ${pkg.company || "entreprise"})`;
    Object.assign(btn.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: "2147483647",
      background: "#1a73e8",
      color: "#fff",
      border: "none",
      borderRadius: "6px",
      padding: "10px 14px",
      fontSize: "13px",
      fontFamily: "system-ui, sans-serif",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
    });
    btn.addEventListener("click", () => fillForm(pkg, btn));
    document.body.appendChild(btn);
  }

  function fillForm(pkg, btn) {
    const { findField, findFileField, setNativeValue, base64ToFile, setFileInput } = window.CVMatchrFieldMatch;
    let filled = 0;
    let total = 0;

    const fullName = `${pkg.identity.firstName} ${pkg.identity.lastName}`.trim();
    const textFields = [
      ["firstName", pkg.identity.firstName],
      ["lastName", pkg.identity.lastName],
      ["fullName", fullName],
      ["email", pkg.identity.email],
      ["phone", pkg.identity.phone],
      ["linkedin", pkg.identity.linkedin],
      ["location", pkg.identity.location],
    ];
    for (const [key, value] of textFields) {
      if (!value) continue;
      total++;
      const el = findField(key);
      if (el) {
        setNativeValue(el, value);
        filled++;
      }
    }

    if (pkg.resume && pkg.resume.base64) {
      total++;
      const fileEl = findFileField("resume");
      if (fileEl) {
        const file = base64ToFile(pkg.resume.base64, pkg.resume.filename, pkg.resume.mimeType);
        setFileInput(fileEl, file);
        filled++;
      }
    }

    btn.textContent = `${filled}/${total} champs remplis — vérifie avant d'envoyer`;
  }

  chrome.storage.local.get(STORAGE_KEY, (result) => {
    const pkg = result[STORAGE_KEY];
    if (pkg) injectButton(pkg);
  });
})();
