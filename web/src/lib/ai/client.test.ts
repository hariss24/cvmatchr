import { describe, it, expect, vi, afterEach } from "vitest";
import { getUserApiKey, getApiHeaders, postJson, streamSse } from "./client";

afterEach(() => vi.unstubAllGlobals());

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

describe("getUserApiKey / getApiHeaders", () => {
  it("renvoie vide sans localStorage (SSR)", () => {
    expect(getUserApiKey()).toBe("");
    expect(getApiHeaders()).toEqual({});
  });

  it("lit la clé et construit l'en-tête X-Api-Key", () => {
    vi.stubGlobal("localStorage", { getItem: () => "sk-perso" });
    expect(getUserApiKey()).toBe("sk-perso");
    expect(getApiHeaders()).toEqual({ "X-Api-Key": "sk-perso" });
  });

  it("pas d'en-tête si clé vide", () => {
    vi.stubGlobal("localStorage", { getItem: () => "" });
    expect(getApiHeaders()).toEqual({});
  });
});

describe("postJson", () => {
  it("envoie le corps + en-têtes et renvoie le JSON parsé", async () => {
    vi.stubGlobal("localStorage", { getItem: () => "sk-perso" });
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
