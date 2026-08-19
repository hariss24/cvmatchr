import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "./route";

// Le débit n'est plus compté ici : la route délègue à `enforceRateLimit`, qui
// s'appuie sur un compteur partagé en base (le compteur mémoire d'avant ne
// survivait pas au serverless). Ce qui se teste ici, c'est donc la délégation —
// le comptage lui-même est couvert par lib/security/rateLimit.test.ts.
const enforceRateLimit = vi.hoisted(() =>
  vi.fn<(req: Request, route: string) => Promise<Response | null>>(),
);
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit }));

describe("Login API", () => {
  beforeEach(() => {
    process.env.REMOTE_AUTH_PASSWORD = "secretpassword";
    // mockReset et pas seulement mockResolvedValue : `vi.restoreAllMocks()`
    // ne remet pas à zéro l'historique d'un mock créé par vi.hoisted, et les
    // appels s'additionneraient d'un test à l'autre.
    enforceRateLimit.mockReset();
    enforceRateLimit.mockResolvedValue(null);
    // Mock crypto.subtle.digest for tests to avoid having to use real crypto API in node
    const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          digest: mockDigest
        }
      }
    });
  });

  afterEach(() => {
    delete process.env.REMOTE_AUTH_PASSWORD;
    vi.restoreAllMocks();
  });

  it("should return success if no password is set", async () => {
    delete process.env.REMOTE_AUTH_PASSWORD;
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ password: "anything" }),
      headers: { "x-forwarded-for": "1.1.1.1" }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ password: "wrong" }),
      headers: { "x-forwarded-for": "2.2.2.2" }
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("passe la main au compteur partagé, sous le nom de route 'login'", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ password: "wrong" }),
      headers: { "x-forwarded-for": "3.3.3.3" }
    });

    await POST(req);

    expect(enforceRateLimit).toHaveBeenCalledOnce();
    expect(enforceRateLimit.mock.calls[0][1]).toBe("login");
  });

  it("renvoie le 429 du compteur sans même regarder le mot de passe", async () => {
    enforceRateLimit.mockResolvedValue(
      Response.json({ error: "Trop de requêtes." }, { status: 429 }),
    );

    // Mot de passe CORRECT : s'il passait quand même, la limite serait contournable.
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ password: "secretpassword" }),
      headers: { "x-forwarded-for": "3.3.3.3" }
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("should succeed with correct password", async () => {
    const req = new Request("http://localhost/api/login", {
      method: "POST",
      body: JSON.stringify({ password: "secretpassword" }),
      headers: { "x-forwarded-for": "4.4.4.4" }
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Cookie should be set
    const cookie = res.headers.get("Set-Cookie");
    expect(cookie).toContain("auth_token=");
  });
});
