/* Флакон: админка салона. Работает с теми же данными, что и сайт (FlakonStore).
   В демо всё сохраняется в браузере; на рабочем сайте Store будет ходить на сервер. */
(async () => {
  'use strict';

  const Store = window.FlakonStore;
  const BASE = '../';
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
  const money = n => Number(n || 0).toLocaleString('ru-RU');
  const plural = (n, one, few, many) => {
    const a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  };
  const fmtMin = m => {
    const h = Math.floor(m / 60), r = m % 60;
    return [h ? h + ' ч' : '', r ? r + ' мин' : ''].filter(Boolean).join(' ') || '0 мин';
  };
  const fmtTime = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const WD_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const fmtDate = d => `${d.getDate()} ${MON[d.getMonth()]}`;
  // to: верх вилки цен («3 800–5 200 ₽»)
  const priceTxt = (p, from, to = 0) => (p === 0 ? 'бесплатно' : to > p ? `${money(p)}–${money(to)} ₽` : `${from ? 'от ' : ''}${money(p)} ₽`);
  const src = ref => (ref && ref.startsWith('idb:') ? `data-ref="${esc(ref)}"` : `src="${esc(BASE + ref)}"`);
  const durOptions = (sel, max = 600) => {
    let o = '';
    for (let m = 15; m <= max; m += 15) o += `<option value="${m}" ${m === sel ? 'selected' : ''}>${fmtMin(m)}</option>`;
    if (sel && sel % 15) o = `<option value="${sel}" selected>${fmtMin(sel)}</option>` + o;
    return o;
  };
  const timeOptions = (sel, from = 7 * 60, to = 23 * 60) => {
    let o = '';
    for (let t = from; t <= to; t += 30) o += `<option value="${t}" ${t === sel ? 'selected' : ''}>${fmtTime(t)}</option>`;
    return o;
  };
  const phoneDigits = p => { let d = String(p || '').replace(/\D/g, ''); if (d[0] === '8') d = '7' + d.slice(1); return d; };
  const fmtPhone = v => {
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
  };
  const ICON = {
    up: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 14l5-5 5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };
  const mark = '<img src="../assets/img/mark.png" alt="" width="120" height="234">';

  /* ---------- сохранение и сообщения ---------- */
  const toastEl = $('[data-toast]');
  let toastT;
  const toast = msg => {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), 2400);
  };
  const commit = async (msg = 'Сохранено') => { await Store.save(D); index(); toast(msg); };
  const reloadBookings = async () => { B = await Store.bookings(); };

  /* ---------- вход (в демо подходит любой пароль) ---------- */
  const session = {
    get: () => { try { return sessionStorage.getItem('flakon-admin') === '1'; } catch { return true; } },
    set: on => { try { on ? sessionStorage.setItem('flakon-admin', '1') : sessionStorage.removeItem('flakon-admin'); } catch { /* приватный режим: просто без запоминания */ } },
  };
  const loginEl = $('[data-login]');
  const appEl = $('[data-app]');
  const showApp = on => { loginEl.hidden = on; appEl.hidden = !on; if (on) route(true); };
  $('[data-login-form]').addEventListener('submit', e => {
    e.preventDefault();
    session.set(true);
    showApp(true);
  });
  $('[data-logout]').addEventListener('click', () => { session.set(false); showApp(false); });

  /* ---------- окно подтверждения ---------- */
  const cf = $('[data-confirm]');
  const ask = (text, yes = 'Удалить', danger = true) => new Promise(resolve => {
    $('[data-confirm-text]', cf).textContent = text;
    const y = $('[data-confirm-yes]', cf);
    y.textContent = yes;
    y.className = `btn ${danger ? 'btn--danger' : 'btn--dark'}`;
    cf.returnValue = '';
    cf.showModal();
    cf.addEventListener('close', () => resolve(cf.returnValue === 'yes'), { once: true });
  });

  /* ---------- окно редактирования ---------- */
  const sheet = $('[data-sheet]');
  const sheetForm = $('[data-sheet-form]');
  const sheetBody = $('[data-sheet-body]');
  const sheetFoot = $('[data-sheet-foot]');
  let sheetSubmit = null, sheetActs = {};
  function openSheet({ title, body, save = 'Сохранить', del = null, onSubmit, acts = {}, onOpen }) {
    $('[data-sheet-title]').textContent = title;
    // «Удалить» внизу окна, отдельно от «Сохранить», чтобы не нажать случайно
    sheetBody.innerHTML = body + (del ? `<div class="sheet__danger"><button class="btn btn--line btn--sm btn--danger-line" type="button" data-sheet-act="__del">${esc(del.label)}</button></div>` : '');
    sheetFoot.innerHTML = save ? `<span class="spacer"></span>
      <button class="btn btn--line" type="button" data-sheet-close>Отмена</button>
      <button class="btn btn--dark" type="submit">${esc(save)}</button>` : '';
    sheetSubmit = onSubmit;
    sheetActs = { ...acts, ...(del ? { __del: del.run } : {}) };
    sheet.classList.remove('is-closing');
    if (!sheet.open) sheet.showModal();
    document.documentElement.style.overflow = 'hidden';
    Store.hydrate(sheetBody, BASE);
    sheetBody.scrollTop = 0;
    $('[data-sheet-title]').focus({ preventScroll: true });
    onOpen && onOpen(sheetBody);
  }
  function closeSheet() {
    if (!sheet.open || sheet.classList.contains('is-closing')) return;
    const done = () => {
      sheet.classList.remove('is-closing'); sheet.close(); document.documentElement.style.overflow = '';
      $$('video', sheetBody).forEach(v => v.pause());
      // кнопка, открывшая окно, могла перерисоваться: тогда фокус на содержимое страницы, а не в начало документа
      if (!document.activeElement || document.activeElement === document.body) main.focus({ preventScroll: true });
    };
    if (reduce.matches) return done();
    sheet.classList.add('is-closing');
    sheet.addEventListener('animationend', done, { once: true });
  }
  sheet.addEventListener('cancel', e => { e.preventDefault(); closeSheet(); });
  sheet.addEventListener('click', e => {
    if (e.target === sheet) return closeSheet();
    const t = e.target.closest('[data-sheet-close], [data-sheet-act]');
    if (!t) return;
    if ('sheetClose' in t.dataset) return closeSheet();
    const fn = sheetActs[t.dataset.sheetAct];
    if (fn) fn(t, e);
  });
  sheetForm.addEventListener('submit', async e => {
    e.preventDefault();
    if (!sheetSubmit) return;
    const ok = await sheetSubmit(sheetForm);
    if (ok !== false) closeSheet();
  });
  // ошибка у поля: текст под ним и фокус
  const fieldError = (form, name, msg) => {
    const el = form.elements[name];
    const err = $(`[data-err="${name}"]`, form);
    if (el) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (err) err.textContent = msg || '';
    if (msg && el) el.focus();
    return !msg;
  };
  const field = (label, control, { hint = '', err = '' } = {}) =>
    `<div class="field"><label${control.match(/id="([^"]+)"/) ? ` for="${control.match(/id="([^"]+)"/)[1]}"` : ''}>${label}</label>${control}${hint ? `<p class="field__hint">${hint}</p>` : ''}${err ? `<p class="field__err" data-err="${err}"></p>` : ''}</div>`;

  /* ---------- загрузка фото и видео ---------- */
  async function shrinkImage(file, max) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    let blob = await new Promise(r => c.toBlob(r, 'image/webp', .82));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .85));
    return blob;
  }
  const MAX_VIDEO = 100 * 1024 * 1024;
  async function upload(file, max = 1400) {
    if (file.type.startsWith('image/')) return { type: 'image', ref: await Store.putFile(await shrinkImage(file, max)) };
    if (file.type.startsWith('video/')) {
      if (file.size > MAX_VIDEO) throw new Error(`Видео «${file.name}» больше 100 МБ. Обрежьте его или сожмите и загрузите снова.`);
      return { type: 'video', ref: await Store.putFile(file) };
    }
    throw new Error(`Файл «${file.name}» не фото и не видео.`);
  }

  /* ---------- разделы и навигация ---------- */
  const SECTIONS = [
    { key: 'bookings', title: 'Записи', view: viewBookings, tab: true },
    { key: 'services', title: 'Услуги', view: viewServices, tab: true },
    { key: 'masters', title: 'Мастера', view: viewMasters, tab: true },
    { key: 'schedule', title: 'График', view: viewSchedule, tab: true },
    { key: 'works', title: 'Работы', view: viewWorks },
    { key: 'posters', title: 'Прайс-листы', view: viewPosters },
    { key: 'site', title: 'Тексты и контакты', view: viewSite },
    { key: 'interior', title: 'Фото салона', view: viewInterior },
    { key: 'reviews', title: 'Отзывы', view: viewReviews },
    { key: 'settings', title: 'Настройки', view: viewSettings },
  ];
  const main = $('[data-main]');
  let current = null, dirty = false;
  const newCount = () => B.filter(b => b.status === 'new' && b.date >= Store.ymd(new Date())).length;

  function renderNav() {
    const n = newCount();
    const badge = key => (key === 'bookings' && n ? `<span class="badge" aria-label="${n} ${plural(n, 'новая', 'новые', 'новых')}">${n}</span>` : '');
    $('[data-nav]').innerHTML = SECTIONS.map(s => `<a class="nav-link" href="#${s.key}" ${s.key === current ? 'aria-current="page"' : ''}><span>${s.title}</span>${badge(s.key)}</a>`).join('');
    const inMore = !SECTIONS.find(s => s.key === current)?.tab;
    $('[data-tabbar]').innerHTML = SECTIONS.filter(s => s.tab).map(s => `<a class="tab" href="#${s.key}" ${s.key === current ? 'aria-current="page"' : ''}>${s.title}${badge(s.key)}</a>`).join('')
      + `<button class="tab" type="button" data-more ${inMore ? 'aria-current="page"' : ''}>Ещё</button>`;
  }

  function route(initial = false) {
    const key = (location.hash.slice(1).split('?')[0]) || 'bookings';
    const sec = SECTIONS.find(s => s.key === key) || SECTIONS[0];
    current = sec.key;
    dirty = false;
    renderNav();
    document.title = `${sec.title} · Админка · Флакон`;
    sec.view();
    Store.hydrate(main, BASE);
    if (!initial) { main.focus({ preventScroll: true }); scrollTo(0, 0); }
  }
  let lastHash = location.hash;
  addEventListener('hashchange', async () => {
    if (dirty && !(await ask('Есть несохранённые изменения. Уйти со страницы без сохранения?', 'Уйти без сохранения'))) {
      history.replaceState(null, '', lastHash || '#bookings');
      return;
    }
    lastHash = location.hash;
    if (sheet.open) closeSheet();
    route();
  });
  addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // «Ещё» на телефоне
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-more]')) return;
    openSheet({
      title: 'Ещё', save: null,
      body: `<nav class="more" aria-label="Остальные разделы">
        ${SECTIONS.filter(s => !s.tab).map(s => `<a href="#${s.key}" data-close-more>${s.title}</a>`).join('')}
        <a href="../" target="_blank" rel="noopener">Открыть сайт</a>
        <button type="button" data-sheet-act="logout">Выйти</button>
      </nav>`,
      acts: { logout: () => { closeSheet(); session.set(false); showApp(false); } },
    });
  });
  sheetBody.addEventListener('click', e => { if (e.target.closest('[data-close-more]')) closeSheet(); });

  // запись с сайта в соседней вкладке: обновляем список и счётчик
  Store.onChange(async msg => {
    if (msg.type === 'reset') return location.reload();
    D = await Store.load(); index();
    await reloadBookings();
    renderNav();
    if (current === 'bookings' && !sheet.open) { viewBookings(); Store.hydrate(main, BASE); }
    if (msg.type === 'bookings') toast('Записи обновились');
  });

  // отметка «есть несохранённые изменения» для страниц с общей кнопкой сохранения
  const markDirty = () => {
    if (dirty) return;
    dirty = true;
    const bar = $('[data-savebar]', main);
    if (bar) bar.hidden = false;
  };
  const savebar = (label = 'Сохранить изменения') =>
    `<div class="savebar" data-savebar hidden><span>Есть несохранённые изменения</span><button class="btn btn--dark btn--sm" type="button" data-save>${label}</button></div>`;

  /* =====================================================================
     ЗАПИСИ
     ===================================================================== */
  let bkDay = new Date(), bkMaster = 'all';
  const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Пришла', cancelled: 'Отменена' };

  function viewBookings() {
    const today = new Date();
    const horizon = (D.settings && D.settings.horizonDays) || 21;
    const days = [];
    for (let i = -3; i < horizon; i++) days.push(Store.addDays(today, i));
    const forMaster = b => bkMaster === 'all' || b.masterId === bkMaster;
    const key = Store.ymd(bkDay);
    const list = B.filter(b => b.date === key && forMaster(b)).sort((a, b) => a.start - b.start || a.masterId - b.masterId);
    const active = list.filter(b => b.status !== 'cancelled');
    const sumMoney = active.reduce((s, b) => s + (b.price || 0), 0);
    const masters = D.masters.filter(m => !m.hidden || B.some(b => b.masterId === m.id));

    main.innerHTML = `<section class="page">
      <div class="page__head">
        <h1 class="page__title">Записи</h1>
        <div class="page__actions"><button class="btn btn--dark" type="button" data-new-booking>Новая запись</button></div>
      </div>
      <div class="toolbar">
        <div class="days" role="group" aria-label="День">
          ${days.map(d => {
            const k = Store.ymd(d);
            const n = B.filter(b => b.date === k && b.status !== 'cancelled' && forMaster(b)).length;
            return `<button class="day ${k === Store.ymd(today) ? 'day--today' : ''}" type="button" data-day="${k}" aria-pressed="${k === key}" aria-label="${WD_FULL[d.getDay()]}, ${fmtDate(d)}, ${n} ${plural(n, 'запись', 'записи', 'записей')}">
              <small>${WD[d.getDay()]}</small><b>${d.getDate()}</b><i>${n || '·'}</i></button>`;
          }).join('')}
        </div>
        <div class="chips chips--scroll" role="group" aria-label="Мастер">
          ${[{ id: 'all', name: 'Все мастера' }, ...masters].map(m => `<button class="chip" type="button" data-bk-master="${m.id}" aria-pressed="${bkMaster === m.id}">${esc(m.id === 'all' ? m.name : m.name.split(' ')[0])}</button>`).join('')}
        </div>
      </div>
      <p class="day-sum"><span><b>${WD_FULL[bkDay.getDay()]}, ${fmtDate(bkDay)}</b></span><span>${active.length} ${plural(active.length, 'запись', 'записи', 'записей')}</span>${active.length ? `<span>по прайсу ${money(sumMoney)} ₽</span>` : ''}</p>
      ${list.length ? `<div class="bookings">${list.map(bookingCard).join('')}</div>`
        : `<div class="empty card"><p>На этот день записей нет.</p><button class="btn btn--line" type="button" data-new-booking>Добавить запись</button></div>`}
      <p class="demo-note">Это демо: записи хранятся только в этом браузере. Записи с сайта появляются здесь сразу, даже если сайт открыт в соседней вкладке. На рабочем сайте о каждой новой записи придёт сообщение в Telegram.</p>
    </section>`;
    const cur = $('.day[aria-pressed="true"]', main);
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center' });
  }

  function bookingCard(b) {
    const s = SVC[b.serviceId], m = MST[b.masterId];
    const tel = phoneDigits(b.phone);
    const acts = [];
    if (b.status === 'new') acts.push(`<button class="btn btn--dark btn--sm" type="button" data-bk-act="confirmed" data-id="${b.id}">Подтвердить</button>`);
    if (b.status === 'confirmed' || b.status === 'new') acts.push(`<button class="btn btn--line btn--sm" type="button" data-bk-act="done" data-id="${b.id}">Пришла</button>`);
    if (b.status !== 'cancelled') {
      acts.push(`<button class="btn btn--line btn--sm" type="button" data-bk-edit="${b.id}">Перенести</button>`);
      acts.push(`<button class="btn btn--ghost btn--sm" type="button" data-bk-act="cancelled" data-id="${b.id}">Отменить</button>`);
    } else {
      acts.push(`<button class="btn btn--line btn--sm" type="button" data-bk-act="confirmed" data-id="${b.id}">Вернуть запись</button>`);
    }
    return `<article class="bk ${b.status === 'cancelled' ? 'bk--cancelled' : ''}" id="bk-${b.id}" tabindex="-1">
      <div class="bk__time">${fmtTime(b.start)}<span>до ${fmtTime(b.start + b.dur)}</span></div>
      <div class="bk__main">
        <div class="bk__who">${esc(b.name)} <span class="pill-s pill-s--${b.status}">${STATUS[b.status]}</span></div>
        <div class="bk__svc">${esc(s ? s.name : b.serviceName || 'Услуга удалена')}</div>
        <div class="bk__meta">${esc(m ? m.name : b.masterName || 'Мастер удалён')} · <a href="tel:+${tel}">${esc(b.phone)}</a> · <a href="https://wa.me/${tel}" target="_blank" rel="noopener">WhatsApp</a> · ${b.source === 'site' ? 'с сайта' : 'добавлена вручную'}</div>
        ${b.comment ? `<div class="bk__comment">${esc(b.comment)}</div>` : ''}
      </div>
      <div class="bk__price">${priceTxt(b.price, b.from)}</div>
      <div class="bk__acts">${acts.join('')}</div>
    </article>`;
  }

  main.addEventListener('click', async e => {
    if (current !== 'bookings') return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.day) { bkDay = Store.parseYmd(t.dataset.day); viewBookings(); return $('.day[aria-pressed="true"]', main).focus(); }
    if (t.dataset.bkMaster) { bkMaster = t.dataset.bkMaster === 'all' ? 'all' : +t.dataset.bkMaster; viewBookings(); return $('[data-bk-master][aria-pressed="true"]', main).focus(); }
    if ('newBooking' in t.dataset) return bookingSheet();
    if (t.dataset.bkEdit) return bookingSheet(B.find(b => b.id === t.dataset.bkEdit));
    if (t.dataset.bkAct) {
      const st = t.dataset.bkAct;
      if (st === 'cancelled' && !(await ask('Отменить запись? Время снова станет свободным для записи с сайта.', 'Отменить запись'))) return;
      await Store.updateBooking(t.dataset.id, { status: st });
      await reloadBookings();
      renderNav(); viewBookings();
      const card = $(`#bk-${t.dataset.id}`, main);
      if (card) card.focus({ preventScroll: true });
      toast({ confirmed: 'Запись подтверждена', done: 'Отмечено: клиент пришёл', cancelled: 'Запись отменена' }[st]);
    }
  });

  // новая запись или перенос существующей
  function bookingSheet(edit = null) {
    const svcList = D.services.filter(s => s.masters.some(o => MST[o.id]));
    const groups = D.cats.map(c => [c, svcList.filter(s => s.cat === c.key)]).filter(([, l]) => l.length);
    const st = {
      serviceId: edit ? edit.serviceId : (svcList[0] && svcList[0].id),
      masterId: edit ? edit.masterId : null,
      date: edit ? edit.date : Store.ymd(bkDay < new Date(new Date().toDateString()) ? new Date() : bkDay),
      start: edit ? edit.start : null,
    };
    const others = () => B.filter(b => !edit || b.id !== edit.id);
    const body = `
      ${edit ? `<p class="muted small">Клиент: <b>${esc(edit.name)}</b>, ${esc(edit.phone)}</p>` : ''}
      ${field('Услуга', `<select id="nb-svc" name="svc" ${edit ? 'disabled' : ''}>${groups.map(([c, l]) => `<optgroup label="${esc(c.title)}">${l.map(s => `<option value="${s.id}" ${s.id === st.serviceId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`).join('')}</select>`)}
      ${field('Мастер', `<select id="nb-master" name="master"></select>`)}
      <div class="grid2">
        ${field('Дата', `<input id="nb-date" name="date" type="date" value="${st.date}" min="${Store.ymd(new Date())}">`)}
        ${field('Время', `<select id="nb-time" name="time" aria-describedby="nb-time-hint"></select>`, { err: 'time' })}
      </div>
      <p class="field__hint" id="nb-time-hint" data-time-hint></p>
      ${edit ? '' : `
        ${field('Имя клиента', `<input id="nb-name" name="name" autocomplete="off">`, { err: 'name' })}
        ${field('Телефон', `<input id="nb-phone" name="phone" type="tel" inputmode="tel" autocomplete="off" placeholder="+7 (900) 000-00-00">`, { err: 'phone' })}
        ${field('Комментарий', `<textarea id="nb-comment" name="comment" rows="2"></textarea>`)}`}`;
    openSheet({
      title: edit ? 'Перенести запись' : 'Новая запись',
      body,
      save: edit ? 'Перенести' : 'Добавить запись',
      onOpen: root => {
        const f = sheetForm;
        const fillMasters = () => {
          const s = SVC[+f.svc.value];
          const os = s.masters.filter(o => MST[o.id]);
          if (!os.some(o => o.id === st.masterId)) st.masterId = os[0] && os[0].id;
          f.master.innerHTML = os.map(o => `<option value="${o.id}" ${o.id === st.masterId ? 'selected' : ''}>${esc(MST[o.id].name)} · ${fmtMin(o.min)} · ${priceTxt(o.price, o.from)}</option>`).join('');
        };
        const fillTimes = () => {
          const s = SVC[+f.svc.value], mid = +f.master.value;
          const o = s.masters.find(x => x.id === mid);
          const slots = f.date.value ? Store.freeSlots(D, others(), mid, Store.parseYmd(f.date.value), o.min) : [];
          if (edit && f.date.value === edit.date && mid === edit.masterId && !slots.includes(edit.start)) slots.unshift(edit.start);
          f.time.innerHTML = slots.length ? slots.map(t => `<option value="${t}" ${t === st.start ? 'selected' : ''}>${fmtTime(t)}</option>`).join('') : '<option value="">Нет свободного времени</option>';
          const m = MST[mid];
          const day = f.date.value ? m.schedule.week[Store.parseYmd(f.date.value).getDay()] : null;
          $('[data-time-hint]', root).textContent = !f.date.value ? '' : (m.schedule.off || []).includes(f.date.value) ? 'У мастера в этот день выходной.' : day ? `Мастер работает ${fmtTime(day[0])}–${fmtTime(day[1])}. Показано свободное время.` : 'По графику мастер в этот день не работает.';
        };
        fillMasters(); fillTimes();
        f.svc.addEventListener('change', () => { fillMasters(); fillTimes(); });
        f.master.addEventListener('change', () => { st.masterId = +f.master.value; fillTimes(); });
        f.date.addEventListener('change', fillTimes);
        f.time.addEventListener('change', () => { st.start = +f.time.value; });
        if (f.phone) f.phone.addEventListener('input', e => { if (!(e.inputType || '').startsWith('delete')) f.phone.value = fmtPhone(f.phone.value); });
      },
      onSubmit: async f => {
        if (!fieldError(f, 'time', f.time.value ? '' : 'Выберите время или другой день')) return false;
        if (!edit) {
          if (!fieldError(f, 'name', f.name.value.trim().length >= 2 ? '' : 'Напишите имя клиента')) return false;
          if (!fieldError(f, 'phone', phoneDigits(f.phone.value).length === 11 ? '' : 'Номер из 11 цифр, например +7 900 000-00-00')) return false;
        }
        const s = SVC[+f.svc.value], mid = +f.master.value;
        const o = s.masters.find(x => x.id === mid);
        const patch = { masterId: mid, masterName: MST[mid].name, date: f.date.value, start: +f.time.value, dur: o.min, price: o.price, from: o.from };
        if (edit) await Store.updateBooking(edit.id, patch);
        else await Store.addBooking({ ...patch, serviceId: s.id, serviceName: s.name, name: f.name.value.trim(), phone: f.phone.value, comment: f.comment.value.trim(), source: 'admin', status: 'confirmed' });
        await reloadBookings();
        bkDay = Store.parseYmd(f.date.value);
        renderNav(); viewBookings(); Store.hydrate(main, BASE);
        toast(edit ? 'Запись перенесена' : 'Запись добавлена');
      },
    });
  }

  /* =====================================================================
     УСЛУГИ
     ===================================================================== */
  let svcCat = 'all', svcQ = '';
  function viewServices() {
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <h1 class="page__title">Услуги</h1>
        <div class="page__actions">
          <button class="btn btn--line" type="button" data-cats>Разделы</button>
          <button class="btn btn--dark" type="button" data-new-svc>Добавить услугу</button>
        </div>
      </div>
      <p class="page__lead">Цена, время и мастера для каждой услуги. Порядок в списке такой же, как в прайсе на сайте.</p>
      <div class="toolbar">
        <input class="search" type="search" placeholder="Найти услугу" aria-label="Найти услугу" value="${esc(svcQ)}" data-svc-q>
        <div class="chips chips--scroll" role="group" aria-label="Раздел">
          ${[{ key: 'all', title: 'Все' }, ...D.cats].map(c => `<button class="chip" type="button" data-svc-cat="${c.key}" aria-pressed="${svcCat === c.key}">${esc(c.title)}</button>`).join('')}
        </div>
      </div>
      <div data-svc-list></div>
    </section>`;
    fillServiceList();
    $('[data-svc-q]', main).addEventListener('input', e => { svcQ = e.target.value; fillServiceList(); });
  }
  function fillServiceList() {
    const q = svcQ.trim().toLowerCase();
    const groups = D.cats.filter(c => svcCat === 'all' || c.key === svcCat)
      .map(c => [c, D.services.filter(s => s.cat === c.key && (!q || s.name.toLowerCase().includes(q)))])
      .filter(([, l]) => l.length || (!q && svcCat !== 'all'));
    $('[data-svc-list]', main).innerHTML = groups.length ? groups.map(([c, l]) => `
      <h2 class="group-title">${esc(c.title)} · ${l.length}</h2>
      ${l.length ? `<div class="list">${l.map((s, i) => {
        const ms = s.masters.filter(o => MST[o.id]);
        return `<div class="row">
          <button class="row__main" type="button" data-edit-svc="${s.id}">
            <span class="row__name">${esc(s.name)}${s.hidden ? ' <span class="pill-s pill-s--hidden">скрыта</span>' : ''}${ms.length ? '' : ' <span class="pill-s pill-s--cancelled">нет мастеров</span>'}</span>
            <span class="row__sub">${fmtMin(s.min)} · ${ms.length ? ms.map(o => esc(MST[o.id].name.split(' ')[0])).join(', ') : 'никто не делает'}</span>
          </button>
          <span class="row__price">${s.price === 0 ? 'бесплатно' : s.to > s.price ? `${money(s.price)}–${money(s.to)}` : `${s.from ? '<small>от</small> ' : ''}${money(s.price)}`}</span>
          ${q ? '<span></span>' : `<span class="row__move">
            <button class="icon-btn" type="button" data-move-svc="${s.id}" data-dir="-1" aria-label="Поднять «${esc(s.name)}» выше" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
            <button class="icon-btn" type="button" data-move-svc="${s.id}" data-dir="1" aria-label="Опустить «${esc(s.name)}» ниже" ${i === l.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          </span>`}
        </div>`;
      }).join('')}</div>` : '<p class="muted small">В разделе пока нет услуг.</p>'}`).join('')
      : `<div class="empty card"><p>По запросу «${esc(svcQ.trim())}» ничего не нашлось.</p><button class="btn btn--line" type="button" data-svc-reset>Показать все услуги</button></div>`;
  }
  main.addEventListener('click', async e => {
    if (current !== 'services') return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.svcCat) { svcCat = t.dataset.svcCat; $$('[data-svc-cat]', main).forEach(x => x.setAttribute('aria-pressed', String(x === t))); return fillServiceList(); }
    if ('svcReset' in t.dataset) { svcQ = ''; svcCat = 'all'; return viewServices(); }
    if (t.dataset.editSvc) return serviceSheet(SVC[+t.dataset.editSvc]);
    if ('newSvc' in t.dataset) return serviceSheet(null);
    if ('cats' in t.dataset) return catsSheet();
    if (t.dataset.moveSvc) {
      const s = SVC[+t.dataset.moveSvc], dir = +t.dataset.dir;
      const same = D.services.filter(x => x.cat === s.cat);
      const j = same.indexOf(s) + dir;
      if (j < 0 || j >= same.length) return;
      const a = D.services.indexOf(s), b2 = D.services.indexOf(same[j]);
      [D.services[a], D.services[b2]] = [D.services[b2], D.services[a]];
      await commit('Порядок сохранён');
      fillServiceList();
      const again = $(`[data-move-svc="${s.id}"][data-dir="${dir}"]`, main);
      (again && !again.disabled ? again : $(`[data-edit-svc="${s.id}"]`, main)).focus();
    }
  });

  function serviceSheet(s) {
    const isNew = !s;
    const base = s || { id: Date.now(), cat: svcCat !== 'all' ? svcCat : D.cats[0].key, name: '', note: '', price: 0, from: false, min: 60, hidden: false, masters: [] };
    const rows = D.masters.map(m => {
      const o = base.masters.find(x => x.id === m.id);
      return `<div class="mrow" data-mrow="${m.id}" data-sync="${o && (o.price !== base.price || o.min !== base.min) ? 0 : 1}">
        <label class="check"><input type="checkbox" name="m-${m.id}" ${o ? 'checked' : ''}><span>${esc(m.name)}${m.hidden ? ' (скрыт)' : ''}</span></label>
        <input type="number" name="mp-${m.id}" min="0" step="50" value="${o ? o.price : base.price}" aria-label="Цена у мастера ${esc(m.name)}">
        <select class="sel sel--sm" name="mm-${m.id}" aria-label="Время у мастера ${esc(m.name)}">${durOptions(o ? o.min : base.min)}</select>
      </div>`;
    }).join('');
    openSheet({
      title: isNew ? 'Новая услуга' : 'Услуга',
      body: `
        ${field('Название', `<input id="sv-name" name="name" value="${esc(base.name)}" autocomplete="off">`, { err: 'name' })}
        <div class="grid2">
          ${field('Раздел прайса', `<select id="sv-cat" name="cat">${D.cats.map(c => `<option value="${c.key}" ${c.key === base.cat ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>`)}
          ${field('Длительность', `<select id="sv-min" name="min">${durOptions(base.min)}</select>`)}
        </div>
        <div class="grid2">
          ${field('Цена, ₽', `<input id="sv-price" name="price" type="number" min="0" step="50" value="${base.price}">`, { err: 'price', hint: 'Если поставить 0, на сайте будет «бесплатно».' })}
          ${field('Цена до, ₽', `<input id="sv-to" name="to" type="number" min="0" step="50" value="${base.to || ''}" placeholder="необязательно">`, { hint: 'Для цены вилкой, например 3 800–5 200. В записи покажется «от 3 800».' })}
        </div>
        <label class="check check--row"><input type="checkbox" name="from" ${base.from ? 'checked' : ''}><span>Показывать «от» перед ценой</span></label>
        ${field('Описание', `<textarea id="sv-note" name="note" rows="2" placeholder="Например: снятие, маникюр, покрытие">${esc(base.note)}</textarea>`, { hint: 'Показывается под названием в прайсе.' })}
        <div class="field">
          <span>Кто делает</span>
          <p class="field__hint">Отметьте мастеров. Если у мастера другая цена или время, поменяйте их в строке.</p>
          <div class="mrows">${rows}</div>
          <p class="field__err" data-err="masters"></p>
        </div>
        <label class="check check--row"><input type="checkbox" name="visible" ${base.hidden ? '' : 'checked'}><span>Показывать на сайте и в записи</span></label>`,
      del: isNew ? null : { label: 'Удалить услугу', run: async () => {
        const fut = B.filter(b => b.serviceId === base.id && b.status !== 'cancelled' && b.date >= Store.ymd(new Date())).length;
        if (!(await ask(`Удалить «${base.name}»? ${fut ? `На неё ${fut} ${plural(fut, 'будущая запись', 'будущие записи', 'будущих записей')}, они останутся в списке записей. ` : ''}Вместо удаления можно скрыть услугу.`))) return;
        D.services = D.services.filter(x => x.id !== base.id);
        D.posters.forEach(p => { p.items = p.items.filter(it => it.id !== base.id); });
        D.texts.heroPrices.forEach(h => { h.ids = h.ids.filter(id => id !== base.id); });
        await commit('Услуга удалена');
        closeSheet(); viewServices();
      } },
      onOpen: () => {
        const f = sheetForm;
        // общая цена и время подтягиваются в строки мастеров, пока их не меняли вручную
        const sync = () => $$('[data-mrow]', sheetBody).forEach(r => {
          if (r.dataset.sync !== '1') return;
          $('input[type=number]', r).value = f.price.value;
          $('select', r).value = f.min.value;
        });
        f.price.addEventListener('input', sync);
        f.min.addEventListener('change', sync);
        $$('[data-mrow]', sheetBody).forEach(r => {
          $$('input[type=number], select', r).forEach(el => el.addEventListener('input', () => { r.dataset.sync = '0'; }));
        });
      },
      onSubmit: async f => {
        const name = f.name.value.trim();
        if (!fieldError(f, 'name', name ? '' : 'Напишите название услуги')) return false;
        const price = Math.max(0, Math.round(+f.price.value || 0));
        const hi = Math.round(+f.to.value || 0);
        const to = hi > price ? hi : 0;
        // при вилке цен в записи пишем «от»
        const from = f.from.checked || to > 0;
        const masters = D.masters.filter(m => f[`m-${m.id}`].checked).map(m => ({
          id: m.id, price: Math.max(0, Math.round(+f[`mp-${m.id}`].value || 0)), min: +f[`mm-${m.id}`].value, from,
        }));
        const visible = f.visible.checked;
        if (visible && !masters.length && !fieldError(f, 'masters', 'Отметьте хотя бы одного мастера, иначе на услугу нельзя записаться')) {
          $('[name^="m-"]', sheetBody).focus();
          return false;
        }
        const next = { ...base, name, cat: f.cat.value, min: +f.min.value, price, to, from, note: f.note.value.trim(), masters, hidden: !visible };
        if (isNew) D.services.push(next);
        else D.services[D.services.indexOf(base)] = next;
        await commit(isNew ? 'Услуга добавлена' : 'Услуга сохранена');
        fillServiceList();
      },
    });
  }

  function catsSheet() {
    let cats = D.cats.map(c => ({ ...c }));
    const draw = () => {
      $('[data-cats-list]', sheetBody).innerHTML = cats.map((c, i) => {
        const n = D.services.filter(s => s.cat === c.key).length;
        return `<div class="list-edit__row">
          <div class="list-edit__fields">
            <input name="cat-${i}" value="${esc(c.title)}" aria-label="Название раздела ${i + 1}" data-cat-i="${i}">
            <span class="small muted">${n} ${plural(n, 'услуга', 'услуги', 'услуг')}</span>
          </div>
          <div class="list-edit__ctl">
            <button class="icon-btn" type="button" data-sheet-act="up" data-i="${i}" aria-label="Выше" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
            <button class="icon-btn" type="button" data-sheet-act="down" data-i="${i}" aria-label="Ниже" ${i === cats.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
            ${n ? '' : `<button class="icon-btn" type="button" data-sheet-act="del" data-i="${i}" aria-label="Удалить раздел">${ICON.x}</button>`}
          </div>
        </div>`;
      }).join('');
    };
    const read = () => $$('[data-cat-i]', sheetBody).forEach(el => { cats[+el.dataset.catI].title = el.value; });
    const move = (i, d) => { read(); const j = i + d; [cats[i], cats[j]] = [cats[j], cats[i]]; draw(); };
    openSheet({
      title: 'Разделы прайса',
      body: `<p class="muted small">Разделы идут в прайсе на сайте в этом порядке. Удалить можно только пустой раздел: сначала перенесите из него услуги.</p>
        <div class="list-edit" data-cats-list></div>
        <button class="btn btn--line" type="button" data-sheet-act="add">Добавить раздел</button>`,
      onOpen: draw,
      acts: {
        up: t => move(+t.dataset.i, -1),
        down: t => move(+t.dataset.i, 1),
        del: t => { read(); cats.splice(+t.dataset.i, 1); draw(); },
        add: () => { read(); cats.push({ key: 'c' + Date.now().toString(36), title: 'Новый раздел' }); draw(); const els = $$('[data-cat-i]', sheetBody); els[els.length - 1].select(); },
      },
      onSubmit: async () => {
        read();
        D.cats = cats.map(c => ({ ...c, title: c.title.trim() || 'Без названия' }));
        await commit('Разделы сохранены');
        viewServices();
      },
    });
  }

  /* =====================================================================
     МАСТЕРА
     ===================================================================== */
  const workDays = m => [1, 2, 3, 4, 5, 6, 0].filter(d => m.schedule.week[d]).map(d => WD[d]).join(', ') || 'не работает';
  function viewMasters() {
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <h1 class="page__title">Мастера</h1>
        <div class="page__actions"><button class="btn btn--dark" type="button" data-new-master>Добавить мастера</button></div>
      </div>
      <div class="mgrid">
        ${D.masters.map(m => {
          const n = D.services.filter(s => s.masters.some(o => o.id === m.id)).length;
          return `<button class="mcard" type="button" data-edit-master="${m.id}">
            ${m.photo ? `<img class="mcard__photo" ${src(m.photo)} alt="" width="560" height="420" loading="lazy">` : `<span class="mcard__mono">${mark}</span>`}
            <span class="mcard__body">
              <span class="mcard__name">${esc(m.name)}${m.hidden ? ' <span class="pill-s pill-s--hidden">скрыт</span>' : ''}</span>
              <span class="mcard__sub">${esc(m.role)}</span>
              <span class="mcard__sub">${n} ${plural(n, 'услуга', 'услуги', 'услуг')} · ${workDays(m)}</span>
            </span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
  }
  main.addEventListener('click', e => {
    if (current !== 'masters') return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.editMaster) masterSheet(MST[+t.dataset.editMaster]);
    if ('newMaster' in t.dataset) masterSheet(null);
  });

  function masterSheet(m) {
    const isNew = !m;
    const H = (a, b) => [a * 60, b * 60];
    const base = m || { id: Date.now(), slug: '', name: '', short: '', role: '', about: '', rating: 5, reviews: 0, photo: null, hidden: false, schedule: { week: { 0: null, 1: H(10, 20), 2: H(10, 20), 3: H(10, 20), 4: H(10, 20), 5: H(10, 20), 6: null }, off: [] } };
    let photo = base.photo;
    const has = s => s.masters.some(o => o.id === base.id);
    const svcChecks = D.cats.map(c => {
      const l = D.services.filter(s => s.cat === c.key);
      return l.length ? `<div class="checks__group">${esc(c.title)}</div>${l.map(s => `<label class="check" data-svc-name="${esc(s.name.toLowerCase())}"><input type="checkbox" name="s-${s.id}" ${has(s) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}` : '';
    }).join('');
    const photoHtml = () => photo ? `<img class="photo-field__img" ${src(photo)} alt="Фото мастера">` : `<span class="photo-field__img mcard__mono" style="aspect-ratio:4/5">${mark}</span>`;
    openSheet({
      title: isNew ? 'Новый мастер' : 'Мастер',
      body: `
        <div class="photo-field">
          <div data-photo>${photoHtml()}</div>
          <div class="photo-field__btns">
            <label class="btn btn--line btn--sm file-btn">Загрузить фото<input type="file" accept="image/*" data-photo-input aria-label="Загрузить фото мастера"></label>
            <button class="btn btn--ghost btn--sm" type="button" data-sheet-act="nophoto">Убрать фото</button>
            <p class="field__hint">Лучше вертикальное фото, лицо по центру.</p>
          </div>
        </div>
        ${field('Имя и фамилия', `<input id="ms-name" name="name" value="${esc(base.name)}" autocomplete="off">`, { err: 'name' })}
        ${field('На кнопке записи', `<input id="ms-short" name="short" value="${esc(base.short)}" placeholder="Насте" autocomplete="off">`, { hint: 'Как продолжить «Записаться к …»: Насте, Анастасии, Дарье.' })}
        ${field('Должность', `<input id="ms-role" name="role" value="${esc(base.role)}" placeholder="Мастер маникюра" autocomplete="off">`)}
        ${field('О мастере', `<textarea id="ms-about" name="about" rows="3">${esc(base.about)}</textarea>`)}
        <div class="grid2">
          ${field('Рейтинг', `<input id="ms-rating" name="rating" type="number" min="0" max="5" step="0.1" value="${base.rating}">`)}
          ${field('Отзывов', `<input id="ms-reviews" name="reviews" type="number" min="0" step="1" value="${base.reviews}">`, { hint: 'Если 0, рейтинг на сайте не показывается.' })}
        </div>
        <label class="check check--row"><input type="checkbox" name="visible" ${base.hidden ? '' : 'checked'}><span>Показывать на сайте и в записи</span></label>
        <div class="field">
          <span>Какие услуги делает</span>
          <input class="search" type="search" placeholder="Найти услугу" aria-label="Найти услугу в списке" data-svc-filter>
          <div class="checks">${svcChecks}</div>
          <p class="field__hint">Цена и время у новых услуг берутся из общих. Поменять их для мастера можно в разделе «Услуги».</p>
        </div>
        ${isNew ? '' : `<a class="link-btn" href="#schedule" data-goto-schedule="${base.id}">График этого мастера</a>`}`,
      del: isNew ? null : { label: 'Удалить мастера', run: async () => {
        const fut = B.filter(b => b.masterId === base.id && b.status !== 'cancelled' && b.date >= Store.ymd(new Date())).length;
        if (!(await ask(`Удалить мастера ${base.name}? ${fut ? `У него ${fut} ${plural(fut, 'будущая запись', 'будущие записи', 'будущих записей')}, они останутся в списке. ` : ''}Если мастер в отпуске, лучше поставить выходные в графике или скрыть его.`))) return;
        D.masters = D.masters.filter(x => x.id !== base.id);
        D.services.forEach(s => { s.masters = s.masters.filter(o => o.id !== base.id); });
        await commit('Мастер удалён');
        closeSheet(); viewMasters(); Store.hydrate(main, BASE);
      } },
      acts: {
        nophoto: () => { photo = null; $('[data-photo]', sheetBody).innerHTML = photoHtml(); },
      },
      onOpen: root => {
        $('[data-photo-input]', root).addEventListener('change', async e => {
          const f = e.target.files[0];
          if (!f) return;
          try {
            photo = (await upload(f, 900)).ref;
            $('[data-photo]', root).innerHTML = photoHtml();
            Store.hydrate(root, BASE);
          } catch (err) { toast(err.message); }
        });
        $('[data-svc-filter]', root).addEventListener('input', e => {
          const q = e.target.value.trim().toLowerCase();
          $$('[data-svc-name]', root).forEach(l => { l.hidden = !!q && !l.dataset.svcName.includes(q); });
        });
        const g = $('[data-goto-schedule]', root);
        if (g) g.addEventListener('click', () => { schMaster = base.id; });
      },
      onSubmit: async f => {
        const name = f.name.value.trim();
        if (!fieldError(f, 'name', name ? '' : 'Напишите имя мастера')) return false;
        const next = {
          ...base, name, short: f.short.value.trim() || name.split(' ')[0], role: f.role.value.trim(), about: f.about.value.trim(),
          rating: Math.min(5, Math.max(0, +f.rating.value || 0)), reviews: Math.max(0, Math.round(+f.reviews.value || 0)),
          photo, hidden: !f.visible.checked,
        };
        if (isNew) D.masters.push(next); else D.masters[D.masters.indexOf(base)] = next;
        D.services.forEach(s => {
          const on = f[`s-${s.id}`].checked, i = s.masters.findIndex(o => o.id === base.id);
          if (on && i < 0) s.masters.push({ id: base.id, price: s.price, min: s.min, from: s.from });
          if (!on && i >= 0) s.masters.splice(i, 1);
        });
        await commit(isNew ? 'Мастер добавлен' : 'Мастер сохранён');
        viewMasters(); Store.hydrate(main, BASE);
      },
    });
  }

  /* =====================================================================
     ГРАФИК
     ===================================================================== */
  let schMaster = null;
  function viewSchedule() {
    if (!MST[schMaster]) schMaster = D.masters[0] && D.masters[0].id;
    const m = MST[schMaster];
    if (!m) { main.innerHTML = '<section class="page"><h1 class="page__title">График</h1><p class="empty">Сначала добавьте мастера.</p></section>'; return; }
    const week = JSON.parse(JSON.stringify(m.schedule.week));
    const today = new Date();
    const offs = (m.schedule.off || []).filter(d => d >= Store.ymd(today)).sort();
    const cal = [];
    for (let i = 0; i < 14; i++) {
      const d = Store.addDays(today, i), k = Store.ymd(d), w = m.schedule.week[d.getDay()];
      const off = (m.schedule.off || []).includes(k);
      const n = B.filter(b => b.masterId === m.id && b.date === k && b.status !== 'cancelled').length;
      cal.push(`<div class="cal__d ${w && !off ? 'cal__d--work' : 'cal__d--off'}"><span>${WD[d.getDay()]}</span><b>${d.getDate()}</b><span>${off ? 'выходной' : w ? `${fmtTime(w[0])}–${fmtTime(w[1])}` : 'не работает'}</span>${n ? `<span>${n} ${plural(n, 'запись', 'записи', 'записей')}</span>` : ''}</div>`);
    }
    main.innerHTML = `<section class="page">
      <div class="page__head"><h1 class="page__title">График</h1></div>
      <p class="page__lead">По графику сайт показывает клиентам свободное время. Уже занятые часы в запись не попадают.</p>
      <div class="toolbar">
        <div class="chips chips--scroll" role="group" aria-label="Мастер">
          ${D.masters.map(x => `<button class="chip" type="button" data-sch-master="${x.id}" aria-pressed="${x.id === m.id}">${esc(x.name)}</button>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Рабочая неделя</h2></div>
        <div class="card__body">
          <div class="week">
            ${[1, 2, 3, 4, 5, 6, 0].map(d => {
              const w = week[d];
              return `<div class="week__row">
                <label class="check check--row"><input type="checkbox" data-wd="${d}" ${w ? 'checked' : ''}><span>${WD_FULL[d]}</span></label>
                <div class="week__times">
                  <select class="sel sel--sm" data-wf="${d}" aria-label="${WD_FULL[d]}, начало" ${w ? '' : 'disabled'}>${timeOptions(w ? w[0] : 600)}</select>
                  <span aria-hidden="true">–</span>
                  <select class="sel sel--sm" data-wt="${d}" aria-label="${WD_FULL[d]}, конец" ${w ? '' : 'disabled'}>${timeOptions(w ? w[1] : 1200)}</select>
                </div>
              </div>`;
            }).join('')}
          </div>
          <p class="field__err" data-week-err></p>
          ${savebar('Сохранить график')}
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Выходные и отпуск</h2></div>
        <div class="card__body">
          <div class="grid2">
            ${field('Дата', `<input id="off-date" type="date" min="${Store.ymd(today)}" data-off-date>`)}
            <div class="field"><span class="field__hint" aria-hidden="true">&nbsp;</span><button class="btn btn--line" type="button" data-off-add>Добавить выходной</button></div>
          </div>
          ${offs.length ? `<div class="offs">${offs.map(k => { const d = Store.parseYmd(k); return `<span class="off">${WD[d.getDay()]}, ${fmtDate(d)}<button class="icon-btn" type="button" data-off-del="${k}" aria-label="Убрать выходной ${fmtDate(d)}">${ICON.x}</button></span>`; }).join('')}</div>` : '<p class="muted small">Дополнительных выходных нет.</p>'}
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Ближайшие две недели</h2></div>
        <div class="card__body"><div class="cal">${cal.join('')}</div></div>
      </div>
    </section>`;

    const readWeek = () => {
      const w = {};
      for (const d of [0, 1, 2, 3, 4, 5, 6]) {
        w[d] = $(`[data-wd="${d}"]`, main).checked ? [+$(`[data-wf="${d}"]`, main).value, +$(`[data-wt="${d}"]`, main).value] : null;
      }
      return w;
    };
    main.querySelectorAll('[data-wd], [data-wf], [data-wt]').forEach(el => el.addEventListener('change', () => {
      if (el.dataset.wd) { $(`[data-wf="${el.dataset.wd}"]`, main).disabled = !el.checked; $(`[data-wt="${el.dataset.wd}"]`, main).disabled = !el.checked; }
      markDirty();
    }));
    $('[data-save]', main).addEventListener('click', async () => {
      const w = readWeek();
      const bad = Object.entries(w).find(([, v]) => v && v[1] <= v[0]);
      $('[data-week-err]', main).textContent = bad ? `${WD_FULL[bad[0]]}: конец рабочего дня должен быть позже начала.` : '';
      if (bad) return $(`[data-wt="${bad[0]}"]`, main).focus();
      m.schedule.week = w;
      dirty = false;
      await commit('График сохранён');
      viewSchedule();
    });
  }
  main.addEventListener('click', async e => {
    if (current !== 'schedule') return;
    const t = e.target.closest('button');
    if (!t) return;
    const m = MST[schMaster];
    if (t.dataset.schMaster) {
      if (dirty && !(await ask('График не сохранён. Переключиться без сохранения?', 'Переключиться', false))) return;
      dirty = false; schMaster = +t.dataset.schMaster; viewSchedule();
      return $('[data-sch-master][aria-pressed="true"]', main).focus();
    }
    if ('offAdd' in t.dataset) {
      const v = $('[data-off-date]', main).value;
      if (!v) return $('[data-off-date]', main).focus();
      const busy = B.filter(b => b.masterId === m.id && b.date === v && b.status !== 'cancelled').length;
      if (busy && !(await ask(`На ${fmtDate(Store.parseYmd(v))} у мастера ${busy} ${plural(busy, 'запись', 'записи', 'записей')}. Записи останутся, их нужно перенести или отменить в разделе «Записи». Поставить выходной?`, 'Поставить выходной', false))) return;
      m.schedule.off = [...new Set([...(m.schedule.off || []), v])];
      await commit('Выходной добавлен'); viewSchedule();
    }
    if (t.dataset.offDel) {
      m.schedule.off = (m.schedule.off || []).filter(d => d !== t.dataset.offDel);
      await commit('Выходной убран'); viewSchedule();
    }
  });

  /* =====================================================================
     РАБОТЫ (фото и видео)
     ===================================================================== */
  let workCat = 'all';
  const uploadTile = (accept, label, hint, multi = true) => `<label class="upload">${label}<small>${hint}</small><input type="file" accept="${accept}" ${multi ? 'multiple' : ''} data-upload aria-label="${label}"></label>`;
  function viewWorks() {
    const cats = D.workCats || [];
    const list = D.works.filter(w => workCat === 'all' || w.cat === workCat);
    const catTitle = k => (cats.find(c => c.key === k) || {}).title || 'Без раздела';
    main.innerHTML = `<section class="page">
      <div class="page__head"><h1 class="page__title">Работы</h1></div>
      <p class="page__lead">Фото и видео в разделе «Работы» на сайте. Порядок такой же, как здесь. Нажмите на работу, чтобы подписать её или удалить.</p>
      <div class="toolbar">
        <div class="chips chips--scroll" role="group" aria-label="Раздел">
          ${[{ key: 'all', title: 'Все' }, ...cats].map(c => `<button class="chip" type="button" data-work-cat="${c.key}" aria-pressed="${workCat === c.key}">${esc(c.title)}</button>`).join('')}
        </div>
      </div>
      <div class="wgrid">
        ${uploadTile('image/*,video/*', 'Добавить фото или видео', 'можно несколько сразу')}
        ${list.map(w => `<button class="wtile" type="button" data-edit-work="${w.id}" aria-label="${esc(w.alt || 'Работа без описания')}, ${catTitle(w.cat)}">
          ${w.type === 'video' ? `<video ${src(w.src)} muted playsinline preload="metadata"></video><span class="wtile__video">видео</span>` : `<img ${src(w.src)} alt="" loading="lazy">`}
          <span class="wtile__tag">${esc(catTitle(w.cat))}</span>
        </button>`).join('')}
      </div>
    </section>`;
  }
  main.addEventListener('click', e => {
    if (current !== 'works') return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.workCat) { workCat = t.dataset.workCat; viewWorks(); Store.hydrate(main, BASE); return $('[data-work-cat][aria-pressed="true"]', main).focus(); }
    if (t.dataset.editWork) workSheet(D.works.find(w => w.id === t.dataset.editWork));
  });
  main.addEventListener('change', async e => {
    const inp = e.target.closest('[data-upload]');
    if (!inp || !inp.files.length) return;
    const files = [...inp.files];
    toast(`Загружаем ${files.length} ${plural(files.length, 'файл', 'файла', 'файлов')}…`);
    const added = [];
    for (const f of files) {
      try {
        const r = await upload(f, current === 'works' ? 1400 : 1600);
        if (current === 'works') {
          const cat = workCat !== 'all' ? workCat : (D.workCats[0] || {}).key;
          added.push({ id: 'w' + Store.uid(), type: r.type, src: r.ref, cat, book: D.cats.some(c => c.key === cat) ? cat : 'all', alt: '' });
        } else if (r.type === 'image') {
          added.push({ id: 'in' + Store.uid(), src: r.ref, alt: '' });
        }
      } catch (err) { toast(err.message); }
    }
    if (!added.length) return;
    if (current === 'works') D.works.unshift(...added); else D.interior.push(...added);
    await commit(`Добавлено: ${added.length}`);
    route(true);
    // одно фото: сразу предлагаем подписать
    if (added.length === 1) (current === 'works' ? workSheet : interiorSheet)(added[0]);
  });

  const moveIn = (arr, item, dir) => {
    const i = arr.indexOf(item), j = i + dir;
    if (j < 0 || j >= arr.length) return false;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    return true;
  };
  function workSheet(w) {
    const i = D.works.indexOf(w);
    openSheet({
      title: w.type === 'video' ? 'Видео' : 'Фото работы',
      body: `
        ${w.type === 'video' ? `<video class="preview" ${src(w.src)} controls playsinline></video>` : `<img class="preview" ${src(w.src)} alt="">`}
        ${field('Описание', `<textarea id="wk-alt" name="alt" rows="2" placeholder="Например: молочный маникюр с сухоцветами">${esc(w.alt)}</textarea>`, { hint: 'Его видят в просмотре работы, читают незрячие посетители и поисковики.' })}
        <div class="grid2">
          ${field('Раздел работ', `<select id="wk-cat" name="cat">${(D.workCats || []).map(c => `<option value="${c.key}" ${c.key === w.cat ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>`)}
          ${field('«Хочу так же» открывает', `<select id="wk-book" name="book"><option value="all">все услуги</option>${D.cats.map(c => `<option value="${c.key}" ${c.key === w.book ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>`)}
        </div>
        <div class="field"><span>Порядок</span><div class="photo-field__btns">
          <button class="btn btn--line btn--sm" type="button" data-sheet-act="first" ${i === 0 ? 'disabled' : ''}>Поставить первой</button>
          <button class="btn btn--line btn--sm" type="button" data-sheet-act="prev" ${i === 0 ? 'disabled' : ''}>Раньше</button>
          <button class="btn btn--line btn--sm" type="button" data-sheet-act="next" ${i === D.works.length - 1 ? 'disabled' : ''}>Позже</button>
        </div></div>`,
      del: { label: w.type === 'video' ? 'Удалить видео' : 'Удалить фото', run: async () => {
        if (!(await ask('Удалить эту работу с сайта?'))) return;
        D.works = D.works.filter(x => x !== w);
        await commit('Удалено'); closeSheet(); viewWorks(); Store.hydrate(main, BASE);
      } },
      acts: {
        first: async () => { D.works.splice(D.works.indexOf(w), 1); D.works.unshift(w); await commit('Работа стоит первой'); closeSheet(); viewWorks(); Store.hydrate(main, BASE); },
        prev: async () => { moveIn(D.works, w, -1); await commit('Порядок сохранён'); viewWorks(); Store.hydrate(main, BASE); workSheet(w); },
        next: async () => { moveIn(D.works, w, 1); await commit('Порядок сохранён'); viewWorks(); Store.hydrate(main, BASE); workSheet(w); },
      },
      onSubmit: async f => {
        Object.assign(w, { alt: f.alt.value.trim(), cat: f.cat.value, book: f.book.value });
        await commit(); viewWorks(); Store.hydrate(main, BASE);
      },
    });
  }

  /* =====================================================================
     ФОТО САЛОНА
     ===================================================================== */
  function viewInterior() {
    main.innerHTML = `<section class="page">
      <div class="page__head"><h1 class="page__title">Фото салона</h1></div>
      <p class="page__lead">Блок «О салоне» на сайте показывает первые 6 фото. Первое самое крупное.</p>
      <div class="wgrid">
        ${D.interior.map((p, i) => `<button class="wtile" type="button" data-edit-in="${p.id}" aria-label="${esc(p.alt || 'Фото без описания')}${i < 6 ? '' : ', не показывается на сайте'}">
          <img ${src(p.src)} alt="" loading="lazy"><span class="wtile__tag">${i < 6 ? (i === 0 ? 'крупное' : 'на сайте') : 'в запасе'}</span>
        </button>`).join('')}
        ${uploadTile('image/*', 'Добавить фото', 'можно несколько сразу')}
      </div>
    </section>`;
  }
  main.addEventListener('click', e => {
    if (current !== 'interior') return;
    const t = e.target.closest('[data-edit-in]');
    if (t) interiorSheet(D.interior.find(p => p.id === t.dataset.editIn));
  });
  function interiorSheet(p) {
    const i = D.interior.indexOf(p);
    openSheet({
      title: 'Фото салона',
      body: `<img class="preview" ${src(p.src)} alt="">
        ${field('Описание', `<input id="in-alt" name="alt" value="${esc(p.alt)}" placeholder="Например: зона ожидания">`, { hint: 'Читают незрячие посетители и поисковики.' })}
        <div class="field"><span>Порядок</span><div class="photo-field__btns">
          <button class="btn btn--line btn--sm" type="button" data-sheet-act="prev" ${i === 0 ? 'disabled' : ''}>Раньше</button>
          <button class="btn btn--line btn--sm" type="button" data-sheet-act="next" ${i === D.interior.length - 1 ? 'disabled' : ''}>Позже</button>
        </div></div>`,
      del: { label: 'Удалить фото', run: async () => {
        if (!(await ask('Удалить это фото с сайта?'))) return;
        D.interior = D.interior.filter(x => x !== p);
        await commit('Фото удалено'); closeSheet(); viewInterior(); Store.hydrate(main, BASE);
      } },
      acts: {
        prev: async () => { moveIn(D.interior, p, -1); await commit('Порядок сохранён'); viewInterior(); Store.hydrate(main, BASE); interiorSheet(p); },
        next: async () => { moveIn(D.interior, p, 1); await commit('Порядок сохранён'); viewInterior(); Store.hydrate(main, BASE); interiorSheet(p); },
      },
      onSubmit: async f => { p.alt = f.alt.value.trim(); await commit(); viewInterior(); Store.hydrate(main, BASE); },
    });
  }

  /* =====================================================================
     ПРАЙС-ЛИСТЫ (фирменные блоки маникюра и завивки)
     ===================================================================== */
  function viewPosters() {
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <h1 class="page__title">Прайс-листы</h1>
        <div class="page__actions"><button class="btn btn--dark" type="button" data-new-poster>Добавить прайс-лист</button></div>
      </div>
      <p class="page__lead">Блоки в стиле ваших прайс-листов под первым экраном. Цены берутся из услуг, поэтому меняются вместе с прайсом.</p>
      ${D.posters.length ? D.posters.map((p, i) => `<div class="card">
        <div class="card__head"><h2 class="card__title">${esc(p.title)} · ${esc(p.sub)}</h2>
          <span class="row__move">
            <button class="icon-btn" type="button" data-move-poster="${i}" data-dir="-1" aria-label="Выше" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
            <button class="icon-btn" type="button" data-move-poster="${i}" data-dir="1" aria-label="Ниже" ${i === D.posters.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          </span>
        </div>
        <div class="card__body">
          <div class="photo-field">
            <img class="photo-field__img" ${src(p.photo)} alt="">
            <div>${p.items.map(it => { const s = SVC[it.id]; return s ? `<p><b>${esc(it.name || s.name)}</b> <span class="muted">${priceTxt(s.price, false)}</span></p>` : ''; }).join('')}</div>
          </div>
          <div><button class="btn btn--line" type="button" data-edit-poster="${i}">Изменить</button></div>
        </div>
      </div>`).join('') : '<div class="empty card"><p>Прайс-листов нет, блок на сайте скрыт.</p></div>'}
    </section>`;
  }
  main.addEventListener('click', async e => {
    if (current !== 'posters') return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.editPoster) posterSheet(D.posters[+t.dataset.editPoster]);
    if ('newPoster' in t.dataset) posterSheet(null);
    if (t.dataset.movePoster) {
      const p = D.posters[+t.dataset.movePoster];
      if (moveIn(D.posters, p, +t.dataset.dir)) { await commit('Порядок сохранён'); viewPosters(); Store.hydrate(main, BASE); }
    }
  });
  function posterSheet(p) {
    const isNew = !p;
    const base = p ? JSON.parse(JSON.stringify(p)) : { key: D.cats[0].key, title: 'Price list', sub: '', photo: 'assets/img/work-05.webp', photoAlt: '', handle: '', items: [] };
    let photo = base.photo;
    let items = base.items.map(x => ({ ...x }));
    const svcOptions = sel => D.cats.map(c => {
      const l = D.services.filter(s => s.cat === c.key);
      return l.length ? `<optgroup label="${esc(c.title)}">${l.map(s => `<option value="${s.id}" ${s.id === sel ? 'selected' : ''}>${esc(s.name)} · ${priceTxt(s.price, s.from)}</option>`).join('')}</optgroup>` : '';
    }).join('');
    const drawItems = () => {
      $('[data-items]', sheetBody).innerHTML = items.length ? items.map((it, i) => `<div class="list-edit__row">
        <div class="list-edit__fields">
          <select class="sel" data-it-svc="${i}" aria-label="Услуга ${i + 1}">${svcOptions(it.id)}</select>
          <input data-it-name="${i}" value="${esc(it.name || '')}" placeholder="Название на прайсе, например «Комбо 1»" aria-label="Название на прайсе ${i + 1}">
          <input data-it-note="${i}" value="${esc(it.note || '')}" placeholder="Что входит (необязательно)" aria-label="Что входит ${i + 1}">
        </div>
        <div class="list-edit__ctl">
          <button class="icon-btn" type="button" data-sheet-act="up" data-i="${i}" aria-label="Выше" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="icon-btn" type="button" data-sheet-act="down" data-i="${i}" aria-label="Ниже" ${i === items.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <button class="icon-btn" type="button" data-sheet-act="del" data-i="${i}" aria-label="Убрать пункт">${ICON.x}</button>
        </div>
      </div>`).join('') : '<p class="muted small">Пунктов пока нет.</p>';
    };
    const readItems = () => { items = items.map((it, i) => ({ id: +$(`[data-it-svc="${i}"]`, sheetBody).value, name: $(`[data-it-name="${i}"]`, sheetBody).value.trim(), note: $(`[data-it-note="${i}"]`, sheetBody).value.trim() })); };
    const photoHtml = () => `<img class="photo-field__img" ${src(photo)} alt="">`;
    openSheet({
      title: isNew ? 'Новый прайс-лист' : 'Прайс-лист',
      body: `
        <div class="grid2">
          ${field('Заголовок', `<input id="ps-title" name="title" value="${esc(base.title)}">`, { hint: 'Крупными белыми буквами, как на ваших прайсах.' })}
          ${field('Подпись', `<input id="ps-sub" name="sub" value="${esc(base.sub)}" placeholder="маникюр">`)}
        </div>
        <div class="photo-field">
          <div data-photo>${photoHtml()}</div>
          <div class="photo-field__btns">
            <label class="btn btn--line btn--sm file-btn">Заменить фото<input type="file" accept="image/*" data-photo-input aria-label="Заменить фото прайс-листа"></label>
          </div>
        </div>
        ${field('Описание фото', `<input id="ps-alt" name="alt" value="${esc(base.photoAlt)}">`)}
        <div class="grid2">
          ${field('Instagram', `<input id="ps-handle" name="handle" value="${esc(base.handle || '')}" placeholder="hair.curl_studio">`, { hint: 'Без @. Можно оставить пустым.' })}
          ${field('Кнопка «Записаться» открывает', `<select id="ps-key" name="key">${D.cats.map(c => `<option value="${c.key}" ${c.key === base.key ? 'selected' : ''}>${esc(c.title)}</option>`).join('')}</select>`)}
        </div>
        <div class="field"><span>Пункты</span><p class="field__hint">Цена подставляется из услуги.</p><div class="list-edit" data-items></div>
          <button class="btn btn--line btn--sm" type="button" data-sheet-act="add" style="justify-self:start">Добавить пункт</button></div>`,
      del: isNew ? null : { label: 'Удалить прайс-лист', run: async () => {
        if (!(await ask(`Удалить прайс-лист «${base.title} ${base.sub}»?`))) return;
        D.posters = D.posters.filter(x => x !== p);
        await commit('Прайс-лист удалён'); closeSheet(); viewPosters(); Store.hydrate(main, BASE);
      } },
      acts: {
        add: () => { readItems(); items.push({ id: D.services[0].id, name: '', note: '' }); drawItems(); },
        del: t => { readItems(); items.splice(+t.dataset.i, 1); drawItems(); },
        up: t => { readItems(); const i = +t.dataset.i; [items[i - 1], items[i]] = [items[i], items[i - 1]]; drawItems(); },
        down: t => { readItems(); const i = +t.dataset.i; [items[i + 1], items[i]] = [items[i], items[i + 1]]; drawItems(); },
      },
      onOpen: root => {
        drawItems();
        $('[data-photo-input]', root).addEventListener('change', async e => {
          const f = e.target.files[0];
          if (!f) return;
          try { photo = (await upload(f, 1200)).ref; $('[data-photo]', root).innerHTML = photoHtml(); Store.hydrate(root, BASE); } catch (err) { toast(err.message); }
        });
      },
      onSubmit: async f => {
        readItems();
        const next = { ...base, title: f.title.value.trim() || 'Price list', sub: f.sub.value.trim(), photo, photoAlt: f.alt.value.trim(), handle: f.handle.value.trim().replace(/^@/, ''), key: f.key.value, items };
        if (isNew) D.posters.push(next); else D.posters[D.posters.indexOf(p)] = next;
        await commit(isNew ? 'Прайс-лист добавлен' : 'Прайс-лист сохранён');
        viewPosters(); Store.hydrate(main, BASE);
      },
    });
  }

  /* =====================================================================
     ТЕКСТЫ И КОНТАКТЫ
     ===================================================================== */
  function viewSite() {
    const T = D.texts, S = D.salon;
    const inp = (name, val, label, opts = {}) => field(label, `<input id="st-${name}" name="${name}" value="${esc(val)}" ${opts.type ? `type="${opts.type}"` : ''} ${opts.attrs || ''}>`, opts);
    main.innerHTML = `<form class="page" novalidate data-site-form>
      <div class="page__head"><h1 class="page__title">Тексты и контакты</h1></div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Первый экран</h2></div>
        <div class="card__body">
          ${inp('heroWhere', T.heroWhere, 'Строка под «Салон красоты»')}
          <div class="field"><span>Цены на первом экране</span>
            <p class="field__hint">Показывается самая низкая цена из выбранных услуг, с «от», если цены разные.</p>
            <div class="list-edit" data-hero-list></div>
            <button class="btn btn--line btn--sm" type="button" data-hero-add style="justify-self:start">Добавить строку</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Блок прайс-листов</h2></div>
        <div class="card__body">
          ${inp('postersTitle', T.postersTitle, 'Заголовок')}
          ${field('Подзаголовок', `<textarea id="st-postersLead" name="postersLead" rows="2">${esc(T.postersLead)}</textarea>`)}
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">О салоне</h2></div>
        <div class="card__body">
          ${inp('aboutTitle', T.aboutTitle, 'Заголовок')}
          ${T.about.map((p, i) => field(`Абзац ${i + 1}`, `<textarea id="st-about-${i}" name="about-${i}" rows="3">${esc(p)}</textarea>`)).join('')}
          <div class="field"><span>Список преимуществ</span><div class="list-edit" data-facts-list></div>
            <button class="btn btn--line btn--sm" type="button" data-fact-add style="justify-self:start">Добавить пункт</button></div>
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Контакты</h2></div>
        <div class="card__body">
          ${inp('address', S.address, 'Адрес')}
          ${inp('addressNote', S.addressNote, 'Уточнение к адресу', { attrs: 'placeholder="цокольный этаж"' })}
          <div class="grid2">${inp('metro', S.metro, 'Метро')}${inp('metroWalk', S.metroWalk, 'Сколько идти от метро')}</div>
          ${inp('hours', S.hours, 'Часы работы', { hint: 'Это текст для сайта. Время для записи задаётся в графике мастеров.' })}
          ${inp('phone', S.phone, 'Телефон', { type: 'tel' })}
          <div class="grid2">${inp('whatsapp', S.whatsapp, 'WhatsApp, ссылка', { type: 'url' })}${inp('telegram', S.telegram, 'Telegram, ссылка', { type: 'url' })}</div>
          ${inp('vk', S.vk, 'ВКонтакте, ссылка', { type: 'url', hint: 'Пустое поле: кнопка на сайте не показывается.' })}
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Рейтинг</h2></div>
        <div class="card__body">
          <p class="field__hint">Числа из DIKIDI для первого экрана и блока отзывов.</p>
          <div class="grid2">${inp('rating', S.rating, 'Рейтинг', { type: 'number', attrs: 'min="0" max="5" step="0.1"' })}${inp('ratings', S.ratings, 'Оценок', { type: 'number', attrs: 'min="0" step="1"' })}</div>
          ${inp('reviewsCount', S.reviews, 'Отзывов', { type: 'number', attrs: 'min="0" step="1"' })}
        </div>
      </div>
      ${savebar()}
    </form>`;

    let hero = T.heroPrices.map(h => ({ label: h.label, ids: [...h.ids] }));
    let facts = T.facts.map(f => ({ ...f }));
    const drawHero = () => {
      $('[data-hero-list]', main).innerHTML = hero.map((h, i) => `<div class="list-edit__row">
        <div class="list-edit__fields">
          <input data-hero-label="${i}" value="${esc(h.label)}" aria-label="Подпись ${i + 1}">
          <button class="btn btn--line btn--sm" type="button" data-hero-pick="${i}" style="justify-self:start">Услуги: ${h.ids.filter(id => SVC[id]).length}</button>
        </div>
        <div class="list-edit__ctl"><button class="icon-btn" type="button" data-hero-del="${i}" aria-label="Убрать строку">${ICON.x}</button></div>
      </div>`).join('');
    };
    const drawFacts = () => {
      $('[data-facts-list]', main).innerHTML = facts.map((f, i) => `<div class="list-edit__row">
        <div class="list-edit__fields">
          <input data-fact-b="${i}" value="${esc(f.b)}" placeholder="Главное, например «Педикюр в массажном кресле»" aria-label="Пункт ${i + 1}">
          <input data-fact-s="${i}" value="${esc(f.span)}" placeholder="Пояснение, можно не заполнять" aria-label="Пояснение к пункту ${i + 1}">
        </div>
        <div class="list-edit__ctl">
          <button class="icon-btn" type="button" data-fact-move="${i}" data-dir="-1" aria-label="Выше" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="icon-btn" type="button" data-fact-move="${i}" data-dir="1" aria-label="Ниже" ${i === facts.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
          <button class="icon-btn" type="button" data-fact-del="${i}" aria-label="Убрать пункт">${ICON.x}</button>
        </div>
      </div>`).join('');
    };
    const readLists = () => {
      hero.forEach((h, i) => { h.label = $(`[data-hero-label="${i}"]`, main).value; });
      facts.forEach((f, i) => { f.b = $(`[data-fact-b="${i}"]`, main).value; f.span = $(`[data-fact-s="${i}"]`, main).value; });
    };
    drawHero(); drawFacts();
    const form = $('[data-site-form]', main);
    form.addEventListener('input', markDirty);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('click', e => {
      const t = e.target.closest('button');
      if (!t) return;
      if ('heroAdd' in t.dataset) { readLists(); hero.push({ label: 'Новая строка', ids: [] }); drawHero(); markDirty(); }
      if (t.dataset.heroDel) { readLists(); hero.splice(+t.dataset.heroDel, 1); drawHero(); markDirty(); }
      if (t.dataset.heroPick) { readLists(); const i = +t.dataset.heroPick; pickServices(hero[i].ids, `Цена «${hero[i].label}»`, ids => { hero[i].ids = ids; drawHero(); markDirty(); }); }
      if ('factAdd' in t.dataset) { readLists(); facts.push({ b: '', span: '' }); drawFacts(); markDirty(); $$('[data-fact-b]', main).pop().focus(); }
      if (t.dataset.factDel) { readLists(); facts.splice(+t.dataset.factDel, 1); drawFacts(); markDirty(); }
      if (t.dataset.factMove) { readLists(); moveIn(facts, facts[+t.dataset.factMove], +t.dataset.dir); drawFacts(); markDirty(); }
      if ('save' in t.dataset) save();
    });
    async function save() {
      readLists();
      const v = n => form.elements[n].value.trim();
      Object.assign(D.texts, {
        heroWhere: v('heroWhere'), heroPrices: hero.filter(h => h.label.trim() && h.ids.length),
        postersTitle: v('postersTitle'), postersLead: v('postersLead'), aboutTitle: v('aboutTitle'),
        about: T.about.map((_, i) => v(`about-${i}`)), facts: facts.filter(f => f.b.trim()).map(f => ({ b: f.b.trim(), span: f.span.trim() })),
      });
      Object.assign(D.salon, {
        address: v('address'), addressNote: v('addressNote'), metro: v('metro'), metroWalk: v('metroWalk'), hours: v('hours'),
        phone: v('phone'), whatsapp: v('whatsapp'), telegram: v('telegram'), vk: v('vk'),
        rating: Math.min(5, Math.max(0, +v('rating') || 0)), ratings: Math.max(0, Math.round(+v('ratings') || 0)), reviews: Math.max(0, Math.round(+v('reviewsCount') || 0)),
      });
      dirty = false;
      await commit('Тексты сохранены');
      viewSite();
    }
  }

  // выбор нескольких услуг (для цен на первом экране)
  function pickServices(selected, title, done) {
    openSheet({
      title: 'Выбор услуг',
      body: `<p class="muted small">${esc(title)}</p>
        <input class="search" type="search" placeholder="Найти услугу" aria-label="Найти услугу" data-pick-q>
        <div class="checks" style="max-height:none">${D.cats.map(c => {
          const l = D.services.filter(s => s.cat === c.key);
          return l.length ? `<div class="checks__group">${esc(c.title)}</div>${l.map(s => `<label class="check" data-svc-name="${esc(s.name.toLowerCase())}"><input type="checkbox" value="${s.id}" ${selected.includes(s.id) ? 'checked' : ''}><span>${esc(s.name)} · ${priceTxt(s.price, s.from)}</span></label>`).join('')}` : '';
        }).join('')}</div>`,
      save: 'Готово',
      onOpen: root => $('[data-pick-q]', root).addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        $$('[data-svc-name]', root).forEach(l => { l.hidden = !!q && !l.dataset.svcName.includes(q); });
      }),
      onSubmit: () => done($$('.checks input:checked', sheetBody).map(i => +i.value)),
    });
  }

  /* =====================================================================
     ОТЗЫВЫ
     ===================================================================== */
  function viewReviews() {
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <h1 class="page__title">Отзывы</h1>
        <div class="page__actions"><button class="btn btn--dark" type="button" data-new-review>Добавить отзыв</button></div>
      </div>
      <p class="page__lead">Отзывы в блоке «Отзывы» на сайте, в этом порядке. Лучше брать настоящие отзывы из DIKIDI или Яндекс Карт.</p>
      ${D.reviews.length ? `<div class="list">${D.reviews.map((r, i) => `<div class="row">
        <button class="row__main" type="button" data-edit-review="${r.id}">
          <span class="row__name">${esc(r.name)}</span>
          <span class="row__sub">${esc(r.text.length > 110 ? r.text.slice(0, 110) + '…' : r.text)}</span>
        </button>
        <span></span>
        <span class="row__move">
          <button class="icon-btn" type="button" data-move-review="${r.id}" data-dir="-1" aria-label="Выше" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
          <button class="icon-btn" type="button" data-move-review="${r.id}" data-dir="1" aria-label="Ниже" ${i === D.reviews.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
        </span>
      </div>`).join('')}</div>` : '<div class="empty card"><p>Отзывов нет, блок на сайте будет пустым.</p></div>'}
    </section>`;
  }
  main.addEventListener('click', async e => {
    if (current !== 'reviews') return;
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.editReview) reviewSheet(D.reviews.find(r => r.id === t.dataset.editReview));
    if ('newReview' in t.dataset) reviewSheet(null);
    if (t.dataset.moveReview) {
      if (moveIn(D.reviews, D.reviews.find(r => r.id === t.dataset.moveReview), +t.dataset.dir)) { await commit('Порядок сохранён'); viewReviews(); }
    }
  });
  function reviewSheet(r) {
    const isNew = !r;
    const base = r || { id: 'r' + Store.uid(), name: '', date: '', service: '', master: '', text: '' };
    openSheet({
      title: isNew ? 'Новый отзыв' : 'Отзыв',
      body: `
        ${field('Имя', `<input id="rv-name" name="name" value="${esc(base.name)}">`, { err: 'name' })}
        <div class="grid2">
          ${field('Дата', `<input id="rv-date" name="date" value="${esc(base.date)}" placeholder="10 октября 2026">`)}
          ${field('Мастер', `<select id="rv-master" name="master"><option value="">не указан</option>${D.masters.map(m => `<option ${m.name === base.master ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}${base.master && !D.masters.some(m => m.name === base.master) ? `<option selected>${esc(base.master)}</option>` : ''}</select>`)}
        </div>
        ${field('Услуга', `<input id="rv-service" name="service" value="${esc(base.service)}" placeholder="Маникюр комбо №1">`)}
        ${field('Текст отзыва', `<textarea id="rv-text" name="text" rows="5">${esc(base.text)}</textarea>`, { err: 'text' })}`,
      del: isNew ? null : { label: 'Удалить отзыв', run: async () => {
        if (!(await ask(`Удалить отзыв ${base.name}?`))) return;
        D.reviews = D.reviews.filter(x => x !== r);
        await commit('Отзыв удалён'); closeSheet(); viewReviews();
      } },
      onSubmit: async f => {
        if (!fieldError(f, 'name', f.name.value.trim() ? '' : 'Напишите имя')) return false;
        if (!fieldError(f, 'text', f.text.value.trim() ? '' : 'Вставьте текст отзыва')) return false;
        const next = { ...base, name: f.name.value.trim(), date: f.date.value.trim(), master: f.master.value, service: f.service.value.trim(), text: f.text.value.trim() };
        if (isNew) D.reviews.push(next); else D.reviews[D.reviews.indexOf(r)] = next;
        await commit(isNew ? 'Отзыв добавлен' : 'Отзыв сохранён'); viewReviews();
      },
    });
  }

  /* =====================================================================
     НАСТРОЙКИ
     ===================================================================== */
  function viewSettings() {
    const S = D.settings || (D.settings = { leadMin: 60, horizonDays: 21, telegram: '', notifyNew: true, notifyCancel: true });
    const opt = (v, list) => list.map(([val, t]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${t}</option>`).join('');
    main.innerHTML = `<form class="page" novalidate data-settings-form>
      <div class="page__head"><h1 class="page__title">Настройки</h1></div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Онлайн-запись</h2></div>
        <div class="card__body">
          <div class="grid2">
            ${field('Самая ранняя запись', `<select id="se-lead" name="lead">${opt(S.leadMin, [[0, 'на ближайшее время'], [30, 'через 30 минут'], [60, 'через час'], [120, 'через 2 часа'], [180, 'через 3 часа'], [1440, 'на завтра и позже']])}</select>`, { hint: 'Чтобы мастер успел подготовиться.' })}
            ${field('Запись вперёд', `<select id="se-hor" name="horizon">${opt(S.horizonDays, [[7, 'на неделю'], [14, 'на 2 недели'], [21, 'на 3 недели'], [30, 'на месяц'], [60, 'на 2 месяца']])}</select>`)}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h2 class="card__title">Уведомления в Telegram</h2></div>
        <div class="card__body">
          ${field('Куда присылать', `<input id="se-tg" name="tg" value="${esc(S.telegram)}" placeholder="@flakon_admin или номер чата">`, { hint: 'Можно личный чат администратора или общую группу салона.' })}
          <label class="check check--row"><input type="checkbox" name="notifyNew" ${S.notifyNew ? 'checked' : ''}><span>Новая запись с сайта</span></label>
          <label class="check check--row"><input type="checkbox" name="notifyCancel" ${S.notifyCancel ? 'checked' : ''}><span>Отмена или перенос записи</span></label>
          <p class="demo-note" style="margin:0">В демо сообщения не отправляются. На рабочем сайте подключим бота салона, и он будет присылать каждую запись: услугу, мастера, время, имя и телефон клиента.</p>
        </div>
      </div>
      ${savebar()}
      <div class="card">
        <div class="card__head"><h2 class="card__title">Данные демо</h2></div>
        <div class="card__body">
          <p class="small muted">Все изменения и записи в демо хранятся только в этом браузере. Их можно выгрузить файлом или вернуть всё как было.</p>
          <div class="photo-field__btns">
            <button class="btn btn--line" type="button" data-export>Скачать данные</button>
            <button class="btn btn--line btn--danger-line" type="button" data-reset>Вернуть исходные данные</button>
          </div>
        </div>
      </div>
    </form>`;
    const form = $('[data-settings-form]', main);
    form.addEventListener('input', markDirty);
    form.addEventListener('change', markDirty);
    form.addEventListener('submit', e => e.preventDefault());
    form.addEventListener('click', async e => {
      const t = e.target.closest('button');
      if (!t) return;
      if ('save' in t.dataset) {
        Object.assign(S, { leadMin: +form.lead.value, horizonDays: +form.horizon.value, telegram: form.tg.value.trim(), notifyNew: form.notifyNew.checked, notifyCancel: form.notifyCancel.checked });
        dirty = false;
        await commit('Настройки сохранены'); viewSettings();
      }
      if ('export' in t.dataset) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify({ data: D, bookings: B }, null, 1)], { type: 'application/json' }));
        a.download = `flakon-dannye-${Store.ymd(new Date())}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      if ('reset' in t.dataset) {
        if (!(await ask('Вернуть исходные данные? Пропадут все правки, загруженные фото и записи, сделанные в демо.', 'Вернуть исходные'))) return;
        await Store.reset();
        location.reload();
      }
    });
  }

  /* ---------- старт ---------- */
  showApp(session.get());
})();
