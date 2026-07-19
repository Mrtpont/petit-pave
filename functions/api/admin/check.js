// Cloudflare Pages Function — /api/admin/check
// Permet à admin.html de savoir si une session valide existe déjà (sans renvoyer d'identité).
import { requireAdmin } from '../../_lib/auth.js';

export async function onRequestGet(context) {
  const ok = await requireAdmin(context);
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
