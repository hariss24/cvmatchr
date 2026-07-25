import { describe, it, expect } from "vitest";
import { deriveStatus, daysSince, summarize } from "./status";
import type { Application, ApplicationEvent } from "./types";

const DAY = 86400000;
const NOW = new Date("2026-07-25T12:00:00Z").getTime();

function app(events: ApplicationEvent[]): Application {
  return {
    id: "x", createdAt: events[0]?.date ?? NOW,
    company: "Acme", role: "Dev", normKey: "acme|dev",
    jobText: "", jobUrl: "", source: "manual",
    events, notes: "", updatedAt: NOW,
  };
}
const applied = (daysAgo: number): ApplicationEvent =>
  ({ date: NOW - daysAgo * DAY, type: "applied", source: "system" });

describe("deriveStatus", () => {
  it("un refus gagne sur tout le reste", () => {
    const a = app([applied(200), { date: NOW - 190 * DAY, type: "interview", source: "manual" }, { date: NOW - 180 * DAY, type: "rejected", source: "manual" }]);
    expect(deriveStatus(a, NOW, 30)).toBe("rejected");
  });

  it("un entretien empêche le passage en sans suite, même à 200 jours", () => {
    const a = app([applied(200), { date: NOW - 199 * DAY, type: "interview", source: "manual" }]);
    expect(deriveStatus(a, NOW, 30)).toBe("interview");
  });

  it("31 jours de silence avec un seuil de 30 donne sans suite", () => {
    expect(deriveStatus(app([applied(31)]), NOW, 30)).toBe("stale");
  });

  it("29 jours de silence reste en cours", () => {
    expect(deriveStatus(app([applied(29)]), NOW, 30)).toBe("applied");
  });

  it("une note récente ne rajeunit pas une candidature morte", () => {
    const a = app([applied(60), { date: NOW, type: "note", source: "manual", detail: "relu" }]);
    expect(deriveStatus(a, NOW, 30)).toBe("stale");
  });

  it("respecte un seuil personnalisé", () => {
    expect(deriveStatus(app([applied(20)]), NOW, 14)).toBe("stale");
  });
});

describe("daysSince", () => {
  it("compte les jours depuis la candidature, pas depuis le dernier événement", () => {
    const a = app([applied(40), { date: NOW - 2 * DAY, type: "interview", source: "manual" }]);
    expect(daysSince(a, NOW)).toBe(40);
  });
});

describe("summarize", () => {
  it("agrège les compteurs et le taux de réponse", () => {
    const apps = [
      app([applied(2)]),
      app([applied(5)]),
      app([applied(10), { date: NOW - 3 * DAY, type: "interview", source: "manual" }]),
      app([applied(20), { date: NOW - 1 * DAY, type: "rejected", source: "manual" }]),
      app([applied(50)]),
    ];
    const s = summarize(apps, NOW, 30);
    expect(s.total).toBe(5);
    expect(s.applied).toBe(2);
    expect(s.interview).toBe(1);
    expect(s.rejected).toBe(1);
    expect(s.stale).toBe(1);
    expect(s.answered).toBe(2);
    expect(s.responseRate).toBe(40);
    expect(s.oldest).toBe(NOW - 50 * DAY);
  });

  it("ne divise pas par zéro sur une liste vide", () => {
    const s = summarize([], NOW, 30);
    expect(s.total).toBe(0);
    expect(s.responseRate).toBe(0);
    expect(s.oldest).toBeNull();
  });
});
