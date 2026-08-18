import test from "node:test";
import assert from "node:assert/strict";
import { mesurer } from "./mesurer-pertinence.mjs";

test("mesurer-pertinence : rejoue la sélection et calcule les pertinents", () => {
  const fakeData = [
    {
      ats: "greenhouse",
      slug: "test1",
      id: "1",
      entreprise: "TestCorp",
      titre: "Chef de projet marketing digital",
      lieu: "Paris",
      url: "https://example.com/1",
      publieLe: new Date().toISOString(),
      decouverteLe: new Date().toISOString(),
    },
    {
      ats: "greenhouse",
      slug: "test2",
      id: "2",
      entreprise: "OtherCorp",
      titre: "Chef de projet supply chain",
      lieu: "Paris",
      url: "https://example.com/2",
      publieLe: new Date().toISOString(),
      decouverteLe: new Date().toISOString(),
    },
  ];

  const res = mesurer(["chef de projet marketing"], { data: fakeData });
  assert.equal(res.candidatsCount, 2);
  assert.equal(res.pertinentsDispos, 1);
  assert.equal(res.retenusCount, 2);
  assert.equal(res.pertinentsRetenus, 1);
});
