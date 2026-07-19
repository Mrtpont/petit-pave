// Cloudflare Pages Function — /api/reports
// GET  : liste les signalements partagés par tous les habitants
// POST : crée un nouveau signalement

const ALLOWED_CATEGORIES = [
  'voirie', 'dechets', 'mobilier', 'espaces-verts',
  'voie-velo', 'signalisation', 'autre',
];

// Grande zone large autour de Marseille (garde-fou anti-abus, pas une frontière stricte)
const BOUNDS = { latMin: 43.05, latMax: 43.45, lngMin: 5.10, lngMax: 5.65 };

const MAX_COMMENT_LEN = 140;
const MAX_PHOTO_LEN = 350000; // ~ image compressée en base64
const MAX_REPORTS_PER_HOUR_PER_IP = 8;

async function hashIp(ip) {
  const data = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT id, category, comment, photo, lat, lng, status, created_at as createdAt
     FROM reports ORDER BY created_at DESC LIMIT 500`
  ).all();
  return json(results);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  // Piège à robots : ce champ est invisible pour un humain et ne doit jamais être rempli
  if (body.website) {
    return json({ ok: true }); // on fait semblant que tout va bien, sans rien enregistrer
  }

  const { category, comment, photo, lat, lng } = body;

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return json({ error: 'Catégorie invalide.' }, 400);
  }
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return json({ error: 'Position invalide.' }, 400);
  }
  if (lat < BOUNDS.latMin || lat > BOUNDS.latMax || lng < BOUNDS.lngMin || lng > BOUNDS.lngMax) {
    return json({ error: "Cette position semble en dehors de la région de Marseille." }, 400);
  }

  const safeComment = typeof comment === 'string' ? comment.slice(0, MAX_COMMENT_LEN) : '';
  const safePhoto = typeof photo === 'string' && photo.startsWith('data:image') && photo.length <= MAX_PHOTO_LEN
    ? photo
    : null;

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIp(ip);
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { results: recent } = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM reports WHERE ip_hash = ? AND created_at > ?`
  ).bind(ipHash, oneHourAgo).all();

  if (recent[0].n >= MAX_REPORTS_PER_HOUR_PER_IP) {
    return json({ error: 'Trop de signalements envoyés récemment. Réessayez un peu plus tard.' }, 429);
  }

  const id = 'r-' + crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO reports (id, category, comment, photo, lat, lng, status, created_at, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, 'ouvert', ?, ?)`
  ).bind(id, category, safeComment, safePhoto, lat, lng, createdAt, ipHash).run();

  return json({
    id, category, comment: safeComment, photo: safePhoto, lat, lng,
    status: 'ouvert', createdAt,
  }, 201);
}
