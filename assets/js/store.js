/* Флакон: слой данных для сайта и админки.
   В демо всё хранится в браузере (IndexedDB): правки админки, записи клиентов, загруженные фото и видео.
   На рабочем сайте эти же методы будут ходить на сервер (PHP + SQLite), интерфейс останется прежним. */
(() => {
  'use strict';

  const DB_NAME = 'flakon-demo';
  const DEFAULTS = window.FLAKON;
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('flakon') : null;

  /* ---------- IndexedDB: два хранилища, данные (kv) и файлы (files) ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('files');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
  const tx = async (store, mode, fn) => {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => resolve(req && req.result);
      t.onerror = () => reject(t.error);
    });
  };
  const get = (store, key) => tx(store, 'readonly', s => s.get(key));
  const put = (store, key, val) => tx(store, 'readwrite', s => s.put(val, key));
  const del = (store, key) => tx(store, 'readwrite', s => s.delete(key));

  const clone = o => JSON.parse(JSON.stringify(o));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- даты и время ---------- */
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  /* ---------- свободное время: график мастера минус записи ---------- */
  const STEP = 30;
  function freeSlots(data, bookings, masterId, date, dur, now = new Date()) {
    const m = data.masters.find(x => x.id === masterId);
    if (!m || m.hidden) return [];
    const key = ymd(date);
    if ((m.schedule.off || []).includes(key)) return [];
    const day = m.schedule.week[date.getDay()];
    if (!day) return [];
    const [from, to] = day;
    const busy = bookings
      .filter(b => b.masterId === masterId && b.date === key && b.status !== 'cancelled')
      .map(b => [b.start, b.start + b.dur]);
    const lead = (data.settings && data.settings.leadMin) ?? 60;
    const earliest = ymd(now) === key ? Math.ceil((now.getHours() * 60 + now.getMinutes() + lead) / STEP) * STEP : 0;
    if (key < ymd(now)) return [];
    const out = [];
    for (let t = from; t + dur <= to; t += STEP) {
      if (t < earliest) continue;
      if (busy.some(([a, z]) => t < z && t + dur > a)) continue;
      out.push(t);
    }
    return out;
  }

  /* ---------- демо-записи, чтобы календарь выглядел живым ---------- */
  function seedBookings(data) {
    let seed = 20261019;
    const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const pick = a => a[Math.floor(rnd() * a.length)];
    const NAMES = ['Анна', 'Мария', 'Ольга', 'Дарья', 'Алина', 'Виктория', 'Ксения', 'Полина', 'Елена', 'Юлия', 'Наталья', 'Ирина', 'Кристина', 'Татьяна', 'Светлана', 'Арина'];
    const phone = () => `+7 (9${Math.floor(10 + rnd() * 89)}) ${Math.floor(100 + rnd() * 899)}-${Math.floor(10 + rnd() * 89)}-${Math.floor(10 + rnd() * 89)}`;
    const out = [];
    const today = new Date();
    for (let i = -2; i < 14; i++) {
      const d = addDays(today, i);
      for (const m of data.masters) {
        const svc = data.services.filter(s => s.masters.some(o => o.id === m.id) && s.cat !== 'promo' && s.price > 0);
        if (!svc.length) continue;
        const n = Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          const s = pick(svc);
          const o = s.masters.find(x => x.id === m.id);
          const slots = freeSlots(data, out, m.id, d, o.min, new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
          if (!slots.length) continue;
          const start = pick(slots);
          const past = i < 0 || (i === 0 && start < today.getHours() * 60);
          out.push({
            id: uid(), serviceId: s.id, serviceName: s.name, masterId: m.id, masterName: m.name, date: ymd(d), start, dur: o.min, price: o.price, from: o.from,
            name: pick(NAMES), phone: phone(), comment: '', source: rnd() < .6 ? 'site' : 'admin',
            // новые (ещё не подтверждённые) только среди ближайших дней, как бывает в жизни
            status: past ? 'done' : i <= 2 && rnd() < .25 ? 'new' : 'confirmed', created: Date.now() - Math.floor(rnd() * 5e8),
          });
        }
      }
    }
    return out;
  }

  /* ---------- файлы: фото и видео из админки ---------- */
  const urls = new Map();
  async function putFile(blob) {
    const key = 'f' + uid();
    await put('files', key, blob);
    return 'idb:' + key;
  }
  async function url(ref, base = '') {
    if (!ref) return '';
    if (!ref.startsWith('idb:')) return base + ref;
    if (urls.has(ref)) return urls.get(ref);
    const blob = await get('files', ref.slice(4));
    const u = blob ? URL.createObjectURL(blob) : '';
    urls.set(ref, u);
    return u;
  }
  // подставляет настоящие адреса во все src/poster с data-ref внутри узла
  async function hydrate(root, base = '') {
    const els = [...root.querySelectorAll('[data-ref]')];
    await Promise.all(els.map(async el => {
      const u = await url(el.dataset.ref, base);
      if (el.tagName === 'VIDEO' || el.tagName === 'SOURCE') el.src = u; else el.src = u;
      el.removeAttribute('data-ref');
    }));
  }

  /* ---------- данные ---------- */
  async function load() {
    const stored = await get('kv', 'data');
    if (stored && stored.version === DEFAULTS.version) return stored;
    return clone(DEFAULTS);
  }
  async function save(data) {
    await put('kv', 'data', data);
    channel && channel.postMessage({ type: 'data' });
  }
  async function bookings() {
    const stored = await get('kv', 'bookings');
    if (stored && stored.version === DEFAULTS.version) return stored.list;
    const list = seedBookings(await load());
    await put('kv', 'bookings', { version: DEFAULTS.version, list });
    return list;
  }
  async function saveBookings(list) {
    await put('kv', 'bookings', { version: DEFAULTS.version, list });
    channel && channel.postMessage({ type: 'bookings' });
  }
  async function addBooking(b) {
    const list = await bookings();
    const item = { id: uid(), status: 'new', created: Date.now(), comment: '', ...b };
    list.push(item);
    await saveBookings(list);
    return item;
  }
  async function updateBooking(id, patch) {
    const list = await bookings();
    const i = list.findIndex(b => b.id === id);
    if (i >= 0) list[i] = { ...list[i], ...patch };
    await saveBookings(list);
    return list[i];
  }
  async function reset() {
    await del('kv', 'data');
    await del('kv', 'bookings');
    await tx('files', 'readwrite', s => s.clear());
    urls.clear();
    channel && channel.postMessage({ type: 'reset' });
  }
  const onChange = fn => channel && channel.addEventListener('message', e => fn(e.data));

  window.FlakonStore = { load, save, bookings, addBooking, updateBooking, saveBookings, reset, putFile, url, hydrate, onChange, freeSlots, ymd, parseYmd, addDays, uid, STEP };
})();
