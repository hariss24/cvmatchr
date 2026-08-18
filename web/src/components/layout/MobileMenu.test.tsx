/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const auth = {
  user: null as null | { email: string; user_metadata?: Record<string, string> },
  isConfigured: true,
  signInWithGoogle: vi.fn(),
  signOut: vi.fn(),
};
vi.mock("@/state/authStore", () => ({ useAuthStore: () => auth }));
vi.mock("@/components/auth/QuotaBadge", () => ({ default: () => null }));
vi.mock("@/components/auth/GoogleSignInButton", () => ({
  default: () => <div>Bouton Google</div>,
}));

import MobileMenu from "./MobileMenu";

/**
 * Le menu utilisateur de la barre du haut porte `mobile-hidden`. Sur téléphone,
 * il n'existait donc AUCUN moyen de se connecter : l'app s'ouvrait, mais le
 * compte était inatteignable — et depuis que l'enregistrement est automatique,
 * un visiteur non connecté ne peut rien conserver.
 */
function afficher() {
  return render(
    <MobileMenu
      open
      onClose={() => {}}
      onNewCv={() => {}}
      onOpenChat={() => {}}
      onToggleTheme={() => {}}
    />,
  );
}

beforeEach(() => {
  cleanup();
  auth.user = null;
  vi.clearAllMocks();
});

describe("MobileMenu — accès au compte", () => {
  it("propose de se connecter quand personne ne l'est", () => {
    afficher();
    expect(screen.getByText("Se connecter avec Google")).toBeTruthy();
    expect(screen.queryByText("Déconnexion")).toBeNull();
  });

  it("affiche qui est connecté, et permet de sortir", () => {
    auth.user = { email: "a@b.fr", user_metadata: { full_name: "Hariss" } };
    afficher();
    expect(screen.getByText("Hariss")).toBeTruthy();
    expect(screen.getByText("Déconnexion")).toBeTruthy();
    expect(screen.queryByText("Se connecter avec Google")).toBeNull();
  });

  it("ne promet pas une connexion impossible si Supabase n'est pas configuré", () => {
    auth.isConfigured = false;
    afficher();
    expect(screen.queryByText("Se connecter avec Google")).toBeNull();
    auth.isConfigured = true;
  });
});
