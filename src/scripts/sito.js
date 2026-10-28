// Comportamenti del sito: animazioni d'ingresso, slider continuo, lightbox delle gallerie,
// menu mobile, altezza delle gallerie, widget dello shop.
const mq = window.matchMedia('(max-width: 750px)');
const ridotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- animazioni d'ingresso ----------
// Una sola comparsa, breve e morbida, per tutti gli elementi (al posto di tendine, scivolamenti
// e ingressi da lontano del sito di partenza): dissolvenza con una leggera salita.
const INGRESSO = [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }];

function avviaIngressi() {
  const attr = mq.matches ? 'data-fxm' : 'data-fxd';
  const els = [...document.querySelectorAll(`[${attr}]`)];
  if (ridotto) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      e.target.classList.remove('fx-wait');
      e.target.animate(INGRESSO, { duration: 500, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)', fill: 'backwards' });
    }
  }, { threshold: 0.01 });
  for (const el of els) { el.classList.add('fx-wait'); io.observe(el); }
}

// ---------- gallerie: altezza dei contenitori e lightbox ----------
function adattaGallerie() {
  const gal = [...document.querySelectorAll('.gal-rows, [data-cresce]')]; // gallerie e shop filtrabile: il contenitore segue il contenuto
  if (!gal.length) return;
  const voci = gal.map((g) => {
    const nodo = g.closest('.wx');
    const catena = [];
    for (let p = nodo; p && !p.classList.contains('sito'); p = p.parentElement) if (p.classList.contains('wx') || p.classList.contains('pagina')) catena.push(p);
    return { g, nodo, catena };
  });
  // letture e scritture separate in tre fasi: un solo reflow invece di uno per galleria
  for (const v of voci) v.catena.forEach((p) => p.style.removeProperty('height'));
  for (const v of voci) { v.delta = v.g.offsetHeight - v.nodo.offsetHeight; v.h = v.catena.map((p) => p.offsetHeight); }
  for (const v of voci) { if (Math.abs(v.delta) < 1) continue; v.catena.forEach((p, i) => { p.style.height = `${v.h[i] + v.delta}px`; }); }
}

function lightbox() {
  const lb = document.querySelector('.lightbox');
  if (!lb) return;
  let lista = []; let i = 0;
  const img = lb.querySelector('.lb-media img'); const t = lb.querySelector('.lb-title');
  const d = lb.querySelector('.lb-desc'); const a = lb.querySelector('.lb-link');
  const mostra = () => {
    const it = lista[i];
    img.src = it.src; img.width = it.w; img.height = it.h; img.alt = it.alt || '';
    t.textContent = it.title || ''; d.textContent = it.desc || '';
    a.hidden = !it.link; if (it.link) { a.textContent = it.link.text; a.href = it.link.href; }
  };
  const apri = (l, k) => { lista = l; i = k; mostra(); lb.classList.add('open'); document.documentElement.style.overflow = 'hidden'; lb.querySelector('.lb-close').focus(); };
  const chiudi = () => { lb.classList.remove('open'); document.documentElement.style.overflow = ''; };
  document.addEventListener('click', (e) => {
    const it = e.target.closest('.gal-it');
    if (!it) return;
    e.preventDefault();
    const g = it.closest('.gal');
    if (g.dataset.click === 'none') return;
    apri(JSON.parse(g.dataset.lb), +it.dataset.i);
  });
  lb.querySelector('.lb-close').addEventListener('click', chiudi);
  lb.querySelector('.lb-prev').addEventListener('click', () => { i = (i - 1 + lista.length) % lista.length; mostra(); });
  lb.querySelector('.lb-next').addEventListener('click', () => { i = (i + 1) % lista.length; mostra(); });
  document.addEventListener('keydown', (e) => {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') chiudi();
    if (e.key === 'ArrowLeft') lb.querySelector('.lb-prev').click();
    if (e.key === 'ArrowRight') lb.querySelector('.lb-next').click();
  });
}

// ---------- slider continuo (scorre a velocità costante, in loop) ----------
function slider() {
  for (const s of document.querySelectorAll('.slider')) {
    const track = s.querySelector('.slider-track');
    const orig = [...track.children];
    orig.forEach((f) => { const c = f.cloneNode(true); c.setAttribute('aria-hidden', 'true'); c.querySelector('img').loading = 'eager'; track.appendChild(c); });
    const speed = +s.dataset.speed || 36; // px al secondo
    let x = 0; let last = performance.now(); let salto = 0;
    const metà = () => track.scrollWidth / 2;
    const step = (t) => {
      const dt = Math.min(64, t - last); last = t;
      if (!ridotto) x -= (speed * dt) / 1000;
      if (salto) { x += salto * Math.max(0, Math.min(1, dt / 120)) ; salto *= 0.85; if (Math.abs(salto) < 1) salto = 0; }
      const w = metà(); if (w > 0) { while (x <= -w) x += w; while (x > 0) x -= w; }
      track.style.transform = `translate3d(${x}px,0,0)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const larg = () => orig[0]?.getBoundingClientRect().width || s.clientWidth;
    s.querySelector('.prev')?.addEventListener('click', () => { salto += larg(); });
    s.querySelector('.next')?.addEventListener('click', () => { salto -= larg(); });
  }
}

// ---------- menu mobile ----------
function menuMobile() {
  const b = document.querySelector('.hamb');
  if (!b) return;
  const root = document.documentElement;
  b.addEventListener('click', () => { const o = root.classList.toggle('menu-aperto'); b.setAttribute('aria-expanded', String(o)); });
  document.querySelectorAll('.menu-mobile [data-sub]').forEach((t) => t.addEventListener('click', () => { t.nextElementSibling.classList.toggle('open'); t.setAttribute('aria-expanded', String(t.nextElementSibling.classList.contains('open'))); }));
  document.querySelector('.menu-mobile .mm-bg')?.addEventListener('click', () => b.click());
}

// ---------- shop ----------
function negozio() {
  document.querySelectorAll('[data-apri-filtri]').forEach((b) => b.addEventListener('click', () => b.parentElement.querySelector('[data-filtri]').classList.add('open')));
  document.querySelectorAll('[data-chiudi-filtri]').forEach((b) => b.addEventListener('click', () => b.closest('[data-filtri]').classList.remove('open')));
  document.querySelectorAll('[data-scheda-gal]').forEach((g) => g.querySelectorAll('.miniature button').forEach((t) => t.addEventListener('click', () => {
    g.querySelectorAll('.on').forEach((x) => x.classList.remove('on'));
    t.classList.add('on'); g.querySelectorAll('.principale img')[+t.dataset.i].classList.add('on');
  })));
  document.querySelectorAll('[data-qta]').forEach((b) => b.addEventListener('click', () => {
    const inp = b.parentElement.querySelector('input'); inp.value = String(Math.max(1, (+inp.value || 1) + +b.dataset.qta));
  }));
}

// ---------- modulo: non invia finché site.form.endpoint è vuoto ----------
function moduli() {
  document.querySelectorAll('form[data-endpoint]').forEach((f) => f.addEventListener('submit', (e) => {
    if (!f.dataset.endpoint) { e.preventDefault(); console.warn('Modulo non collegato: impostare site.form.endpoint'); }
  }));
}

document.documentElement.classList.add('js');
avviaIngressi();
adattaGallerie();
lightbox();
slider();
menuMobile();
negozio();
moduli();
let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(adattaGallerie, 150); });
let bp; mq.addEventListener('change', () => { clearTimeout(bp); bp = setTimeout(() => location.reload(), 300); }); // niente reload a raffica mentre si trascina la finestra
document.fonts?.ready.then(adattaGallerie);
window.addEventListener('impagina', adattaGallerie); // lo shop cambia altezza quando si filtra
