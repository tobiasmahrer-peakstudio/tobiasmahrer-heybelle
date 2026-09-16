// ---------- Mobile Nav ----------
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

navToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('mobile-open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

mainNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('mobile-open');
    navToggle.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ---------- Sticky header shadow ----------
const header = document.getElementById('site-header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 12);
document.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ---------- Service Tabs ----------
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabButtons.forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-selected', String(b === btn));
    });

    tabPanels.forEach(panel => {
      const isTarget = panel.id === target;
      panel.classList.toggle('active', isTarget);
      panel.hidden = !isTarget;
    });
  });
});

// ---------- Scroll Reveal ----------
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

revealEls.forEach(el => revealObserver.observe(el));

// ---------- Contact form ----------
const contactForm = document.getElementById('contact-form');
const formNote = document.getElementById('form-note');

contactForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = contactForm.name.value.trim();
  const email = contactForm.email.value.trim();
  const service = contactForm.service.value;
  const message = contactForm.message.value.trim();
  const phone = contactForm.phone.value.trim();

  const submitBtn = contactForm.querySelector('button[type=submit]');
  submitBtn.disabled = true;
  formNote.style.color = '';
  formNote.textContent = 'Wird gesendet …';

  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, service, message }),
    });
    if (!res.ok) throw new Error('Versand fehlgeschlagen');

    formNote.textContent = 'Danke für deine Anfrage! Wir melden uns so schnell wie möglich bei dir.';
    contactForm.reset();
  } catch {
    formNote.style.color = '#c0392b';
    formNote.textContent = 'Da ist etwas schiefgelaufen. Schreib uns gerne direkt per WhatsApp oder Telefon.';
  }

  submitBtn.disabled = false;
});

// ---------- Footer year ----------
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Content-driven rendering (services, prices, hours) ----------
let siteContent = { hours: {}, categories: [] };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function renderPriceCard(t) {
  const hasSale = t.salePrice != null && t.salePrice !== '' && Number(t.salePrice) < Number(t.price);
  const featured = t.topSeller || t.tag || hasSale;

  const badges = [];
  if (t.topSeller) badges.push({ label: 'Meistgebucht', cls: 'badge-topseller' });
  if (hasSale) badges.push({ label: 'Aktion', cls: 'badge-sale' });
  if (t.tag && !t.topSeller) badges.push({ label: t.tag, cls: '' });

  const priceHtml = hasSale
    ? `<span class="price-old">${escapeHtml(t.price)} CHF</span><span class="price price-sale">${escapeHtml(t.salePrice)} CHF</span>`
    : `<span class="price">${escapeHtml(t.price)} CHF</span>`;

  const badgesHtml = badges.length
    ? `<div class="badges">${badges.map(b => `<span class="badge ${b.cls}">${escapeHtml(b.label)}</span>`).join('')}</div>`
    : '';

  return `
    <div class="price-card${featured ? ' featured' : ''}${hasSale ? ' on-sale' : ''}">
      ${badgesHtml}
      <h3>${escapeHtml(t.name)}</h3>
      <p>${escapeHtml(t.desc)}</p>
      <div class="price-row"><span>${escapeHtml(t.duration)}</span>${priceHtml}</div>
    </div>
  `;
}

function renderTreatments() {
  document.querySelectorAll('[data-category]').forEach(grid => {
    const cat = siteContent.categories.find(c => c.id === grid.dataset.category);
    if (!cat) return;
    grid.innerHTML = cat.treatments.map(renderPriceCard).join('');
  });

  document.querySelectorAll('[data-zones]').forEach(grid => {
    const cat = siteContent.categories.find(c => c.id === grid.dataset.zones);
    if (!cat || !cat.zones) return;
    grid.innerHTML = cat.zones.map(z => `
      <div class="zone-row"><span>${escapeHtml(z.name)}</span><span>${escapeHtml(z.price)} CHF</span></div>
    `).join('');
  });
}

// ---------- Live opening status ----------
const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function renderHoursTable() {
  const body = document.getElementById('hours-table-body');
  if (!body) return;
  const order = [1, 2, 3, 4, 5, 6, 0];
  body.innerHTML = order.map(day => {
    const h = siteContent.hours[day];
    const label = h.closed ? 'Geschlossen' : `${h.open}–${h.close}`;
    return `<tr data-day="${day}"><th>${DAY_NAMES[day]}</th><td>${label}</td></tr>`;
  }).join('');
}

function getZurichNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const map = {};
  parts.forEach(p => { map[p.type] = p.value; });

  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    day: weekdayMap[map.weekday],
    minutes: parseInt(map.hour, 10) * 60 + parseInt(map.minute, 10),
  };
}

function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTimeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

function findNextOpening(fromDay, fromMinutes) {
  for (let offset = 0; offset <= 7; offset++) {
    const day = (fromDay + offset) % 7;
    const hours = siteContent.hours[day];
    if (!hours || hours.closed) continue;
    const openMin = parseTimeToMinutes(hours.open);
    if (offset === 0 && fromMinutes >= openMin) continue;
    return { day, time: openMin };
  }
  return null;
}

function updateOpenStatus() {
  const { day, minutes } = getZurichNow();
  const todayHours = siteContent.hours[day];
  const badges = document.querySelectorAll('[data-status-badge]');

  let isOpen = false;
  let label = '';

  const openMin = todayHours && !todayHours.closed ? parseTimeToMinutes(todayHours.open) : null;
  const closeMin = todayHours && !todayHours.closed ? parseTimeToMinutes(todayHours.close) : null;

  if (openMin != null && minutes >= openMin && minutes < closeMin) {
    isOpen = true;
    label = `Jetzt geöffnet · bis ${formatTime(closeMin)} Uhr`;
  } else {
    const next = findNextOpening(day, minutes);
    if (next) {
      const dayLabel = next.day === day ? 'heute' : next.day === (day + 1) % 7 ? 'morgen' : DAY_NAMES[next.day];
      label = `Jetzt geschlossen · öffnet ${dayLabel} ${formatTime(next.time)} Uhr`;
    } else {
      label = 'Jetzt geschlossen';
    }
  }

  badges.forEach(badge => {
    badge.classList.toggle('is-open', isOpen);
    badge.classList.toggle('is-closed', !isOpen);
    const textEl = badge.querySelector('[data-status-text]');
    if (textEl) textEl.textContent = label;
  });

  document.querySelectorAll('.hours-table tr[data-day]').forEach(row => {
    row.classList.toggle('today', parseInt(row.dataset.day, 10) === day);
  });
}

(async () => {
  siteContent = await loadContent();
  renderTreatments();
  renderHoursTable();
  updateOpenStatus();
  setInterval(updateOpenStatus, 60000);
})();

// ---------- Reviews carousel ----------
(() => {
  const track = document.getElementById('reviews-track');
  if (!track) return;

  const cards = [...track.children];
  const viewport = track.parentElement;
  const dotsWrap = document.getElementById('carousel-dots');
  const prevBtn = document.querySelector('.carousel-prev');
  const nextBtn = document.querySelector('.carousel-next');
  const carousel = document.querySelector('.reviews-carousel');

  let index = 0;
  let timer = null;

  function cardsPerView() {
    const w = window.innerWidth;
    if (w <= 640) return 1;
    if (w <= 960) return 2;
    return 3;
  }

  function totalPages() {
    return Math.ceil(cards.length / cardsPerView());
  }

  function renderDots() {
    dotsWrap.innerHTML = '';
    const pages = totalPages();
    for (let i = 0; i < pages; i++) {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'carousel-dot';
      dot.setAttribute('aria-label', `Zu Bewertungen ${i + 1}`);
      dot.addEventListener('click', () => { goTo(i); restartTimer(); });
      dotsWrap.appendChild(dot);
    }
  }

  function updateDots() {
    [...dotsWrap.children].forEach((d, i) => d.classList.toggle('active', i === index));
  }

  function goTo(i) {
    const pages = totalPages();
    index = (i + pages) % pages;
    const perView = cardsPerView();
    const cardWidth = cards[0].getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(track).gap) || 0;
    const step = perView * (cardWidth + gap);
    track.style.transform = `translateX(-${index * step}px)`;
    updateDots();
  }

  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(next, 5000);
  }

  prevBtn.addEventListener('click', () => { prev(); restartTimer(); });
  nextBtn.addEventListener('click', () => { next(); restartTimer(); });
  carousel.addEventListener('mouseenter', () => { if (timer) clearInterval(timer); });
  carousel.addEventListener('mouseleave', restartTimer);

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => { renderDots(); goTo(0); }, 150);
  });

  renderDots();
  goTo(0);
  restartTimer();
})();
