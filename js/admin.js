// ---------- Backoffice: password gate + content editor ----------
// The password is verified server-side by the heybelle-admin Worker (see
// js/data.js). "Speichern" writes straight to the shared Worker/KV store —
// live for every visitor within moments, from any device, as soon as
// someone who knows the password saves.

const loginScreen = document.getElementById('admin-login');
const dashboard = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

let content = null;
let dashboardInitialized = false;

function showDashboard() {
  loginScreen.hidden = true;
  dashboard.hidden = false;
  initDashboard();
}

function backToLogin() {
  setAdminPassword('');
  dashboard.hidden = true;
  loginScreen.hidden = false;
  document.getElementById('login-password').value = '';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const entered = document.getElementById('login-password').value;
  const submitBtn = loginForm.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  const ok = await checkAdminLogin(entered).catch(() => false);
  submitBtn.disabled = false;

  if (ok) {
    setAdminPassword(entered);
    loginError.hidden = true;
    showDashboard();
  } else {
    loginError.hidden = false;
  }
});

document.getElementById('btn-logout').addEventListener('click', backToLogin);

// ---------- Dashboard ----------
async function initDashboard() {
  content = await loadContent();
  renderAll();

  if (dashboardInitialized) return;
  dashboardInitialized = true;
  wireStaticControls();
}

function showNote(el, text, isError) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#c0392b' : '';
  el.classList.add('is-visible');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('is-visible'), isError ? 5000 : 1800);
}

async function saveNow() {
  const btn = document.getElementById('btn-save');
  const note = document.getElementById('save-note');
  btn.disabled = true;
  btn.textContent = 'Speichere …';
  try {
    await saveContentRemote(content);
    showNote(note, 'Gespeichert ✓ (live für alle)', false);
  } catch (err) {
    if (err.message.includes('Nicht angemeldet')) {
      showNote(note, 'Sitzung abgelaufen — bitte neu anmelden.', true);
      setTimeout(backToLogin, 1500);
    } else {
      showNote(note, `Fehler: ${err.message}`, true);
    }
  }
  btn.disabled = false;
  btn.textContent = 'Speichern ✓';
}

function escapeAttr(str) {
  return String(str == null ? '' : str).replace(/"/g, '&quot;');
}

// ---------- Opening hours ----------
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS = { 1: 'Montag', 2: 'Dienstag', 3: 'Mittwoch', 4: 'Donnerstag', 5: 'Freitag', 6: 'Samstag', 0: 'Sonntag' };

function renderHoursEditor() {
  const wrap = document.getElementById('hours-editor');
  wrap.innerHTML = DAY_ORDER.map(day => {
    const h = content.hours[day];
    return `
      <div class="hours-editor-row" data-day="${day}">
        <span class="hours-editor-day">${DAY_LABELS[day]}</span>
        <label class="hours-editor-closed">
          <input type="checkbox" data-hours-field="closed" ${h.closed ? 'checked' : ''}>
          Geschlossen
        </label>
        <input type="time" data-hours-field="open" value="${h.open}" ${h.closed ? 'disabled' : ''}>
        <span class="hours-editor-sep">–</span>
        <input type="time" data-hours-field="close" value="${h.close}" ${h.closed ? 'disabled' : ''}>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('.hours-editor-row').forEach(row => {
    const day = row.dataset.day;
    row.querySelectorAll('[data-hours-field]').forEach(input => {
      input.addEventListener('change', () => {
        const field = input.dataset.hoursField;
        if (field === 'closed') {
          content.hours[day].closed = input.checked;
          row.querySelectorAll('input[type=time]').forEach(t => t.disabled = input.checked);
        } else {
          content.hours[day][field] = input.value;
        }
      });
    });
  });
}

// ---------- Treatments ----------
function findCategory(catId) {
  return content.categories.find(c => c.id === catId);
}

function renderTreatmentsEditor(catId) {
  const wrap = document.querySelector(`[data-treatments="${catId}"]`);
  if (!wrap) return;
  const cat = findCategory(catId);

  wrap.innerHTML = cat.treatments.map(t => `
    <div class="treatment-editor-card" data-treatment-id="${t.id}">
      <div class="admin-form-row">
        <label>Name</label>
        <input type="text" data-field="name" value="${escapeAttr(t.name)}">
      </div>
      <div class="admin-form-row">
        <label>Beschreibung</label>
        <textarea rows="2" data-field="desc">${escapeAttr(t.desc)}</textarea>
      </div>
      <div class="admin-form-grid">
        <div class="admin-form-row">
          <label>Dauer</label>
          <input type="text" data-field="duration" value="${escapeAttr(t.duration)}">
        </div>
        <div class="admin-form-row">
          <label>Preis (CHF)</label>
          <input type="number" min="0" step="1" data-field="price" value="${escapeAttr(t.price)}">
        </div>
        <div class="admin-form-row">
          <label>Aktionspreis (CHF)</label>
          <input type="number" min="0" step="1" data-field="salePrice" placeholder="—" value="${t.salePrice != null ? escapeAttr(t.salePrice) : ''}">
        </div>
      </div>
      <div class="treatment-editor-footer">
        <label class="admin-checkbox">
          <input type="checkbox" data-field="topSeller" ${t.topSeller ? 'checked' : ''}>
          Meistgebucht
        </label>
        <button type="button" class="admin-delete-btn" data-delete-treatment="${t.id}" aria-label="Behandlung löschen">Löschen</button>
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('.treatment-editor-card').forEach(card => {
    const id = card.dataset.treatmentId;
    const treatment = cat.treatments.find(t => t.id === id);

    card.querySelectorAll('[data-field]').forEach(input => {
      const evt = input.tagName === 'SELECT' || input.type === 'checkbox' ? 'change' : 'input';
      input.addEventListener(evt, () => {
        const field = input.dataset.field;
        if (field === 'topSeller') {
          treatment.topSeller = input.checked;
        } else if (field === 'price') {
          treatment.price = input.value === '' ? 0 : Number(input.value);
        } else if (field === 'salePrice') {
          treatment.salePrice = input.value === '' ? null : Number(input.value);
        } else {
          treatment[field] = input.value;
        }
      });
    });

    card.querySelector('[data-delete-treatment]').addEventListener('click', () => {
      if (!confirm(`"${treatment.name}" wirklich löschen?`)) return;
      cat.treatments = cat.treatments.filter(t => t.id !== id);
      renderTreatmentsEditor(catId);
    });
  });
}

function addTreatment(catId) {
  const cat = findCategory(catId);
  cat.treatments.push({
    id: makeId('t'),
    name: 'Neue Behandlung',
    desc: '',
    duration: '',
    price: 0,
    salePrice: null,
    topSeller: false,
  });
  renderTreatmentsEditor(catId);
}

// ---------- Laser zones ----------
function renderZonesEditor() {
  const wrap = document.querySelector('[data-zones-editor="laser"]');
  if (!wrap) return;
  const cat = findCategory('laser');

  wrap.innerHTML = cat.zones.map(z => `
    <div class="zone-editor-row" data-zone-id="${z.id}">
      <input type="text" data-zfield="name" value="${escapeAttr(z.name)}" placeholder="Zone">
      <input type="number" min="0" step="1" data-zfield="price" value="${escapeAttr(z.price)}" placeholder="CHF">
      <button type="button" class="admin-delete-btn" data-delete-zone="${z.id}" aria-label="Zone löschen">✕</button>
    </div>
  `).join('');

  wrap.querySelectorAll('.zone-editor-row').forEach(row => {
    const id = row.dataset.zoneId;
    const zone = cat.zones.find(z => z.id === id);

    row.querySelectorAll('[data-zfield]').forEach(input => {
      input.addEventListener('input', () => {
        const field = input.dataset.zfield;
        zone[field] = field === 'price' ? Number(input.value || 0) : input.value;
      });
    });

    row.querySelector('[data-delete-zone]').addEventListener('click', () => {
      if (!confirm(`Zone "${zone.name}" wirklich löschen?`)) return;
      cat.zones = cat.zones.filter(z => z.id !== id);
      renderZonesEditor();
    });
  });
}

function addZone() {
  const cat = findCategory('laser');
  cat.zones.push({ id: makeId('z'), name: 'Neue Zone', price: 0 });
  renderZonesEditor();
}

// ---------- Render everything ----------
function renderAll() {
  renderHoursEditor();
  ['gesicht', 'brows', 'headspa', 'laser', 'dental'].forEach(renderTreatmentsEditor);
  renderZonesEditor();
}

// ---------- Static controls (tabs, save/export/import/reset) ----------
function wireStaticControls() {
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      const target = btn.dataset.adminTab;
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.toggle('active', p.dataset.adminPanel === target));
    });
  });

  document.querySelectorAll('[data-add-treatment]').forEach(btn => {
    btn.addEventListener('click', () => addTreatment(btn.dataset.addTreatment));
  });
  document.querySelectorAll('[data-add-zone]').forEach(btn => {
    btn.addEventListener('click', addZone);
  });

  document.getElementById('btn-save').addEventListener('click', saveNow);

  document.getElementById('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'heybelle-content.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.categories || !parsed.hours) throw new Error('invalid');
        content = parsed;
        renderAll();
        showNote(document.getElementById('save-note'), 'Importiert — nicht vergessen: "Speichern" klicken.', false);
      } catch {
        alert('Diese Datei sieht nicht wie eine gültige heybelle-Inhalte-Datei aus.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (!confirm('Wirklich alle unveröffentlichten Änderungen verwerfen und den zuletzt gespeicherten Stand neu laden?')) return;
    content = await loadContent();
    renderAll();
    showNote(document.getElementById('save-note'), 'Zurückgesetzt', false);
  });
}

// ---------- Auto-login if a password is already in this tab's session ----------
if (getAdminPassword()) {
  showDashboard();
}
