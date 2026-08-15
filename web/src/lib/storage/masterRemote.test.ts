import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Resume } from '@/lib/resume/schema';

vi.mock('@/lib/storage/db', () => ({
  getHistoryEntry: vi.fn(),
  saveHistoryEntry: vi.fn(async () => {}),
}));
vi.mock('@/lib/storage/remote', async () => {
  const actual = await vi.importActual<typeof import('./remote')>('./remote');
  return { ...actual, currentUserId: vi.fn(async () => 'u-1' as string | null) };
});

import { getHistoryEntry, saveHistoryEntry } from '@/lib/storage/db';
import { currentUserId } from '@/lib/storage/remote';
import { loadMasterResume, saveMasterResume } from './master';
import { RemoteError } from './remote';

const SAMPLE_RESUME = {
  name: 'Hariss Maître',
  title: 'Lead Architect',
  email: 'h@example.com',
  phone: '0600000000',
  location: 'Lyon',
  about: 'Expert fullstack',
  experiences: [],
  education: [],
  skills: [],
} as unknown as Resume;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(currentUserId).mockResolvedValue('u-1');
});

describe('CV Maître', () => {
  it('s\'enregistre comme un document de type Maître, pas comme un CV étiqueté', async () => {
    await saveMasterResume(SAMPLE_RESUME, 'sobre');
    const entry = vi.mocked(saveHistoryEntry).mock.calls[0][0];
    expect(entry.doc_type).toBe('Maître');
    expect(entry.id).toBe('master');
    // `label` est le nom visible dans « Mes CV » : le détourner y ferait
    // apparaître le CV Maître sous le nom « master ».
    expect(entry.label).toBeUndefined();
  });

  it('rend null quand le compte n\'a pas de CV Maître', async () => {
    vi.mocked(getHistoryEntry).mockResolvedValueOnce(undefined);
    expect(await loadMasterResume()).toBeNull();
  });

  it('rend null quand le CV Maître enregistré est vide', async () => {
    vi.mocked(getHistoryEntry).mockResolvedValueOnce({
      id: 'master', doc_type: 'Maître', json: { ...SAMPLE_RESUME, name: '', title: '' },
    } as never);
    expect(await loadMasterResume()).toBeNull();
  });

  it('rend null sans compte, sans lever : l\'éditeur reste utilisable déconnecté', async () => {
    vi.mocked(currentUserId).mockResolvedValue(null);
    expect(await loadMasterResume()).toBeNull();
    expect(vi.mocked(getHistoryEntry)).not.toHaveBeenCalled();
  });

  it('laisse remonter une panne au lieu de la faire passer pour une absence', async () => {
    // Une panne confondue avec « pas de CV Maître » relance en silence la dérive
    // d'adaptation en adaptation que ce mécanisme existe pour empêcher.
    vi.mocked(getHistoryEntry).mockRejectedValueOnce(new RemoteError('Panne serveur'));
    await expect(loadMasterResume()).rejects.toBeInstanceOf(RemoteError);
  });
});
