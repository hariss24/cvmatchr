import { describe, it, expect } from "vitest";
import { usageKey } from "./db";

describe("usageKey", () => {
  it("compose source + mois courant", () => {
    expect(usageKey("jsearch", new Date("2026-07-27T10:00:00Z"))).toBe("jsearch-2026-07");
  });

  it("garde le mois sur deux chiffres", () => {
    expect(usageKey("adzuna", new Date("2026-01-03T10:00:00Z"))).toBe("adzuna-2026-01");
  });
});
