/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EtatErreur from './EtatErreur';

describe('EtatErreur', () => {
  it('affiche le message d\'erreur et déclenche onRetry au clic', () => {
    const onRetry = vi.fn();
    render(<EtatErreur message="Impossible de joindre le serveur." onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Impossible de joindre le serveur.')).toBeDefined();

    const bouton = screen.getByRole('button', { name: 'Réessayer' });
    fireEvent.click(bouton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
