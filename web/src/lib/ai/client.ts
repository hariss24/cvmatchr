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

/**
 * POST vers une route IA en **streaming SSE**. Lit le flux `data: <chunk JSON>` / `[DONE]` /
 * `[ERROR] <msg>` (format `sseFromGenerator`), accumule les morceaux et appelle `onChunk`
 * avec le texte cumulé à chaque morceau. Renvoie le texte final. Port de `_readSseStream` +
 * `streamToMonaco` (app.js l.1999-2037).
 */
export async function streamSse(
  url: string,
  body: unknown,
  onChunk: (accumulated: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const resp = await fetch(url, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", ...getApiHeaders() },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    let msg = "Erreur serveur";
    try {
      msg = (await resp.json()).error || msg;
    } catch {
      /* corps non-JSON : on garde le message générique */
    }
    throw new Error(msg);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let accumulated = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") return accumulated;
      if (data.startsWith("[ERROR]")) {
        throw new Error(data.slice(8).trim() || "Erreur serveur");
      }
      try {
        const chunk = JSON.parse(data) as string;
        accumulated += chunk;
        onChunk(accumulated);
      } catch {
        /* ligne partielle ou non-JSON : ignorée (fidèle à l'original) */
      }
    }
  }
  return accumulated;
}
