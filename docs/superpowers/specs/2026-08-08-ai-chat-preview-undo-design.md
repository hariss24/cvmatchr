# Spécification Technique — Bascule d'Aperçu & Comparaison IA

> Date : 8 août 2026  
> Statut : Validé  

## 1. Contexte & Problème

Dans l'éditeur (`/editor`), lorsque l'Assistant IA formule des propositions de modification de CV ou de lettre de motivation (`ChatPanel.tsx`), l'utilisateur dispose d'un bouton **« Prévisualiser »**.

Aujourd'hui, cliquer sur ce bouton bascule l'aperçu du document (`previewOverride` dans `docStore.ts`) sur le JSON de la proposition. Cependant :
1. Le bouton reste bloqué sur « Prévisualiser », sans retour visuel sur l'état actif.
2. L'utilisateur ne dispose d'aucun moyen pour masquer cet aperçu et réafficher temporairement son document d'origine, sauf s'il clique sur **« Rejeter »** (ce qui ferme définitivement la proposition).
3. Il est donc impossible d'alterner entre l'original et la proposition IA pour comparer.

## 2. Solution Retenue

### 2.1 Bascule dans `ChatPanel.tsx`
- Pour chaque carte de proposition dont le statut est `"open"` :
  - L'état d'activation est dérivé par comparaison entre `previewOverride` et `proposal.json`.
  - Si la proposition est active :
    - Le bouton devient **« Masquer l'aperçu »** avec la classe CSS `.proposal-btn--active`.
    - Cliquer dessus appelle `setPreviewOverride(null)`, réaffichant le document original sans changer le statut de la proposition (elle reste `"open"`).
  - Si la proposition n'est pas active :
    - Le bouton affiche **« Prévisualiser »**.
    - Cliquer dessus active `setPreviewOverride(proposal.json)`.

### 2.2 Contrôle direct dans l'en-tête de `PreviewPane.tsx`
- Lorsque `previewOverride !== null` (`isPreview` est vrai) :
  - Le badge d'en-tête `Proposition IA — non appliquée` devient interactif et inclut un bouton actionnable **« Voir l'original »**.
  - Cliquer sur ce bouton appelle `setPreviewOverride(null)`, remettant immédiatement le document original dans l'aperçu PDF.

### 2.3 Rétrocompatibilité & Sécurité
- Les boutons **« Appliquer »** et **« Rejeter »** conservent leur comportement actuel :
  - **Appliquer** : écrit le JSON dans le store (`setJson`), annule `previewOverride` (`null`), et passe la proposition en `"applied"`.
  - **Rejeter** : annule `previewOverride` (`null`), et passe la proposition en `"rejected"`.
- Aucun changement dans le moteur d'historique (Ctrl+Z) ni dans les endpoints backend `/api/editor-chat`.

## 3. Impact Code & Fichiers

- `web/src/components/modals/ChatPanel.tsx` : gestion dynamique du libellé du bouton de prévisualisation et de la bascule d'aperçu.
- `web/src/components/editor/PreviewPane.tsx` : bouton « Voir l'original » dans le badge d'en-tête.
- `web/src/app/globals.css` : styles pour `.proposal-btn--active` et le badge interactif `.preview-override-badge`.
- `web/src/components/modals/ChatPanel.test.tsx` (ou nouveau fichier de test) : tests unitaires du composant `ChatPanel`.

## 4. Stratégie de Test

- **Vitest** :
  - Vérifier qu'un clic sur « Prévisualiser » active `setPreviewOverride`.
  - Vérifier que le bouton se transforme en « Masquer l'aperçu ».
  - Vérifier qu'un second clic rétablit `previewOverride` à `null` et conserve le statut `"open"`.
- **Build & Lint** :
  - `npm test`, `npm run build`, `npm run lint` sans aucune erreur ni régression.
