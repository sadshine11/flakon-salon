/* Флакон: сайт салона. Данные берутся из FlakonStore (store.js): по умолчанию из DIKIDI,
   поверх них правки из админки. Свободное время считается по графику мастеров и записям. */
(async () => {
  'use strict';

  const Store = window.FlakonStore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  let D = await Store.load();
  let B = await Store.bookings();
  let SVC = {}, MST = {};
  const index = () => {
    SVC = Object.fromEntries(D.services.map(s => [s.id, s]));
    MST = Object.fromEntries(D.masters.map(m => [m.id, m]));
  };
  index();

  /* ---------- форматирование ---------- */
  const money = n => Number(n).toLocaleString('ru-RU');
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const fmtMin = m => {
    const h = Math.floor(m / 60), r = m % 60;
    return [h ? h + ' ч' : '', r ? r + ' мин' : ''].filter(Boolean).join(' ');
  };
  const fmtRate = r => Number(r).toFixed(1).replace('.', ',');
  const fmtTime = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const fmtDate = d => `${d.getDate()} ${MON[d.getMonth()]}`;
  // to: верх вилки цен («3 800–5 200»), тогда «от» не пишем
  const cost = (price, from, cur = true, to = 0) =>
    price === 0 ? 'бесплатно'
      : to > price ? `${money(price)}–${money(to)}${cur ? ' <small>₽</small>' : ''}`
      : `${from ? '<small>от</small>' : ''}${money(price)}${cur ? ' <small>₽</small>' : ''}`;
  // картинка из папки сайта или загруженная в админке (idb:...)
  const src = ref => (ref && ref.startsWith('idb:') ? `data-ref="${esc(ref)}"` : `src="${esc(ref)}"`);

  // что видно клиентам: скрытые услуги и мастера, а также услуги без мастеров не показываем
  const offers = s => s.masters.filter(o => MST[o.id] && !MST[o.id].hidden);
  const visibleServices = () => D.services.filter(s => !s.hidden && offers(s).length);
  const offer = (s, mid) => offers(s).find(m => m.id === mid);

  /* ---------- шапка, меню, нижняя кнопка ---------- */
  const top = $('[data-top]');
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  const dock = $('[data-dock]');

  new IntersectionObserver(([e]) => top.classList.toggle('is-solid', !e.isIntersecting), { rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 68}px 0px 0px` }).observe($('.hero__logo'));
  new IntersectionObserver(([e]) => dock.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe($('.hero__cta'));

  const setMenu = open => {
    burger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    top.classList.toggle('is-open', open);
  };
  burger.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); }
  });

  /* ---------- тексты и контакты ---------- */
  function renderTexts() {
    const S = D.salon, T = D.texts;
    $$('[data-t]').forEach(el => { el.textContent = T[el.dataset.t] ?? ''; });
    $$('[data-s]').forEach(el => { el.textContent = S[el.dataset.s] ?? ''; });
    $$('[data-s-href]').forEach(el => { const v = S[el.dataset.sHref]; el.hidden = !v; if (v) el.href = v; });
    const tel = 'tel:+' + S.phone.replace(/\D/g, '').replace(/^8/, '7');
    $$('[data-s-phone]').forEach(el => { el.textContent = S.phone; el.href = tel; });
    $$('[data-s-phone-href]').forEach(el => { el.href = tel; });
    $$('[data-s-metro]').forEach(el => { el.textContent = `Метро «${S.metro}», ${S.metroWalk.replace(/ пешком$/, '')}`; });
    $$('[data-s-rating]').forEach(el => { el.innerHTML = `<b>${fmtRate(S.rating)}</b> в DIKIDI, ${S.ratings} ${plural(S.ratings, 'оценка', 'оценки', 'оценок')}`; });
    $$('[data-s-score]').forEach(el => { el.textContent = fmtRate(S.rating); });
    $$('[data-s-score-txt]').forEach(el => { el.textContent = `${S.ratings} ${plural(S.ratings, 'оценка', 'оценки', 'оценок')} и ${S.reviews} ${plural(S.reviews, 'отзыв', 'отзыва', 'отзывов')} в DIKIDI`; });
    $('[data-about]').innerHTML = T.about.filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('');
    $('[data-facts]').innerHTML = T.facts.filter(f => f.b).map(f => `<li><b>${esc(f.b)}</b>${f.span ? `<span>${esc(f.span)}</span>` : ''}</li>`).join('');
    $('[data-contacts]').innerHTML = `
      <div><dt>Адрес</dt><dd>${esc(S.address)}${S.addressNote ? `<br><span class="muted">${esc(S.addressNote)}</span>` : ''}</dd></div>
      <div><dt>Метро</dt><dd>«${esc(S.metro)}», ${esc(S.metroWalk)}</dd></div>
      <div><dt>Часы работы</dt><dd>${esc(S.hours)}</dd></div>
      <div><dt>Телефон</dt><dd><a class="contacts__phone" href="${tel}">${esc(S.phone)}</a></dd></div>`;
    // цены на первом экране: минимальная из выбранных услуг, «от», если цены разные
    $('[data-hero-prices]').innerHTML = T.heroPrices.map(h => {
      const list = h.ids.map(id => SVC[id]).filter(s => s && !s.hidden);
      if (!list.length) return '';
      const min = Math.min(...list.map(s => s.price));
      const from = list.length > 1 && list.some(s => s.price !== min) || list.some(s => s.from);
      return `<li><span>${esc(h.label)}</span><b>${from ? '<small>от</small> ' : ''}${money(min)}</b></li>`;
    }).join('');
  }

  /* ---------- фирменные прайс-листы: лента, листается вбок ---------- */
  const posters = $('[data-posters]');
  const postersTabs = $('[data-posters-tabs]');
  const posterLabel = p => { const t = p.sub || p.title; return t.charAt(0).toUpperCase() + t.slice(1); };
  function renderPosters() {
    $('[data-posters-sec]').hidden = !D.posters.length;
    posters.innerHTML = D.posters.map((p, i) => {
      const items = p.items.filter(it => SVC[it.id] && !SVC[it.id].hidden);
      const wide = items.some(it => SVC[it.id].to > SVC[it.id].price);
      return `
      <article class="poster${wide ? ' poster--wide' : ''}" ${p.slug ? `id="pl-${esc(p.slug)}"` : ''} data-poster="${i}">
        <img class="poster__chain" src="assets/img/chain-drape.webp" alt="" width="1200" height="1200" loading="lazy">
        <div class="poster__head">
          <h3 class="poster__title">${esc(p.title)}<span class="poster__sub">${esc(p.sub)}</span></h3>
        </div>
        <div class="poster__body">
          <img class="poster__photo" ${src(p.photo)} alt="${esc(p.photoAlt)}" width="480" height="945" loading="lazy">
          <ul class="poster__list">
            ${items.map(it => {
              const s = SVC[it.id];
              return `<li><button class="poster__item" type="button" data-book-service="${s.id}">
                <span class="sr-only">Записаться: </span><span class="poster__name">${esc(it.name || s.name)}</span>
                ${it.note ? `<span class="poster__note">${esc(it.note)}</span>` : ''}
                <span class="poster__price">${cost(s.price, false, false, s.to)}</span>
              </button></li>`;
            }).join('')}
          </ul>
        </div>
        <div class="poster__foot">
          <img class="poster__logo" src="assets/img/logo.webp" alt="Флакон" width="727" height="234" loading="lazy">
          ${p.handle ? `<a class="poster__handle" href="https://instagram.com/${esc(p.handle)}" target="_blank" rel="noopener">@${esc(p.handle)}</a>` : ''}
          <button class="btn btn--dark" type="button" data-book data-book-cat="${esc(p.key)}">Записаться</button>
        </div>
      </article>`;
    }).join('');
    postersTabs.innerHTML = D.posters.length > 1
      ? D.posters.map((p, i) => `<button class="chip" type="button" aria-pressed="false" data-poster-go="${i}">${esc(posterLabel(p))}</button>`).join('')
      : '';
    syncPosters();
  }
  // какой прайс сейчас первым в ленте: подсвечиваем его кнопку, крайние стрелки гасим
  const posterStart = () => parseFloat(getComputedStyle(posters).scrollPaddingLeft) || 0;
  const posterNow = () => {
    const els = $$('.poster', posters), x = posters.scrollLeft + posterStart();
    return els.reduce((best, el, i) => (Math.abs(el.offsetLeft - x) < Math.abs(els[best].offsetLeft - x) ? i : best), 0);
  };
  let posterWant = -1; // последний прайс, выбранный кнопкой: в конце ленты он может быть не первым
  function syncPosters() {
    if (!D.posters.length) return;
    const end = posters.scrollLeft >= posters.scrollWidth - posters.clientWidth - 2;
    let cur = posterNow();
    if (end && posterWant > cur) cur = posterWant;
    $$('[data-poster-go]', postersTabs).forEach((b, i) => {
      const on = i === cur;
      b.setAttribute('aria-pressed', on);
      // на телефоне кнопки в одну строку: активную держим в видимой части
      if (on && (b.offsetLeft < postersTabs.scrollLeft || b.offsetLeft + b.offsetWidth > postersTabs.scrollLeft + postersTabs.clientWidth)) {
        postersTabs.scrollTo({ left: b.offsetLeft - 16, behavior: reduce.matches ? 'auto' : 'smooth' });
      }
    });
    $('[data-posters-step="-1"]').disabled = posters.scrollLeft < 2;
    $('[data-posters-step="1"]').disabled = end;
  }
  const posterGo = i => {
    const els = $$('.poster', posters);
    const el = els[Math.max(0, Math.min(els.length - 1, i))];
    if (el) posters.scrollTo({ left: el.offsetLeft - posterStart(), behavior: reduce.matches ? 'auto' : 'smooth' });
  };
  let posterRaf = 0;
  posters.addEventListener('scroll', () => {
    cancelAnimationFrame(posterRaf);
    posterRaf = requestAnimationFrame(syncPosters);
  }, { passive: true });
  addEventListener('resize', syncPosters);
  ['pointerdown', 'wheel'].forEach(t => posters.addEventListener(t, () => { posterWant = -1; }, { passive: true }));
  postersTabs.addEventListener('click', e => {
    const b = e.target.closest('[data-poster-go]');
    if (!b) return;
    posterWant = +b.dataset.posterGo;
    posterGo(posterWant);
    syncPosters();
  });
  $$('[data-posters-step]').forEach(b => b.addEventListener('click', () => { posterWant = -1; posterGo(posterNow() + +b.dataset.postersStep); }));

  /* ---------- интерьер ---------- */
  function renderInterior() {
    $('[data-interior]').innerHTML = D.interior.slice(0, 6).map(i => `<img ${src(i.src)} alt="${esc(i.alt)}" loading="lazy" width="900" height="1200">`).join('');
  }

  /* ---------- прайс ---------- */
  const priceTabs = $('[data-price-tabs]');
  const priceList = $('[data-price-list]');
  let priceCat = null;
  function renderPrice() {
    const vis = visibleServices();
    const cats = D.cats.filter(c => vis.some(s => s.cat === c.key));
    if (!cats.some(c => c.key === priceCat)) priceCat = cats[0] && cats[0].key;
    priceTabs.innerHTML = cats.map(c => `<button class="chip" type="button" aria-pressed="${c.key === priceCat}" data-cat="${c.key}">${esc(c.title)}</button>`).join('');
    priceList.innerHTML = vis.filter(s => s.cat === priceCat).map(s => `
      <li><button class="price__row" type="button" data-book-service="${s.id}">
        <span class="price__name">${esc(s.name)}${s.note ? `<span class="price__note">${esc(s.note)}</span>` : ''}</span>
        <span class="price__time">${fmtMin(s.min)}</span>
        <span class="price__cost">${cost(s.price, s.from, true, s.to)}</span>
        <span class="btn btn--line price__go">Записаться</span>
      </button></li>`).join('');
  }
  priceTabs.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    priceCat = b.dataset.cat;
    renderPrice();
  });

  /* ---------- мастера ---------- */
  const mark = cls => `<img src="assets/img/mark.png" alt="" width="120" height="234">`;
  const avatar = (m, cls) => m.photo
    ? `<img class="${cls}" ${src(m.photo)} alt="" width="560" height="700" loading="lazy">`
    : `<span class="${cls} ${cls}--mono" aria-hidden="true">${mark()}</span>`;
  function renderMasters() {
    $('[data-masters]').innerHTML = D.masters.filter(m => !m.hidden).map(m => `
      <article class="master">
        ${m.photo
          ? `<img class="master__photo" ${src(m.photo)} alt="${esc(m.name)}" width="560" height="700" loading="lazy">`
          : `<div class="master__mono" role="img" aria-label="${esc(m.name)}, фото скоро появится">${mark()}</div>`}
        <div>
          <h3 class="master__name">${esc(m.name)}</h3>
          <p class="master__role">${esc(m.role)}</p>
          <p class="master__about">${esc(m.about)}</p>
          ${m.reviews ? `<p class="master__rate"><b>${fmtRate(m.rating)}</b> · ${m.reviews} ${plural(m.reviews, 'отзыв', 'отзыва', 'отзывов')}</p>` : ''}
        </div>
        <button class="btn btn--line" type="button" data-book-master="${m.id}">Записаться к ${esc(m.short || m.name)}</button>
      </article>`).join('');
  }

  /* ---------- работы ---------- */
  const works = $('[data-works]');
  const worksTabs = $('[data-works-tabs]');
  let workFilter = 'all';
  function renderWorks() {
    const cats = (D.workCats || []).filter(c => D.works.some(w => w.cat === c.key));
    if (workFilter !== 'all' && !cats.some(c => c.key === workFilter)) workFilter = 'all';
    worksTabs.innerHTML = cats.length > 1 ? [{ key: 'all', title: 'Все' }, ...cats].map(c => `<button class="chip" type="button" aria-pressed="${c.key === workFilter}" data-filter="${c.key}">${esc(c.title)}</button>`).join('') : '';
    works.innerHTML = D.works.map(w => `
      <li data-cat="${esc(w.cat)}" ${workFilter !== 'all' && w.cat !== workFilter ? 'hidden' : ''}>
        <button class="work${w.type === 'video' ? ' work--video' : ''}" type="button" data-work="${esc(w.id)}" aria-label="${w.type === 'video' ? 'Смотреть видео' : 'Открыть фото'}: ${esc(w.alt)}">
          ${w.type === 'video'
            ? `<video ${src(w.src)} muted playsinline preload="metadata" aria-hidden="true"></video>`
            : `<img ${src(w.src)} alt="${esc(w.alt)}" width="900" height="900" loading="lazy">`}
        </button>
      </li>`).join('');
  }
  worksTabs.addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    workFilter = b.dataset.filter;
    $$('[data-filter]', worksTabs).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $$('li', works).forEach(li => { li.hidden = workFilter !== 'all' && li.dataset.cat !== workFilter; });
  });

  /* ---------- отзывы ---------- */
  function renderReviews() {
    $('[data-reviews]').innerHTML = D.reviews.map(r => `
      <li class="review">
        <p class="review__text">${esc(r.text)}</p>
        <p class="review__meta"><b>${esc(r.name)}</b>${[r.date, r.service, r.master && 'мастер ' + r.master].filter(Boolean).map(esc).join(' · ')}</p>
      </li>`).join('');
  }

  async function renderAll() {
    renderTexts(); renderPosters(); renderInterior(); renderPrice(); renderMasters(); renderWorks(); renderReviews();
    await Store.hydrate(document.body);
  }
  await renderAll();

  // админка в соседней вкладке что-то поменяла: перечитываем и перерисовываем
  Store.onChange(async () => {
    D = await Store.load(); B = await Store.bookings(); index();
    await renderAll();
  });

  /* ---------- окна: открытие и закрытие с анимацией ---------- */
  const lockScroll = on => { document.documentElement.style.overflow = on ? 'hidden' : ''; };
  const openDialog = dlg => { dlg.classList.remove('is-closing'); dlg.showModal(); lockScroll(true); };
  const closeDialog = dlg => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    const done = () => { dlg.classList.remove('is-closing'); dlg.close(); lockScroll(false); dlg.dispatchEvent(new Event('closed')); };
    if (reduce.matches) return done();
    dlg.classList.add('is-closing');
    dlg.addEventListener('animationend', done, { once: true });
  };
  const wireDialog = dlg => {
    dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(dlg); });
    dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(dlg); });
  };

  /* ---------- просмотр работы ---------- */
  const lb = $('[data-lightbox]');
  const lbImg = $('[data-lightbox-img]');
  const lbVideo = $('[data-lightbox-video]');
  wireDialog(lb);
  lb.addEventListener('closed', () => lbVideo.pause());
  let lbWork = null;
  works.addEventListener('click', async e => {
    const b = e.target.closest('[data-work]');
    if (!b) return;
    lbWork = D.works.find(w => w.id === b.dataset.work);
    const u = await Store.url(lbWork.src);
    const isVideo = lbWork.type === 'video';
    lbImg.hidden = isVideo; lbVideo.hidden = !isVideo;
    if (isVideo) { lbVideo.src = u; lbVideo.setAttribute('aria-label', lbWork.alt); } else { lbImg.src = u; lbImg.alt = lbWork.alt; }
    $('[data-lightbox-cap]').textContent = lbWork.alt;
    openDialog(lb);
  });
  $('[data-lightbox-close]').addEventListener('click', () => closeDialog(lb));
  $('[data-lightbox-book]').addEventListener('click', () => {
    lbVideo.pause();
    lb.close(); lb.classList.remove('is-closing');
    openBooking({ cat: lbWork.book || 'all' });
  });

  /* =====================================================================
     Онлайн-запись: услуга → мастер → дата и свободное время → контакты.
     Свободное время = график мастера минус уже сделанные записи.
     ===================================================================== */
  const dlg = $('[data-book-dialog]');
  const body = $('[data-book-body]');
  const sum = $('[data-book-summary]');
  const titleEl = $('[data-book-title]');
  const stepEl = $('[data-book-step]');
  const backBtn = $('[data-book-back]');
  wireDialog(dlg);
  $('[data-book-close]').addEventListener('click', () => closeDialog(dlg));

  const STEPS = ['service', 'master', 'time', 'form'];
  const TITLES = { service: 'Услуга', master: 'Мастер', time: 'Дата и время', form: 'Контакты', done: 'Вы записаны' };
  let st = {};

  const days = () => {
    const out = [], d0 = new Date();
    for (let i = 0; i < ((D.settings && D.settings.horizonDays) || 21); i++) out.push(Store.addDays(d0, i));
    return out;
  };
  // время → список свободных мастеров (для «любого мастера» берём первого свободного)
  const slotsFor = d => {
    const s = st.service;
    const ids = st.master === 'any' ? offers(s).map(m => m.id) : [st.master];
    const map = new Map();
    for (const id of ids) {
      const o = offer(s, id);
      if (!o) continue;
      for (const t of Store.freeSlots(D, B, id, d, o.min)) map.set(t, [...(map.get(t) || []), id]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  };

  function openBooking({ serviceId, masterId, cat } = {}) {
    st = { step: 'service', service: null, master: null, prefMaster: masterId ? +masterId : null, cat: cat || 'all', q: '', day: null, time: null, assigned: null, booking: null, form: { name: '', phone: '', comment: '', ok: false } };
    if (st.cat !== 'all' && !visibleServices().some(s => s.cat === st.cat)) st.cat = 'all';
    openDialog(dlg);
    if (serviceId && SVC[serviceId] && offers(SVC[serviceId]).length) pickService(+serviceId);
    else render();
  }

  function go(step) { st.step = step; render(); }

  function prevStep() {
    if (st.step === 'form') return go('time');
    if (st.step === 'time') return go(offers(st.service).length > 1 && !st.prefMaster ? 'master' : 'service');
    if (st.step === 'master') return go('service');
  }
  backBtn.addEventListener('click', prevStep);

  function pickService(id) {
    st.service = SVC[id];
    st.day = null; st.time = null;
    const os = offers(st.service);
    if (st.prefMaster && offer(st.service, st.prefMaster)) { st.master = st.prefMaster; go('time'); }
    else if (os.length === 1) { st.master = os[0].id; go('time'); }
    else go('master');
  }

  function renderSummary() {
    const p = [];
    if (st.prefMaster && st.step === 'service') {
      p.push(`<button class="pill" type="button" data-clear-pref><span>Мастер: ${esc(MST[st.prefMaster].name)}</span> ✕</button>`);
    }
    if (st.service && st.step !== 'service' && st.step !== 'done') {
      p.push(`<button class="pill" type="button" data-goto="service"><span>${esc(st.service.name)}</span></button>`);
    }
    if (st.master && (st.step === 'time' || st.step === 'form')) {
      p.push(`<button class="pill" type="button" data-goto="master"><span>${st.master === 'any' ? 'Любой мастер' : esc(MST[st.master].name)}</span></button>`);
    }
    if (st.time != null && st.step === 'form') {
      p.push(`<button class="pill" type="button" data-goto="time"><span>${fmtDate(st.day)}, ${fmtTime(st.time)}</span></button>`);
    }
    sum.innerHTML = p.join('');
  }

  function render() {
    const i = STEPS.indexOf(st.step);
    stepEl.textContent = i >= 0 ? `Шаг ${i + 1} из ${STEPS.length}` : 'Запись создана';
    titleEl.textContent = TITLES[st.step];
    backBtn.hidden = i <= 0;
    renderSummary();
    ({ service: viewService, master: viewMaster, time: viewTime, form: viewForm, done: viewDone })[st.step]();
    Store.hydrate(body);
    body.scrollTop = 0;
    body.classList.remove('step-in'); void body.offsetWidth; body.classList.add('step-in');
    // содержимое шага заменено: переводим фокус на заголовок, чтобы клавиатура и экранный диктор не потерялись
    if (!body.contains(document.activeElement)) titleEl.focus({ preventScroll: true });
  }

  /* шаг 1: услуга */
  function viewService() {
    const vis = visibleServices();
    const cats = D.cats.filter(c => vis.some(s => s.cat === c.key));
    body.innerHTML = `
      <div class="bk-search">
        <input type="search" placeholder="Найти услугу" aria-label="Найти услугу" value="${esc(st.q)}" data-q>
        <div class="chips" role="group" aria-label="Разделы">
          ${[{ key: 'all', title: 'Все' }, ...cats].map(c => `<button class="chip" type="button" aria-pressed="${st.cat === c.key}" data-bk-cat="${c.key}">${esc(c.title)}</button>`).join('')}
        </div>
      </div>
      <div data-svc-list></div>`;
    fillServices();
    const q = $('[data-q]', body);
    q.addEventListener('input', () => { st.q = q.value; fillServices(); });
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) q.focus({ preventScroll: true });
  }
  function fillServices() {
    const q = st.q.trim().toLowerCase();
    const list = visibleServices().filter(s =>
      (st.cat === 'all' || s.cat === st.cat) &&
      (!q || s.name.toLowerCase().includes(q)) &&
      (!st.prefMaster || offer(s, st.prefMaster)));
    const groups = D.cats.map(c => [c, list.filter(s => s.cat === c.key)]).filter(([, l]) => l.length);
    $('[data-svc-list]', body).innerHTML = groups.length ? groups.map(([c, l]) => `
      <p class="bk-group">${esc(c.title)}</p>
      <div class="bk-list">${l.map(s => {
        const o = st.prefMaster ? offer(s, st.prefMaster) : null;
        return `<button class="bk-item" type="button" data-pick-service="${s.id}">
          <span class="bk-item__name">${esc(s.name)}</span>
          <span class="bk-item__sub">${fmtMin(o ? o.min : s.min)}${s.note ? ' · ' + esc(s.note) : ''}</span>
          <span class="bk-item__price">${cost(o ? o.price : s.price, o ? o.from : s.from)}</span>
        </button>`;
      }).join('')}</div>`).join('')
      : `<div class="bk-empty"><p>${q ? `По запросу «${esc(st.q.trim())}» ничего не нашлось.` : 'В этом разделе нет услуг.'}</p><button class="btn btn--line" type="button" data-reset-search>Показать все услуги</button></div>`;
  }

  /* шаг 2: мастер */
  function viewMaster() {
    const s = st.service;
    const ms = offers(s).map(o => ({ o, m: MST[o.id] }));
    const minPrice = Math.min(...ms.map(x => x.o.price));
    body.innerHTML = `
      <div class="bk-list">
        ${ms.length > 1 ? `<button class="bk-item bk-master" type="button" data-pick-master="any">
          <span class="bk-ava bk-ava--any" aria-hidden="true">${ms.length}</span>
          <span class="bk-item__name">Любой свободный мастер</span>
          <span class="bk-item__sub">Покажем всё свободное время</span>
          <span class="bk-item__price">${cost(minPrice, s.from || ms.some(x => x.o.price !== minPrice))}</span>
        </button>` : ''}
        ${ms.map(({ o, m }) => `<button class="bk-item bk-master" type="button" data-pick-master="${m.id}">
          ${avatar(m, 'bk-ava')}
          <span class="bk-item__name">${esc(m.name)}</span>
          <span class="bk-item__sub">${esc(m.role)}${m.reviews ? ' · ' + fmtRate(m.rating) : ''} · ${fmtMin(o.min)}</span>
          <span class="bk-item__price">${cost(o.price, o.from)}</span>
        </button>`).join('')}
      </div>`;
  }

  /* шаг 3: дата и время */
  function viewTime() {
    const ds = days().map(d => ({ d, n: slotsFor(d).length }));
    if (!st.day || !ds.some(x => Store.ymd(x.d) === Store.ymd(st.day) && x.n)) st.day = (ds.find(x => x.n) || ds[0]).d;
    const sl = slotsFor(st.day);
    const part = (from, to) => sl.filter(([t]) => t >= from && t < to);
    const block = (name, l) => l.length ? `<p class="bk-group">${name}</p><div class="bk-slots">${l.map(([t]) => `<button class="bk-slot" type="button" data-pick-time="${t}">${fmtTime(t)}</button>`).join('')}</div>` : '';
    const anyFree = ds.some(x => x.n);
    body.innerHTML = `
      <div class="bk-days" role="group" aria-label="Дата">
        ${ds.map(({ d, n }) => `<button class="bk-day" type="button" data-pick-day="${Store.ymd(d)}" aria-pressed="${Store.ymd(d) === Store.ymd(st.day)}" ${n ? '' : 'disabled'} aria-label="${WD_FULL[d.getDay()]}, ${fmtDate(d)}${n ? '' : ', нет свободного времени'}">
          <small>${WD[d.getDay()]}</small><b>${d.getDate()}</b>
        </button>`).join('')}
      </div>
      <p class="bk-month">${WD_FULL[st.day.getDay()][0].toUpperCase() + WD_FULL[st.day.getDay()].slice(1)}, ${fmtDate(st.day)}</p>
      ${sl.length ? block('Утро', part(0, 720)) + block('День', part(720, 1020)) + block('Вечер', part(1020, 1440))
        : anyFree ? '<p class="bk-empty">На этот день свободного времени нет. Выберите другой день.</p>'
        : `<div class="bk-empty"><p>В ближайшие дни свободного времени нет.</p><a class="btn btn--line" href="tel:+${D.salon.phone.replace(/\D/g, '')}">Позвонить в салон</a></div>`}
      <p class="bk-note">Показано только свободное время.</p>`;
    const cur = $('.bk-day[aria-pressed="true"]', body);
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* шаг 4: контакты */
  function viewForm() {
    const o = offer(st.service, st.assigned);
    const f = st.form;
    body.innerHTML = `
      <form class="bk-form" novalidate data-form>
        <div class="bk-total"><span>${esc(MST[st.assigned].name)}, ${fmtMin(o.min)}</span><b>${cost(o.price, o.from)}</b></div>
        <div class="field">
          <label for="bk-name">Имя</label>
          <input id="bk-name" name="name" autocomplete="given-name" value="${esc(f.name)}" aria-describedby="bk-name-err" required>
          <p class="field__err" id="bk-name-err"></p>
        </div>
        <div class="field">
          <label for="bk-phone">Телефон</label>
          <input id="bk-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (900) 000-00-00" value="${esc(f.phone)}" aria-describedby="bk-phone-err" required>
          <p class="field__err" id="bk-phone-err"></p>
        </div>
        <div class="field">
          <label for="bk-comment">Комментарий, если нужно</label>
          <textarea id="bk-comment" name="comment" rows="2" placeholder="Например, нужно снятие чужого покрытия">${esc(f.comment)}</textarea>
        </div>
        <label class="check"><input type="checkbox" name="ok" ${f.ok ? 'checked' : ''} aria-describedby="bk-ok-err"><span>Даю согласие на обработку персональных данных по <a href="#" data-policy>политике конфиденциальности</a></span></label>
        <p class="field__err" id="bk-ok-err"></p>
        <button class="btn btn--dark btn--lg" type="submit">Записаться на ${fmtDate(st.day)}, ${fmtTime(st.time)}</button>
      </form>`;
    const form = $('[data-form]', body);
    const phone = form.phone;
    phone.addEventListener('input', e => {
      if (e.inputType && e.inputType.startsWith('delete')) return;
      phone.value = fmtPhone(phone.value);
    });
    form.addEventListener('input', e => {
      st.form = { name: form.name.value, phone: form.phone.value, comment: form.comment.value, ok: form.ok.checked };
      // ошибку убираем, как только поле стало правильным
      const ok = { name: () => form.name.value.trim().length >= 2, phone: () => form.phone.value.replace(/\D/g, '').length === 11, ok: () => form.ok.checked };
      const k = e.target.name;
      if (ok[k] && ok[k]()) {
        e.target.removeAttribute('aria-invalid');
        $(`#bk-${k}-err`, form).textContent = '';
      }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const errs = {
        name: form.name.value.trim().length < 2 ? 'Напишите, как к вам обращаться' : '',
        phone: form.phone.value.replace(/\D/g, '').length !== 11 ? 'Номер должен быть из 11 цифр, например +7 900 000-00-00' : '',
        ok: form.ok.checked ? '' : 'Отметьте согласие на обработку данных, без него запись не отправить',
      };
      for (const k of ['name', 'phone']) {
        form[k].setAttribute('aria-invalid', String(!!errs[k]));
        $(`#bk-${k}-err`, form).textContent = errs[k];
      }
      $('#bk-ok-err', form).textContent = errs.ok;
      const bad = ['name', 'phone', 'ok'].find(k => errs[k]);
      if (bad) { form[bad].focus(); return; }
      const btn = $('[type=submit]', form);
      btn.disabled = true; btn.textContent = 'Записываем…';
      // время могли занять, пока клиент заполнял форму: проверяем ещё раз
      B = await Store.bookings();
      const still = Store.freeSlots(D, B, st.assigned, st.day, o.min).includes(st.time);
      if (!still) {
        btn.disabled = false; btn.textContent = `Записаться на ${fmtDate(st.day)}, ${fmtTime(st.time)}`;
        $('#bk-ok-err', form).textContent = 'Это время только что заняли. Выберите другое, данные формы сохранятся.';
        return;
      }
      st.booking = await Store.addBooking({
        serviceId: st.service.id, serviceName: st.service.name, masterId: st.assigned, masterName: MST[st.assigned].name, date: Store.ymd(st.day), start: st.time, dur: o.min,
        price: o.price, from: o.from, name: form.name.value.trim(), phone: form.phone.value, comment: form.comment.value.trim(), source: 'site',
      });
      B = await Store.bookings();
      go('done');
    });
  }
  function fmtPhone(v) {
    let d = v.replace(/\D/g, '');
    if (!d) return '';
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] !== '7') d = '7' + d;
    const p = d.slice(1, 11);
    let out = '+7';
    if (p.length) out += ' (' + p.slice(0, 3);
    if (p.length >= 3) out += ') ' + p.slice(3, 6);
    if (p.length >= 6) out += '-' + p.slice(6, 8);
    if (p.length >= 8) out += '-' + p.slice(8, 10);
    return out;
  }

  /* готово */
  function viewDone() {
    const o = offer(st.service, st.assigned);
    body.innerHTML = `
      <div class="bk-done">
        <span class="bk-done__mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
        <h3>Ждём вас</h3>
        <dl class="bk-card">
          <div><dt>Услуга</dt><dd>${esc(st.service.name)}</dd></div>
          <div><dt>Мастер</dt><dd>${esc(MST[st.assigned].name)}</dd></div>
          <div><dt>Когда</dt><dd>${WD_FULL[st.day.getDay()]}, ${fmtDate(st.day)}, ${fmtTime(st.time)}</dd></div>
          <div><dt>Стоимость</dt><dd>${o.price === 0 ? 'бесплатно' : (o.from ? 'от ' : '') + money(o.price) + ' ₽'}</dd></div>
          <div><dt>Адрес</dt><dd>${esc(D.salon.address)}${D.salon.addressNote ? ', ' + esc(D.salon.addressNote) : ''}</dd></div>
        </dl>
        <p class="bk-demo">Это демо-версия: запись сохранилась только в этом браузере и уже видна в <a href="admin/#bookings">админке салона</a>, а это время стало занятым. На рабочем сайте салон сразу получит её в Telegram.</p>
        <button class="btn btn--line btn--lg" type="button" data-ics>Добавить в календарь</button>
        <button class="btn btn--dark btn--lg" type="button" data-book-close-done>Готово</button>
      </div>`;
  }
  function downloadIcs() {
    const o = offer(st.service, st.assigned);
    const p = n => String(n).padStart(2, '0');
    const start = new Date(st.day.getFullYear(), st.day.getMonth(), st.day.getDate(), Math.floor(st.time / 60), st.time % 60);
    const end = new Date(start.getTime() + o.min * 60000);
    const f = x => `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}T${p(x.getHours())}${p(x.getMinutes())}00`;
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Flakon//Zapis//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
      `UID:${Date.now()}@flakon`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
      `SUMMARY:Флакон: ${st.service.name}`,
      `LOCATION:${(D.salon.address + (D.salon.addressNote ? ', ' + D.salon.addressNote : '')).replace(/,/g, '\\,')}`,
      `DESCRIPTION:Мастер: ${MST[st.assigned].name}. Телефон салона: ${D.salon.phone}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    a.download = 'flakon-zapis.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* клики внутри окна записи */
  dlg.addEventListener('click', e => {
    const t = e.target.closest('button, a');
    if (!t || !dlg.contains(t)) return;
    if (t.dataset.bkCat) { st.cat = t.dataset.bkCat; $$('[data-bk-cat]', body).forEach(x => x.setAttribute('aria-pressed', String(x === t))); fillServices(); return; }
    if (t.dataset.pickService) return pickService(+t.dataset.pickService);
    if (t.dataset.pickMaster) { st.master = t.dataset.pickMaster === 'any' ? 'any' : +t.dataset.pickMaster; st.time = null; return go('time'); }
    if (t.dataset.pickDay) {
      st.day = Store.parseYmd(t.dataset.pickDay);
      viewTime();
      return $('.bk-day[aria-pressed="true"]', body).focus();
    }
    if ('resetSearch' in t.dataset) { st.q = ''; st.cat = 'all'; st.prefMaster = null; return go('service'); }
    if (t.dataset.pickTime) {
      st.time = +t.dataset.pickTime;
      st.assigned = slotsFor(st.day).find(([x]) => x === st.time)[1][0];
      return go('form');
    }
    if (t.dataset.goto) return go(t.dataset.goto);
    if ('clearPref' in t.dataset) { st.prefMaster = null; renderSummary(); fillServices(); return; }
    if ('ics' in t.dataset) return downloadIcs();
    if ('bookCloseDone' in t.dataset) return closeDialog(dlg);
    if ('policy' in t.dataset) { e.preventDefault(); return; }
  });

  /* кнопки «Записаться» по всему сайту */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-book], [data-book-service], [data-book-master]');
    if (!t || dlg.contains(t)) return;
    openBooking({ serviceId: t.dataset.bookService, masterId: t.dataset.bookMaster, cat: t.dataset.bookCat });
  });
})();
