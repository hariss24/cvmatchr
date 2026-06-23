import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de la couche IA : on ne veut pas d'appel réseau ni de clé.
vi.mock("@/lib/ai/clients", () => ({ complete: vi.fn() }));

import { complete } from "@/lib/ai/clients";
import { POST } from "./route";

const mockComplete = vi.mocked(complete);

const BASE_RESUME = {
  name: "Jean Dupont",
  title: "Développeur",
  summary: "Profil.",
  photo: "data:image/png;base64,AAAAPHOTOSECRET",
  experience: [
    { title: "Dev", company: "ACME", date: "2020", bullets: ["a"] },
  ],
  skills: ["JS"],
  languages: [{ name: "Français", level: "Natif" }],
  interests: ["Lecture"],
  projects: [{ title: "Projet X", date: "2021", description: "desc" }],
  certifications: ["Cert A"],
  volunteer: [],
};

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/tailor-resume", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockComplete.mockReset();
});

describe("POST /api/tailor-resume", () => {
  it("adapte le CV, ne transmet jamais la photo, et applique l'anti-wipe", async () => {
    // L'IA renvoie un CV adapté qui a vidé langues/intérêts/projets et perdu la photo.
    mockComplete.mockResolvedValue(
      JSON.stringify({
        name: "Jean Dupont",
        title: "Développeur Senior",
        summary: "Profil orienté.",
        experience: [{ title: "Dev", company: "ACME", date: "2020", bullets: ["a+"] }],
        skills: ["JS", "TS"],
        languages: [],
        interests: [],
        projects: [],
        certifications: [],
        volunteer: [],
      }),
    );

    const res = await POST(makeRequest({ resume: BASE_RESUME, job_desc: "Poste TS", level: "adapte" }));
    expect(res.status).toBe(200);
    const { resume } = await res.json();

    // Adaptation appliquée.
    expect(resume.title).toBe("Développeur Senior");
    // Photo restaurée (jamais perdue).
    expect(resume.photo).toBe("data:image/png;base64,AAAAPHOTOSECRET");
    // Langues / intérêts toujours restaurés depuis la base.
    expect(resume.languages).toHaveLength(1);
    expect(resume.interests).toEqual(["Lecture"]);
    // Projets / certifs restaurés car l'IA les a vidés.
    expect(resume.projects).toHaveLength(1);
    expect(resume.certifications).toEqual(["Cert A"]);

    // La photo n'a JAMAIS été envoyée à l'IA.
    const sentContent = mockComplete.mock.calls[0][0][0].content;
    expect(sentContent).not.toContain("AAAAPHOTOSECRET");
    expect(sentContent).toContain("Poste TS");
  });

  it("choisit la base 'invention' pour le niveau sur-mesure", async () => {
    mockComplete.mockResolvedValue(JSON.stringify(BASE_RESUME));
    await POST(makeRequest({ resume: BASE_RESUME, job_desc: "x", level: "sur-mesure" }));
    const system = mockComplete.mock.calls[0][1];
    expect(system).toContain("optimisation de CV agressive");
  });

  it("rejette une offre manquante", async () => {
    const res = await POST(makeRequest({ resume: BASE_RESUME, job_desc: "" }));
    expect(res.status).toBe(400);
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it("renvoie 400 si aucune clé API n'est disponible", async () => {
    mockComplete.mockRejectedValue(new Error("Aucune clé API configurée."));
    const res = await POST(makeRequest({ resume: BASE_RESUME, job_desc: "x" }));
    expect(res.status).toBe(400);
  });
});
