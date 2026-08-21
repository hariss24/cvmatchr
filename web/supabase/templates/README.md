# Gabarits d'emails d'authentification

Ces fichiers sont la **source de vérité** des emails envoyés par Supabase.
Ils ne vivent nulle part ailleurs que dans un tableau de bord externe : sans
cette copie, personne ne peut les relire, les comparer, ni les restaurer.

## Où les coller

Tableau de bord Supabase → **Authentication → Emails**, puis, pour chaque
gabarit, coller le contenu du fichier correspondant :

| Fichier | Gabarit Supabase |
|---|---|
| `confirmation-inscription.html` | Confirm signup |
| `reinitialisation-mot-de-passe.html` | Reset password |
| `changement-adresse.html` | Change Email Address |

Les autres gabarits (Magic Link, Invite user, Reauthentication) restent en
anglais : l'application ne déclenche aucun d'eux aujourd'hui. À traduire le
jour où l'un est mis en service.

## Réglage à ne pas désactiver

**« Secure email change »** (Authentication → Providers → Email) doit rester
activé. Il impose une confirmation sur l'ANCIENNE adresse en plus de la
nouvelle. Désactivé, quelqu'un qui met la main sur une session ouverte
détourne le compte vers sa propre adresse sans que le propriétaire soit
prévenu — et reprend alors la main dessus par « mot de passe oublié ». Le
gabarit `changement-adresse.html` est écrit en supposant ce réglage actif.

## Pourquoi `{{ .RedirectTo }}&token_hash=...` et non `{{ .ConfirmationURL }}`

`{{ .ConfirmationURL }}` produit un lien qui ramène un `code` à échanger contre
une session. Cet échange exige une clé de vérification stockée dans le
navigateur qui a fait la demande : le lien ne fonctionne donc QUE sur
l'appareil d'origine. Constaté le 20/08/2026 sur la réinitialisation de mot de
passe — or on lit ses courriels sur son téléphone, et une personne qui a oublié
son mot de passe n'a aucun moyen de rattraper l'échec.

`{{ .TokenHash }}` se suffit à lui-même : la route `/auth/confirmer` le vérifie
côté serveur, sans rien attendre du navigateur. Le lien marche partout.

`{{ .RedirectTo }}` est l'adresse que l'application a demandée — donc
`localhost` en développement et le domaine public en production. Le `&` (et non
`?`) est indispensable : cette adresse porte déjà un `?next=`.

## Règles à ne pas casser

- **`{{ .Token }}` est indispensable dans « Confirm signup ».** L'application
  attend un code à 6 chiffres saisi au clavier. Un gabarit qui ne contient que
  `{{ .ConfirmationURL }}` laisse sans issue quiconque ouvre son courriel sur
  un autre appareil que celui de l'inscription — le lien n'ouvre de session
  que dans le navigateur d'origine.
- **Ne pas remplacer le lien par `{{ .ConfirmationURL }}`** — voir la section
  ci-dessus : le parcours redevient dépendant de l'appareil.
- **Aucune image distante.** La plupart des messageries les bloquent par
  défaut : un logo en image se réduirait à un carré vide. D'où le nom en texte.
- **Styles en ligne uniquement.** Gmail supprime les blocs `<style>`.
- **Mise en page en `<table>`.** Outlook ignore flexbox et grid.

## Après modification

Coller dans Supabase, puis déclencher un envoi réel et lire le message reçu :
ces gabarits ne sont couverts par aucun test automatique.
