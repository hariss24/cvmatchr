import { describe, it, expect } from "vitest";
import { resolveProfile } from "./resolveProfile";
import { EMPTY_PROFILE } from "./profile";

describe("resolveProfile", () => {
  it("retourne EMPTY_PROFILE sans corps", () => {
    expect(resolveProfile()).toEqual(EMPTY_PROFILE);
  });
  it("extrait et valide body.profile", () => {
    const p = resolveProfile({ profile: { keywords: ["Webmaster"] } });
    expect(p.keywords).toEqual(["Webmaster"]);
    expect(p.maxAgeDays).toBe(30);
  });
  it("ignore un body sans profile", () => {
    expect(resolveProfile({ offer: {} })).toEqual(EMPTY_PROFILE);
  });
});
