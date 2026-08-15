import { describe, it, expect, vi } from 'vitest';
import { onSyncChange, emitSyncChange } from './syncEvents';

describe('syncEvents', () => {
  it('prévient les abonnés', () => {
    const vu = vi.fn();
    const off = onSyncChange(vu);
    emitSyncChange();
    expect(vu).toHaveBeenCalledTimes(1);
    off();
  });

  it('ne prévient plus après désabonnement', () => {
    const vu = vi.fn();
    onSyncChange(vu)();
    emitSyncChange();
    expect(vu).not.toHaveBeenCalled();
  });

  it('un abonné qui se désabonne pendant l\'émission ne casse pas les suivants', () => {
    const suivant = vi.fn();
    const off = onSyncChange(() => off());
    onSyncChange(suivant);
    emitSyncChange();
    expect(suivant).toHaveBeenCalledTimes(1);
    off();
  });
});
