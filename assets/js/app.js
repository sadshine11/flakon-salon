/* Флакон: прайс, мастера, работы и онлайн-запись. Данные в data.js (собираются из DIKIDI). */
(() => {
  'use strict';

  const D = window.FLAKON;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  const SVC = Object.fromEntries(D.services.map(s => [s.id, s]));
  const MST = Object.fromEntries(D.masters.map(m => [m.id, m]));
  const CAT = Object.fromEntries(D.cats.map(c => [c.key, c]));

  /* ---------- форматирование ---------- */
  const money = n => n.toLocaleString('ru-RU');
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const fmtMin = m => {
    const h = Math.floor(m / 60), r = m % 60;
    return [h ? h + ' ч' : '', r ? r + ' мин' : ''].filter(Boolean).join(' ');
  };
  const fmtRate = r => r.toFixed(1).replace('.', ',');
  const fmtTime = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const WD_FULL = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const fmtDate = d => `${d.getDate()} ${MON[d.getMonth()]}`;
  const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const cost = (price, from, cur = true) =>
    price === 0 ? 'бесплатно' : `${from ? '<small>от</small>' : ''}${money(price)}${cur ? ' <small>₽</small>' : ''}`;

  /* ---------- шапка, меню, нижняя кнопка ---------- */
  const top = $('[data-top]');
  const burger = $('[data-burger]');
  const menu = $('[data-menu]');
  const heroLogo = $('.hero__logo');
  const dock = $('[data-dock]');

  new IntersectionObserver(([e]) => top.classList.toggle('is-solid', !e.isIntersecting), { rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--top-h')) || 68}px 0px 0px` }).observe(heroLogo);
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

  /* ---------- фирменные прайсы ---------- */
  $('[data-posters]').innerHTML = D.posters.map(p => `
    <article class="poster">
      <img class="poster__chain" src="assets/img/chain-drape.webp" alt="" width="1200" height="1200" loading="lazy">
      <div class="poster__head">
        <h3 class="poster__title">${esc(p.title)}<span class="poster__sub">${esc(p.sub)}</span></h3>
      </div>
      <div class="poster__body">
        <img class="poster__photo" src="assets/img/${p.photo}" alt="${esc(p.photoAlt)}" width="900" height="900" loading="lazy">
        <ul class="poster__list">
          ${p.items.map(it => {
            const s = SVC[it.id];
            return `<li><button class="poster__item" type="button" data-book-service="${s.id}">
              <span class="sr-only">Записаться: </span><span class="poster__name">${esc(it.name)}</span>
              ${it.note ? `<span class="poster__note">${esc(it.note)}</span>` : ''}
              <span class="poster__price">${money(s.price)}</span>
            </button></li>`;
          }).join('')}
        </ul>
      </div>
      <div class="poster__foot">
        <img class="poster__logo" src="assets/img/logo.webp" alt="Флакон" width="727" height="234" loading="lazy">
        ${p.handle ? `<a class="poster__handle" href="${D.salon.curlInstagram}" target="_blank" rel="noopener">@${esc(p.handle)}</a>` : ''}
        <button class="btn btn--dark" type="button" data-book data-book-cat="${p.key}">Записаться</button>
      </div>
    </article>`).join('');

  /* ---------- интерьер ---------- */
  const INTERIOR = [
    ['salon-1.webp', 'Зал: кресла парикмахеров и зеркала с подсветкой'],
    ['salon-2.webp', 'Кресло для педикюра'],
    ['salon-7.webp', 'Кабинет коррекции фигуры'],
    ['salon-4.webp', 'Рабочее место с круглым зеркалом'],
    ['salon-5.webp', 'Зона ожидания'],
    ['salon-6.webp', 'Общий вид зала'],
  ];
  $('[data-interior]').innerHTML = INTERIOR.map(([f, a]) => `<img src="assets/img/${f}" alt="${a}" loading="lazy" width="900" height="1200">`).join('');

  /* ---------- прайс ---------- */
  const priceTabs = $('[data-price-tabs]');
  const priceList = $('[data-price-list]');
  priceTabs.innerHTML = D.cats.map((c, i) => `<button class="chip" type="button" aria-pressed="${i === 0}" data-cat="${c.key}">${c.title}</button>`).join('');
  const renderPrice = key => {
    priceList.innerHTML = D.services.filter(s => s.cat === key).map(s => `
      <li><button class="price__row" type="button" data-book-service="${s.id}">
        <span class="price__name">${esc(s.name)}${s.note ? `<span class="price__note">${esc(s.note)}</span>` : ''}</span>
        <span class="price__time">${fmtMin(s.min)}</span>
        <span class="price__cost">${cost(s.price, s.from)}</span>
        <span class="btn btn--line price__go">Записаться</span>
      </button></li>`).join('');
  };
  priceTabs.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    $$('[data-cat]', priceTabs).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderPrice(b.dataset.cat);
  });
  renderPrice(D.cats[0].key);

  /* ---------- мастера ---------- */
  // без фото: знак флакона из логотипа
  const avatar = (m, cls) => m.noPhoto
    ? `<span class="${cls} ${cls}--mono" aria-hidden="true"><img src="assets/img/mark.png" alt="" width="120" height="234"></span>`
    : `<img class="${cls}" src="assets/img/master-${m.slug}.webp" alt="" width="560" height="700" loading="lazy">`;
  $('[data-masters]').innerHTML = D.masters.map(m => `
    <article class="master">
      ${m.noPhoto
        ? `<div class="master__mono" role="img" aria-label="${esc(m.name)}, фото скоро появится"><img src="assets/img/mark.png" alt="" width="120" height="234" loading="lazy"></div>`
        : `<img class="master__photo" src="assets/img/master-${m.slug}.webp" alt="${esc(m.name)}" width="560" height="700" loading="lazy">`}
      <div>
        <h3 class="master__name">${esc(m.name)}</h3>
        <p class="master__role">${esc(m.role)}</p>
        <p class="master__about">${esc(m.about)}</p>
        <p class="master__rate"><b>${fmtRate(m.rating)}</b> · ${m.reviews} ${plural(m.reviews, 'отзыв', 'отзыва', 'отзывов')}</p>
      </div>
      <button class="btn btn--line" type="button" data-book-master="${m.id}">Записаться к ${esc(m.short)}</button>
    </article>`).join('');

  /* ---------- работы ---------- */
  const works = $('[data-works]');
  works.innerHTML = D.works.map((w, i) => `
    <li data-cat="${w.cat}"><button class="work" type="button" data-work="${i}" aria-label="Открыть фото: ${esc(w.alt)}">
      <img src="assets/img/${w.img}" alt="${esc(w.alt)}" width="900" height="900" loading="lazy">
    </button></li>`).join('');
  $('[data-works-tabs]').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    $$('li', works).forEach(li => { li.hidden = b.dataset.filter !== 'all' && li.dataset.cat !== b.dataset.filter; });
  });

  /* ---------- отзывы ---------- */
  $('[data-reviews]').innerHTML = D.reviews.map(r => `
    <li class="review">
      <p class="review__text">${esc(r.text)}</p>
      <p class="review__meta"><b>${esc(r.name)}</b>${esc(r.date)} · ${esc(r.service)} · мастер ${esc(r.master)}</p>
    </li>`).join('');

  /* ---------- окна: открытие и закрытие с анимацией ---------- */
  const lockScroll = on => { document.documentElement.style.overflow = on ? 'hidden' : ''; };
  const openDialog = dlg => { dlg.classList.remove('is-closing'); dlg.showModal(); lockScroll(true); };
  const closeDialog = dlg => {
    if (!dlg.open || dlg.classList.contains('is-closing')) return;
    const done = () => { dlg.classList.remove('is-closing'); dlg.close(); lockScroll(false); };
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
  wireDialog(lb);
  let lbWork = null;
  works.addEventListener('click', e => {
    const b = e.target.closest('[data-work]');
    if (!b) return;
    lbWork = D.works[+b.dataset.work];
    $('[data-lightbox-img]').src = `assets/img/${lbWork.img}`;
    $('[data-lightbox-img]').alt = lbWork.alt;
    $('[data-lightbox-cap]').textContent = lbWork.alt;
    openDialog(lb);
  });
  $('[data-lightbox-close]').addEventListener('click', () => closeDialog(lb));
  $('[data-lightbox-book]').addEventListener('click', () => {
    const cat = lbWork.book || (lbWork.cat === 'nails' ? 'nails' : 'hair');
    lb.close(); lb.classList.remove('is-closing');
    openBooking({ cat });
  });

  /* =====================================================================
     Онлайн-запись. В демо свободное время считается локально; на рабочем
     сайте сюда подключается сервер с расписанием и уведомлением в Telegram.
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

  // Детерминированное «занятое» время, чтобы демо выглядело как живое расписание
  const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const busy = (mid, d) => {
    const r = rng(hash(mid + '|' + dayKey(d)));
    if (r() < 0.26) return null;                          // выходной мастера
    const list = [];
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const s = D.salon.open + Math.floor(r() * 18) * 30;
      list.push([s, s + (2 + Math.floor(r() * 5)) * 30]);
    }
    return list;
  };
  const freeSlots = (mid, d, dur) => {
    const b = busy(mid, d);
    if (!b) return [];
    const now = new Date();
    const today = dayKey(now) === dayKey(d);
    const earliest = today ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 60) / 30) * 30 : 0;
    const out = [];
    for (let t = D.salon.open; t + dur <= D.salon.close; t += 30) {
      if (t < earliest) continue;
      if (b.some(([a, z]) => t < z && t + dur > a)) continue;
      out.push(t);
    }
    return out;
  };
  const days = () => {
    const out = [], d0 = new Date();
    for (let i = 0; i < 14; i++) out.push(new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i));
    return out;
  };
  // Время -> список свободных мастеров (для «любого мастера» берём первого свободного)
  const slotsFor = d => {
    const s = st.service;
    const ids = st.master === 'any' ? s.masters.map(m => m.id) : [st.master];
    const map = new Map();
    for (const id of ids) {
      const dur = s.masters.find(m => m.id === id).min;
      for (const t of freeSlots(id, d, dur)) map.set(t, [...(map.get(t) || []), id]);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  };
  const offer = (s, mid) => s.masters.find(m => m.id === mid);

  function openBooking({ serviceId, masterId, cat } = {}) {
    st = { step: 'service', service: null, master: null, prefMaster: masterId ? +masterId : null, cat: cat || 'all', q: '', day: null, time: null, assigned: null, form: { name: '', phone: '', comment: '', ok: false } };
    openDialog(dlg);
    if (serviceId) pickService(+serviceId);
    else render();
  }

  function go(step) { st.step = step; render(); }

  function prevStep() {
    if (st.step === 'form') return go('time');
    if (st.step === 'time') return go('master');
    if (st.step === 'master') return go('service');
  }
  backBtn.addEventListener('click', prevStep);

  function pickService(id) {
    st.service = SVC[id];
    st.day = null; st.time = null;
    const pm = st.prefMaster && offer(st.service, st.prefMaster);
    if (pm) { st.master = st.prefMaster; go('time'); }
    else if (st.service.masters.length === 1) { st.master = st.service.masters[0].id; go('time'); }
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
    body.scrollTop = 0;
    body.classList.remove('step-in'); void body.offsetWidth; body.classList.add('step-in');
    // содержимое шага заменено: переводим фокус на заголовок, чтобы клавиатура и экранный диктор не потерялись
    if (!body.contains(document.activeElement)) titleEl.focus({ preventScroll: true });
  }

  /* шаг 1: услуга */
  function viewService() {
    body.innerHTML = `
      <div class="bk-search">
        <input type="search" placeholder="Найти услугу" aria-label="Найти услугу" value="${esc(st.q)}" data-q>
        <div class="chips" role="group" aria-label="Разделы">
          ${[{ key: 'all', title: 'Все' }, ...D.cats].map(c => `<button class="chip" type="button" aria-pressed="${st.cat === c.key}" data-bk-cat="${c.key}">${c.title}</button>`).join('')}
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
    const list = D.services.filter(s =>
      (st.cat === 'all' || s.cat === st.cat) &&
      (!q || s.name.toLowerCase().includes(q)) &&
      (!st.prefMaster || offer(s, st.prefMaster)));
    const groups = D.cats.map(c => [c, list.filter(s => s.cat === c.key)]).filter(([, l]) => l.length);
    $('[data-svc-list]', body).innerHTML = groups.length ? groups.map(([c, l]) => `
      <p class="bk-group">${c.title}</p>
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
    const ms = s.masters.map(o => ({ o, m: MST[o.id] }));
    const minPrice = Math.min(...s.masters.map(o => o.price));
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
          <span class="bk-item__sub">${esc(m.role)} · ${fmtRate(m.rating)} · ${fmtMin(o.min)}</span>
          <span class="bk-item__price">${cost(o.price, o.from)}</span>
        </button>`).join('')}
      </div>`;
  }

  /* шаг 3: дата и время */
  function viewTime() {
    const ds = days().map(d => ({ d, n: slotsFor(d).length }));
    if (!st.day || !ds.some(x => dayKey(x.d) === dayKey(st.day) && x.n)) st.day = (ds.find(x => x.n) || ds[0]).d;
    const sl = slotsFor(st.day);
    const part = (from, to) => sl.filter(([t]) => t >= from && t < to);
    const block = (name, l) => l.length ? `<p class="bk-group">${name}</p><div class="bk-slots">${l.map(([t]) => `<button class="bk-slot" type="button" data-pick-time="${t}">${fmtTime(t)}</button>`).join('')}</div>` : '';
    body.innerHTML = `
      <div class="bk-days" role="group" aria-label="Дата">
        ${ds.map(({ d, n }) => `<button class="bk-day" type="button" data-pick-day="${dayKey(d)}" aria-pressed="${dayKey(d) === dayKey(st.day)}" ${n ? '' : 'disabled'} aria-label="${WD_FULL[d.getDay()]}, ${fmtDate(d)}${n ? '' : ', нет свободного времени'}">
          <small>${WD[d.getDay()]}</small><b>${d.getDate()}</b>
        </button>`).join('')}
      </div>
      <p class="bk-month">${WD_FULL[st.day.getDay()][0].toUpperCase() + WD_FULL[st.day.getDay()].slice(1)}, ${fmtDate(st.day)}</p>
      ${sl.length ? block('Утро', part(0, 720)) + block('День', part(720, 1020)) + block('Вечер', part(1020, 1440)) : '<p class="bk-empty">На этот день свободного времени нет. Выберите другой день.</p>'}
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
    form.addEventListener('submit', e => {
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
      setTimeout(() => go('done'), 650);
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
          <div><dt>Адрес</dt><dd>${D.salon.address}, ${D.salon.addressNote}</dd></div>
        </dl>
        <p class="bk-demo">Это демо-версия: запись никуда не отправилась. На рабочем сайте она сразу придёт салону в Telegram, а это время станет занятым для других клиентов.</p>
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
      'LOCATION:Новосибирск\\, ул. Геодезическая\\, 5/1\\, цокольный этаж',
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
      st.day = days().find(d => dayKey(d) === t.dataset.pickDay);
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
