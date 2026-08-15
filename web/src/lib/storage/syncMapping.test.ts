import { describe, it, expect } from 'vitest';
import {
  profileToRemoteSetting,
  remoteSettingToProfile,
  jobProfileToRemoteSetting,
  remoteSettingToJobProfile,
} from './syncMapping';
import type { UserProfile } from '@/lib/profile/profile';
import type { JobSearchProfile } from '@/lib/jobs/profile';

const PROFIL: UserProfile = {
  id: 'me',
  prenom: 'Hariss',
  nom: 'Hafeji',
  email: 'h@example.com',
  telephone: '0600000000',
  ville: 'Lyon',
  linkedin: 'https://linkedin.com/in/x',
  updatedAt: Date.parse('2026-08-15T10:00:00.000Z'),
};

describe('mapping des réglages', () => {
  it('le profil part avec id="profile" et son horloge client', () => {
    const row = profileToRemoteSetting(PROFIL, 'user-1');
    expect(row.id).toBe('profile');
    expect(row.user_id).toBe('user-1');
    expect(row.client_updated_at).toBe('2026-08-15T10:00:00.000Z');
    expect(row.content.prenom).toBe('Hariss');
  });

  it('le profil fait l\'aller-retour sans perdre de champ', () => {
    const back = remoteSettingToProfile(profileToRemoteSetting(PROFIL, 'user-1'));
    expect(back).toEqual(PROFIL);
  });

  it('un profil distant sans horodatage lisible ne casse pas le retour', () => {
    const back = remoteSettingToProfile({
      id: 'profile',
      content: { prenom: 'Zoe' },
      client_updated_at: '2026-08-15T11:00:00.000Z',
    });
    expect(back.prenom).toBe('Zoe');
    expect(back.nom).toBe('');
    expect(back.id).toBe('me');
    expect(back.updatedAt).toBe(Date.parse('2026-08-15T11:00:00.000Z'));
  });

  it('les critères de recherche font l\'aller-retour', () => {
    const profile = { homeAddress: 'Lyon', keywords: ['dev'] } as unknown as JobSearchProfile;
    const local = { id: 'me' as const, profile, updatedAt: Date.parse('2026-08-15T09:00:00.000Z') };
    const row = jobProfileToRemoteSetting(local, 'user-1');
    expect(row.id).toBe('jobProfile');
    expect(remoteSettingToJobProfile(row).profile).toEqual(profile);
  });
});
