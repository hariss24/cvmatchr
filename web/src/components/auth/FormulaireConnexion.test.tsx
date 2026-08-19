/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import FormulaireConnexion from './FormulaireConnexion';
import { useAuthStore } from '@/state/authStore';

// Sans ce mock, `useRouter` lève « expected app router to be mounted » : sous
// jsdom il n'y a aucun routeur Next. Même procédé que MobileMenu.test.tsx,
// qui mocke `usePathname` pour la même raison.
const pousser = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pousser, replace: pousser, refresh: pousser }),
  usePathname: () => '/connexion',
}));

describe('FormulaireConnexion', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAuthStore.setState({
      user: null, session: null, isLoading: false, isConfigured: true,
      signInWithEmail: vi.fn().mockResolvedValue(undefined),
      signUpWithEmail: vi.fn().mockResolvedValue(undefined),
      confirmSignupCode: vi.fn().mockResolvedValue(undefined),
      requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ google: false }),
    }));
  });

  // Le bouton Google est rendu par Google Identity Services, dont le script ne
  // se charge pas sous jsdom : on ne peut donc pas chercher son libellé. Le
  // séparateur « ou » prouve que le bloc Google est bien monté à côté du
  // formulaire — c'est la cohabitation des deux chemins qu'on teste ici.
  it('affiche les deux chemins : Google et le formulaire', () => {
    render(<FormulaireConnexion />);
    expect(screen.getByText(/^ou$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument();
  });

  it('refuse une adresse invalide sans appeler le réseau', async () => {
    render(<FormulaireConnexion />);
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'pas-une-adresse' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }));

    expect(await screen.findByText(/adresse email n'est pas valide/i)).toBeInTheDocument();
    expect(useAuthStore.getState().signInWithEmail).not.toHaveBeenCalled();
  });

  it('connecte avec des identifiants valides', async () => {
    render(<FormulaireConnexion />);
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().signInWithEmail)
        .toHaveBeenCalledWith('marc@test.fr', 'motdepasse');
    });
  });

  it('oriente vers Google quand la route reconnaît un compte Google', async () => {
    useAuthStore.setState({
      signInWithEmail: vi.fn().mockRejectedValue({ message: 'Invalid login credentials' }),
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ google: true }),
    }));

    render(<FormulaireConnexion />);
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^se connecter$/i }));

    expect(await screen.findByText(/compte a été créé avec google/i)).toBeInTheDocument();
  });

  it('passe à la saisie du code après une inscription réussie', async () => {
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }));
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^créer mon compte$/i }));

    expect(await screen.findByLabelText(/code reçu par email/i)).toBeInTheDocument();
  });

  it('ne demande pas de mot de passe pour une réinitialisation', async () => {
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }));
    expect(screen.queryByLabelText(/^mot de passe$/i)).toBeNull();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
  });
});
