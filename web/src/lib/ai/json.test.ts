import { describe, it, expect } from "vitest";
import { parseAiJson } from "./json";

describe("parseAiJson", () => {
  it("parse du JSON brut", () => {
    expect(parseAiJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("retire les clôtures markdown ```json", () => {
    expect(parseAiJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseAiJson('```\n{"b":2}\n```')).toEqual({ b: 2 });
  });

  it("gère les espaces autour", () => {
    expect(parseAiJson('   {"c":3}   ')).toEqual({ c: 3 });
  });

  it("lève sur du JSON malformé", () => {
    expect(() => parseAiJson("pas du json")).toThrow(/JSON malformé/);
  });
});
