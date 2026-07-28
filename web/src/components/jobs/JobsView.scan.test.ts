import { describe, it, expect } from "vitest";
import { rankOffer, buildRankContext, shouldPersist } from "@/lib/jobs/rank";
import { EMPTY_PROFILE, type JobSearchProfile } from "@/lib/jobs/profile";
import type { JobOffer } from "@/lib/jobs/offer";

/**
 * Vérifie la logique que `scan()` enchaîne, hors React : classer toutes les
 * offres, tout conserver, et trier du meilleur au moins bon.
 */

const T0 = Date.UTC(2026, 6, 28);

const offre = (p: Partial<JobOffer>): JobOffer => ({
  id: "x", source: "francetravail", title: "", company: "", location: "",
  commuteDestination: "", url: "", jobText: "", publishedAt: new Date(T0 - 86400e3).toISOString(),
  logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "", ...p,
});

const profil: JobSearchProfile = {
  ...EMPTY_PROFILE,
  keywords: ["webmaster"],
  romeCodes: ["M1855"],
  prefilterKeywords: ["seo", "wordpress"],
  contractTypes: ["CDI"],
};

describe("logique de scan", () => {
  const ctx = buildRankContext(profil, { lat: 48.85, lng: 2.35 });

  const lot = [
    offre({ id: "bon", title: "Webmaster", jobText: "Profil recherché : SEO, WordPress.",
      romeCode: "M1855", contractLabel: "CDI", salaryLabel: "35 k€", lat: 48.86, lng: 2.35 }),
    offre({ id: "bruit", title: "Conseiller formation webmaster", jobText: "Stagiaires.",
      romeCode: "K2101", contractLabel: "CDI", lat: 48.86, lng: 2.35 }),
    offre({ id: "hors", title: "Comptable", jobText: "Bilans.", romeCode: "M1203" }),
  ];

  it("classe toutes les offres sans en écarter aucune", () => {
    const notees = lot.map((o) => ({ o, r: rankOffer(o, profil, ctx, T0) }));
    expect(notees).toHaveLength(3);
    expect(notees.every(({ r }) => shouldPersist(r, profil))).toBe(true);
  });

  it("place l'offre pertinente devant le bruit et le hors-sujet", () => {
    const tri = lot
      .map((o) => ({ id: o.id, r: rankOffer(o, profil, ctx, T0) }))
      .sort((a, b) => b.r.score - a.r.score);
    expect(tri[0].id).toBe("bon");
    expect(tri[2].id).toBe("hors");
  });

  it("n'accorde jamais mieux que C au bruit de recherche", () => {
    const r = rankOffer(lot[1], profil, ctx, T0);
    expect(["C", "D"]).toContain(r.grade);
  });

  it("attache un détail lisible à chaque offre", () => {
    const r = rankOffer(lot[0], profil, ctx, T0);
    expect(r.breakdown.length).toBeGreaterThanOrEqual(5);
    expect(r.breakdown.every((l) => typeof l.label === "string" && l.label !== "")).toBe(true);
  });
});
