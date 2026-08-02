"use client";

import type { AutofillPackage } from "./autofillPackage";

const MESSAGE_TYPE = "cvmatchr:autofill-package";
const ACK_TYPE = "cvmatchr:autofill-package-ack";

/**
 * Envoie le paquet à l'extension (si installée) via postMessage, et attend son
 * accusé de réception écrit par `content-bridge.js`. `false` si aucune extension
 * ne répond dans le délai (`timeoutMs`) — l'appelant en déduit qu'elle n'est pas
 * installée sur cette origine.
 */
export function postAutofillPackage(pkg: AutofillPackage, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.origin !== window.location.origin) return;
      if (event.data?.source !== "cvmatchr-extension" || event.data?.type !== ACK_TYPE) return;
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(true);
    };

    window.addEventListener("message", onMessage);
    window.postMessage({ source: "cvmatchr-app", type: MESSAGE_TYPE, payload: pkg }, window.location.origin);

    setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      resolve(false);
    }, timeoutMs);
  });
}
