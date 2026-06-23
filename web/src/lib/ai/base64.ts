/**
 * Strip / restore des images base64 (`src="data:image/…"`) avant/après un appel IA.
 * Port **fidèle** de `app.js` (l.1626-1644 pour le flux tailor, l.1816-1830 pour le chat).
 *
 * ⚠️ Logique métier critique (CLAUDE.md) : ne jamais altérer. Les images base64 ne doivent
 * JAMAIS être envoyées à l'IA (explosion des tokens) ; on les remplace par des placeholders
 * puis on les restaure à la réception. Comportement testé round-trip.
 */

/** Regex d'une `src` pointant une image base64 (≥ 20 caractères de données). */
const SRC_DATA_IMAGE = /src="data:image\/[^"]{20,}"/g;

// ---- flux tailor : placeholder indexé `[IMAGE_BASE64_N]` ---------------------

/** Map placeholder → match complet (`src="data:image/…"`). */
export type Base64Map = Record<string, string>;

/**
 * Remplace chaque `src="data:image/…"` par `src="[IMAGE_BASE64_N]"` et renvoie le HTML
 * nettoyé + la map de restauration. Port de `_stripBase64ForTailor`.
 */
export function stripBase64ForTailor(html: string): { html: string; map: Base64Map } {
  const map: Base64Map = {};
  let i = 0;
  const out = html.replace(SRC_DATA_IMAGE, (match) => {
    const placeholder = `[IMAGE_BASE64_${i}]`;
    map[placeholder] = match;
    i++;
    return `src="${placeholder}"`;
  });
  return { html: out, map };
}

/** Restaure les images dans le HTML adapté à partir de la map. Port de `_restoreBase64InTailor`. */
export function restoreBase64InTailor(html: string, map: Base64Map): string {
  if (!html) return html;
  let out = html;
  for (const placeholder in map) {
    out = out.split(`src="${placeholder}"`).join(map[placeholder]);
  }
  return out;
}

// ---- flux chat : placeholder unique `[IMAGE_BASE64]` -------------------------

/**
 * Remplace toutes les images base64 par `src="[IMAGE_BASE64]"` et mémorise la **première**
 * donnée base64 (sans le `src="`). Port de `_stripBase64ForChat`.
 */
export function stripBase64ForChat(html: string): { html: string; data: string | null } {
  const match = html.match(/src="(data:image\/[^"]{20,})"/);
  const data = match ? match[1] : null;
  const out = html.replace(SRC_DATA_IMAGE, 'src="[IMAGE_BASE64]"');
  return { html: out, data };
}

/**
 * Restaure la photo dans les propositions du chat (1re occurrence du placeholder seulement,
 * fidèle à l'original). Port de `_restoreBase64InProposals`.
 */
export function restoreBase64InProposals<T extends { html?: string }>(
  proposals: T[],
  data: string | null,
): T[] {
  if (!data || !proposals) return proposals;
  return proposals.map((p) => ({
    ...p,
    html: p.html ? p.html.replace('src="[IMAGE_BASE64]"', `src="${data}"`) : p.html,
  }));
}
