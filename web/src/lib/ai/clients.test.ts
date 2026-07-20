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

  it("retombe sur la clé serveur pour Gemini si pas de clé user", () => {
    useSettingsStore.setState({ activeModel: "gemini-3.1-flash-lite", geminiKey: "" });
    process.env.GEMINI_API_KEY = "server-key";
    const res = requireActiveKey();
    expect(res.key).toBe("server-key");
    expect(res.provider).toBe("gemini");
  });

  it("lève si aucune clé n'est disponible", () => {
    useSettingsStore.setState({ activeModel: "gemini-3.1-flash-lite", geminiKey: "" });
    expect(() => requireActiveKey()).toThrow(/Clé Gemini requise/);
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
