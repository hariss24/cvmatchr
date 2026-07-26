import { describe, it, expect } from "vitest";
import { anonymousIdsToDelete, isAnonymous } from "./shelf";

const e = (id: string, doc_type: string, label?: string, applicationId?: string) =>
  ({ id, doc_type, label, applicationId });

describe("isAnonymous", () => {
  it("un document sans label et sans candidature est anonyme", () => {
    expect(isAnonymous(e("a", "CV"))).toBe(true);
    expect(isAnonymous(e("a", "CV", ""))).toBe(true);
  });

  it("un document nommé n'est pas anonyme", () => {
    expect(isAnonymous(e("a", "CV", "Intérim manutention"))).toBe(false);
  });

  it("un document rattaché à une candidature n'est pas dans le rayon", () => {
    expect(isAnonymous(e("a", "CV", "", "app-1"))).toBe(false);
  });
});

describe("anonymousIdsToDelete", () => {
  it("ne garde qu'un seul CV anonyme : les autres sont supprimés", () => {
    const entries = [e("old1", "CV"), e("old2", "CV"), e("new", "CV")];
    expect(anonymousIdsToDelete(entries, "CV", "new").sort()).toEqual(["old1", "old2"]);
  });

  it("ne touche jamais un document nommé", () => {
    const entries = [e("kept", "CV", "Intérim manutention"), e("old", "CV"), e("new", "CV")];
    expect(anonymousIdsToDelete(entries, "CV", "new")).toEqual(["old"]);
  });

  it("cloisonne par type de document : une lettre ne remplace pas un CV", () => {
    const entries = [e("cv", "CV"), e("newLetter", "Lettre")];
    expect(anonymousIdsToDelete(entries, "Lettre", "newLetter")).toEqual([]);
  });

  it("ne supprime pas le document qu'on vient de créer", () => {
    expect(anonymousIdsToDelete([e("new", "CV")], "CV", "new")).toEqual([]);
  });

  it("ignore les documents rattachés à une candidature", () => {
    const entries = [e("attached", "CV", "", "app-1"), e("new", "CV")];
    expect(anonymousIdsToDelete(entries, "CV", "new")).toEqual([]);
  });
});
