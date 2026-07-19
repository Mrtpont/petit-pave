// Cloudflare Pages Function — /api/admin/reports/:id
// Réservé à l'admin (cookie de session vérifié) : modifier ou supprimer un signalement.
import { requireAdmin } from '../../../_lib/auth.js';

const ALLOWED_CATEGORIES = [
  'voirie', 'dechets', 'mobilier', 'espaces-verts',
  'voie-velo', 'signalisation', 'autre',
];
const MAX_COMMENT_LEN = 140;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPatch(context) {
  if (!(await requireAdmin(context))) return json({ error: 'Non autorisé.' }, 401);

  const { request, env, params } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const updates = [];
  const values = [];

  if (typeof body.comment === 'string') {
    updates.push('comment = ?');
    values.push(body.comment.slice(0, MAX_COMMENT_LEN));
  }
  if (typeof body.category === 'string' && ALLOWED_CATEGORIES.includes(body.category)) {
    updates.push('category = ?');
    values.push(body.category);
  }
  if (body.status === 'ouvert' || body.status === 'resolu') {
    updates.push('status = ?');
    values.push(body.status);
  }

  if (updates.length === 0) return json({ error: 'Rien à modifier.' }, 400);

  values.push(params.id);
  const { meta } = await env.DB.prepare(
    `UPDATE reports SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if (!meta || meta.changes === 0) return json({ error: 'Signalement introuvable.' }, 404);
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  if (!(await requireAdmin(context))) return json({ error: 'Non autorisé.' }, 401);

  const { env, params } = context;
  const { meta } = await env.DB.prepare(`DELETE FROM reports WHERE id = ?`).bind(params.id).run();

  if (!meta || meta.changes === 0) return json({ error: 'Signalement introuvable.' }, 404);
  return json({ ok: true });
}
