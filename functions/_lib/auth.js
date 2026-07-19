// Fonctions partagées d'authentification admin.
// Le dossier est préfixé par "_" : Cloudflare Pages ne le traite jamais comme
// une route publique, seulement comme un module importable par les autres fonctions.

const encoder = new TextEncoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function b64url(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Jeton de session signé (HMAC) : ne contient qu'une date d'expiration,
// aucune donnée personnelle. Rien qui permette de relier la session à qui que ce soit.
export async function createSessionToken(secret, ttlSeconds = 60 * 60 * 8) {
  const payload = JSON.stringify({ exp: Date.now() + ttlSeconds * 1000 });
  const payloadB64 = b64url(encoder.encode(payload));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  return `${payloadB64}.${b64url(sig)}`;
}

export async function verifySessionToken(token, secret) {
  if (!token || !secret || !token.includes('.')) return false;
  const [payloadB64, sigB64] = token.split('.');
  try {
    const key = await hmacKey(secret);
    const valid = await crypto.subtle.verify('HMAC', key, b64urlDecode(sigB64), encoder.encode(payloadB64));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function requireAdmin(context) {
  const { request, env } = context;
  const token = getCookie(request, 'admin_session');
  return verifySessionToken(token, env.ADMIN_SECRET);
}

export function timingSafeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
