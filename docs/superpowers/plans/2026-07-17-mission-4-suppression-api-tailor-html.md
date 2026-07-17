# Mission 4 — Supprimer le pipeline HTML côté serveur (`/api/tailor` + prompts HTML)

Tu es un développeur chargé d'une suppression chirurgicale dans **CV Tailor**,
une app Next.js 16 / React 19 / TypeScript strict située dans `web/`. Ne touche
à rien d'autre que ce qui est décrit ici.

## Contexte

L'app a migré vers un pipeline 100 % JSON → react-pdf. La route `/api/tailor`
(adaptation HTML → HTML en streaming SSE, « mode expert HTML ») est un vestige :
**aucun composant client ne l'appelle** (vérifié par grep — seul son propre test
la référence). Le propriétaire a confirmé qu'elle est obsolète. On la supprime,
ainsi que ses dépendances exclusives : le helper de streaming `stream.ts` et le
bloc « prompts HTML » de `prompts.ts`.

## Suppressions de fichiers

Supprimer entièrement :

- `web/src/app/api/tailor/` (dossier complet : `route.ts` + `route.test.ts`)
- `web/src/lib/ai/stream.ts` et `web/src/lib/ai/stream.test.ts`
  (`stream.ts` n'est importé que par `/api/tailor` — vérifié)

## Modifications dans `web/src/lib/ai/prompts.ts`

Supprimer les symboles suivants (tout le bloc commenté
`// ---- adaptation HTML, par niveau (pipeline HTML legacy) ---------------------`
sauf le type `TailorLevel` qui reste — il est utilisé par le pipeline JSON) :

1. `TAILOR_SYSTEMS` (lignes ~104-185) — le `Record<TailorLevel, string>` des
   prompts HTML par niveau.
2. `COMMON_HTML_RULES` (lignes ~187-226).
3. `REWRITE_HTML_RULES` (lignes ~228-241).
4. La fonction `tailorHtmlSystem` (lignes ~439-472, docstring incluse).
5. `PRESERVE_RULE` et `ELAGUE_RULE` (définies en tête de fichier, lignes ~13-21)
   **uniquement si** plus aucune référence après les suppressions 1-4 —
   vérifie avec `grep -n "PRESERVE_RULE\|ELAGUE_RULE" web/src/lib/ai/prompts.ts`.
   (Attendu : plus aucune — elles n'étaient utilisées que par les prompts HTML.)

**Garde intact** : `export type TailorLevel = "peu" | "adapte" | "hyper" | "sur-mesure";`
(ligne ~102 — la mission 5 s'en occupera), ainsi que tout le bloc
`// ---- schéma JSON + adaptation JSON (pipeline /api/tailor-resume) -------------`
et tout ce qui suit (`RESUME_SCHEMA_DESC`, `SECTION_ROUTING_RULES`,
`RESUME_TAILOR_RULES`, `SYSTEM_TAILOR_RESUME_BASE*`, `tailorResumeSystem`,
prompts du chat, etc.).

## Modifications dans `web/src/lib/ai/prompts.test.ts`

Supprimer tous les tests qui référencent les symboles supprimés :

- l'import de `TAILOR_SYSTEMS`, `tailorHtmlSystem`, `COMMON_HTML_RULES`,
  `REWRITE_HTML_RULES` (et `PRESERVE_RULE`/`ELAGUE_RULE` si importés) ;
- les `it(...)` qui les utilisent, notamment (lignes approximatives) :
  `TAILOR_SYSTEMS[level] ... ANTI-DÉTECTION` (~l.26),
  « tailorHtmlSystem inclut les règles HTML communes » (~l.80),
  « tailorHtmlSystem en mode Maître bascule en élagage » (~l.86),
  ceux vers ~l.131, ~l.136-146 et ~l.151 (« le sur-mesure HTML n'autorise plus
  les chiffres inventés »).

**Garde intacts** tous les tests portant sur `tailorResumeSystem` et les autres
prompts JSON (ne supprime pas un test simplement parce qu'il mentionne un niveau).

## Règles du projet (non négociables)

- Suppression chirurgicale : ne reformate pas le reste de `prompts.ts`, ne
  renumérote pas, ne « nettoie » rien d'autre.
- Ne touche PAS à `/api/tailor-resume` (pipeline JSON actif) malgré le nom proche.
- N'anticipe pas les missions suivantes (sur-mesure, docStore) — elles arrivent.

## Vérification (depuis `web/`)

```bash
grep -rn "api/tailor\"" src | grep -v tailor-resume   # attendu : aucun résultat
grep -rn "tailorHtmlSystem\|TAILOR_SYSTEMS\|COMMON_HTML_RULES\|REWRITE_HTML_RULES" src   # attendu : aucun résultat
npx tsc --noEmit    # attendu : aucune erreur
npm run lint        # attendu : aucune erreur
npm test            # attendu : tous les tests passent
```

## Commit

```
refactor(ai): supprime le pipeline d'adaptation HTML legacy (/api/tailor, stream, prompts HTML)

Le mode expert HTML est obsolète depuis la migration JSON/react-pdf : la route
n'avait plus aucun appelant côté client. Décision d'audit du 17/07/2026.
```
