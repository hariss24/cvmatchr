import type { Page } from '@playwright/test';

export const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

export const FAKE_USER = {
  id: FAKE_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@example.com',
  email_confirmed_at: '2026-01-01T00:00:00Z',
  phone: '',
  confirmed_at: '2026-01-01T00:00:00Z',
  last_sign_in_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { name: 'Test User' },
  identities: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const FAKE_SESSION = {
  access_token: 'fake-access-token',
  token_type: 'bearer',
  expires_in: 3600000,
  expires_at: Math.floor(Date.now() / 1000) + 3600000,
  refresh_token: 'fake-refresh-token',
  user: FAKE_USER,
};

/**
 * Injecte une session Supabase factice et intercepte les appels PostgREST (rest/v1).
 * Permet aux tests e2e de tourner sans accès réseau Supabase réel.
 */
export async function connecte(page: Page) {
  const sessionStr = JSON.stringify(FAKE_SESSION);

  // 1. Initialiser le localStorage et les cookies dans la page avant tout chargement
  await page.addInitScript((sessionJson) => {
    try {
      const keys = [
        'sb-czbpdmkdcssiitpynpxm-auth-token',
        'sb-supabase-auth-token',
        'supabase.auth.token',
      ];
      for (const k of keys) {
        window.localStorage.setItem(k, sessionJson);
      }

      // Encodage base64 standard de la session pour @supabase/ssr
      const b64 = btoa(unescape(encodeURIComponent(sessionJson)));
      document.cookie = `sb-czbpdmkdcssiitpynpxm-auth-token=${encodeURIComponent(
        'base64-' + b64,
      )}; path=/; max-age=3600000`;
      document.cookie = `sb-czbpdmkdcssiitpynpxm-auth-token.0=${encodeURIComponent(
        'base64-' + b64,
      )}; path=/; max-age=3600000`;
    } catch {
      // no-op
    }
  }, sessionStr);

  // 2. Intercepter les appels Auth Supabase
  await page.route('**/auth/v1/user*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_USER),
    });
  });

  await page.route('**/auth/v1/session*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION),
    });
  });

  await page.route('**/auth/v1/token*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FAKE_SESSION),
    });
  });

  // 3. Store mémoire par page pour mocker PostgREST
  const store = new Map<string, unknown>();

  await page.route('**/rest/v1/**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET') {
      const isSingle = route.request().headers()['accept']?.includes('vnd.pgrst.object+json');

      if (url.includes('user_settings')) {
        const idMatch = url.match(/(?:^|[?&])id=eq\.([^&]+)/);
        const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
        const entry = id ? store.get(id) : null;

        if (isSingle) {
          if (entry) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(entry),
            });
            return;
          }
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(entry ? [entry] : []),
        });
        return;
      }

      if (url.includes('saved_jobs')) {
        const jobs = (store.get('saved_jobs') as Record<string, unknown>[]) || [];
        const idMatch = url.match(/(?:^|[?&])id=eq\.([^&]+)/);
        const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
        const filtered = id ? jobs.filter((j) => j.id === id) : jobs;

        if (isSingle) {
          if (filtered.length === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(filtered[0]),
            });
            return;
          }
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', message: 'The result contains 0 rows' }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filtered),
        });
        return;
      }

      if (url.includes('documents')) {
        const docs = (store.get('documents') as Record<string, unknown>[]) || [];
        const idMatch = url.match(/(?:^|[?&])id=eq\.([^&]+)/);
        const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
        const filtered = id ? docs.filter((d) => d.id === id) : docs;

        if (isSingle) {
          if (filtered.length === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(filtered[0]),
            });
            return;
          }
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', message: 'The result contains 0 rows' }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filtered),
        });
        return;
      }

      if (url.includes('applications')) {
        const apps = (store.get('applications') as Record<string, unknown>[]) || [];
        const idMatch = url.match(/(?:^|[?&])id=eq\.([^&]+)/);
        const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
        const filtered = id ? apps.filter((a) => a.id === id) : apps;

        if (isSingle) {
          if (filtered.length === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(filtered[0]),
            });
            return;
          }
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', message: 'The result contains 0 rows' }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filtered),
        });
        return;
      }

      if (url.includes('templates')) {
        const tpls = (store.get('templates') as Record<string, unknown>[]) || [];
        const idMatch = url.match(/(?:^|[?&])id=eq\.([^&]+)/);
        const id = idMatch ? decodeURIComponent(idMatch[1]) : null;
        const filtered = id ? tpls.filter((t) => t.id === id) : tpls;

        if (isSingle) {
          if (filtered.length === 1) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(filtered[0]),
            });
            return;
          }
          await route.fulfill({
            status: 406,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'PGRST116', message: 'The result contains 0 rows' }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(filtered),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      const postData = route.request().postDataJSON();
      if (url.includes('user_settings')) {
        const id = postData?.id;
        if (id) store.set(id, postData);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(postData ?? {}),
        });
        return;
      }

      if (url.includes('saved_jobs')) {
        const jobs = (store.get('saved_jobs') as Record<string, unknown>[]) || [];
        const incoming = Array.isArray(postData) ? postData : [postData];
        for (const j of incoming) {
          const idx = jobs.findIndex((x) => x.id === j.id);
          if (idx >= 0) jobs[idx] = j;
          else jobs.push(j);
        }
        store.set('saved_jobs', jobs);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(postData ?? {}),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(postData ?? {}),
      });
      return;
    }

    if (method === 'DELETE') {
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    await route.continue();
  });
}
