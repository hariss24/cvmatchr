# Mission 2 — Analyse ATS en un clic : IA directe, moteur local en secours

Tu es un développeur chargé d'une modification chirurgicale dans **CV Tailor**,
une app Next.js 16 / React 19 / TypeScript strict située dans `web/`. Ne touche
à rien d'autre que ce qui est décrit ici.

## Contexte

Le panneau ATS (`web/src/components/modals/AtsPanel.tsx`) a aujourd'hui deux
boutons :

- « Score ATS » (`runLocal`) : analyse algorithmique locale instantanée
  (`analyzeResumeAts` de `web/src/lib/ats/engine.ts`) ;
- « Analyser avec l'IA » (`runAi`) : l'IA (`/api/ats-score`) extrait les
  exigences de l'offre, puis **le score reste calculé par le moteur local**
  (`analyzeWithRequirements`).

Comportement cible : **un seul bouton « Analyse ATS »** qui lance directement
l'analyse IA (spinner pendant l'appel). Si l'appel IA échoue (pas de clé,
quota 429, réseau), on retombe automatiquement sur l'analyse locale avec un
toast d'explication. Le moteur `engine.ts` et la route `/api/ats-score` ne
changent pas du tout.

## Modifications

Toutes dans `web/src/components/modals/AtsPanel.tsx` :

1. **Supprimer** la fonction `runLocal` entière (~lignes 118-124).

2. **Remplacer** le bloc des deux boutons (~lignes 163-170) par :

```tsx
<div className="ats-actions">
  <button type="button" className="ats-action-btn" onClick={runAi} disabled={busy}>
    {busy ? "Analyse IA…" : "Analyse ATS"}
  </button>
</div>
```

3. **Remplacer** le `catch` de `runAi` (~lignes 139-141) par un fallback local :

```tsx
} catch {
  setReport(analyzeResumeAts(input.resume, input.desc, input.role));
  setPriorities([]);
  setByAi(false);
  toast("Analyse IA indisponible — score algorithmique local affiché.", "info");
} finally {
```

4. **Garder** l'import `analyzeResumeAts` (il sert désormais au fallback) et
   mettre à jour le commentaire d'en-tête du fichier : les « deux chemins »
   deviennent « IA d'abord, moteur local en secours en cas d'échec ».

## Règles du projet (non négociables)

- ⚠️ Ne jamais lire ni tester `docStore.html` : vestige de l'ancien pipeline
  HTML, toujours vide — le CV vient de `docStore.json` (déjà le cas ici).
- Jamais `alert`/`confirm`/`prompt` natifs — utiliser `toast` de
  `@/state/uiStore` (déjà importé).
- Changement chirurgical : ne modifie ni `engine.ts`, ni `resumeText.ts`,
  ni la route `/api/ats-score`, ni le CSS.

## Vérification (obligatoire avant de conclure)

Depuis `web/` :

```bash
npm run lint        # attendu : 0 erreur
npx tsc --noEmit    # attendu : 0 erreur
npm test            # attendu : suite verte — les tests de engine.ts passent inchangés
```

Test manuel : lancer `npm run dev`, coller une offre (fixture :
`web/tests/fixtures/job_sharkninja.txt`), ouvrir le panneau ATS → un seul
bouton « Analyse ATS » → spinner → résultat avec badge « ✨ Analyse IA ».
Puis DevTools mode offline → re-cliquer → résultat sans badge + toast
« Analyse IA indisponible — score algorithmique local affiché. ».

## Commit

```bash
git add web/src/components/modals/AtsPanel.tsx
git commit -m "feat(ats): analyse en un clic — IA directe, moteur local en secours"
```
