// Cloudflare Pages Function — /api/admin/messages/:id
// DELETE : supprime un message reçu (réservé à l'admin).
import { requireAdmin } from '../../../_lib/auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestDelete(context) {
  if (!(await requireAdmin(context))) return json({ error: 'Non autorisé.' }, 401);

  const { env, params } = context;
  const { meta } = await env.DB.prepare(`DELETE FROM messages WHERE id = ?`).bind(params.id).run();

  if (!meta || meta.changes === 0) return json({ error: 'Message introuvable.' }, 404);
  return json({ ok: true });
}
