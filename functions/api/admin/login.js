// Cloudflare Pages Function — /api/admin/login
// Vérifie l'identifiant/mot de passe (variables d'environnement Cloudflare,
// jamais présents dans le code publié sur GitHub) et pose un cookie de session signé.
import { createSessionToken, timingSafeEqual } from '../../_lib/auth.js';

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const { user, password } = body || {};

  if (!env.ADMIN_USER || !env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return json({ error: "Accès admin non configuré côté serveur." }, 500);
  }

  const okUser = timingSafeEqual(user, env.ADMIN_USER);
  const okPass = timingSafeEqual(password, env.ADMIN_PASSWORD);

  if (!okUser || !okPass) {
    await new Promise((r) => setTimeout(r, 350)); // ralentit le brute-force
    return json({ error: 'Identifiants incorrects.' }, 401);
  }

  const token = await createSessionToken(env.ADMIN_SECRET);
  const cookie = `admin_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 8}`;

  return json({ ok: true }, 200, { 'Set-Cookie': cookie });
}
