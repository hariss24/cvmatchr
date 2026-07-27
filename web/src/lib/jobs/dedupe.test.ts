import { describe, it, expect } from "vitest";
import { dedupeOffers } from "./dedupe";
import type { JobOffer, SourceId } from "./offer";

function offer(source: SourceId, company: string, title: string, extra: Partial<JobOffer> = {}): JobOffer {
  return {
    id: `${source}-${company}-${title}`, source, title, company,
    location: "", commuteDestination: "", url: "", jobText: "", publishedAt: "",
    logoUrl: "", boardDomain: "", boardName: "", contractLabel: "", salaryLabel: "",
    ...extra,
  };
}

describe("dedupeOffers", () => {
  it("garde France Travail face à JSearch et Adzuna", () => {
    const out = dedupeOffers([
      offer("adzuna", "ACME", "Webmaster"),
      offer("francetravail", "ACME", "Webmaster"),
      offer("jsearch", "ACME", "Webmaster"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("francetravail");
  });

  it("garde JSearch face à Adzuna", () => {
    const out = dedupeOffers([
      offer("adzuna", "ACME", "Webmaster"),
      offer("jsearch", "ACME", "Webmaster"),
    ]);
    expect(out[0].source).toBe("jsearch");
  });

  it("adopte le logo d'un doublon écarté", () => {
    const out = dedupeOffers([
      offer("francetravail", "ACME", "Webmaster"),
      offer("jsearch", "ACME", "Webmaster", { logoUrl: "https://logo/acme.png" }),
    ]);
    expect(out[0].source).toBe("francetravail");
    expect(out[0].logoUrl).toBe("https://logo/acme.png");
  });

  it("n'écrase pas un logo déjà présent", () => {
    const out = dedupeOffers([
      offer("jsearch", "ACME", "Webmaster", { logoUrl: "https://logo/garde.png" }),
      offer("adzuna", "ACME", "Webmaster", { logoUrl: "https://logo/autre.png" }),
    ]);
    expect(out[0].logoUrl).toBe("https://logo/garde.png");
  });

  it("ignore la casse et les accents", () => {
    const out = dedupeOffers([
      offer("francetravail", "Médecins Sans Frontières", "Webmaster F/H"),
      offer("jsearch", "medecins sans frontieres", "webmaster f h"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("garde deux offres distinctes", () => {
    const out = dedupeOffers([
      offer("francetravail", "ACME", "Webmaster"),
      offer("francetravail", "ACME", "Développeur"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("garde les offres sans entreprise ni poste exploitables", () => {
    const out = dedupeOffers([offer("adzuna", "", ""), offer("jsearch", "", "")]);
    expect(out).toHaveLength(2);
  });
});
