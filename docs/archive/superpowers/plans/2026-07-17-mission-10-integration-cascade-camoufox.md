# Mission 10 — Intégration du microservice Camoufox dans la cascade d'extraction

Tu es un développeur chargé d'une modification chirurgicale dans **CV Tailor**
(Next.js 16 / TypeScript strict, code dans `web/`). Travaille sur la branche
**`camoufox-scraper`** (la Mission 9 y a créé `scraper-service/`). Ne touche à
rien d'autre que les fichiers listés.

## Contexte

`web/src/lib/scraper/scraper.ts` extrait le texte d'une offre : fetch+cheerio,
puis fallback Jina AI si bloqué. Un micro-service Camoufox local
(`http://127.0.0.1:8765`, voir `scraper-service/README.md`) sait contourner
les protections anti-bot. Il faut l'insérer **entre** les deux : la cascade
devient fetch+cheerio → Camoufox → Jina.

**Règle absolue : si `process.env.SCRAPER_URL` n'est pas définie, le
comportement doit rester strictement identique à l'actuel** (prod Vercel).

## Fichiers

- Modifier : `web/src/lib/scraper/scraper.ts`
- Modifier : `web/src/lib/scraper/scraper.test.ts`
- Modifier : `web/.env.local` (ajout de variables, ne rien retirer)

## 1. `web/src/lib/scraper/scraper.ts`

Dans `scrapeJobText`, **entre** le bloc qui se termine par
`if (text.length < 200) { isBlocked = true; ... }` et le bloc
`// 3. Fallback to Jina AI if blocked or poor extraction`, insérer :

```ts
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
```

Puis renuméroter les commentaires existants : `// 3. Fallback to Jina AI...`
devient `// 4. Fallback to Jina AI...` et `// 4. Truncate` devient
`// 5. Truncate`. **Aucune autre modification** dans ce fichier (le bloc Jina
et sa condition `if (isBlocked || !text)` restent tels quels : après un succès
Camoufox, `isBlocked` vaut `false` et `text` est rempli, donc Jina est sauté).

## 2. `web/src/lib/scraper/scraper.test.ts`

Les 5 tests existants doivent continuer à passer **sans modification** (ils
tournent sans `SCRAPER_URL`). Ajouter en fin de `describe("scraper", ...)` :

```ts
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
```

Note : `afterEach` est déjà importé de vitest en tête de fichier ; n'ajoute
aucun import.

## 3. `web/.env.local`

Ajouter à la fin (sans toucher aux lignes existantes) :

```
# Microservice de scraping Camoufox (local — voir scraper-service/README.md)
SCRAPER_URL=http://127.0.0.1:8765
# SCRAPER_TOKEN=   # requis uniquement si le service est hébergé sur Internet
```

## Vérifications (obligatoires avant de conclure)

Depuis `web/` :

1. `npx tsc --noEmit` → aucune erreur.
2. `npm run lint` → aucune erreur.
3. `npm test` → tous les tests passent, y compris les 5 tests scraper
   existants (inchangés) et les 3 nouveaux.

## Commit

```
feat(scraper): fallback Camoufox dans la cascade d'extraction d'offres

La cascade devient fetch+cheerio → microservice Camoufox (si SCRAPER_URL
est définie) → Jina AI. Sans SCRAPER_URL, comportement inchangé (prod).
Timeout 60 s, token Bearer optionnel, 3 tests Vitest ajoutés.
```
