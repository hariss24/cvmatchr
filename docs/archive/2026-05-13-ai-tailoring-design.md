# Conception : Import CV + Tailoring IA

**Date :** 2026-05-13  
**Projet :** cv-tailor  
**Approche retenue :** A — Purement additif (nouveaux fichiers, app.py modifié, rien d'autre touché)

---

## Ce qu'on construit

Trois nouvelles capacités ajoutées à l'app existante :

1. **Import texte → HTML** : l'utilisateur colle le texte brut de son CV, l'IA génère le HTML structuré
2. **Import PDF → HTML** : l'utilisateur upload son CV en PDF, l'app le convertit en images puis l'IA génère le HTML
3. **Tailoring IA** : l'utilisateur colle une offre d'emploi, l'IA adapte le CV dans l'éditeur

Le workflow existant (éditeur Monaco + export PDF) reste inchangé.

---

## Fichiers touchés

### Nouveaux fichiers
- `ai_engine.py` — toute la logique d'appel IA (Gemini et Anthropic), gestion du streaming
- `quota.py` — compteur journalier d'utilisation de la clé serveur

### Fichiers modifiés
- `app.py` — 3 nouveaux endpoints Flask + ajouts dans la variable PAGE (l'interface)
- `requirements.txt` — ajout de `pymupdf`, `google-generativeai`, `anthropic`

### Fichiers non touchés
- `pdf_engine.py`, `archive.py`, `mcp_server.py`, `api/index.py` — intacts

---

## Les 3 nouveaux endpoints

Un endpoint est une "adresse" sur le serveur que l'app appelle pour déclencher une action.

| Adresse | Ce qu'elle reçoit | Ce qu'elle retourne |
|---|---|---|
| `POST /api/text-to-html` | Le texte brut du CV | Le HTML généré, progressivement |
| `POST /api/pdf-to-html` | Le fichier PDF | Le HTML généré, progressivement |
| `POST /api/tailor` | Le HTML du CV + l'offre d'emploi | Le HTML adapté, progressivement |

Tous les trois acceptent un header optionnel `X-Api-Key` (la clé API personnelle de l'utilisateur).  
Tous les trois streamient la réponse — le texte arrive progressivement, pas d'un bloc.

---

## ai_engine.py

Responsabilités :
- Détecter le provider selon la clé : `sk-ant-*` → Anthropic, sinon → Gemini
- Exposer `stream_completion(prompt, system, images=None, api_key=None) → generator`
  - `images` : liste de bytes PNG (pour la conversion PDF page par page)
  - `api_key` : clé utilisateur, si absente utilise `GEMINI_API_KEY` depuis l'environnement
- N'a aucune connaissance de Flask ni de quota

Prompts système utilisés :

**text-to-html :**
```
Tu reçois le contenu texte brut d'un CV.
Retourne uniquement le HTML structuré correspondant : utilise des balises sémantiques
(h1, h2, h3, p, ul, li, strong). Ne génère pas de CSS. Ne génère pas de design.
Uniquement la structure HTML du contenu, fidèle au texte fourni.
```

**pdf-to-html (par page) :**
```
Voici une page d'un CV en image.
Retourne uniquement le HTML structuré du contenu visible : titres, paragraphes, listes,
dates, intitulés. Pas de CSS, pas de style inline, uniquement les balises HTML sémantiques.
Texte en français si c'est en français, anglais si c'est en anglais.
```

**tailor :**
```
Tu reçois un CV en HTML et une offre d'emploi.
Adapte le CV pour ce poste : réécris le résumé/accroche, réordonne et ajuste les
compétences pour mettre en avant celles qui correspondent à l'offre, adapte légèrement
les descriptions d'expériences pour coller aux mots-clés du poste.
Ne supprime aucune expérience. Ne mens pas. Ne change pas les dates, les entreprises,
les diplômes. Retourne uniquement le HTML complet modifié, rien d'autre.
```

---

## quota.py

Le quota sert à protéger la clé serveur si beaucoup de gens utilisent l'app sans avoir leur propre clé.

- Stockage : dictionnaire en mémoire `{"date": "2026-05-13", "count": 42}`
- Limite : 50/jour par défaut, configurable via variable d'environnement `DAILY_QUOTA`
- Reset : automatique quand la date change
- Limitation connue : sur Vercel (l'hébergement cloud), le serveur peut "dormir" entre utilisations et perdre le compteur — le quota est donc approximatif en production cloud. Acceptable pour le MVP.
- API : `check_and_increment() → bool` — retourne True si quota disponible, False sinon

Le quota n'est pas appliqué si l'utilisateur a fourni sa propre clé.

---

## Gestion de la clé API utilisateur

La clé API est comme un mot de passe qui donne accès au service IA (Gemini ou Anthropic).

**Flux :**
1. L'utilisateur colle sa clé dans ⚙️ Paramètres
2. Elle est sauvegardée dans le navigateur (localStorage) — jamais envoyée à un serveur externe ni stockée dans une base de données
3. À chaque appel IA, elle est envoyée au serveur dans un header de requête (`X-Api-Key`)
4. Le serveur l'utilise pour cet appel uniquement, ne l'enregistre pas

**Détection du provider :**
- Clé commençant par `sk-ant-` → Anthropic
- Sinon → Gemini

---

## Streaming (texte progressif)

Le streaming permet d'afficher le texte généré par l'IA au fur et à mesure, sans attendre la fin.

- Côté serveur : Flask envoie des morceaux de texte dès qu'ils arrivent de Gemini, via un "tuyau" ouvert (SSE — Server-Sent Events)
- Format de chaque morceau : `data: <texte>\n\n`
- Signal de fin : `data: [DONE]\n\n`
- Signal d'erreur : `data: [ERROR] message\n\n`
- Côté navigateur : le JS accumule les morceaux et les insère progressivement dans Monaco

---

## Conversion PDF → HTML (détail technique)

1. Le navigateur envoie le fichier PDF au serveur (`/api/pdf-to-html`)
2. Le serveur utilise PyMuPDF (`fitz`) pour "photographier" chaque page en image PNG à 150 DPI
3. Chaque image est envoyée à Gemini Vision avec le prompt "page d'un CV"
4. Le HTML de chaque page est streamié dans l'ordre vers le navigateur
5. Monaco reçoit les morceaux et les affiche au fur et à mesure

---

## Interface utilisateur (ce que l'utilisateur voit)

### État 1 — Arrivée sur l'app (éditeur vide)

Le panneau d'import remplace l'éditeur. Deux onglets côte à côte :

- **Onglet "Coller le texte"** : grande zone de texte + bouton "Convertir en HTML"
- **Onglet "Importer un PDF"** : bouton de sélection de fichier + bouton "Convertir le PDF"

Pendant la conversion : le texte HTML apparaît progressivement dans l'éditeur (streaming).

### État 2 — CV chargé

- Le panneau d'import se replie en une petite barre "▶ Importer un autre CV"
- L'éditeur Monaco s'affiche normalement
- Un nouveau panneau "🎯 Adapter à une offre d'emploi" apparaît sous la barre d'outils de l'éditeur, replié par défaut, cliquable pour ouvrir

### Panneau "Adapter à une offre"

- Grande zone de texte "Colle l'offre d'emploi ici"
- Bouton "Adapter le CV"
- Pendant l'adaptation : le contenu de Monaco est remplacé progressivement par le HTML adapté

### Icône ⚙️ (Paramètres)

Ajoutée dans la barre de navigation en haut à droite. Ouvre une fenêtre superposée avec :
- Champ texte pour la clé Gemini ou Anthropic
- Bouton "Enregistrer" (sauvegarde dans le navigateur)
- Bouton "Effacer"
- Indication "Clé personnelle active ✓" si une clé est déjà enregistrée

### Messages d'erreur

- Quota épuisé : "Quota journalier atteint — colle ton texte manuellement ou ajoute ta propre clé dans ⚙️ Paramètres."
- Clé invalide : "Clé API invalide ou expirée — vérifie ta clé dans ⚙️ Paramètres."
- PDF illisible : "Impossible de lire ce PDF — essaie l'option Coller le texte."

---

## Ce qu'on ne fait pas (dans ce chantier)

- Pas de système de comptes ou d'authentification
- Pas de base de données
- Pas de modification à pdf_engine.py, archive.py, mcp_server.py, api/index.py
- Pas de CSS généré par l'IA (le design reste géré par les templates existants)
- Pas d'extraction des templates hors de app.py (chantier séparé)

---

## Ordre de construction

1. Installer les dépendances (pymupdf, google-generativeai, anthropic)
2. Écrire `quota.py`
3. Écrire `ai_engine.py` (Gemini text + vision, Anthropic text, streaming)
4. Ajouter `/api/text-to-html` dans app.py + tester
5. Ajouter `/api/pdf-to-html` dans app.py + tester
6. Ajouter `/api/tailor` dans app.py + tester
7. Ajouter le panneau Import dans l'interface (PAGE string)
8. Ajouter le panneau Tailoring dans l'interface
9. Ajouter le modal Paramètres (clé API utilisateur)
10. Tester le workflow complet : PDF → HTML → tailoring → export PDF
11. Vérifier les variables d'environnement pour Vercel
