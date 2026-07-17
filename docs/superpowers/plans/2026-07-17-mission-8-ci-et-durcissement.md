# Mission 8 — Fusion CI, durcissement du scraper, limites de taille d'entrée

Tu es un développeur chargé de trois petits chantiers indépendants dans
**CV Tailor** (Next.js 16 / TypeScript strict, code dans `web/`). Ne touche à
rien d'autre que ce qui est décrit ici.

## Volet A — Un seul workflow CI

`.github/workflows/ci.yml` (lint + vitest, Node 22) est un sous-ensemble strict
de `.github/workflows/web.yml` (tsc + lint + vitest + build + e2e, Node 20) :
chaque push exécute lint et vitest deux fois.

1. **Supprimer** `.github/workflows/ci.yml`.
2. Dans `.github/workflows/web.yml` :
   - trigger `push.branches` : `[main]` (retirer `rewrite-nextjs`, branche morte) ;
   - `node-version: "22"` (aligné sur le dev local et l'ancien ci.yml).
   Ne rien changer d'autre (les steps tsc/lint/vitest/build/playwright restent).

## Volet B — Redirections HTTP revalidées dans le scraper (anti-SSRF)

`web/src/lib/scraper/scraper.ts` valide l'URL contre les IP privées
(`validateUrlForScraping`) **puis** fait un `fetch` qui suit les redirections
par défaut : une réponse `302 Location: http://127.0.0.1/...` contourne toute
la validation. Correctif : suivre les redirections manuellement en revalidant
chaque saut.

Dans `scraper.ts`, remplacer le bloc du fetch direct (actuellement lignes
~13-37, de `try {` du premier fetch jusqu'à son `catch`) par :

```ts
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
```

Le reste du fichier (extraction cheerio, fallback Jina, troncature) ne change
pas. Note : si `validateUrlForScraping` rejette un saut, l'erreur est avalée
par le `catch` → `isBlocked = true` → fallback Jina, qui ne reçoit que
`safeUrl` déjà validée. C'est le comportement voulu.

### Test à ajouter dans `web/src/lib/scraper/scraper.test.ts`

Le fichier mocke déjà `global.fetch` (`vi.fn()` dans `beforeEach`) et
`ssrf.validateUrlForScraping` en passthrough
(`vi.spyOn(ssrf, "validateUrlForScraping").mockImplementation(async (url) => url)`).
Ajouter ce test dans le `describe("scraper", ...)` existant :

```ts
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
```

Note : avec `redirect: "manual"`, la réponse mockée doit exposer
`res.status` (3xx) et `res.headers.get("location")` — d'où le `new Headers(...)`
ci-dessus. Vérifie aussi que les tests existants du fichier passent toujours :
leurs réponses mockées `{ ok: true, text: ... }` n'ont pas de `status`, or le
nouveau code lit `res.status` uniquement quand `!res.ok` — si un test existant
casse, ajoute-lui un `status: 200` explicite plutôt que de modifier le scraper.

## Volet C — Borner la taille des textes envoyés à l'IA

Les routes IA acceptent des textes sans limite de longueur (coût tokens).
`ats-score` clampe déjà les siens (`.slice(0, max)`, ligne 14 de sa route) —
appliquer le même principe ailleurs. Dans chacun des fichiers suivants,
clamper à **30 000 caractères** au moment du `.trim()` :

| Fichier | Ligne actuelle | Remplacement |
|---|---|---|
| `web/src/app/api/tailor-resume/route.ts:35` | `const jobDesc = (body.job_desc ?? "").trim();` | `const jobDesc = (body.job_desc ?? "").trim().slice(0, 30_000);` |
| `web/src/app/api/adapt-letter/route.ts:27` | `const letterBody = (body.letter_body ?? "").trim();` | `const letterBody = (body.letter_body ?? "").trim().slice(0, 30_000);` |
| `web/src/app/api/adapt-letter/route.ts:28` | `const jobDesc = (body.job_desc ?? "").trim();` | `const jobDesc = (body.job_desc ?? "").trim().slice(0, 30_000);` |
| `web/src/app/api/extract-meta/route.ts:19` | `const jobDesc = (body.job_desc ?? "").trim();` | `const jobDesc = (body.job_desc ?? "").trim().slice(0, 30_000);` |
| `web/src/app/api/text-to-resume/route.ts:26` | `const text = (body.text ?? "").trim();` | `const text = (body.text ?? "").trim().slice(0, 30_000);` |
| `web/src/app/api/text-to-letter/route.ts:25` | `const text = (body.text ?? "").trim();` | `const text = (body.text ?? "").trim().slice(0, 30_000);` |
| `web/src/app/api/editor-chat/route.ts:41` | `` if (body.job_desc) context += `\n\nOffre d'emploi cible :\n${body.job_desc}`; `` | `` if (body.job_desc) context += `\n\nOffre d'emploi cible :\n${String(body.job_desc).slice(0, 30_000)}`; `` |

Pas de constante partagée, pas d'erreur 413 : un clamp silencieux suffit
(30 000 caractères couvrent toute offre d'emploi réelle).

## Volet D — Nettoyer les identifiants de templates fantômes

`web/src/lib/pdfgen/ResumeDocument.tsx` ligne 8 expose des templates jamais
implémentés (`moderne`, `classique`, `minimal`) avec fallback silencieux.
Remplacer :

```ts
export type PdfTemplateId = "graphique" | "sobre" | "moderne" | "classique" | "minimal" | "kakuna" | "marine";
```

par :

```ts
export type PdfTemplateId = "graphique" | "sobre" | "kakuna" | "marine";
```

Si le `switch` du composant a des `case` dédiés à `moderne`/`classique`/`minimal`,
les supprimer (le `default` → Graphique reste). Si un autre fichier référence
ces trois identifiants (`npx tsc --noEmit` le dira), retirer la référence de la
même façon et le signaler dans ton rapport.

## Règles du projet (non négociables)

- Chaque volet est indépendant : un problème sur l'un ne bloque pas les autres,
  mais signale-le.
- Ne modifie pas `ssrf.ts` (la validation elle-même est correcte) — seulement
  son utilisation dans `scraper.ts`.
- Ne change ni le User-Agent ni le fallback Jina.

## Vérification (depuis `web/`)

```bash
ls ../.github/workflows            # attendu : web.yml uniquement
grep -n "redirect" src/lib/scraper/scraper.ts   # attendu : redirect: "manual"
grep -rn "moderne\|classique\|minimal" src/lib/pdfgen   # attendu : aucun identifiant fantôme
npx tsc --noEmit    # attendu : aucune erreur
npm run lint        # attendu : aucune erreur
npm test            # attendu : tous les tests passent, dont le nouveau test SSRF
```

## Commit (un seul, ou un par volet — au choix)

```
chore: fusionne la CI, revalide les redirections du scraper (SSRF), borne les entrées IA

- CI : suppression du workflow redondant ci.yml, web.yml passe en Node 22
- Scraper : redirections suivies manuellement avec revalidation anti-IP privée
- Routes IA : textes clampés à 30 000 caractères
- PdfTemplateId : retrait des identifiants jamais implémentés
```
