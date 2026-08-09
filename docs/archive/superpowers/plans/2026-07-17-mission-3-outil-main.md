# Mission 3 — Outil « main » : pan à la souris dans l'aperçu PDF

Tu es un développeur chargé d'une modification chirurgicale dans **CV Tailor**,
une app Next.js 16 / React 19 / TypeScript strict située dans `web/`. Ne touche
à rien d'autre que ce qui est décrit ici.

## Contexte

L'aperçu PDF (`web/src/components/editor/PdfPreview.tsx`) rend chaque page dans
un `<canvas>` à l'intérieur d'un conteneur `.pdf-preview` qui a `overflow: auto`
(CSS dans `web/src/app/globals.css`, ~ligne 1285). Avec le zoom, l'utilisateur
doit utiliser les barres de défilement.

Comportement cible : cliquer-glisser à la souris déplace l'aperçu, comme
l'outil « main » de Photoshop (curseur grab → grabbing). Actif en permanence
(zoom ou non). **Souris uniquement** : au tactile, le défilement natif du
navigateur fait déjà le travail — le neutraliser casserait le scroll de page
sur mobile.

## Modifications

### 1. `web/src/components/editor/PdfPreview.tsx`

Ajouter sous la déclaration `containerRef` existante :

```tsx
// Outil « main » : glisser à la souris pour déplacer l'aperçu (scroll du conteneur).
// Souris uniquement — au tactile, le défilement natif fait déjà le travail.
const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);

const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
  if (e.pointerType !== "mouse" || e.button !== 0) return;
  const el = containerRef.current;
  if (!el) return;
  panRef.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
  el.setPointerCapture(e.pointerId);
  el.classList.add("is-panning");
};

const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
  const pan = panRef.current;
  const el = containerRef.current;
  if (!pan || !el) return;
  el.scrollLeft = pan.left - (e.clientX - pan.x);
  el.scrollTop = pan.top - (e.clientY - pan.y);
};

const endPan = (e: React.PointerEvent<HTMLDivElement>) => {
  const el = containerRef.current;
  if (!panRef.current || !el) return;
  panRef.current = null;
  el.classList.remove("is-panning");
  el.releasePointerCapture(e.pointerId);
};
```

Et remplacer le `return` du composant par :

```tsx
return (
  <div
    ref={containerRef}
    className={`pdf-preview${zoom ? " pdf-preview--zoom" : ""}`}
    data-testid="pdf-preview"
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={endPan}
    onPointerCancel={endPan}
  />
);
```

Pas de nouvel état React — tout en refs (le composant re-rend déjà à chaque
nouveau blob, inutile d'en rajouter).

### 2. `web/src/app/globals.css`

Après la règle `.pdf-preview--zoom .pdf-preview__page { max-width: none; }`
(~ligne 1303), ajouter :

```css
.pdf-preview { cursor: grab; user-select: none; }
.pdf-preview.is-panning { cursor: grabbing; }
```

Ne pas modifier le bloc `.pdf-preview` existant (lignes ~1285-1293).

## Règles du projet (non négociables)

- Jamais de couleur en dur dans le CSS — ici on n'en ajoute aucune.
- Changement chirurgical : ne modifie ni la logique de rendu pdf.js du
  composant, ni `PreviewPane.tsx`.
- Piège Windows/Turbopack : si le CSS ne semble pas pris en compte en dev,
  supprimer `web/.next` et relancer.

## Vérification (obligatoire avant de conclure)

Depuis `web/` :

```bash
npm run lint        # attendu : 0 erreur
npx tsc --noEmit    # attendu : 0 erreur
npm test            # attendu : suite verte
```

Test manuel : lancer `npm run dev`, activer le zoom de l'aperçu (loupe) →
cliquer-glisser déplace l'aperçu dans les deux axes, curseur grab → grabbing.
DevTools mode tactile → le défilement au doigt reste le comportement natif.

## Commit

```bash
git add web/src/components/editor/PdfPreview.tsx web/src/app/globals.css
git commit -m "feat(preview): outil main — pan à la souris dans l'aperçu PDF"
```
