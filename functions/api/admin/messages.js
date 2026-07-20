// Cloudflare Pages Function — /api/admin/messages
// GET : liste les messages reçus via le formulaire de contact (réservé à l'admin).
import { requireAdmin } from '../../_lib/auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestGet(context) {
  if (!(await requireAdmin(context))) return json({ error: 'Non autorisé.' }, 401);

  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT id, nom, prenom, email, telephone, objet, message, created_at as createdAt
     FROM messages ORDER BY created_at DESC LIMIT 500`
  ).all();
  return json(results);
}
