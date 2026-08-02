// Pont entre la page CVMatchr (window.postMessage) et chrome.storage.local.
// Injecté uniquement sur cvmatchr.fr et localhost:3000 (voir manifest.json).
(function () {
  const STORAGE_KEY = "cvmatchrAutofillPackage";
  const MESSAGE_TYPE = "cvmatchr:autofill-package";
  const ACK_TYPE = "cvmatchr:autofill-package-ack";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.source !== "cvmatchr-app" || data.type !== MESSAGE_TYPE) return;

    chrome.storage.local.set({ [STORAGE_KEY]: data.payload }, () => {
      window.postMessage({ source: "cvmatchr-extension", type: ACK_TYPE }, window.location.origin);
    });
  });
})();
