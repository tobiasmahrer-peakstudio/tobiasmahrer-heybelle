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

const CONTACT_TO_EMAIL = 'info@heybelle.ch';
const CONTACT_FROM_EMAIL = 'heybelle Website <kontaktformular@heybelle.ch>';

function isValidContact(data) {
  return !!data
    && typeof data.name === 'string' && data.name.trim()
    && typeof data.email === 'string' && data.email.trim()
    && typeof data.phone === 'string' && data.phone.trim()
    && typeof data.message === 'string' && data.message.trim();
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

    if (path === '/api/contact' && request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return err('Invalid JSON');
      }
      if (!isValidContact(body)) return err('Bitte alle Pflichtfelder ausfüllen.');

      const { name, email, phone, service, message } = body;
      const text = `Neue Terminanfrage über die Website\n\nName: ${name}\nE-Mail: ${email}\nTelefon: ${phone}\nInteresse: ${service || '-'}\n\nNachricht:\n${message}`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: CONTACT_FROM_EMAIL,
          to: CONTACT_TO_EMAIL,
          reply_to: email,
          subject: `Terminanfrage: ${service || 'Allgemein'}`,
          text,
        }),
      });

      if (!resendRes.ok) {
        return err('E-Mail-Versand fehlgeschlagen.', 502);
      }
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
