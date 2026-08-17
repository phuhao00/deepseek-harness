/**
 * Mask a credential so configuration UIs can show which key is loaded
 * without echoing the secret.
 */

/**
 * Recognizable mask of one secret: first four and last four characters.
 * Short values collapse to bullets so a tiny secret is not reconstructed.
 * @param value - resolved credential; callers must not log it.
 * @returns a hint that does not contain the full secret.
 */
export function credentialHint(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 8) return '••••'
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`
}
