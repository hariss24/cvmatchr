import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isAnthropicKey,
  requireActiveKey,
  hasServerKey,
  serverKeyPreview,
  streamCompletion,
} from "./clients";
import { useSettingsStore } from "@/state/settingsStore";

const ORIGINAL = process.env.GEMINI_API_KEY;

beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = ORIGINAL;
});

describe("isAnthropicKey", () => {
  it("reconnaît les clés Anthropic", () => {
    expect(isAnthropicKey("sk-ant-abc")).toBe(true);
    expect(isAnthropicKey("AIzaSyXXXX")).toBe(false);
    expect(isAnthropicKey("")).toBe(false);
  });
});

describe("requireActiveKey", () => {
  it("retourne la clé selon le modèle actif", () => {
    useSettingsStore.setState({ activeModel: "claude-haiku-4-5-20251001", anthropicKey: "sk-ant-user" });
    const res = requireActiveKey();
    expect(res.key).toBe("sk-ant-user");
    expect(res.provider).toBe("anthropic");
  });

  it("exige une clé utilisateur et ne retombe plus silencieusement sur la clé serveur", () => {
    useSettingsStore.setState({ activeModel: "gemini-3.1-flash-lite", geminiKey: "" });
    process.env.GEMINI_API_KEY = "server-key";
    expect(() => requireActiveKey()).toThrow(/Clé Gemini requise/);
  });

  it("lève si aucune clé n'est disponible", () => {
    useSettingsStore.setState({ activeModel: "gemini-3.1-flash-lite", geminiKey: "" });
    expect(() => requireActiveKey()).toThrow(/Clé Gemini requise/);
  });

  it("le modèle/la clé en override (en-têtes client) priment sur le store serveur", () => {
    // Le store reflète l'état par défaut côté serveur (jamais hydraté par le client réel) ;
    // le modèle + la clé envoyés via X-Ai-Model/X-Api-Key doivent quand même être utilisés.
    useSettingsStore.setState({ activeModel: "gemini-3.5-flash", geminiKey: "" });
    const res = requireActiveKey("sk-ant-user", "claude-3-5-sonnet");
    expect(res.key).toBe("sk-ant-user");
    expect(res.provider).toBe("anthropic");
    expect(res.model).toBe("claude-3-5-sonnet");
  });
});

describe("statut clé serveur", () => {
  it("reflète l'absence de clé", () => {
    expect(hasServerKey()).toBe(false);
    expect(serverKeyPreview()).toBeNull();
  });

  it("expose un aperçu tronqué quand la clé existe", () => {
    process.env.GEMINI_API_KEY = "AIzaSecret";
    expect(hasServerKey()).toBe(true);
    expect(serverKeyPreview()).toBe("AIza…");
  });
});

describe("streamCompletion (garde Anthropic + images)", () => {
  it("refuse les images avec une clé Anthropic", async () => {
    const gen = streamCompletion("prompt", "system", {
      apiKey: "sk-ant-test",
      model: "claude-3-5-sonnet",
      images: [new Uint8Array([1, 2, 3])],
    });
    await expect(gen.next()).rejects.toThrow(/Anthropic ne supporte pas/);
  });

  it("lève sans clé", async () => {
    useSettingsStore.setState({ activeModel: "gemini-3.1-flash-lite", geminiKey: "" });
    const gen = streamCompletion("prompt", "system");
    await expect(gen.next()).rejects.toThrow(/Clé Gemini requise/);
  });
});
