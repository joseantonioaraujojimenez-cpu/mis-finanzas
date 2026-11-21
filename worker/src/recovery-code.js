// Internal recovery-code helpers. Do not expose through public routes until audited.
const DOMAIN = 'mis-finanzas:recovery:v1:';
const encoder = new TextEncoder();
const toHex = bytes => Array.from(bytes, b => b.toString(16).padStart(2,'0')).join('');

export function generateRecoveryCode() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  // 256 bits of cryptographically secure entropy; group for manual transcription.
  const hex = toHex(bytes);
  return hex.match(/.{1,8}/g).join('-');
}

export async function recoveryDigest(code) {
  if (typeof code !== 'string' || !/^[a-fA-F0-9]{8}(?:-[a-fA-F0-9]{8}){7}$/.test(code))
    throw new TypeError('Invalid recovery code format');
  const canonical = code.replaceAll('-','').toLowerCase();
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(DOMAIN + canonical));
  return toHex(new Uint8Array(digest));
}
