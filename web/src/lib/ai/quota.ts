export type BillableEndpoint =
  | 'tailor-resume' | 'adapt-letter' | 'text-to-resume' | 'text-to-letter'
  | 'pdf-to-resume' | 'editor-chat' | 'ats-score' | 'extract-meta';

/** Coût en crédits. 0 = gratuit mais toujours soumis à authentification. */
export const ENDPOINT_COST: Record<BillableEndpoint, number> = {
  'tailor-resume': 1,
  'adapt-letter': 1,
  'text-to-resume': 1,
  'text-to-letter': 1,
  'pdf-to-resume': 1,
  'editor-chat': 1,
  'ats-score': 0,
  'extract-meta': 0,
};

export interface QuotaCheckParams {
  hasCustomKey: boolean;
  isAuthenticated: boolean;
}

export interface QuotaResult {
  allowed: boolean;
  reason?: 'custom_key' | 'server_quota';
  status?: number;
  message?: string;
}

export function evaluateQuotaRules(params: QuotaCheckParams): QuotaResult {
  if (params.hasCustomKey) return { allowed: true, reason: 'custom_key' };
  if (!params.isAuthenticated) {
    return {
      allowed: false,
      status: 401,
      message:
        'Connectez-vous avec Google, ou ajoutez votre propre clé API dans les Paramètres.',
    };
  }
  return { allowed: true, reason: 'server_quota' };
}
