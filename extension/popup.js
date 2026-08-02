const STORAGE_KEY = "cvmatchrAutofillPackage";

function render(pkg) {
  const el = document.getElementById("status");
  if (!pkg) {
    el.innerHTML = "<p>Aucune candidature préparée.</p><p>Va sur /pack dans CVMatchr et clique sur « Préparer pour l'extension ».</p>";
    return;
  }
  el.innerHTML = `
    <p>Candidature préparée :</p>
    <p><strong>${pkg.role || "(poste non renseigné)"}</strong> chez <strong>${pkg.company || "(entreprise non renseignée)"}</strong></p>
    <button id="clear">Vider</button>
  `;
  document.getElementById("clear").addEventListener("click", () => {
    chrome.storage.local.remove(STORAGE_KEY, () => render(null));
  });
}

chrome.storage.local.get(STORAGE_KEY, (result) => render(result[STORAGE_KEY] || null));
