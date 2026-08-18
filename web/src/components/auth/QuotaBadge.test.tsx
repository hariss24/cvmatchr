/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

vi.mock("@/state/authStore", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { id: "u1" } }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClientHelper: () => null, // aucune donnée ne reviendra
}));

import QuotaBadge from "./QuotaBadge";

/**
 * Le compteur rendait `null` pendant l'aller-retour serveur, puis apparaissait :
 * sur mobile, tout le menu ☰ sautait d'une ligne sous le doigt de l'utilisateur.
 */
beforeEach(cleanup);

describe("QuotaBadge", () => {
  it("occupe sa place avant de connaître son chiffre", () => {
    const { container } = render(<QuotaBadge />);
    const badge = container.querySelector(".quota-badge");
    expect(badge).not.toBeNull();
    expect(badge!.textContent?.trim()).toBe("");
  });

  it("n'invente aucun solde tant qu'il ne le connaît pas", () => {
    const { container } = render(<QuotaBadge />);
    expect(container.textContent).not.toMatch(/crédits/);
  });
});
