# Connexion hors Google : email et mot de passe — design

**Date :** 19 août 2026
**Chantier :** A (voir la file SaaS, §9 de `2026-08-15-sync-compte-restitution-design.md`)
**Dépend de :** rien. Débloque B (compte obligatoire), qui débloque G (Stripe).
**Décisions propriétaire :** Hariss, 19/08/2026 — méthode, périmètre, collision
Google, moment de la confirmation, correctif middleware.

---

## 1. Le problème

Il n'existe qu'une seule façon d'entrer dans Cvmatchr : un compte Google.
`authStore.ts` ne connaît que `signInWithOAuth({ provider: 'google' })` et le
flux Google Identity Services. Il n'y a pas d'autre porte.

Deux populations sont exclues, et ce sont exactement celles que l'app vise :

- **Ceux qui n'ont pas de compte Google.** Rien ne leur est proposé : la
  première action IA renvoie « Connectez-vous avec Google, ou ajoutez votre
  propre clé API dans les Paramètres » (`quota.ts`, `evaluateQuotaRules`). La
  seconde moitié de la phrase ne parle qu'aux développeurs.
- **Ceux qui refusent de relier leur Google.** Chercher un emploi en étant en
  poste rend cette réticence banale, et l'app n'offre aucune alternative.

Le chantier 0 vient de rendre le compte utile — il restitue enfin les données.
Ce chantier-ci rend le compte **accessible**. Les deux chantiers suivants (B :
compte obligatoire, G : Stripe) supposent que quiconque peut en créer un.

## 2. Ce qu'on construit

Une inscription et une connexion par **email et mot de passe**, à côté de
Google, avec confirmation de l'adresse et récupération de mot de passe oublié.

**Pourquoi le mot de passe plutôt que le code à usage unique :** c'est la seule
méthode qui permet de se reconnecter sans dépendre d'un email qui arrive. Le
code par email a été écarté comme entrée principale — il pourra être ajouté
plus tard comme raccourci, sans rien casser de ce qui est décrit ici.

**Ce qui n'est pas dans ce chantier :** le moment où l'app réclame un compte
(chantier B), la suppression et l'export de compte (chantier D), et le vieux
portail `/login` à mot de passe partagé, qui est un sujet sans rapport (§7.2).

## 3. Les écrans

Deux routes. Pas cinq : les états d'un même formulaire ne méritent pas chacun
leur adresse.

### `/connexion`

Une page, quatre états internes :

| État | Contenu |
|---|---|
| `connexion` *(défaut)* | Bouton Google, puis email + mot de passe. Liens vers `inscription` et `oubli`. |
| `inscription` | Email + mot de passe. Bouton Google également présent. |
| `code` | Champ à 6 chiffres, après une inscription réussie. Bouton « renvoyer l'email ». |
| `oubli` | Email seul. Confirme l'envoi sans dire si l'adresse existe. |

Le nom est `/connexion` et **non `/login`** : cette dernière adresse est déjà
prise par le portail à mot de passe partagé (§7.2). Deux pages appelées
« connexion » qui ne font pas la même chose est un piège à bug ; le français est
par ailleurs cohérent avec `/profil`, `/candidatures`, `/confidentialite`.

### `/connexion/nouveau-mot-de-passe`

Route séparée par nécessité : le lien de réinitialisation envoyé par email doit
atterrir à une adresse fixe. Elle affiche un champ « nouveau mot de passe » et
n'est utile qu'avec une session de récupération active.

### Points d'entrée

`UserMenu.tsx` et `MobileMenu.tsx` remplacent leur bouton « Se connecter avec
Google » par un lien vers `/connexion`. Google n'est pas dégradé : il reste le
premier bouton de la page.

## 4. L'architecture

**Tout passe par `authStore.ts`, côté navigateur** — le chemin qu'emprunte déjà
Google.

L'alternative (formulaires traités par des routes Next.js, mots de passe ne
transitant pas par le navigateur) a été écartée : le gain est théorique
puisque Supabase reçoit le mot de passe en HTTPS dans les deux cas, tandis que
le coût est réel — deux mécaniques d'authentification à maintenir côté client
pour Google et côté serveur pour l'email. C'est précisément le genre de dualité
qui a produit les trois pertes de données du 15/08.

Quatre parcours s'ajoutent aux deux entrées Google existantes, pour cinq appels
Supabase (le dernier, `updateUser`, achève le parcours de réinitialisation) :

| Méthode | Appel Supabase |
|---|---|
| créer un compte | `signUp({ email, password })` |
| se connecter | `signInWithPassword({ email, password })` |
| valider le code reçu | `verifyOtp({ email, token, type: 'signup' })` |
| demander une réinitialisation | `resetPasswordForEmail(email, { redirectTo })` |
| poser le nouveau mot de passe | `updateUser({ password })` |

**Rien d'autre n'est à brancher.** `onAuthStateChange` est déjà abonné dans
`initAuth` et déclenche `reprendreDonneesLocales()` à toute connexion, quelle
qu'en soit la méthode. C'est ce qui rend ce chantier court.

Le `redirectTo` de la réinitialisation pointe sur
`/auth/callback?next=/connexion/nouveau-mot-de-passe`. Le callback existant
échange déjà le code contre une session et valide `next` via
`safeRedirectPath` : il n'y a rien à y modifier.

## 5. La confirmation de l'adresse

**Réglage retenu : confirmation exigée dès l'inscription** (réglage natif
Supabase « Confirm email »). Aucune session n'est ouverte tant que l'adresse
n'est pas prouvée. Motif : les crédits IA offerts sont payés par la clé Gemini
du serveur ; sans preuve d'adresse, dix adresses inventées donnent droit à dix
fois les crédits.

**Le gabarit d'email contient le code à 6 chiffres *et* le lien cliquable.**
Ce n'est pas un supplément décoratif, c'est une protection :

> Une personne qui vient de remplir son CV s'inscrit, va dans sa boîte mail,
> clique le lien — et ce lien s'ouvre dans le navigateur par défaut du client
> mail, souvent un autre que celui où elle travaillait. Elle arrive connectée
> sur un écran vide, son travail étant resté dans l'IndexedDB de l'autre
> navigateur. C'est le symptôme exact que le chantier 0 vient de corriger ; il
> serait absurde de le réintroduire par la porte d'entrée.

Le code retapé dans l'onglet d'origine supprime le problème. Les deux sortent
du même envoi Supabase (`{{ .Token }}` et `{{ .ConfirmationURL }}` dans le même
gabarit) : aucun coût, aucun code applicatif supplémentaire.

## 6. Le cas « ce compte a été créé avec Google »

**Comportement retenu :** la personne voit « Ce compte a été créé avec Google »,
et le bouton Google juste en dessous. Si elle veut malgré tout un mot de passe,
le parcours « mot de passe oublié » lui en fait poser un sur le même compte —
Supabase associe les deux identités sur une adresse vérifiée, sans code de notre
part.

**La difficulté :** Supabase répond `Invalid login credentials` de façon
identique que le mot de passe soit faux ou que le compte n'ait pas de mot de
passe du tout. Le navigateur ne peut pas distinguer les deux cas, et
`auth.identities` ne lui est pas lisible.

**La solution :** une fonction Postgres `SECURITY DEFINER` qui, pour une adresse
donnée, répond uniquement « ce compte passe par Google » (booléen, rien d'autre
— jamais de nom, jamais de date, jamais d'existence tout court en dehors de ce
cas).

Deux garde-fous, tous deux nécessaires :

1. **Elle n'est appelée qu'après un échec de mot de passe.** Jamais à la frappe,
   jamais avant. On ne répond donc jamais à quelqu'un qui n'a pas déjà soumis
   une tentative.
2. **Elle passe par la limitation de débit** posée le 19/08 (`rateLimit.ts`,
   migration `0004`), sur le même compteur que `login`.

**Ce que ça coûte, dit franchement :** cela reste un moyen borné de tester si
une adresse est inscrite chez nous. Le propriétaire l'a validé le 19/08 en
connaissance de cause, l'alternative — un message générique — laissant sans
issue une personne qui a bel et bien un compte et dont les CV sont là.

## 7. Deux corrections d'environnement

### 7.1 Le message qui deviendra faux

`evaluateQuotaRules` (`src/lib/ai/quota.ts`) annonce « Connectez-vous avec
Google, ou ajoutez votre propre clé API dans les Paramètres ». Dès ce chantier
livré, la première moitié est inexacte. Le message est corrigé pour mentionner
la création de compte — **et rien de plus**. Refondre ce moment de blocage
(mettre le compte en avant, replier la clé API dans un « Avancé ») est la ligne
« Onboarding SaaS » du `TODO.md`, c'est-à-dire le chantier B.

### 7.2 Le middleware bloque le callback

`src/middleware.ts` protège tout le site derrière un mot de passe partagé quand
`AUTH_PASSWORD` (ou `REMOTE_AUTH_PASSWORD`) est défini. Sa liste de chemins
laissés libres contient `/login`, `/api/login`, `/_next/`, `/static/`,
`/favicon.ico` — **mais pas `/auth/callback`**.

Conséquence si ce mot de passe est activé un jour en production : tout lien de
confirmation d'adresse ou de réinitialisation renvoie la personne sur le portail
mot de passe au lieu de la connecter. Le défaut existe déjà pour Google ; il
devient bien plus visible avec des emails.

`/auth/callback` est ajouté à la liste. Le portail lui-même n'est pas refondu :
c'est un sujet distinct, hors de ce chantier.

## 8. Les erreurs

Supabase répond en anglais. Une fonction pure traduit les cas réellement
rencontrés :

| Réponse Supabase | Ce que la personne lit |
|---|---|
| `Invalid login credentials` | Email ou mot de passe incorrect. |
| *(idem + compte Google détecté)* | Ce compte a été créé avec Google. |
| `User already registered` | Cette adresse a déjà un compte. |
| `Password should be at least…` | Le mot de passe doit faire au moins 8 caractères. |
| `Email rate limit exceeded` | Trop de tentatives. Réessayez dans quelques minutes. |
| `Token has expired or is invalid` | Ce code n'est plus valable. Demandez-en un nouveau. |
| *(inconnu)* | Message générique + le texte d'origine en second plan. |

Une réponse inconnue ne doit jamais produire un écran muet : le cas par défaut
affiche quelque chose d'utilisable et laisse le texte d'origine visible.

## 9. Ce qui doit être vérifiable

**Tests unitaires (Vitest, sans réseau) :**

- La traduction des erreurs : chaque ligne du tableau §8, plus le cas inconnu.
- La validation du formulaire : email malformé, mot de passe trop court, champs
  vides — avant tout appel réseau.
- Les quatre méthodes du store, avec un client Supabase simulé : chacune appelle
  la bonne fonction avec les bons arguments, et remonte l'erreur sans l'avaler.

**Test SQL (sur le modèle de `tests/rate_limit.sql`) :**

- La fonction de détection §6 répond vrai pour un compte Google, faux pour un
  compte à mot de passe, faux pour une adresse inconnue.
- Elle n'est pas appelable directement par le rôle `anon` en dehors du chemin
  prévu, et ne renvoie jamais autre chose qu'un booléen.
- **Validation par mutation** des assertions clés, comme le 19/08 : un test qui
  ne tombe pas quand on casse volontairement le code ne prouve rien.

**Parcours Playwright :**

- Inscription → saisie du code → connecté, avec le CV rempli avant inscription
  toujours présent après (c'est le point du §5).
- Mot de passe oublié → nouveau mot de passe → connecté.

**Protocole standard** de `.agents/rules/cadrage.md` §4 après chaque task :
`npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`, plus
`npx playwright test` en fin de plan puisque l'UI est touchée.

## 10. L'action humaine requise

Le chantier n'est **pas livrable** sans elle, et elle ne peut pas être faite par
un agent.

L'envoi d'emails intégré de Supabase ne délivre que quelques messages par heure,
uniquement vers les adresses déclarées dans le projet. En production, la plupart
des inscrits ne recevraient jamais leur code. Il faut donc :

1. Créer un compte **Resend** (3 000 emails/mois gratuits).
2. Vérifier le domaine `cvmatchr.fr` — trois enregistrements DNS (SPF, DKIM,
   DMARC). Ils resserviront pour tous les emails futurs : reçus Stripe (G),
   export RGPD (D).
3. Coller les identifiants SMTP dans Supabase → Authentication → SMTP Settings.
4. Activer « Confirm email » et adapter le gabarit « Confirm signup » pour qu'il
   contienne `{{ .Token }}` en plus du lien.
5. Porter la longueur minimale du mot de passe à **8 caractères** (Supabase en
   impose 6 par défaut). Sans ce réglage, le message d'erreur du §8 annoncerait
   une règle que le serveur n'applique pas.

Tant que ces quatre points ne sont pas faits, le développement se poursuit sur
l'envoi Supabase par défaut, suffisant pour les essais du propriétaire seul.
Ce plan signalera l'étape où l'action devient bloquante.

## 11. Le piège à ne pas réintroduire

Ne pas ajouter de second chemin d'authentification côté serveur « pour faire
plus propre » sur l'un des quatre parcours. Google est client, l'email est
client, `onAuthStateChange` est l'unique point où la session devient réelle et
où la reprise des données se déclenche. Un parcours qui ouvrirait une session
ailleurs contournerait `reprendreDonneesLocales()` — et rendrait un écran vide à
quelqu'un qui vient de s'inscrire.
