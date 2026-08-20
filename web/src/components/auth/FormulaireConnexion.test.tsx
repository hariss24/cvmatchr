/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
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
    window.history.replaceState({}, '', '/connexion');
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

  // Régression du 19/08 : le composant ne regardait que `isConfigured`, qui
  // vaut `false` tant que `initAuth()` n'a pas répondu. Le HTML servi pour
  // /connexion ne contenait alors QUE le message d'indisponibilité — la page
  // d'inscription annonçait au visiteur qu'il ne pouvait pas s'inscrire.
  it("affiche le formulaire pendant l'initialisation de la session", () => {
    useAuthStore.setState({ isConfigured: false, isLoading: true });
    render(<FormulaireConnexion />);
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
    expect(screen.queryByText(/indisponible sur cette installation/i)).toBeNull();
  });

  it("renvoie vers l'accueil quelqu'un qui est déjà connecté", async () => {
    pousser.mockClear();
    useAuthStore.setState({
      user: { id: 'u1', email: 'marc@test.fr' } as never,
      isConfigured: true, isLoading: false,
    });
    render(<FormulaireConnexion />);
    await waitFor(() => expect(pousser).toHaveBeenCalledWith('/'));
  });

  it("annonce l'indisponibilité seulement une fois l'initialisation terminée", () => {
    useAuthStore.setState({ isConfigured: false, isLoading: false });
    render(<FormulaireConnexion />);
    expect(screen.getByText(/indisponible sur cette installation/i)).toBeInTheDocument();
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

  // Retour de /auth/callback : le lien a bien confirmé l'adresse côté serveur,
  // mais la session ne pouvait pas s'ouvrir dans CE navigateur. Sans message,
  // la personne se retrouvait devant un formulaire de connexion muet.
  it("explique pourquoi la session ne s'est pas ouverte sur cet appareil", async () => {
    window.history.replaceState({}, '', '/connexion?erreur=session_impossible');
    render(<FormulaireConnexion />);
    expect(await screen.findByRole('alert'))
      .toHaveTextContent(/n'a pas pu s'ouvrir sur cet appareil/i);
  });

  // Lien de réinitialisation cliqué trop tard, ou déjà utilisé. Sans message,
  // la personne retombe sur le formulaire sans comprendre ce qui a échoué.
  it("explique qu'un lien périmé se redemande", async () => {
    window.history.replaceState({}, '', '/connexion?erreur=lien_expire');
    render(<FormulaireConnexion />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/n'est plus valable/i);
  });

  it('ne demande pas de mot de passe pour une réinitialisation', async () => {
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }));
    expect(screen.queryByLabelText(/^mot de passe$/i)).toBeNull();
    expect(screen.getByLabelText(/adresse email/i)).toBeInTheDocument();
  });
});

describe('FormulaireConnexion — déblocage automatique', () => {
  afterEach(() => { vi.useRealTimers(); cleanup(); });

  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState({}, '', '/connexion');
    useAuthStore.setState({
      user: null, session: null, isLoading: false, isConfigured: true,
      signUpWithEmail: vi.fn().mockResolvedValue(undefined),
    });
  });

  /** Amène le formulaire à l'écran de saisie du code, sous timers simulés. */
  async function jusquAuCode() {
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /créer un compte/i }));
    fireEvent.change(screen.getByLabelText(/adresse email/i), {
      target: { value: 'marc@test.fr' },
    });
    fireEvent.change(screen.getByLabelText(/^mot de passe$/i), {
      target: { value: 'motdepasse' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^créer mon compte$/i }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByLabelText(/code reçu par email/i)).toBeInTheDocument();
  }

  // Le cas visé : la personne clique le lien depuis son téléphone. Cet onglet
  // ne reçoit rien — sans cette relance il resterait bloqué indéfiniment.
  it("retente la connexion tant que l'adresse n'est pas confirmée", async () => {
    const connexion = vi.fn().mockRejectedValue(new Error('Email not confirmed'));
    useAuthStore.setState({ signInWithEmail: connexion });
    await jusquAuCode();

    expect(connexion).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(connexion).toHaveBeenCalledWith('marc@test.fr', 'motdepasse');
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(connexion).toHaveBeenCalledTimes(2);
  });

  // Supabase plafonne les tentatives à 30 par 5 minutes ET PAR IP : une boucle
  // sans fin épuiserait le quota de tout le foyer ou de tout le bureau.
  it('cesse de relancer au bout de cinq minutes', async () => {
    const connexion = vi.fn().mockRejectedValue(new Error('Email not confirmed'));
    useAuthStore.setState({ signInWithEmail: connexion });
    await jusquAuCode();

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    const apresCinqMinutes = connexion.mock.calls.length;
    expect(apresCinqMinutes).toBeLessThanOrEqual(20);

    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60_000); });
    expect(connexion).toHaveBeenCalledTimes(apresCinqMinutes);
  });

  it('ne relance pas depuis les autres écrans', async () => {
    const connexion = vi.fn().mockRejectedValue(new Error('Email not confirmed'));
    useAuthStore.setState({ signInWithEmail: connexion });
    render(<FormulaireConnexion />);
    fireEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }));

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(connexion).not.toHaveBeenCalled();
  });
});
