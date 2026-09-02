/**
 * Verifies Firebase ID tokens inside the Worker.
 *
 * The app sends `Authorization: Bearer <firebase id token>`. Without this check
 * anyone who found the Worker URL could spend the OpenRouter budget, so this
 * runs before any model call.
 *
 * Firebase ID tokens are RS256 JWTs signed by Google. We fetch Google's public
 * keys (JWK form), verify the signature with Web Crypto, then check the claims.
 */

const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

interface Jwk {
  kid: string;
  n: string;
  e: string;
  alg?: string;
  kty?: string;
}

export class AuthError extends Error {}

// Google rotates these keys roughly daily; cache within the isolate so we
// aren't fetching them on every request.
let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null;
const KEY_TTL_MS = 60 * 60 * 1000;

async function getGoogleKeys(): Promise<Jwk[]> {
  if (cachedKeys && Date.now() - cachedKeys.fetchedAt < KEY_TTL_MS) {
    return cachedKeys.keys;
  }
  const res = await fetch(JWK_URL);
  if (!res.ok) throw new AuthError('Could not fetch Google signing keys.');
  const body = (await res.json()) as { keys: Jwk[] };
  cachedKeys = { keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
}

/**
 * Returns the verified Firebase uid, or throws AuthError.
 * `projectId` must be the Firebase project id the app signs in against.
 */
export async function verifyFirebaseToken(token: string, projectId: string): Promise<string> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('Malformed token.');

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJson(headerB64);
    payload = decodeJson(payloadB64);
  } catch {
    throw new AuthError('Malformed token.');
  }

  if (header.alg !== 'RS256') throw new AuthError('Unexpected token algorithm.');

  const keys = await getGoogleKeys();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new AuthError('Unknown signing key.');

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    base64UrlToBytes(signatureB64),
    new TextEncoder().encode(`${headerB64}.${payloadB64}`),
  );
  if (!valid) throw new AuthError('Invalid token signature.');

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < now) throw new AuthError('Token expired.');
  if (typeof payload.iat !== 'number' || payload.iat > now + 300) throw new AuthError('Token issued in the future.');
  if (payload.aud !== projectId) throw new AuthError('Token audience mismatch.');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError('Token issuer mismatch.');
  }
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new AuthError('Token has no subject.');
  }

  return payload.sub;
}
