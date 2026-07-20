// Cloudflare Pages Function — /api/contact
// POST : reçoit un message du formulaire "Nous contacter" (public, protégé anti-spam).
// Les messages sont ensuite consultables uniquement par l'admin via /api/admin/messages.

const MAX_LEN = { nom: 80, prenom: 80, email: 180, telephone: 20, objet: 120, message: 1000 };
const MAX_MESSAGES_PER_HOUR_PER_IP = 5;

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

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  // Piège à robots : champ invisible, un humain ne le remplit jamais.
  if (body.website) {
    return json({ ok: true }); // on fait semblant que tout va bien, sans rien enregistrer
  }

  const nom = typeof body.nom === 'string' ? body.nom.trim().slice(0, MAX_LEN.nom) : '';
  const email = typeof body.email === 'string' ? body.email.trim().slice(0, MAX_LEN.email) : '';

  if (!nom) return json({ error: 'Le nom est obligatoire.' }, 400);
  if (!isValidEmail(email)) return json({ error: 'Adresse e-mail invalide.' }, 400);

  const prenom = typeof body.prenom === 'string' ? body.prenom.trim().slice(0, MAX_LEN.prenom) : '';
  const telephone = typeof body.telephone === 'string' ? body.telephone.trim().slice(0, MAX_LEN.telephone) : '';
  const objet = typeof body.objet === 'string' ? body.objet.trim().slice(0, MAX_LEN.objet) : '';
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, MAX_LEN.message) : '';

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIp(ip);
  const oneHourAgo = new Date(Date.now() - 3600_000).toISOString();

  const { results: recent } = await env.DB.prepare(
    `SELECT COUNT(*) as n FROM messages WHERE ip_hash = ? AND created_at > ?`
  ).bind(ipHash, oneHourAgo).all();

  if (recent[0].n >= MAX_MESSAGES_PER_HOUR_PER_IP) {
    return json({ error: 'Trop de messages envoyés récemment. Réessayez un peu plus tard.' }, 429);
  }

  const id = 'm-' + crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO messages (id, nom, prenom, email, telephone, objet, message, created_at, ip_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, nom, prenom, email, telephone, objet, message, createdAt, ipHash).run();

  return json({ ok: true, id }, 201);
}
