import { describe, it, expect } from "vitest";
import { planBackfill } from "./backfill";

const NOW = new Date("2026-07-25T12:00:00Z").getTime();
const ids = (i: number) => `app-${i}`;

const entry = (id: string, created_at: string, company: string, role: string, applicationId?: string) =>
  ({ id, created_at, doc_type: "CV", company, role, job_desc: "", applicationId });

describe("planBackfill", () => {
  it("groupe trois documents en deux candidatures et rattache chaque document", () => {
    const plan = planBackfill(
      [
        entry("d1", "2026-07-01T10:00:00Z", "Decathlon", "Product Owner"),
        entry("d2", "2026-07-02T10:00:00Z", "Decathlon", "Product Owner"),
        entry("d3", "2026-07-03T10:00:00Z", "Manpower", "Cariste"),
      ],
      NOW,
      ids,
    );
    expect(plan.applications).toHaveLength(2);
    expect(plan.links).toHaveLength(3);
    const decathlon = plan.applications.find((a) => a.company === "Decathlon")!;
    const linked = plan.links.filter((l) => l.applicationId === decathlon.id).map((l) => l.entryId);
    expect(linked.sort()).toEqual(["d1", "d2"]);
  });

  it("date la candidature du document le plus ancien du groupe", () => {
    const plan = planBackfill(
      [
        entry("d2", "2026-07-02T10:00:00Z", "Decathlon", "PO"),
        entry("d1", "2026-07-01T10:00:00Z", "Decathlon", "PO"),
      ],
      NOW,
      ids,
    );
    const expected = new Date("2026-07-01T10:00:00Z").getTime();
    expect(plan.applications[0].createdAt).toBe(expected);
    expect(plan.applications[0].events[0]).toMatchObject({ date: expected, type: "applied", source: "system" });
  });

  it("ignore les documents déjà rattachés", () => {
    const plan = planBackfill([entry("d1", "2026-07-01T10:00:00Z", "Acme", "Dev", "app-x")], NOW, ids);
    expect(plan.applications).toEqual([]);
    expect(plan.links).toEqual([]);
  });

  it("ignore les documents sans entreprise ni poste (ils vont au rayon Mes CV)", () => {
    const plan = planBackfill([entry("d1", "2026-07-01T10:00:00Z", "", "")], NOW, ids);
    expect(plan.applications).toEqual([]);
    expect(plan.links).toEqual([]);
  });

  it("reprend le texte de l'offre s'il existe", () => {
    const e = { ...entry("d1", "2026-07-01T10:00:00Z", "Acme", "Dev"), job_desc: "Une offre" };
    const plan = planBackfill([e], NOW, ids);
    expect(plan.applications[0].jobText).toBe("Une offre");
  });

  it("est vide quand il n'y a rien à faire (donc idempotent une fois les liens écrits)", () => {
    expect(planBackfill([], NOW, ids)).toEqual({ applications: [], links: [] });
  });
});
