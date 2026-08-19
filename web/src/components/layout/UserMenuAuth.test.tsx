/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import UserMenu from './UserMenu';
import { useAuthStore } from '@/state/authStore';

describe('UserMenu — authentification', () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    useAuthStore.setState({ user: null, session: null, isLoading: false, isConfigured: true });
  });

  it('propose la connexion quand personne n\'est connecté', () => {
    render(<UserMenu onToggleTheme={() => {}} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    expect(screen.getByText(/se connecter/i)).toBeInTheDocument();
  });

  it('masque l\'entrée de connexion si Supabase n\'est pas configuré', () => {
    useAuthStore.setState({ isConfigured: false });
    render(<UserMenu onToggleTheme={() => {}} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    expect(screen.queryByText(/se connecter/i)).toBeNull();
  });
});
