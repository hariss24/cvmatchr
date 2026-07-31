// FICHIER TEMPORAIRE — essai de la protection de la branche main.
// Il doit faire échouer la CI. À supprimer immédiatement après l'essai.
import { describe, it, expect } from "vitest";

describe("essai du refus", () => {
  it("échoue volontairement", () => {
    expect(1).toBe(2);
  });
});
