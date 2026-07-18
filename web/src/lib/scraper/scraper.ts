import * as cheerio from "cheerio";
import { validateUrlForScraping } from "./ssrf";

const EXTRACT_MAX_CHARS = 15_000;

// LinkedIn/Indeed : les URL de navigation (?currentJobId= / ?vjk=) affichent
// l'offre dans un panneau JS ou derrière un mur de connexion — le scraping n'y
// voit que la page d'accueil. La même offre a une page publique dédiée
// (/jobs/view/<id>, /viewjob?jk=<id>) — on réécrit avant de scraper.
function normalizeJobUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "linkedin.com" || u.hostname.endsWith(".linkedin.com")) {
      const id = u.searchParams.get("currentJobId");
      if (id && /^\d+$/.test(id)) return `https://www.linkedin.com/jobs/view/${id}`;
    }
    if (u.hostname === "indeed.com" || u.hostname.endsWith(".indeed.com")) {
      const id = u.searchParams.get("vjk");
      if (id && /^[0-9a-f]+$/i.test(id)) return `https://${u.hostname}/viewjob?jk=${id}`;
    }
  } catch {
    // URL invalide : laissée telle quelle, la validation SSRF la rejettera.
  }
  return url;
}

export async function scrapeJobText(url: string): Promise<{ text: string; title: string }> {
  // 1. Validate the URL and protect against SSRF
  const safeUrl = await validateUrlForScraping(normalizeJobUrl(url));

  let html = "";
  let isBlocked = false;

  const MAX_REDIRECTS = 3;

  try {
    // 2. Fetch de la page — redirections suivies manuellement : chaque saut est
    // revalidé contre les IP privées (sinon un 302 contournerait la protection SSRF).
    let currentUrl = safeUrl;
    let res: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      res = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          "User-Agent":
            "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc || i === MAX_REDIRECTS) throw new Error("BLOCKED");
        // URL relative possible dans Location : résoudre par rapport à l'URL courante.
        currentUrl = await validateUrlForScraping(new URL(loc, currentUrl).toString());
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      const status = res?.status ?? 0;
      if (status === 401 || status === 403 || status >= 500) {
        isBlocked = true;
      } else {
        throw new Error(`HTTP ${status}`);
      }
    } else {
      html = await res.text();
    }
  } catch {
    // Fetch impossible (timeout, connexion coupée, redirection non autorisée) : fallback.
    isBlocked = true;
  }

  // Check if we got an empty or suspiciously short response (often the case with JS challenges)
  if (!isBlocked && html.length < 500) {
    isBlocked = true;
  }

  let text = "";
  let title = "";

  if (!isBlocked) {
    const $ = cheerio.load(html);
    title = $("title").text().trim();

    // Remove noise
    const noiseSelectors = [
      'nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript',
      '[class*="cookie"]', '[class*="Cookie"]', '[id*="cookie"]',
      '[class*="banner"]', '[class*="modal"]', '[class*="popup"]',
      '[class*="sidebar"]', '[class*="Sidebar"]',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]'
    ];
    noiseSelectors.forEach((sel) => $(sel).remove());

    // Find candidate containers
    const candidates = [
      '[class*="job-description"]',
      '[class*="offer-description"]',
      '[class*="jobDescription"]',
      '[class*="posting-description"]',
      '[data-qa="job-description"]',
      'article',
      'main',
      'body',
    ];

    for (const sel of candidates) {
      const el = $(sel).first();
      if (el.length > 0) {
        // We use text() but we need spacing like innerText. Cheerio's .text() just concatenates.
        // Let's format it a bit better by replacing block elements with line breaks.
        el.find("br, p, div, h1, h2, h3, h4, h5, h6, li").append("\n");
        const t = el.text().replace(/\s+/g, " ").trim();
        if (t.length > 100) {
          text = t;
          break;
        }
      }
    }

    if (text.length < 200) {
      isBlocked = true; // Fallback to Jina if extraction is too short
    }
  }

  // 3. Fallback microservice Camoufox (navigateur furtif local) si configuré.
  if ((isBlocked || !text) && process.env.SCRAPER_URL) {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.SCRAPER_TOKEN) {
        headers["Authorization"] = `Bearer ${process.env.SCRAPER_TOKEN}`;
      }
      const res = await fetch(`${process.env.SCRAPER_URL}/scrape`, {
        method: "POST",
        headers,
        body: JSON.stringify({ url: safeUrl }),
        // Lancement du navigateur + pages lourdes : timeout volontairement long.
        signal: AbortSignal.timeout(60000),
      });
      if (res.ok) {
        const data = (await res.json()) as { text?: string; title?: string };
        if (data.text && data.text.trim().length > 0) {
          text = data.text;
          title = title || data.title || "";
          isBlocked = false;
        }
      }
    } catch {
      // Service éteint ou en échec : on retombe sur Jina.
      console.error("Microservice Camoufox indisponible, fallback Jina.");
    }
  }

  // 4. Fallback to Jina AI if blocked or poor extraction
  if (isBlocked || !text) {
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${safeUrl}`, {
        headers: {
          "Accept": "text/event-stream", // or application/json, but text/plain returns markdown by default
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!jinaRes.ok) {
        throw new Error("BLOCKED");
      }

      const md = await jinaRes.text();
      
      // Jina returns a markdown file where title is usually at the top or in the URL.
      text = md.trim();
      if (!text || text.includes("Enable JavaScript and cookies to continue") || text.includes("Attention Required! | Cloudflare")) {
         throw new Error("BLOCKED");
      }

    } catch {
      throw new Error("Impossible d'extraire l'offre : accès bloqué par le site (Cloudflare/Captcha). Essayez de copier-coller le texte manuellement.");
    }
  }

  // 5. Truncate
  if (text.length > EXTRACT_MAX_CHARS) {
    text = text.substring(0, EXTRACT_MAX_CHARS) + "... [TRONQUÉ]";
  }

  return { text, title };
}
