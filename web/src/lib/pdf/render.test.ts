import { describe, it, expect } from "vitest";
import { htmlToPdf, isAllowedResourceUrl, VALID_FORMATS, VALID_MARGINS } from "./render";

describe("isAllowedResourceUrl (anti-SSRF : inline only)", () => {
  it("autorise uniquement le contenu inline", () => {
    expect(isAllowedResourceUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isAllowedResourceUrl("blob:https://example.com/abc")).toBe(true);
    expect(isAllowedResourceUrl("about:blank")).toBe(true);
  });

  it("bloque toute ressource réseau (élimine le SSRF / DNS rebinding)", () => {
    for (const url of [
      "http://169.254.169.254/latest/meta-data/", // métadonnées cloud
      "https://example.com/photo.jpg", // public mais réseau quand même
      "http://127.0.0.1:8080/", // loopback
      "http://10.0.0.5/", // privé
      "https://attacker.test/rebind", // hostname (rebinding impossible : pas de DNS)
      "file:///etc/passwd", // lecture locale
      "ftp://internal/", // autre schéma réseau
    ]) {
      expect(isAllowedResourceUrl(url), url).toBe(false);
    }
  });

  it("bloque une URL non parsable", () => {
    expect(isAllowedResourceUrl("pas une url")).toBe(false);
  });
});

describe("htmlToPdf (whitelist)", () => {
  it("rejette un format hors whitelist avant tout rendu", async () => {
    // @ts-expect-error test d'une valeur invalide
    await expect(htmlToPdf("<h1>x</h1>", { format: "B4" })).rejects.toThrow(/Format non support/);
  });

  it("rejette une marge hors whitelist avant tout rendu", async () => {
    // @ts-expect-error test d'une valeur invalide
    await expect(htmlToPdf("<h1>x</h1>", { margin: "42mm" })).rejects.toThrow(/Marge non support/);
  });

  it("expose les whitelists attendues", () => {
    expect(VALID_FORMATS).toContain("A4");
    expect(VALID_MARGINS).toContain("0");
  });
});
