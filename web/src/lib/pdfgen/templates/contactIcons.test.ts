import { describe, it, expect } from "vitest";
import { detectContactIcon } from "./contactIcons";

describe("detectContactIcon", () => {
  it("détecte les marques par le label ou la valeur", () => {
    expect(detectContactIcon("GitHub", "github.com/hariss24")).toBe("github");
    expect(detectContactIcon("", "https://github.com/hariss24")).toBe("github");
    expect(detectContactIcon("LinkedIn", "linkedin.com/in/hariss")).toBe("linkedin");
    expect(detectContactIcon("GitLab", "gitlab.com/x")).toBe("gitlab");
    expect(detectContactIcon("", "stackoverflow.com/users/1")).toBe("stackoverflow");
    expect(detectContactIcon("Twitter", "@hariss")).toBe("x");
    expect(detectContactIcon("", "x.com/hariss")).toBe("x");
  });

  it("les marques priment sur le repli « lien » : github.com sort le logo GitHub, pas un globe", () => {
    expect(detectContactIcon("", "www.github.com/hariss24")).toBe("github");
  });

  it("détecte le permis de conduire", () => {
    expect(detectContactIcon("Permis", "B")).toBe("car");
    expect(detectContactIcon("", "Permis B, véhiculé")).toBe("car");
  });

  it("les portfolios et sites personnels tombent sur le globe", () => {
    expect(detectContactIcon("Portfolio", "monsite.fr")).toBe("globe");
    expect(detectContactIcon("Site web", "")).toBe("globe");
    expect(detectContactIcon("", "https://hariss.dev")).toBe("globe");
    expect(detectContactIcon("", "www.exemple.org")).toBe("globe");
  });

  it("détecte les autres champs usuels : Malt, disponibilité, email et téléphone libres", () => {
    expect(detectContactIcon("Malt", "malt.fr/profile/hariss")).toBe("malt");
    expect(detectContactIcon("Disponibilité", "immédiate")).toBe("calendar");
    expect(detectContactIcon("Email pro", "contact@hariss.dev")).toBe("email");
    expect(detectContactIcon("Fixe", "01 23 45 67 89")).toBe("phone");
    expect(detectContactIcon("WhatsApp", "+33 7 66 05 22 07")).toBe("whatsapp");
  });

  it("les champs non reconnus tombent sur le maillon de chaîne", () => {
    expect(detectContactIcon("Mobilité", "Île-de-France")).toBe("link");
    expect(detectContactIcon("Âge", "26 ans")).toBe("link");
    expect(detectContactIcon("Véhiculé", "oui")).toBe("link");
  });
});
