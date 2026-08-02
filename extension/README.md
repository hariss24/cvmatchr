# Extension CVMatchr — autofill de candidature

Extension de navigateur (Manifest V3, Chrome/Edge/Brave) qui remplit les
formulaires de candidature Greenhouse et Lever avec un CV et une identité
préparés depuis CVMatchr (`/pack`).

## Charger en mode développeur

1. `chrome://extensions`
2. Activer « Mode développeur » (en haut à droite)
3. « Charger l'extension non empaquetée » → sélectionner ce dossier (`extension/`)

## Utilisation

1. Dans CVMatchr, page `/pack`, clique sur « Préparer pour l'extension ».
2. Ouvre une offre Greenhouse ou Lever.
3. Clique sur le bouton flottant « Remplir avec CVMatchr » en bas à droite de la
   page.
4. Relis le formulaire avant d'envoyer — l'extension ne soumet jamais à ta place.

Conception détaillée :
`docs/superpowers/specs/2026-08-02-extension-autofill-design.md`.
