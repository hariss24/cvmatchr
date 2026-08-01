# Journal — Éclaireur, 2026-08-01

## Domaine audité

Manques fonctionnels — premier tour de la rotation à neuf domaines réécrite par le
propriétaire le 01/08 (voir `boucle/roles/eclaireur.md`). Aucun constat antérieur sur
ce domaine précis dans `boucle/constats/` (les deux existants portaient sur
performance et état CI).

## Méthode

Lecture de `PROJECT_INDEX.md` (sections 3 à 10) pour fixer le périmètre exact de ce
que fait CVMatchr aujourd'hui. Puis quatre agents en parallèle, chacun chargé de
consulter réellement (WebSearch + WebFetch) les pages officielles de deux des huit
produits de référence de `MISSION.md` :
- Jobscan + Teal
- Rezi + Huntr
- Kickresume + Enhancv
- Careerflow + Simplify

Consigne donnée à chaque agent : citer l'URL exacte et la date pour chaque
affirmation, signaler explicitement ce qui n'est pas vérifiable (mur payant, page
qui ne charge pas), ne jamais décrire une fonctionnalité concurrente de mémoire.
Deux agents ont rencontré des blocages partiels (tealhq.com renvoie 403 au
WebFetch direct sur toutes ses pages ; careerflow.ai/pricing et simplify.jobs/pricing
en 404) — contournés par des extraits de recherche citant l'URL officielle, avec la
réserve signalée dans le constat à chaque fois que c'était le cas.

## Résultat

8 manques confirmés au sens strict du seuil de `MISSION.md` (capacité présente chez
≥ 2 des 8 produits, absente de CVMatchr). Classement par gravité dans le constat et
dans `BACKLOG.md` :
1. Extension navigateur (capture d'offre + autofill) — 7/8 produits, le manque le
   plus universel observé depuis le début de la boucle.
2. Préparation d'entretien par IA — 4 produits.
3. CRM de networking/contacts — 4 produits, mais en tension avec un choix de design
   déjà documenté (`PROJECT_INDEX.md` §8 bis, tracker à zéro saisie) : je l'ai quand
   même remonté (le seuil MISSION.md ne fait pas d'exception pour un choix de design
   existant) mais signalé la tension explicitement pour que l'Architecte ou le
   propriétaire tranche, pas moi.
4. Optimisation de profil LinkedIn — 2 produits.
5. Import direct du profil LinkedIn — 2 produits, faisabilité technique incertaine
   (LinkedIn bloque le scraping non officiel) signalée comme risque bloquant avant
   même une spec.
6. Skill gap analyzer — 2 produits, chevauchement possible avec le moteur ATS
   existant (`src/lib/ats/engine.ts`) à vérifier avant de chiffrer.
7. Journal de candidature — 2 produits, petite ampleur.
8. Générateur de lettre de démission — 2 produits, négligeable.

Point positif à préserver, trouvé au passage : aucun des 8 produits consultés n'a
d'équivalent au tracker à statut dérivé automatiquement de CVMatchr — tous
demandent une saisie manuelle. Un différenciateur réel, pas un retard à combler.

## Ce que je n'ai pas fait

Je n'ai écrit aucune ligne de code applicatif (mandat de l'Éclaireur). Je n'ai pas
tranché la tension entre le manque #3 (CRM de networking) et le principe directeur
« zéro coût pour l'utilisateur » du tracker actuel — ce n'est pas mon rôle, je l'ai
signalée pour que l'Architecte ou le propriétaire arbitre. Je n'ai pas vérifié la
faisabilité technique du scraping LinkedIn (manque #5) au-delà de la mention du
risque — une vérification plus poussée demanderait de sortir du périmètre de cet
audit (qui liste des manques, ne les spécifie pas).

## Fichiers modifiés

- `boucle/constats/2026-08-01-manques-fonctionnels.md` (nouveau)
- `boucle/BACKLOG.md` (8 lignes ajoutées en tête de `## À planifier`)
- `boucle/ETAT.md` (écrasé)
- `boucle/journal/2026-08-01-eclaireur.md` (ce fichier)
