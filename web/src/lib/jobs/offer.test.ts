import { describe, it, expect } from "vitest";
import { yearlySalaryLabel } from "./offer";

describe("yearlySalaryLabel", () => {
  it("formate une fourchette en k€ annuels", () => {
    expect(yearlySalaryLabel(33000, 36000)).toBe("33–36 k€ / an");
  });

  it("formate un montant unique", () => {
    expect(yearlySalaryLabel(41130, null)).toBe("41,1 k€ / an");
  });

  it("garde une décimale seulement si utile", () => {
    expect(yearlySalaryLabel(40000, null)).toBe("40 k€ / an");
  });

  it("renvoie « » quand rien n'est connu", () => {
    expect(yearlySalaryLabel(null, null)).toBe("");
    expect(yearlySalaryLabel(undefined, undefined)).toBe("");
  });

  it("ignore une fourchette dégénérée (min === max)", () => {
    expect(yearlySalaryLabel(45000, 45000)).toBe("45 k€ / an");
  });
});
