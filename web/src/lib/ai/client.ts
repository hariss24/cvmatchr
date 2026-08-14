/**
 * Couche d'appel client vers les routes IA serveur. Un helper `postJson`/`streamSse` factorise
 * le pattern fetch+erreur des appels IA.
 *
 * Le modèle actif et la clé API correspondante (Paramètres, store Zustand) voyagent vers le
 * serveur via les en-têtes `X-Ai-Model` / `X-Api-Key` — sans ça, les routes API (exécutées
 * côté serveur, où le store n'est jamais hydraté) ignorent le choix de l'utilisateur et
 * retombent toujours sur Gemini + la clé serveur. Sans clé personnelle, le serveur retombe
 * sur `GEMINI_API_KEY`.
 */

import { useSettingsStore } from "@/state/settingsStore";

/** En-têtes IA : modèle actif + clé API correspondante (Gemini/Anthropic). */
export function getApiHeaders(): Record<string, string> {
  const { activeModel, geminiKey, anthropicKey } = useSettingsStore.getState();
  const key = activeModel.startsWith("claude-") ? anthropicKey : geminiKey;
  const headers: Record<string, string> = { "X-Ai-Model": activeModel };
  if (key) headers["X-Api-Key"] = key;
  return headers;
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
