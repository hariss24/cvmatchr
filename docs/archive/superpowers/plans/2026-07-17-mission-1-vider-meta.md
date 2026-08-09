# Mission 1 — Vider entreprise/poste au « Nouveau CV »

Tu es un développeur chargé d'une modification chirurgicale dans **CV Tailor**,
une app Next.js 16 / React 19 / TypeScript strict située dans `web/`. State
client : Zustand (`web/src/state/docStore.ts`). Ne touche à rien d'autre que ce
qui est décrit ici.

## Contexte

La barre meta de l'éditeur contient deux champs, `company` et `role`, stockés
dans le `docStore` (Zustand). Quand l'utilisateur clique « Nouveau CV » dans la
TopBar, le CV est remplacé par un CV vierge mais ces deux champs gardent leur
ancienne valeur. Il faut les vider en même temps.

Le menu mobile (`MobileMenu.tsx`) délègue déjà au handler de la TopBar via la
prop `onNewCv` — **un seul endroit à modifier**.

## Modification

Fichier : `web/src/components/layout/TopBar.tsx`, fonction `onNewCv`
(actuellement lignes 66-71). Remplacer par :

```tsx
const onNewCv = async () => {
  if (!(await uiConfirm("Repartir d'un CV vierge ? Le contenu actuel sera remplacé.", "Nouveau CV"))) return;
  const profile = await loadProfile();
  setJson(applyProfileToResume(structuredClone(DEFAULT_RESUME), profile));
  const { setCompany, setRole } = useDocStore.getState();
  setCompany("");
  setRole("");
  toast("Nouveau CV.", "success");
};
```

`setCompany` et `setRole` existent déjà dans le store
(`web/src/state/docStore.ts:99-100`). N'ajoute aucune nouvelle action de store.

## Règles du projet (non négociables)

- Jamais `alert`/`confirm`/`prompt` natifs — le fichier utilise déjà `uiConfirm`, garde-le.
- Changement chirurgical : ne « nettoie » aucun code adjacent.

## Vérification (obligatoire avant de conclure)

Depuis `web/` :

```bash
npm run lint        # attendu : 0 erreur
npx tsc --noEmit    # attendu : 0 erreur
npm test            # attendu : suite verte (261+ tests)
```

Test manuel : lancer `npm run dev`, remplir entreprise + poste dans la barre
meta, cliquer « Nouveau CV », confirmer → les deux champs doivent être vides.

## Commit

```bash
git add web/src/components/layout/TopBar.tsx
git commit -m "feat(ui): vide entreprise et poste au Nouveau CV"
```
