import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrapeJobText } from "./scraper";
import * as ssrf from "./ssrf";

// Mock global fetch
const originalFetch = global.fetch;

describe("scraper", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(ssrf, "validateUrlForScraping").mockImplementation(async (url) => url);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should extract text from direct fetch if valid HTML", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `
        <html><head><title>Test Job</title></head>
        <body>
          <div class="job-description">
            We are looking for a software engineer to join our amazing team.
            Requirements: 10 years of experience with HTML.
            ${"pad".repeat(100) /* make it longer than 200 chars */}
          </div>
        </body></html>
      `
    } as any);

    const res = await scrapeJobText("https://example.com/job");
    expect(res.title).toBe("Test Job");
    expect(res.text).toContain("We are looking for a software engineer");
    expect(global.fetch).toHaveBeenCalledTimes(1); // No fallback to Jina
  });

  it("should fallback to Jina if direct fetch returns 403", async () => {
    // 1st call (direct) -> 403
    // 2nd call (jina) -> success
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (url.toString().startsWith("https://r.jina.ai/")) {
        return {
          ok: true,
          status: 200,
          text: async () => "# Job Title\n\nWe are looking for a ninja."
        } as any;
      }
      return {
        ok: false,
        status: 403
      } as any;
    });

    const res = await scrapeJobText("https://example.com/blocked");
    expect(res.text).toBe("# Job Title\n\nWe are looking for a ninja.");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should fallback to Jina if extracted text is too short", async () => {
    // 1st call (direct) -> 200 OK but tiny text
    // 2nd call (jina) -> success
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (url.toString().startsWith("https://r.jina.ai/")) {
        return {
          ok: true,
          status: 200,
          text: async () => "Jina extracted text"
        } as any;
      }
      return {
        ok: true,
        status: 200,
        text: async () => `<html><body><div class="job-description">Tiny text</div></body></html>`
      } as any;
    });

    const res = await scrapeJobText("https://example.com/short");
    expect(res.text).toBe("Jina extracted text");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("should throw if Jina is also blocked", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403
    } as any);

    await expect(scrapeJobText("https://example.com/ultra-blocked")).rejects.toThrow("accès bloqué par le site");
  });

  it("réécrit les URL LinkedIn « collections » en URL publique /jobs/view/", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `
        <html><head><title>Offre</title></head>
        <body><div class="job-description">
          Description complète de l'offre. ${"pad".repeat(100)}
        </div></body></html>
      `,
    } as any);

    await scrapeJobText("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4433125093");
    const calledUrls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(calledUrls[0]).toBe("https://www.linkedin.com/jobs/view/4433125093");
  });

  it("réécrit les URL Indeed « ?vjk= » en URL publique /viewjob?jk=", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => `
        <html><head><title>Offre</title></head>
        <body><div class="job-description">
          Description complète de l'offre. ${"pad".repeat(100)}
        </div></body></html>
      `,
    } as any);

    await scrapeJobText("https://fr.indeed.com/?vjk=32cd9f9758698f36");
    const calledUrls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(calledUrls[0]).toBe("https://fr.indeed.com/viewjob?jk=32cd9f9758698f36");
  });

  it("refuse une redirection vers une IP privée (SSRF via 302)", async () => {
    // La validation SSRF rejette les URL privées (simulation du comportement réel).
    vi.spyOn(ssrf, "validateUrlForScraping").mockImplementation(async (url) => {
      if (url.includes("127.0.0.1")) throw new Error("URL non autorisée.");
      return url;
    });
    vi.mocked(global.fetch).mockImplementation(async (url) => {
      if (url.toString().startsWith("https://r.jina.ai/")) {
        return { ok: false, status: 500 } as any; // fallback Jina en échec
      }
      return {
        ok: false,
        status: 302,
        headers: new Headers({ location: "http://127.0.0.1/admin" }),
      } as any;
    });

    await expect(scrapeJobText("https://example.com/offre")).rejects.toThrow(/bloqué/);
    // Le fetch ne doit JAMAIS avoir été appelé sur l'IP privée.
    const calledUrls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
    expect(calledUrls.some((u) => u.includes("127.0.0.1"))).toBe(false);
  });

  describe("fallback microservice Camoufox", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("utilise le microservice si le fetch direct est bloqué, sans appeler Jina", async () => {
      vi.stubEnv("SCRAPER_URL", "http://127.0.0.1:8765");
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        if (url.toString().startsWith("http://127.0.0.1:8765/scrape")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ text: "Texte extrait par Camoufox", title: "Offre LinkedIn" }),
          } as any;
        }
        if (url.toString().startsWith("https://r.jina.ai/")) {
          throw new Error("Jina ne doit pas être appelé");
        }
        return { ok: false, status: 403 } as any;
      });

      const res = await scrapeJobText("https://example.com/blocked");
      expect(res.text).toBe("Texte extrait par Camoufox");
      expect(res.title).toBe("Offre LinkedIn");
      const calledUrls = vi.mocked(global.fetch).mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u.startsWith("https://r.jina.ai/"))).toBe(false);
    });

    it("retombe sur Jina si le microservice est en échec", async () => {
      vi.stubEnv("SCRAPER_URL", "http://127.0.0.1:8765");
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        if (url.toString().startsWith("http://127.0.0.1:8765/scrape")) {
          return { ok: false, status: 502 } as any;
        }
        if (url.toString().startsWith("https://r.jina.ai/")) {
          return {
            ok: true,
            status: 200,
            text: async () => "Texte extrait par Jina",
          } as any;
        }
        return { ok: false, status: 403 } as any;
      });

      const res = await scrapeJobText("https://example.com/blocked");
      expect(res.text).toBe("Texte extrait par Jina");
    });

    it("retombe sur Jina si le microservice est injoignable (service éteint)", async () => {
      vi.stubEnv("SCRAPER_URL", "http://127.0.0.1:8765");
      vi.mocked(global.fetch).mockImplementation(async (url) => {
        if (url.toString().startsWith("http://127.0.0.1:8765/scrape")) {
          throw new Error("ECONNREFUSED");
        }
        if (url.toString().startsWith("https://r.jina.ai/")) {
          return {
            ok: true,
            status: 200,
            text: async () => "Texte extrait par Jina",
          } as any;
        }
        return { ok: false, status: 403 } as any;
      });

      const res = await scrapeJobText("https://example.com/blocked");
      expect(res.text).toBe("Texte extrait par Jina");
    });
  });
});
