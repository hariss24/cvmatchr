/**
 * Couche d'appel client vers les routes IA serveur. Port de `getApiHeaders`/`getUserApiKey`
 * (app.js l.1961-1967) + un helper `postJson` factorisant le pattern fetch+erreur des appels IA.
 *
 * La clé API personnelle de l'utilisateur est stockée dans `localStorage` (`userApiKey`) et
 * envoyée via l'en-tête `X-Api-Key`. Sans clé, le serveur retombe sur `GEMINI_API_KEY`.
 */

const STORAGE_KEY_APIKEY = "userApiKey";

/** Clé API personnelle de l'utilisateur (vide côté serveur / SSR). */
export function getUserApiKey(): string {
  if (typeof localStorage === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY_APIKEY) || "";
}

/** En-têtes IA : ajoute `X-Api-Key` si une clé personnelle est enregistrée. */
export function getApiHeaders(): Record<string, string> {
  const key = getUserApiKey();
  return key ? { "X-Api-Key": key } : {};
}

/**
 * POST JSON vers une route IA. Renvoie le corps parsé, ou lève une `Error` portant le message
 * d'erreur renvoyé par le serveur (`{ error }`), sinon « Erreur serveur ».
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...getApiHeaders() },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    let msg = "Erreur serveur";
    try {
      msg = (await resp.json()).error || msg;
    } catch {
      /* corps non-JSON : on garde le message générique */
    }
    throw new Error(msg);
  }
  return resp.json() as Promise<T>;
}
