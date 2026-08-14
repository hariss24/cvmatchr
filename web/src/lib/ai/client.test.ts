import { describe, it, expect, vi, afterEach } from "vitest";
import { getApiHeaders, postJson, streamSse } from "./client";
import { useSettingsStore } from "@/state/settingsStore";

afterEach(() => {
  vi.unstubAllGlobals();
  useSettingsStore.setState({ activeModel: "gemini-3.5-flash", geminiKey: "", anthropicKey: "" });
});

/** Construit un corps de réponse SSE lisible (ReadableStream) à partir de lignes brutes. */
function sseBody(raw: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(raw);
  let sent = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) {
        controller.close();
        return;
      }
      // Découpe en deux morceaux pour exercer le buffer inter-chunks.
      const mid = Math.floor(bytes.length / 2);
      controller.enqueue(bytes.slice(0, mid));
      controller.enqueue(bytes.slice(mid));
      sent = true;
    },
  });
}

describe("getApiHeaders", () => {
  it("envoie toujours le modèle actif", () => {
    expect(getApiHeaders()).toEqual({ "X-Ai-Model": "gemini-3.5-flash" });
  });

  it("ajoute X-Api-Key avec la clé Gemini si le modèle actif est Gemini", () => {
    useSettingsStore.setState({ activeModel: "gemini-3.1-flash-lite", geminiKey: "sk-perso" });
    expect(getApiHeaders()).toEqual({ "X-Ai-Model": "gemini-3.1-flash-lite", "X-Api-Key": "sk-perso" });
  });

  it("bascule sur la clé Anthropic pour un modèle Claude", () => {
    useSettingsStore.setState({ activeModel: "claude-3-5-sonnet", anthropicKey: "sk-ant-perso" });
    expect(getApiHeaders()).toEqual({ "X-Ai-Model": "claude-3-5-sonnet", "X-Api-Key": "sk-ant-perso" });
  });

  it("pas de X-Api-Key si la clé correspondante est vide", () => {
    expect(getApiHeaders()).toEqual({ "X-Ai-Model": "gemini-3.5-flash" });
  });
});

describe("postJson", () => {
  it("envoie le corps + en-têtes et renvoie le JSON parsé", async () => {
    useSettingsStore.setState({ activeModel: "gemini-3.5-flash", geminiKey: "sk-perso" });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resume: { name: "Zoé" } }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await postJson<{ resume: { name: string } }>("/api/tailor-resume", {
      job_desc: "x",
    });
    expect(out.resume.name).toBe("Zoé");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tailor-resume");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Api-Key": "sk-perso",
    });
    expect(init.body).toBe(JSON.stringify({ job_desc: "x" }));
  });

  it("lève avec le message d'erreur serveur", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      json: async () => ({ error: "Quota épuisé." }),
    }));
    await expect(postJson("/api/x", {})).rejects.toThrow("Quota épuisé.");
  });

  it("message générique si le corps d'erreur n'est pas du JSON", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      json: async () => {
        throw new Error("not json");
      },
    }));
    await expect(postJson("/api/x", {})).rejects.toThrow("Erreur serveur");
  });
});

describe("streamSse", () => {
  it("accumule les morceaux, appelle onChunk et renvoie le texte final", async () => {
    const raw =
      `data: ${JSON.stringify("<h1>")}\n\n` +
      `data: ${JSON.stringify("Bonjour")}\n\n` +
      `data: ${JSON.stringify("</h1>")}\n\n` +
      "data: [DONE]\n\n";
    vi.stubGlobal("fetch", async () => ({ ok: true, body: sseBody(raw) }));

    const chunks: string[] = [];
    const final = await streamSse("/api/text-to-html", { text: "x" }, (acc) =>
      chunks.push(acc),
    );

    expect(final).toBe("<h1>Bonjour</h1>");
    expect(chunks).toEqual(["<h1>", "<h1>Bonjour", "<h1>Bonjour</h1>"]);
  });

  it("lève sur [ERROR] avec le message du flux", async () => {
    const raw = `data: ${JSON.stringify("partiel")}\n\n` + "data: [ERROR] Quota épuisé\n\n";
    vi.stubGlobal("fetch", async () => ({ ok: true, body: sseBody(raw) }));
    await expect(streamSse("/api/x", {}, () => {})).rejects.toThrow("Quota épuisé");
  });

  it("lève avec le message d'erreur serveur si la réponse n'est pas ok", async () => {
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      body: null,
      json: async () => ({ error: "Texte vide." }),
    }));
    await expect(streamSse("/api/x", {}, () => {})).rejects.toThrow("Texte vide.");
  });
});
