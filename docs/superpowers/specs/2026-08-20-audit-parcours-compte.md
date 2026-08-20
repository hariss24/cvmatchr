# Audit du parcours « compte » — 20/08/2026

État des lieux après la livraison du chantier A (connexion par email et mot de
passe). Rien n'est corrigé ici : ce document liste ce qui manque, pourquoi cela
compte, et dans quel ordre le traiter.

Périmètre : inscription, connexion, confirmation, mot de passe oublié,
déconnexion, gestion du compte, obligations légales attachées aux comptes.

---

## 1. Ce qui fonctionne

Vérifié en production le 20/08 :

- Inscription par email, confirmation par code ou par lien, connexion.
- Connexion Google, exclusive du formulaire, avec reconnaissance d'un compte
  Google quand quelqu'un tente un mot de passe (`/api/auth/methode`).
- Réinitialisation de mot de passe, désormais indépendante de l'appareil.
- Déblocage automatique de l'onglet en attente.
- Redirection des personnes déjà connectées hors de `/connexion`.
- Perte de session pendant l'usage : `RemoteError` remonte un message explicite
  au lieu d'une liste vide (candidatures, offres, modèles, profil).
- Messages d'erreur traduits, y compris la panne d'envoi d'email.
- Rate limiting en base sur `/api/auth/methode`.

---

## 2. Manques juridiques

### 2.1 — Les conditions ne sont montrées nulle part à l'inscription — CORRIGÉ le 20/08

`/conditions-utilisation` et `/confidentialite` existent, mais ne sont liées
que depuis `/help` et depuis la politique elle-même. **Aucun lien sur
`/connexion`.** Quelqu'un crée donc un compte sans avoir jamais eu l'occasion
de lire ce qu'il accepte.

Le minimum attendu : sous le bouton d'inscription, une phrase du type « En
créant un compte, vous acceptez les conditions d'utilisation et la politique de
confidentialité », les deux termes étant des liens.

### 2.2 — Resend n'est pas déclaré comme destinataire — CORRIGÉ le 20/08

La politique de confidentialité cite Supabase et Google. Depuis le 20/08, les
adresses email des utilisateurs transitent aussi par **Resend** (et par
l'infrastructure Amazon SES qu'il utilise, en Irlande). L'article 13 du RGPD
impose de nommer les destinataires ou leurs catégories.

Une phrase suffit, dans la section des sous-traitants.

### 2.3 — La suppression de compte est promise mais n'existe pas dans l'app — CORRIGÉ le 20/08

La section « Vos droits » annonce : « La suppression d'un compte entraîne la
suppression en cascade de l'ensemble des données associées ». La seule voie
ouverte est un email à une adresse personnelle. C'est acceptable au regard du
RGPD, mais :

- rien ne garantit ni ne trace le traitement de la demande ;
- l'utilisateur n'a aucun moyen visible d'exercer ce droit ;
- l'engagement écrit dépasse ce que le produit sait faire.

Voir aussi § 4.1.

---

## 3. Sécurité

### 3.1 — Les mots de passe compromis ne sont pas refusés

Supabase propose « Prevent use of leaked passwords », qui vérifie le mot de
passe choisi contre la base HaveIBeenPwned. C'est une case à cocher, gratuite,
et aujourd'hui décochée. Sans elle, `motdepasse123` est accepté.

Notre seule règle est une longueur de 8 caractères
(`web/src/lib/auth/validation.ts`).

### 3.2 — Changer de mot de passe n'exige pas l'ancien — CORRIGÉ le 20/08

`updatePassword` agit sur la session en cours sans rien demander d'autre. Un
ordinateur laissé ouvert quelques minutes suffit à un tiers pour changer le mot
de passe — et donc pour enfermer dehors le propriétaire du compte.

Ce point ne se manifeste pas encore, faute d'écran de changement de mot de
passe (§ 4.1) : il doit être traité **en même temps** que celui-ci, pas après.

### 3.3 — Une réinitialisation ne révoque pas les autres sessions — PARTIELLEMENT CORRIGÉ le 20/08

Quelqu'un qui réinitialise son mot de passe parce qu'il craint une intrusion
laisse l'intrus connecté. Supabase sait déconnecter les autres sessions
(`signOut({ scope: 'others' })`).

**20/08 :** le bouton existe désormais sur `/compte`, mais la révocation reste
manuelle — elle n'est pas déclenchée automatiquement à la fin d'une
réinitialisation. À faire le jour où le parcours de récupération est repris.

---

## 4. Fonctionnalités absentes

### 4.1 — Aucune page « Mon compte » — CORRIGÉ le 20/08, sauf le changement d'adresse

`/settings` ne traite que les données locales et la clé d'API ; `/profil`
concerne les informations qui alimentent les CV. Rien nulle part pour :

- voir avec quelle adresse et par quelle méthode on est connecté ;
- changer son mot de passe ;
- changer son adresse email ;
- se déconnecter de tous les appareils ;
- supprimer son compte (§ 2.3).

**20/08 :** page `/compte` livrée avec l'identité, le changement de mot de passe
vérifié, la déconnexion des autres appareils et la suppression du compte. **Le
changement d'adresse email n'y est pas** : il suppose un flux à double
confirmation (ancienne et nouvelle adresse) et un gabarit d'email
supplémentaire à traduire. À traiter séparément.

C'est le manque structurel de ce parcours : tout ce que l'utilisateur peut
faire de son compte aujourd'hui, c'est s'y connecter et s'en déconnecter.

### 4.2 — Le code de confirmation ne peut pas être redemandé

L'écran de saisie n'offre aucun bouton « renvoyer le code ». Un email qui se
perd ou qui tombe en indésirable laisse la personne devant un champ qu'elle ne
peut pas remplir. Recommencer l'inscription fonctionne — Supabase renvoie un
code tant que l'adresse n'est pas confirmée — mais rien ne le lui dit.

### 4.3 — Le message de session perdue ne mène nulle part

« Connectez-vous pour accéder à vos données. » est juste, mais ne propose aucun
lien vers `/connexion`.

---

## 5. Finitions

- Pas de bouton « afficher le mot de passe » : on tape à l'aveugle un mot de
  passe qu'on vient d'inventer, sans pouvoir le relire.
- La règle des 8 caractères n'est annoncée qu'après l'échec.
- Les quatre gabarits d'email non utilisés (Magic Link, Invite, Change Email,
  Reauthentication) restent en anglais. Sans effet aujourd'hui, mais le jour où
  l'un est mis en service, il partira tel quel.

---

## 6. Ordre de traitement proposé

**D'abord — ce qui engage juridiquement** (rapide, sans code applicatif) :
2.1, 2.2, et la case « leaked passwords » de 3.1.

**Ensuite — le manque structurel** : la page « Mon compte » (4.1), qui porte
d'un seul tenant le changement de mot de passe avec vérification de l'ancien
(3.2), le changement d'adresse, la déconnexion globale (3.3) et la suppression
de compte (2.3). C'est le gros morceau.

**Puis — les impasses utilisateur** : renvoi du code (4.2), lien dans le
message de session perdue (4.3).

**Enfin — les finitions** du § 5.
