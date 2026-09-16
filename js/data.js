// ---------- Shared content model (services, prices, opening hours) ----------
// Used by both the public site (main.js) and the admin backoffice (admin.js).
//
// Source of truth: the heybelle-admin Cloudflare Worker (Workers KV storage).
// The public site reads it on every load; the admin editor reads it, lets you
// change it, and writes straight back to it — no separate "publish" step and
// nothing tied to any one browser or device.

const API_BASE = 'https://heybelle-admin.tobias-mahrer.workers.dev';
const ADMIN_SESSION_KEY = 'heybelle_admin_pw';

async function fetchPublishedContent() {
  try {
    const res = await fetch(`${API_BASE}/api/content`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.categories || !data.hours) throw new Error('invalid shape');
    return data;
  } catch (err) {
    console.error('Konnte Inhalte nicht laden:', err);
    return { hours: {}, categories: [] };
  }
}

// Public site always shows the live, shared content.
async function loadContent() {
  return fetchPublishedContent();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- Admin auth + save (server-verified, shared across every device) ----------
function getAdminPassword() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
}

function setAdminPassword(password) {
  if (password) sessionStorage.setItem(ADMIN_SESSION_KEY, password);
  else sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function authHeaders() {
  return { Authorization: `Bearer ${getAdminPassword()}` };
}

async function checkAdminLogin(password) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

async function saveContentRemote(content) {
  const res = await fetch(`${API_BASE}/api/content`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(content),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Nicht angemeldet oder Sitzung abgelaufen.');
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Speichern fehlgeschlagen (HTTP ${res.status}).`);
  }
  return res.json();
}
