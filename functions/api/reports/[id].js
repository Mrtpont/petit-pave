// Cloudflare Pages Function — /api/reports/:id
// PATCH : bascule un signalement entre "ouvert" et "resolu"

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function onRequestPatch(context) {
  const { env, params, request } = context;
  const id = params.id;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Requête invalide.' }, 400);
  }

  const status = body.status === 'resolu' ? 'resolu' : 'ouvert';

  const { meta } = await env.DB.prepare(
    `UPDATE reports SET status = ? WHERE id = ?`
  ).bind(status, id).run();

  if (!meta || meta.changes === 0) {
    return json({ error: 'Signalement introuvable.' }, 404);
  }

  return json({ ok: true, status });
}
