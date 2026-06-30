import * as cheerio from "cheerio";
import { validateUrlForScraping } from "./ssrf";

const EXTRACT_MAX_CHARS = 15_000;

export async function scrapeJobText(url: string): Promise<{ text: string; title: string }> {
  // 1. Validate the URL and protect against SSRF
  const safeUrl = await validateUrlForScraping(url);

  let html = "";
  let isBlocked = false;

  try {
    // 2. Fetch the page directly
    const res = await fetch(safeUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Googlebot/2.1; +http://www.google.com/bot.html) Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        isBlocked = true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } else {
      html = await res.text();
    }
  } catch {
    // If fetch failed completely (e.g. timeout, connection reset), try fallback
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

  // 3. Fallback to Jina AI if blocked or poor extraction
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

  // 4. Truncate
  if (text.length > EXTRACT_MAX_CHARS) {
    text = text.substring(0, EXTRACT_MAX_CHARS) + "... [TRONQUÉ]";
  }

  return { text, title };
}
