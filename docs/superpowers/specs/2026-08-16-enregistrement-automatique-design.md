# L'enregistrement devient automatique — design

**Date :** 16 août 2026
**Décision propriétaire :** Hariss, 16/08/2026 — « je ne veux pas de bouton
Enregistrer, je veux que ça enregistre automatiquement comme la sauvegarde
locale ».
**Suit :** `2026-08-15-serveur-source-unique-design.md` (le serveur est la source
unique, livré et vérifié en local le 16/08).

---

## 1. Le problème

Deux indicateurs parlent de sauvegarde en même temps et se contredisent :

- `EditorPane.tsx:202` affiche une pastille **« Enregistré »** — elle parle du
  **brouillon local** (son libellé interne dit « ✓ Brouillon sauvegardé », mais
  l'écran n'en montre que « Enregistré »). Antérieure au chantier.
- La TopBar affiche **« Modifications non enregistrées »** — elle parle du
  **compte**.

L'utilisateur lit donc « Enregistré » et « Non enregistré » côte à côte, sans
qu'aucun des deux ne dise de quoi il parle, et conclut logiquement que le bouton
« Enregistrer » est de trop. Constat de l'usage réel, 16/08.

S'y ajoute une gêne de mise en page : la phrase entière posée dans la barre du
haut mange la moitié de la largeur disponible.

## 2. Ce qui bloque l'automatique aujourd'hui

**`saveCurrentDocument()` n'enregistre pas, il archive.** Chaque appel crée un
document neuf (`crypto.randomUUID()`), avec sa propre entrée. Trois clics par
jour : invisible. En automatique : un document par pause de frappe, soit des
centaines de copies du même CV.

C'est le seul vrai obstacle. Le reste (débounce, indicateur) en découle.

## 3. La décision

**Le document en cours d'édition a une identité stable, et l'auto-sauvegarde le
met à jour au lieu d'en créer un de plus.**

- `docStore` porte l'identifiant du document courant (`documentId`), posé à la
  création ou au chargement d'un document existant.
- L'auto-sauvegarde écrit sur cet identifiant (`upsert`), après un délai
  d'inactivité **généreux : 3 à 5 s** (voir §5, poids des photos).
- « Nouveau CV » et le chargement d'un document depuis « Mes CV » posent un
  nouvel identifiant : on n'écrase jamais le document précédent.
- Le bouton « Enregistrer » **disparaît**. L'auto-sauvegarde locale du brouillon
  reste, silencieuse : elle protège d'un crash navigateur, elle n'a rien à
  annoncer.
- Un seul état visible, discret, dans la barre : « Enregistrement… » puis
  « Enregistré ». **Rien** quand tout est à jour et calme.
- Déconnecté : rien ne part au serveur, l'éditeur reste utilisable, et l'état dit
  « Non enregistré — connectez-vous ». Une absence de compte n'est pas une panne.

## 4. Ce qui ne change pas

- Le brouillon local (`drafts`) reste local (décision du 15/08, modèle LinkedIn).
- La candidature créée à l'enregistrement continue d'être dédoublonnée par
  `normKey` : une seule candidature par entreprise+poste, pas une par envoi.
- La règle du chantier précédent tient : **une absence, un refus et une panne ne
  se disent jamais de la même façon.**

## 5. La contrepartie, assumée

Chaque envoi transporte le CV entier, **photo en base64 comprise**
(`LIMITES.md` §1.1). Trois envois par jour aujourd'hui ; plusieurs par minute
d'édition demain.

Choix retenu : **délai d'inactivité généreux d'abord**, et on ne paie le chantier
« photos vers Supabase Storage » que si le poids se fait sentir à l'usage. À
mesurer, pas à supposer.

## 6. Critères de succès

1. Taper dans l'éditeur, attendre : l'état passe « Enregistrement… » puis
   « Enregistré », **sans clic**.
2. Après dix modifications successives, « Mes CV » contient **un** document, pas
   dix.
3. « Nouveau CV » puis modification : un **second** document apparaît ; le
   premier est intact.
4. Charger un document depuis « Mes CV », le modifier : c'est **lui** qui est mis
   à jour, pas une copie.
5. Déconnecté : aucun appel réseau, l'éditeur fonctionne, l'état invite à se
   connecter.
6. Réseau coupé pendant l'édition : l'état le dit, et ne prétend jamais
   « Enregistré ».
7. La barre du haut n'affiche plus ni bouton « Enregistrer » ni phrase longue ;
   `EditorPane` n'affiche plus sa pastille « Enregistré » (sauf auto-sauvegarde
   désactivée dans les réglages, choix explicite de l'utilisateur).
