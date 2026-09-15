// ---------- Shared content model (services, prices, opening hours) ----------
// Used by both the public site (main.js) and the admin backoffice (admin.js).
//
// Source of truth: data/content.json, committed in the repo and served as a
// static file. Cloudflare Pages redeploys automatically whenever that file
// changes on the connected GitHub branch, so publishing = committing.
//
// The admin editor keeps an in-progress DRAFT in this browser's localStorage
// (so a refresh doesn't lose unsaved edits) and offers a "Veröffentlichen"
// action that commits the draft straight to data/content.json on GitHub via
// the REST API, using a personal access token the admin pastes in once —
// that token lives only in this browser's localStorage, never in the code.

const CONTENT_STORAGE_KEY = 'heybelle_content_draft_v1';
const CONTENT_URL = 'data/content.json';

const GITHUB_REPO_OWNER = 'tobiasmahrer-peakstudio';
const GITHUB_REPO_NAME = 'tobiasmahrer-heybelle';
const GITHUB_BRANCH = 'main';
const GITHUB_FILE_PATH = 'data/content.json';
const GH_TOKEN_KEY = 'heybelle_gh_token';

async function fetchPublishedContent() {
  try {
    const res = await fetch(CONTENT_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !data.categories || !data.hours) throw new Error('invalid shape');
    return data;
  } catch (err) {
    console.error('Konnte data/content.json nicht laden:', err);
    return { hours: {}, categories: [] };
  }
}

// Public site: always shows the published file, ignoring any admin draft.
async function loadContent() {
  return fetchPublishedContent();
}

// Admin editor: prefer an unsaved local draft, else start from the published file.
async function loadContentForAdmin() {
  try {
    const raw = localStorage.getItem(CONTENT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.categories && parsed.hours) return parsed;
    }
  } catch {
    // fall through to published content
  }
  return fetchPublishedContent();
}

function saveContent(content) {
  localStorage.setItem(CONTENT_STORAGE_KEY, JSON.stringify(content));
}

function resetContent() {
  localStorage.removeItem(CONTENT_STORAGE_KEY);
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---------- GitHub publish ----------
function getGithubToken() {
  return localStorage.getItem(GH_TOKEN_KEY) || '';
}

function setGithubToken(token) {
  if (token) localStorage.setItem(GH_TOKEN_KEY, token);
  else localStorage.removeItem(GH_TOKEN_KEY);
}

function base64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function publishContentToGithub(content) {
  const token = getGithubToken();
  if (!token) {
    throw new Error('Kein GitHub-Zugangstoken hinterlegt. Trage es unter "Einstellungen" ein.');
  }

  const apiUrl = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${GITHUB_FILE_PATH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  // 1. Get the current file's SHA (required by GitHub to update a file)
  const getRes = await fetch(`${apiUrl}?ref=${GITHUB_BRANCH}`, { headers });
  if (!getRes.ok) {
    if (getRes.status === 401 || getRes.status === 403) {
      throw new Error('GitHub hat das Token abgelehnt (ungültig oder keine Schreibrechte).');
    }
    throw new Error(`Konnte aktuelle Datei nicht lesen (HTTP ${getRes.status}).`);
  }
  const current = await getRes.json();

  // 2. Commit the updated content on top of that SHA
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Backoffice: Inhalte aktualisiert',
      content: base64EncodeUtf8(JSON.stringify(content, null, 2)),
      sha: current.sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!putRes.ok) {
    const body = await putRes.json().catch(() => ({}));
    throw new Error(body.message || `Veröffentlichen fehlgeschlagen (HTTP ${putRes.status}).`);
  }

  return putRes.json();
}
