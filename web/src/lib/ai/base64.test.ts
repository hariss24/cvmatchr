import { describe, it, expect } from "vitest";
import {
  stripBase64ForTailor,
  restoreBase64InTailor,
  stripBase64ForChat,
  restoreBase64InProposals,
  stripBase64FromJson,
  restoreBase64InJson,
  PHOTO_PLACEHOLDER,
} from "./base64";

const IMG_A = "data:image/png;base64," + "A".repeat(40);
const IMG_B = "data:image/jpeg;base64," + "B".repeat(40);

describe("strip/restore tailor", () => {
  it("round-trip une image : restauration identique", () => {
    const html = `<img src="${IMG_A}"><p>x</p>`;
    const { html: stripped, map } = stripBase64ForTailor(html);
    expect(stripped).toBe('<img src="[IMAGE_BASE64_0]"><p>x</p>');
    expect(restoreBase64InTailor(stripped, map)).toBe(html);
  });

  it("round-trip plusieurs images avec placeholders indexés", () => {
    const html = `<img src="${IMG_A}"><img src="${IMG_B}">`;
    const { html: stripped, map } = stripBase64ForTailor(html);
    expect(stripped).toBe('<img src="[IMAGE_BASE64_0]"><img src="[IMAGE_BASE64_1]">');
    expect(Object.keys(map)).toHaveLength(2);
    expect(restoreBase64InTailor(stripped, map)).toBe(html);
  });

  it("ne touche pas une src non base64 ni les data: trop courts", () => {
    const html = '<img src="photo.png"><img src="data:image/png;base64,abc">';
    const { html: stripped, map } = stripBase64ForTailor(html);
    expect(stripped).toBe(html);
    expect(Object.keys(map)).toHaveLength(0);
  });

  it("restore gère un html vide", () => {
    expect(restoreBase64InTailor("", {})).toBe("");
  });
});

describe("strip/restore chat", () => {
  it("retire toutes les images mais mémorise la première (sans src=)", () => {
    const html = `<img src="${IMG_A}"><img src="${IMG_B}">`;
    const { html: stripped, data } = stripBase64ForChat(html);
    expect(stripped).toBe('<img src="[IMAGE_BASE64]"><img src="[IMAGE_BASE64]">');
    expect(data).toBe(IMG_A);
  });

  it("data null si aucune image", () => {
    const { html: stripped, data } = stripBase64ForChat("<p>rien</p>");
    expect(stripped).toBe("<p>rien</p>");
    expect(data).toBeNull();
  });

  it("restaure la photo dans la 1re occurrence de chaque proposition", () => {
    const { data } = stripBase64ForChat(`<img src="${IMG_A}">`);
    const proposals = [
      { title: "t", html: '<div><img src="[IMAGE_BASE64]"></div>' },
      { title: "u", html: undefined as string | undefined },
    ];
    const restored = restoreBase64InProposals(proposals, data);
    expect(restored[0].html).toBe(`<div><img src="${IMG_A}"></div>`);
    expect(restored[1].html).toBeUndefined();
  });

  it("ne modifie rien si data null", () => {
    const proposals = [{ html: '<img src="[IMAGE_BASE64]">' }];
    expect(restoreBase64InProposals(proposals, null)).toBe(proposals);
  });
});

describe("strip/restore json", () => {
  it("remplace la photo par le placeholder", () => {
    const json = { name: "test", photo: IMG_A };
    const { json: stripped, data } = stripBase64FromJson(json);
    expect(stripped.photo).toBe(PHOTO_PLACEHOLDER);
    expect(data).toBe(IMG_A);
    expect(json.photo).toBe(IMG_A); // original inchangé
  });

  it("ne touche pas si photo absente ou courte", () => {
    const json = { name: "test", photo: "courte" };
    const { json: stripped, data } = stripBase64FromJson(json);
    expect(stripped.photo).toBe("courte");
    expect(data).toBeNull();
  });

  it("restaure la photo si placeholder inchangé", () => {
    const json = { photo: PHOTO_PLACEHOLDER };
    const restored = restoreBase64InJson(json, IMG_B);
    expect(restored.photo).toBe(IMG_B);
  });

  it("ne restaure pas si placeholder a été supprimé ou modifié", () => {
    const json1 = { photo: "" };
    expect(restoreBase64InJson(json1, IMG_B).photo).toBe("");

    const json2 = { photo: "data:image/png;base64,nouvelle_image" };
    expect(restoreBase64InJson(json2, IMG_B).photo).toBe("data:image/png;base64,nouvelle_image");
  });
});
