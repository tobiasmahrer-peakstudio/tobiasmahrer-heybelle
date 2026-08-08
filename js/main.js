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

contactForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const name = contactForm.name.value.trim();
  const email = contactForm.email.value.trim();
  const service = contactForm.service.value;
  const message = contactForm.message.value.trim();
  const phone = contactForm.phone.value.trim();

  const subject = encodeURIComponent(`Terminanfrage: ${service}`);
  const body = encodeURIComponent(
    `Name: ${name}\nE-Mail: ${email}\nTelefon: ${phone || '-'}\nInteresse: ${service}\n\nNachricht:\n${message}`
  );

  window.location.href = `mailto:info@heybelle.ch?subject=${subject}&body=${body}`;

  formNote.textContent = 'Dein E-Mail-Programm öffnet sich gleich – vielen Dank für deine Anfrage!';
});

// ---------- Footer year ----------
document.getElementById('year').textContent = new Date().getFullYear();

// ---------- Live opening status ----------
const OPENING_HOURS = {
  0: null,       // Sonntag – geschlossen
  1: [9, 20],
  2: [9, 20],
  3: [9, 20],
  4: [9, 20],
  5: [9, 20],
  6: [9, 16],
};
const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

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

function findNextOpening(fromDay, fromMinutes) {
  for (let offset = 0; offset <= 7; offset++) {
    const day = (fromDay + offset) % 7;
    const hours = OPENING_HOURS[day];
    if (!hours) continue;
    const openMin = hours[0] * 60;
    if (offset === 0 && fromMinutes >= openMin) continue;
    return { day, time: openMin };
  }
  return null;
}

function updateOpenStatus() {
  const { day, minutes } = getZurichNow();
  const todayHours = OPENING_HOURS[day];
  const badges = document.querySelectorAll('[data-status-badge]');

  let isOpen = false;
  let label = '';

  if (todayHours && minutes >= todayHours[0] * 60 && minutes < todayHours[1] * 60) {
    isOpen = true;
    label = `Jetzt geöffnet · bis ${formatTime(todayHours[1] * 60)} Uhr`;
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

updateOpenStatus();
setInterval(updateOpenStatus, 60000);

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
