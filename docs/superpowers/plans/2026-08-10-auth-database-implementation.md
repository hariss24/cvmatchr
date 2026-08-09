# Supabase Auth, Database & AI Quotas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Supabase PostgreSQL, Google OAuth authentication, a Freemium AI quota enforcement system, and an offline-first hybrid synchronization engine with Dexie IndexedDB.

**Architecture:** `@supabase/ssr` manages cookie-based sessions in Next.js 16. Server API routes enforce AI quotas (`api_usage` table) before calling Gemini/Anthropic APIs. An asynchronous `SyncEngine` handles delta sync between local IndexedDB (Dexie) and Supabase PostgreSQL with soft deletes (`deleted_at`).

**Tech Stack:** Next.js 16 (App Router), TypeScript, `@supabase/ssr`, `@supabase/supabase-js`, Zustand, Vitest, Dexie.

## Global Constraints
- Next.js 16 conventions: read `web/AGENTS.md` and use App Router server helpers for cookies.
- Strict TypeScript: no `any`, no `@ts-ignore`.
- Zero UI regressions: existing local offline mode must function without breaks for guests.
- Never hardcode colors: use theme variables (`var(--bg)`, `var(--text)`).
- Never send base64 photos to AI APIs.

---

### Task 1: Supabase SSR Helpers and Middleware

**Files:**
- Create: `web/src/lib/supabase/client.ts`
- Create: `web/src/lib/supabase/server.ts`
- Modify: `web/src/middleware.ts`
- Test: `web/tests/unit/supabase.test.ts`

**Interfaces:**
- Consumes: Environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Produces: `createClient()` (browser), `createClient()` (server), Next.js middleware session refresh.

- [ ] **Step 1: Write failing test for Supabase client initialization**

```typescript
// web/tests/unit/supabase.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createBrowserClientHelper } from '../../src/lib/supabase/client';

describe('Supabase Client Helper', () => {
  it('initializes browser client with env variables', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    const client = createBrowserClientHelper();
    expect(client).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/supabase.test.ts`
Expected: FAIL with module `createBrowserClientHelper` not found.

- [ ] **Step 3: Implement Supabase browser and server helpers**

```typescript
// web/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export function createBrowserClientHelper() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// web/src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerClientHelper() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Invoked from Server Component
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Update middleware to refresh Supabase Auth sessions**

```typescript
// web/src/middleware.ts (Add session update logic)
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    await supabase.auth.getUser();
  }

  return response;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/supabase.test.ts`
Expected: PASS

- [ ] **Step 6: Commit Task 1**

```bash
git add web/src/lib/supabase/ web/src/middleware.ts web/tests/unit/supabase.test.ts
git commit -m "feat(auth): ajout des helpers Supabase SSR et middleware de session"
```

---

### Task 2: Auth Store & OAuth Callback Handler

**Files:**
- Create: `web/src/state/authStore.ts`
- Create: `web/src/app/auth/callback/route.ts`
- Test: `web/tests/unit/authStore.test.ts`

**Interfaces:**
- Consumes: `@supabase/ssr` browser client
- Produces: `useAuthStore` Zustand hook with `user`, `session`, `signInWithGoogle()`, `signOut()`

- [ ] **Step 1: Write failing test for authStore state**

```typescript
// web/tests/unit/authStore.test.ts
import { describe, it, expect } from 'vitest';
import { useAuthStore } from '../../src/state/authStore';

describe('AuthStore', () => {
  it('starts with default unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/authStore.test.ts`
Expected: FAIL with module `useAuthStore` not found.

- [ ] **Step 3: Implement useAuthStore and OAuth Callback Route**

```typescript
// web/src/state/authStore.ts
import { create } from 'zustand';
import { User, Session } from '@supabase/supabase-js';
import { createBrowserClientHelper } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, user: session?.user ?? null, isLoading: false }),
  signInWithGoogle: async () => {
    const supabase = createBrowserClientHelper();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  },
  signOut: async () => {
    const supabase = createBrowserClientHelper();
    await supabase.auth.signOut();
    set({ user: null, session: null, isLoading: false });
  },
  initAuth: async () => {
    if (typeof window === 'undefined') return;
    const supabase = createBrowserClientHelper();
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, isLoading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, isLoading: false });
    });
  },
}));
```

```typescript
// web/src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClientHelper } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createServerClientHelper();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=callback_failed`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/authStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add web/src/state/authStore.ts web/src/app/auth/callback/route.ts web/tests/unit/authStore.test.ts
git commit -m "feat(auth): ajout du store Zustand et du route handler OAuth callback"
```

---

### Task 3: AI Quota & Authorization Engine

**Files:**
- Create: `web/src/lib/ai/quota.ts`
- Test: `web/tests/unit/quota.test.ts`

**Interfaces:**
- Consumes: `createServerClientHelper()`, Supabase `api_usage` table
- Produces: `checkAndIncrementAiQuota(userId, endpoint, customApiKey)`

- [ ] **Step 1: Write failing test for quota check**

```typescript
// web/tests/unit/quota.test.ts
import { describe, it, expect } from 'vitest';
import { evaluateQuotaRules } from '../../src/lib/ai/quota';

describe('Quota Evaluation Rules', () => {
  it('bypasses server quota if custom API key is present', () => {
    const res = evaluateQuotaRules({
      hasCustomKey: true,
      isAuthenticated: false,
      monthlyUsage: 0,
      monthlyLimit: 15,
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('custom_key');
  });

  it('rejects unauthenticated guests without custom key', () => {
    const res = evaluateQuotaRules({
      hasCustomKey: false,
      isAuthenticated: false,
      monthlyUsage: 0,
      monthlyLimit: 15,
    });
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(401);
  });

  it('allows authenticated user within limit', () => {
    const res = evaluateQuotaRules({
      hasCustomKey: false,
      isAuthenticated: true,
      monthlyUsage: 5,
      monthlyLimit: 15,
    });
    expect(res.allowed).toBe(true);
    expect(res.reason).toBe('server_quota');
  });

  it('rejects authenticated user exceeding limit', () => {
    const res = evaluateQuotaRules({
      hasCustomKey: false,
      isAuthenticated: true,
      monthlyUsage: 15,
      monthlyLimit: 15,
    });
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(429);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/quota.test.ts`
Expected: FAIL with module `evaluateQuotaRules` not found.

- [ ] **Step 3: Implement evaluateQuotaRules & checkAndIncrementAiQuota**

```typescript
// web/src/lib/ai/quota.ts
export interface QuotaCheckParams {
  hasCustomKey: boolean;
  isAuthenticated: boolean;
  monthlyUsage: number;
  monthlyLimit: number;
}

export interface QuotaResult {
  allowed: boolean;
  reason?: 'custom_key' | 'server_quota';
  status?: number;
  message?: string;
}

export function evaluateQuotaRules(params: QuotaCheckParams): QuotaResult {
  if (params.hasCustomKey) {
    return { allowed: true, reason: 'custom_key' };
  }

  if (!params.isAuthenticated) {
    return {
      allowed: false,
      status: 401,
      message: 'Veuillez vous connecter avec Google ou fournir votre clé API dans les paramètres.',
    };
  }

  if (params.monthlyUsage >= params.monthlyLimit) {
    return {
      allowed: false,
      status: 429,
      message: 'Quota mensuel gratuit atteint. Fournissez votre clé API ou passez à la formule Pro.',
    };
  }

  return { allowed: true, reason: 'server_quota' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/quota.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
git add web/src/lib/ai/quota.ts web/tests/unit/quota.test.ts
git commit -m "feat(ai): ajout du moteur d'évaluation des quotas et d'autorisation"
```

---

### Task 4: Dexie Schema Update & Asynchronous Sync Engine

**Files:**
- Modify: `web/src/lib/storage/db.ts`
- Create: `web/src/lib/storage/syncEngine.ts`
- Test: `web/tests/unit/syncEngine.test.ts`

**Interfaces:**
- Consumes: Dexie local IndexedDB tables, `@supabase/ssr` client
- Produces: `SyncEngine.push()`, `SyncEngine.pull()`, `SyncEngine.syncAll()`

- [ ] **Step 1: Write failing test for sync logic**

```typescript
// web/tests/unit/syncEngine.test.ts
import { describe, it, expect } from 'vitest';
import { prepareSyncDelta } from '../../src/lib/storage/syncEngine';

describe('SyncEngine Delta Builder', () => {
  it('identifies unsynced items where synced_at is null or older than updated_at', () => {
    const items = [
      { id: '1', updated_at: '2026-08-10T00:00:00Z', synced_at: null },
      { id: '2', updated_at: '2026-08-10T00:00:00Z', synced_at: '2026-08-10T01:00:00Z' },
    ];
    const pending = prepareSyncDelta(items);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/syncEngine.test.ts`
Expected: FAIL with module `prepareSyncDelta` not found.

- [ ] **Step 3: Implement prepareSyncDelta and SyncEngine**

```typescript
// web/src/lib/storage/syncEngine.ts
export interface SyncableItem {
  id: string;
  updated_at: string;
  synced_at?: string | null;
  deleted_at?: string | null;
}

export function prepareSyncDelta<T extends SyncableItem>(items: T[]): T[] {
  return items.filter((item) => {
    if (!item.synced_at) return true;
    return new Date(item.updated_at).getTime() > new Date(item.synced_at).getTime();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/syncEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```bash
git add web/src/lib/storage/syncEngine.ts web/src/lib/storage/db.ts web/tests/unit/syncEngine.test.ts
git commit -m "feat(sync): ajout des fonctions delta de synchronisation hybride"
```

---

### Task 5: User Profile & Auth Modal UI Component

**Files:**
- Create: `web/src/components/auth/UserMenu.tsx`
- Test: `web/tests/unit/UserMenu.test.tsx`

**Interfaces:**
- Consumes: `useAuthStore`
- Produces: `<UserMenu />` React component rendering login button or Google user avatar + dropdown menu.

- [ ] **Step 1: Write test for UserMenu component**

```tsx
// web/tests/unit/UserMenu.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserMenu } from '../../src/components/auth/UserMenu';
import { useAuthStore } from '../../src/state/authStore';

describe('UserMenu Component', () => {
  it('renders login button when user is logged out', () => {
    useAuthStore.setState({ user: null, isLoading: false });
    render(<UserMenu />);
    expect(screen.getByText(/se connecter/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run tests/unit/UserMenu.test.tsx`
Expected: FAIL with module `UserMenu` not found.

- [ ] **Step 3: Implement UserMenu Component**

```tsx
// web/src/components/auth/UserMenu.tsx
'use client';

import React from 'react';
import { useAuthStore } from '@/state/authStore';

export function UserMenu() {
  const { user, isLoading, signInWithGoogle, signOut } = useAuthStore();

  if (isLoading) {
    return <div className="text-sm opacity-50">Chargement...</div>;
  }

  if (!user) {
    return (
      <button
        onClick={() => signInWithGoogle()}
        className="px-3 py-1.5 text-sm rounded-md bg-[var(--primary)] text-white hover:opacity-90 transition-opacity"
      >
        Se connecter
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {user.user_metadata?.avatar_url && (
        <img
          src={user.user_metadata.avatar_url}
          alt={user.email ?? 'Avatar'}
          className="w-7 h-7 rounded-full"
        />
      )}
      <span className="truncate max-w-[120px]">{user.user_metadata?.full_name ?? user.email}</span>
      <button
        onClick={() => signOut()}
        className="text-xs px-2 py-1 rounded bg-[var(--bg-subtle)] hover:bg-[var(--bg-hover)]"
      >
        Déconnexion
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run tests/unit/UserMenu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 5**

```bash
git add web/src/components/auth/UserMenu.tsx web/tests/unit/UserMenu.test.tsx
git commit -m "feat(ui): ajout du composant UserMenu pour l'authentification Google"
```

---

## Plan Verification Suite

Run full suite from `web/`:
```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
```
