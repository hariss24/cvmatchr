import { describe, it, expect, vi, afterEach } from "vitest";
import { getUserApiKey, getApiHeaders, postJson } from "./client";

afterEach(() => vi.unstubAllGlobals());

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
