# Procédure de vérification bout-en-bout (Supabase Auth & Sync)

Ce document consignes les vérifications manuelles et automatisées de la couche d'authentification, de sécurité et de synchronisation Supabase de CVMatchr.

## 1. Tests automatisés RLS & Base de données PostgreSQL

Exécuté le 2026-08-11 avec Docker (PostgreSQL 15) :

```bash
docker run --rm -e POSTGRES_PASSWORD=x -v "$PWD/supabase:/sql" postgres:15 sh -c "docker-entrypoint.sh postgres > /tmp/pg.log 2>&1 & sleep 12 && psql -U postgres -q -v ON_ERROR_STOP=1 -f /sql/_auth_stub.sql -f /sql/migrations/0001_auth_quotas.sql > /dev/null && psql -U postgres -v ON_ERROR_STOP=1 -f /sql/tests/rls_etancheite.sql"
```

**Résultat :**
- `TEST 5 OK` — profils créés automatiquement avec free/15.
- `TEST 1 OK` — étanchéité RLS et PK composite.
- `TEST 4 OK` — 15 crédits accordés, 16e refusé, pas de débit sur refus.
- `TEST 2 OK` — compteur en lecture seule pour l'utilisateur.
- `TEST 3 OK` — plan et quota neutralisés, display_name modifiable.
- `TEST 3b OK` — le service_role peut promouvoir un compte.
- **`TOUS_LES_TESTS_OK`**

---

## 2. Checklist des vérifications applicatives bout-en-bout

- [x] **Mode local intact (dégradé sans Supabase)** :
  - Sans `.env.local`, l'application démarre sans erreur. Le menu utilisateur masque la tentative de connexion Google.
  - Création de CV, modification et export PDF fonctionnent à 100% en IndexedDB local.

- [x] **Refus des invités (401 Unauthorized)** :
  - Appel d'une route IA (`/api/tailor-resume`) sans session ni clé perso dans les en-têtes :
    ```bash
    curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/tailor-resume -H "Content-Type: application/json" -d '{"resume":{},"job_desc":"test"}'
    # Sortie : 401
    ```

- [x] **Clé personnelle BYOK (Bypass des quotas serveur)** :
  - En renseignant une clé personnelle dans les Paramètres (en-tête `X-Api-Key`), la requête passe directement sans débiter le compteur `api_usage` PostgreSQL.

- [x] **Quota applicatif (429 Too Many Requests)** :
  - Un compte utilisateur connecté consomme ses 15 crédits gratuits. Au 16e appel, la RPC `consume_ai_credit` renvoie un statut `429` avec le message *"Quota mensuel gratuit atteint (15/15 crédits). Renseignez votre propre clé API dans les Paramètres pour continuer."*
  - L'ajout d'une clé perso dans les Paramètres débloque immédiatement les appels IA.

- [x] **Flux OAuth Google** :
  - Clic sur *"Se connecter avec Google"* → redirection vers Google OAuth → retour sur `/auth/callback` → création automatique du profil PostgreSQL via trigger → session persistée au rechargement.

- [x] **Synchronisation multi-appareils** :
  - Un CV créé sur le navigateur A est poussé sur Supabase et automatiquement tiré (*pull*) sur le navigateur B connecté au même compte.
  - La suppression d'un CV sur A pose un marqueur `deleted_at` (soft delete) qui se propage à B et empêche la résurrection du document.

- [x] **Déconnexion et étanchéité inter-comptes** :
  - La déconnexion appelle `purgeLocalData()`, ce qui vide entièrement la base Dexie locale (`history`, `jobs`, `applications`, `snapshots`, `drafts`).
  - La connexion à un second compte B n'affiche aucun reliquat du compte A.
