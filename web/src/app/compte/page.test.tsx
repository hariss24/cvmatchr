/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import PageCompte from './page';
import { useAuthStore } from '@/state/authStore';

const pousser = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pousser, replace: pousser, refresh: pousser }),
  usePathname: () => '/compte',
}));

const uiConfirm = vi.fn();
const uiPrompt = vi.fn();
vi.mock('@/state/uiStore', () => ({
  toast: vi.fn(),
  uiConfirm: (...a: unknown[]) => uiConfirm(...a),
  uiPrompt: (...a: unknown[]) => uiPrompt(...a),
}));

const compte = (extra = {}) => ({
  id: 'u1', email: 'marc@test.fr', app_metadata: { provider: 'email' }, ...extra,
});

describe('Page Mon compte', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    pousser.mockClear();
    uiConfirm.mockReset().mockResolvedValue(true);
    uiPrompt.mockReset().mockResolvedValue('SUPPRIMER');
    useAuthStore.setState({
      user: compte() as never, isLoading: false, isConfigured: true,
      changePassword: vi.fn().mockResolvedValue(undefined),
      signOutOthers: vi.fn().mockResolvedValue(undefined),
      deleteAccount: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("montre l'adresse et la méthode de connexion", () => {
    render(<PageCompte />);
    expect(screen.getByText('marc@test.fr')).toBeInTheDocument();
    expect(screen.getByText(/email et mot de passe/i)).toBeInTheDocument();
  });

  // Un compte Google n'a jamais eu de mot de passe : le formulaire ne pourrait
  // être satisfait par aucune saisie.
  it('ne propose pas de changer un mot de passe qui n\'existe pas', () => {
    useAuthStore.setState({
      user: compte({ app_metadata: { provider: 'google' } }) as never,
    });
    render(<PageCompte />);
    expect(screen.getByText(/compte google/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/mot de passe actuel/i)).toBeNull();
  });

  it("renvoie vers la connexion quelqu'un sans compte", async () => {
    useAuthStore.setState({ user: null, isLoading: false });
    render(<PageCompte />);
    await waitFor(() => expect(pousser).toHaveBeenCalledWith('/connexion'));
  });

  // Rediriger pendant le chargement éjecterait une personne parfaitement
  // connectée : la session ne revient qu'après un aller-retour.
  it("attend la fin du chargement avant de rediriger", () => {
    useAuthStore.setState({ user: null, isLoading: true });
    render(<PageCompte />);
    expect(pousser).not.toHaveBeenCalled();
  });

  it('exige le mot de passe actuel pour en changer', async () => {
    render(<PageCompte />);
    fireEvent.change(screen.getByLabelText(/mot de passe actuel/i), {
      target: { value: 'ancien123' },
    });
    fireEvent.change(screen.getByLabelText(/nouveau mot de passe/i), {
      target: { value: 'nouveaumotdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le nouveau/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().changePassword)
        .toHaveBeenCalledWith('ancien123', 'nouveaumotdepasse');
    });
  });

  it('refuse un nouveau mot de passe trop court sans appeler le réseau', async () => {
    render(<PageCompte />);
    fireEvent.change(screen.getByLabelText(/mot de passe actuel/i), {
      target: { value: 'ancien123' },
    });
    fireEvent.change(screen.getByLabelText(/nouveau mot de passe/i), {
      target: { value: 'court' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le nouveau/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/8 caractères/i);
    expect(useAuthStore.getState().changePassword).not.toHaveBeenCalled();
  });

  it('refuse de « changer » pour le même mot de passe', async () => {
    render(<PageCompte />);
    fireEvent.change(screen.getByLabelText(/mot de passe actuel/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.change(screen.getByLabelText(/nouveau mot de passe/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer le nouveau/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/identique/i);
    expect(useAuthStore.getState().changePassword).not.toHaveBeenCalled();
  });

  it('ferme les autres sessions', async () => {
    render(<PageCompte />);
    fireEvent.click(screen.getByRole('button', { name: /déconnecter les autres/i }));
    await waitFor(() => expect(useAuthStore.getState().signOutOthers).toHaveBeenCalled());
  });

  // Les deux garde-fous de la suppression. Un bouton rouge se clique par
  // réflexe : sans le mot tapé à la main, un geste malheureux efface tout.
  it('supprime le compte après avertissement ET mot tapé', async () => {
    render(<PageCompte />);
    fireEvent.click(screen.getByRole('button', { name: /^supprimer mon compte$/i }));
    await waitFor(() => expect(useAuthStore.getState().deleteAccount).toHaveBeenCalled());
    expect(uiConfirm).toHaveBeenCalled();
    expect(uiPrompt).toHaveBeenCalled();
  });

  it("ne supprime rien si l'avertissement est refusé", async () => {
    uiConfirm.mockResolvedValue(false);
    render(<PageCompte />);
    fireEvent.click(screen.getByRole('button', { name: /^supprimer mon compte$/i }));
    await waitFor(() => expect(uiConfirm).toHaveBeenCalled());
    expect(uiPrompt).not.toHaveBeenCalled();
    expect(useAuthStore.getState().deleteAccount).not.toHaveBeenCalled();
  });

  it("ne supprime rien si le mot tapé ne correspond pas", async () => {
    uiPrompt.mockResolvedValue('supprimer');
    render(<PageCompte />);
    fireEvent.click(screen.getByRole('button', { name: /^supprimer mon compte$/i }));
    await waitFor(() => expect(uiPrompt).toHaveBeenCalled());
    expect(useAuthStore.getState().deleteAccount).not.toHaveBeenCalled();
  });
});
