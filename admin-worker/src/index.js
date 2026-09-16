import DEFAULT_CONTENT from './default-content.json';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

const json = (data, extra = {}, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extra },
  });
const err = (message, status = 400) => json({ error: message }, {}, status);

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '');
  return token === env.ADMIN_PASSWORD;
}

function isValidContent(data) {
  return !!data && typeof data === 'object' && data.hours && Array.isArray(data.categories);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    if (path === '/api/content' && request.method === 'GET') {
      const stored = await env.HEYBELLE_CONTENT.get('content');
      return json(stored ? JSON.parse(stored) : DEFAULT_CONTENT);
    }

    if (path === '/api/content' && request.method === 'PUT') {
      if (!isAuthorized(request, env)) return err('Unauthorized', 401);
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON');
      }
      if (!isValidContent(body)) return err('Invalid content shape');
      await env.HEYBELLE_CONTENT.put('content', JSON.stringify(body));
      return json({ ok: true });
    }

    if (path === '/api/login' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        body = {};
      }
      const ok = typeof body.password === 'string' && body.password === env.ADMIN_PASSWORD;
      return json({ ok }, {}, ok ? 200 : 401);
    }

    return new Response('Not found', { status: 404, headers: corsHeaders() });
  },
};
