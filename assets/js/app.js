/* Флакон: сайт салона. Данные берутся из FlakonStore (store.js): по умолчанию из DIKIDI,
   поверх них правки из админки. Запись идёт через DIKIDI. */
(async () => {
  'use strict';

  const Store = window.FlakonStore;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  let D = await Store.load();
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
    D = await Store.load(); index();
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
    closeDialog(lb);
    openDikidi({});
  });

  /* =====================================================================
     Онлайн-запись идёт в DIKIDI: кнопки открывают страницу записи салона
     сразу на нужной услуге или мастере (номера из DIKIDI лежат в dk).
     ===================================================================== */
  const dikidiUrl = ({ serviceId, masterId }) => {
    const base = `https://dikidi.net/ru/record/${D.salon.dikidiId}`;
    const s = SVC[serviceId], m = MST[masterId];
    if (s && s.dk && m && m.dk) return `${base}?st_m=1&ss_s=${s.dk}&sm_m=${m.dk}&source=direct_link`;
    if (s && s.dk) return `${base}?p=3.pi-po-ssm-si&o=7&s=${s.dk}&source=direct_link`;
    if (m && m.dk) return `${base}?st_m=1&sm_m=${m.dk}&source=direct_link`;
    return `${base}?p=2.pi-po-ssm&o=7&source=direct_link`; // список всех услуг
  };
  const openDikidi = opts => { open(dikidiUrl(opts), '_blank', 'noopener'); };

  /* кнопки «Записаться» по всему сайту */
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-book], [data-book-service], [data-book-master]');
    if (!t) return;
    openDikidi({ serviceId: t.dataset.bookService, masterId: t.dataset.bookMaster });
  });
})();
