/* Hanap QCU — shared core for index.html (public) and admin.html (desk).
 *
 * Data:   one JSON file (data/db.json = {config, places, items}) on the "data" branch,
 *         read from raw.githubusercontent.com (GitHub's CDN — not GitHub Pages bandwidth),
 *         cached in localStorage and revalidated with ETags (304 = almost zero bytes).
 * Images: only links are stored. Thumbnails are resized by Cloudinary (if the link is
 *         Cloudinary) or the free images.weserv.nl proxy, so phones download ~30 KB, not 3 MB.
 * Map:    Leaflet + free tiles (Esri satellite / CARTO streets) or the "Blueprint" view,
 *         which draws the campus from data/campus.geojson (OpenStreetMap) with no tiles at all.
 */
'use strict';

const LF = (() => {
  // ── where the data lives ────────────────────────────────────────────────
  // On GitHub Pages (owner.github.io/repo/) the owner/repo are detected automatically.
  // Anywhere else, fill these in (or the site falls back to ./data/db.json).
  let OWNER = '', REPO = '';
  const BRANCH = 'data', DB_FILE = 'data/db.json', LEGACY_FILE = 'data/items.json';
  if (!OWNER && location.hostname.endsWith('.github.io')) {
    OWNER = location.hostname.split('.')[0];
    REPO = location.pathname.split('/')[1] || `${OWNER}.github.io`;
  }
  const RAW = (OWNER && REPO) ? `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/` : '';

  const CAMPUS = { center: [14.70044, 121.03272], zoom: 18 };   // QCU San Bartolome (OSM)

  const ITEM_CATS = {
    electronics: ['📱', 'Electronics'], id: ['🪪', 'ID & cards'], bag: ['🎒', 'Bags'],
    books: ['📚', 'Books & notes'], wallet: ['👛', 'Wallet & money'], keys: ['🔑', 'Keys'],
    clothing: ['🧥', 'Clothing'], bottle: ['🥤', 'Tumbler & bottle'], umbrella: ['☂️', 'Umbrella'],
    accessory: ['⌚', 'Accessories'], other: ['📦', 'Others'],
  };
  const PLACE_CATS = {
    desk: ['🧭', 'Lost & Found desk'], building: ['🏢', 'Building'], office: ['🗂️', 'Office'],
    faculty: ['🧑‍🏫', 'Faculty room'], classroom: ['🚪', 'Classroom'], lab: ['🧪', 'Laboratory'],
    library: ['📚', 'Library'], canteen: ['🍽️', 'Canteen'], restroom: ['🚻', 'Restroom'],
    clinic: ['⚕️', 'Clinic'], gate: ['🚶', 'Gate / entrance'], parking: ['🅿️', 'Parking'],
    sports: ['🏀', 'Gym / court'], other: ['📍', 'Other'],
  };
  const STATUS = {
    open: ['Unclaimed', 'st-open'], claimed: ['Claim pending', 'st-claimed'],
    returned: ['Returned', 'st-returned'], archived: ['Archived', 'st-archived'],
  };
  const DEFAULT_CONFIG = {
    site_name: 'Hanap QCU', school: 'Quezon City University',
    tagline: 'Lost something? Found something? Find it — and find your way — around campus.',
    desk_email: '', desk_hours: 'Mon–Fri, 8:00 AM – 5:00 PM',
    claim_text: 'Go to the Lost & Found desk, show your school ID and describe the item (color, marks, contents). The desk keeps found items for 60 days.',
    floors: ['G', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    center: CAMPUS.center, zoom: CAMPUS.zoom,
    cloudinary: { cloud: '', preset: '' },
  };

  // ── line icons (24×24, stroke = currentColor) ───────────────────────────
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
    help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2.6-2.8 4M12 17.2v.1"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
    receipt: '<path d="M5 3h14v18l-2.3-1.5L14.3 21 12 19.5 9.7 21l-2.4-1.5L5 21z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5a14 14 0 0 1 0 19M12 2.5a14 14 0 0 0 0 19"/>',
    blueprint: '<path d="M3 3h18v18H3z"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity=".55"/>',
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    locate: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
    pin: '<path d="M12 21.5s-7-6.3-7-11.5a7 7 0 0 1 14 0c0 5.2-7 11.5-7 11.5z"/><circle cx="12" cy="10" r="2.5"/>',
    nav: '<path d="M3 11 21 3l-8 18-2-8z"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    send: '<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>', share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>', trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
    save: '<path d="M5 3h11l5 5v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    back: '<path d="m15 18-6-6 6-6"/>', clock: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7v5l3 2"/>',
    hand: '<path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V12M16 9.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.3a6 6 0 0 1-4.6-2.2L4 15.2a1.6 1.6 0 0 1 2.4-2.1L7 14"/>',
    alert: '<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.4v.1"/>',
    compass: '<circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M21 14v.01M14 21h3M20 17v4"/>',
  };
  const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  // ── small utils ─────────────────────────────────────────────────────────
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const shortRef = (type) => (type === 'lost' ? 'L-' : 'F-') + Math.random().toString(36).slice(2, 6).toUpperCase();
  const ordinal = n => n + ((n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
  const floorLabel = f => !f ? '' : /^(g|gf|ground)$/i.test(f) ? 'Ground floor' : /^\d+$/.test(f) ? `${ordinal(+f)} floor` : String(f);

  function ago(iso) {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)} min ago`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: s > 86400 * 300 ? 'numeric' : undefined });
  }

  function toast(msg, kind = '') {
    let box = $('#toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind; t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4300);
  }

  // ── images: store links, serve small thumbnails ─────────────────────────
  function thumb(url, w = 480) {
    if (!url) return '';
    if (/^https?:\/\/res\.cloudinary\.com\/.+\/upload\//.test(url)) {
      return url.replace(/\/upload\/(?:[a-z]_[^/]+\/)?/, `/upload/f_auto,q_auto,c_limit,w_${w}/`);
    }
    if (/^https?:\/\//.test(url) && !/images\.weserv\.nl/.test(url)) {
      return `https://images.weserv.nl/?url=${encodeURIComponent(url.replace(/^https?:\/\//, ''))}&w=${w}&fit=inside&we&output=webp&q=72`;
    }
    return url;
  }
  // <img> with the resized copy first and the original link as fallback
  const img = (url, w, alt = '', cls = '', fallback = '📦') => url
    ? `<img class="${cls}" src="${esc(thumb(url, w))}" data-orig="${esc(url)}" data-fb="${esc(fallback)}" alt="${esc(alt)}" loading="lazy" decoding="async" onerror="LF.imgFail(this)">`
    : '';
  // resized copy failed → try the original link; that failed too → category glyph
  function imgFail(el) {
    if (el.dataset.orig && el.src !== el.dataset.orig) { el.src = el.dataset.orig; return; }
    const d = document.createElement('div'); d.className = 'noimg'; d.textContent = el.dataset.fb || '📦';
    el.replaceWith(d);
  }
  async function uploadImage(file, cfg) {
    const c = cfg?.cloudinary || {};
    if (!c.cloud || !c.preset) throw new Error('Photo upload is not set up — paste an image link instead.');
    const fd = new FormData();
    fd.append('file', file); fd.append('upload_preset', c.preset);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, { method: 'POST', body: fd });
    if (!r.ok) throw new Error('Photo upload failed');
    return (await r.json()).secure_url;
  }

  // ── data ────────────────────────────────────────────────────────────────
  function normalize(raw) {
    let db = Array.isArray(raw) ? { items: raw } : (raw || {});
    db = { version: 1, config: {}, places: [], items: [], ...db };
    db.config = { ...DEFAULT_CONFIG, ...db.config, cloudinary: { ...DEFAULT_CONFIG.cloudinary, ...(db.config.cloudinary || {}) } };
    db.items = db.items.map(i => ({
      type: 'found', status: 'open', category: 'other', ...i,
      ref: i.ref || shortRef(i.type || 'found'),
      date: i.date || (i.created || '').slice(0, 10),
    }));
    db.places = db.places.map(p => ({ category: 'other', ...p }));
    return db;
  }

  const CACHE_KEY = 'hanap.db';
  // ?demo → show data/sample.json (never cached over the real data)
  const DEMO = new URLSearchParams(location.search).has('demo');
  function cached() {
    if (DEMO) return null;
    try { const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); return c && { db: normalize(c.db), at: c.at }; } catch { return null; }
  }
  // Stale-while-revalidate: show the cached copy instantly, then ask GitHub's CDN
  // whether it changed (cache:'no-cache' sends If-None-Match → 304 when nothing changed).
  async function loadDb() {
    if (DEMO) {
      const r = await fetch('data/sample.json', { cache: 'no-cache' });
      if (r.ok) return { db: normalize(await r.json()), source: 'sample', demo: true };
    }
    const tries = [];
    if (RAW) tries.push(RAW + DB_FILE, RAW + LEGACY_FILE);
    tries.push('data/db.json', 'data/items.json');
    for (const url of tries) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) continue;
        const db = normalize(await r.json());
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ db, at: Date.now() })); } catch { }
        return { db, source: url };
      } catch { }
    }
    const c = cached();
    if (c) return { db: c.db, source: 'cache', offline: true };
    throw new Error('Could not load the Lost & Found data.');
  }

  let _campus = null;
  async function loadCampus() {
    if (_campus) return _campus;
    try {
      const r = await fetch('data/campus.geojson', { cache: 'force-cache' });
      _campus = r.ok ? await r.json() : { type: 'FeatureCollection', features: [] };
    } catch { _campus = { type: 'FeatureCollection', features: [] }; }
    return _campus;
  }

  // ── geometry ────────────────────────────────────────────────────────────
  function inPoly(lat, lng, ring) {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  // Building footprint under a point → its display name (named place inside it, OSM name, or "Building")
  function buildingAt(lat, lng, campus, places = []) {
    const f = (campus?.features || []).find(f => f.properties.kind === 'building' && inPoly(lat, lng, f.geometry.coordinates[0]));
    if (!f) return null;
    return { id: f.properties.id, name: buildingName(f, places), feature: f };
  }
  function buildingName(f, places = []) {
    const ring = f.geometry.coordinates[0];
    const p = places.find(p => p.category === 'building' && p.lat && inPoly(p.lat, p.lng, ring));
    return p?.name || f.properties.name || '';
  }
  const inCampus = (lat, lng, campus) => {
    const c = (campus?.features || []).find(f => f.properties.kind === 'campus');
    return c ? inPoly(lat, lng, c.geometry.coordinates[0]) : true;
  };
  function dist(a, b) {                 // metres, good enough on a campus
    const k = 111320, dx = (a[1] - b[1]) * k * Math.cos(a[0] * Math.PI / 180), dy = (a[0] - b[0]) * k;
    return Math.hypot(dx, dy);
  }

  // ── map ─────────────────────────────────────────────────────────────────
  const TILES = {
    satellite: () => L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxNativeZoom: 19, maxZoom: 22, attribution: 'Imagery © Esri, Maxar, Earthstar' }),
    street: () => L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxNativeZoom: 20, maxZoom: 22, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }),
    blueprint: () => null,
  };

  // A Leaflet map with the three base views + the campus outline layer.
  async function createMap(el, { view = 'satellite', places = [], onBuilding, center, zoom, interactive = true } = {}) {
    const map = L.map(el, {
      center: center || CAMPUS.center, zoom: zoom || CAMPUS.zoom, maxZoom: 22, minZoom: 15,
      zoomControl: false, attributionControl: true, tap: true,
      dragging: interactive, scrollWheelZoom: interactive, doubleClickZoom: interactive, touchZoom: interactive,
    });
    map.attributionControl.setPrefix('');
    const campus = await loadCampus();
    let tiles = null;
    const outline = L.geoJSON(campus, {
      style: f => ({
        campus: { className: 'g-campus', weight: 2, fill: true },
        building: { className: 'g-bld', weight: 1.5, fill: true },
        context: { className: 'g-ctx', weight: 1, fill: true },
        road: { className: 'g-road ' + (/(primary|secondary|tertiary)/.test(f.properties.hw) ? 'major' : ''), weight: 3, fill: false },
      }[f.properties.kind] || {}),
      interactive: true,
      onEachFeature: (f, layer) => {
        if (f.properties.kind === 'building' && onBuilding) layer.on('click', e => { L.DomEvent.stopPropagation(e); onBuilding(f, e.latlng); });
        if (f.properties.kind === 'road' && f.properties.name) layer.bindTooltip(f.properties.name, { sticky: true, className: 'tt-road' });
      },
    }).addTo(map);
    // building name labels (only for named buildings; shown from zoom 18)
    const labels = L.layerGroup().addTo(map);
    function drawLabels(pl = places) {
      labels.clearLayers();
      for (const f of campus.features.filter(f => f.properties.kind === 'building')) {
        const name = buildingName(f, pl);
        if (!name) continue;
        const ring = f.geometry.coordinates[0];
        const lat = ring.reduce((a, p) => a + p[1], 0) / ring.length, lng = ring.reduce((a, p) => a + p[0], 0) / ring.length;
        L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: 'bld-label', html: `<span>${esc(name)}</span>`, iconSize: null }) }).addTo(labels);
      }
    }
    drawLabels();
    // building names from zoom 18, place names from 19 (keeps the map readable)
    const syncLabels = () => { el.classList.toggle('show-bld', map.getZoom() >= 18); el.classList.toggle('show-labels', map.getZoom() >= 19); };
    map.on('zoomend', syncLabels); syncLabels();

    function setView(v) {
      if (tiles) { map.removeLayer(tiles); tiles = null; }
      const mk = TILES[v] || TILES.satellite;
      tiles = mk();
      if (tiles) tiles.addTo(map).bringToBack();
      el.classList.remove('v-satellite', 'v-street', 'v-blueprint');
      el.classList.add('v-' + v);
      map._lfView = v;
    }
    setView(view);
    return { map, campus, setView, drawLabels, outline };
  }

  // Item pin: the item's photo (or category glyph) in a bubble ringed by its status colour
  function pinIcon(kind, emoji, { photo = '', floor = '', active = false, small = false } = {}) {
    const face = photo
      ? `<img src="${esc(thumb(photo, 96))}" data-orig="${esc(photo)}" data-fb="${emoji}" alt="" onerror="LF.imgFail(this)">`
      : `<div>${emoji}</div>`;
    return L.divIcon({
      className: '', iconSize: [44, 52], iconAnchor: small ? [22, 52] : [22, 52], popupAnchor: [0, -46],
      html: `<div class="pin ${kind}${active ? ' active' : ''}${small ? ' small' : ''}"><div class="b">${face}</div>${floor ? `<span class="fl">${esc(floor)}</span>` : ''}</div>`,
    });
  }
  // Cluster bubble: newest photo + count, ringed in the story gradient
  function clusterIcon(n, photo, emoji) {
    const face = photo ? `<img src="${esc(thumb(photo, 96))}" data-orig="${esc(photo)}" data-fb="${emoji}" alt="" onerror="LF.imgFail(this)">` : `<div>${emoji}</div>`;
    return L.divIcon({ className: '', iconSize: [52, 52], iconAnchor: [26, 26],
      html: `<div class="clu"><div class="b">${face}</div><span>${n}</span></div>` });
  }
  function placeIcon(p) {
    const [emo] = PLACE_CATS[p.category] || PLACE_CATS.other;
    return L.divIcon({
      className: '', iconSize: null, iconAnchor: [14, 14],
      html: `<div class="plc ${p.category === 'desk' ? 'desk' : ''}"><i>${emo}</i><span>${esc(p.name)}</span></div>`,
    });
  }

  // Map location picker: a fixed crosshair pin in the middle — move the map under it.
  // Calls onChange({lat,lng,building}) after every move.
  async function makePicker(el, { lat, lng, places = [], view = 'satellite', onChange } = {}) {
    el.innerHTML = `<div class="pk-map"></div><div class="pk-pin"><div class="pin target"><div class="b"><div><span class="dot"></span></div></div></div><i></i></div>
      <div class="pk-tools">
        <button type="button" class="mbtn" data-v="satellite" title="Satellite">${icon('globe')}</button>
        <button type="button" class="mbtn" data-v="street" title="Street">${icon('map')}</button>
        <button type="button" class="mbtn" data-v="blueprint" title="Blueprint (no tiles — saves data)">${icon('blueprint')}</button>
        <button type="button" class="mbtn" data-act="locate" title="Use my location">${icon('locate')}</button>
      </div>
      <div class="pk-zoom"><button type="button" class="mbtn" data-z="1">${icon('plus')}</button><button type="button" class="mbtn" data-z="-1">${icon('minus')}</button></div>`;
    const m = await createMap(el.querySelector('.pk-map'), { view, places, center: lat ? [lat, lng] : undefined, zoom: lat ? 20 : 18 });
    const emit = () => {
      const c = m.map.getCenter();
      onChange && onChange({ lat: +c.lat.toFixed(7), lng: +c.lng.toFixed(7), building: buildingAt(c.lat, c.lng, m.campus, places), inCampus: inCampus(c.lat, c.lng, m.campus) });
    };
    m.map.on('moveend', emit);
    // tapping a spot moves the pin there
    m.map.on('click', e => m.map.panTo(e.latlng));
    el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { m.setView(b.dataset.v); el.querySelectorAll('[data-v]').forEach(x => x.classList.toggle('on', x === b)); });
    el.querySelector(`[data-v="${view}"]`)?.classList.add('on');
    el.querySelectorAll('[data-z]').forEach(b => b.onclick = () => m.map.setZoom(m.map.getZoom() + +b.dataset.z));
    el.querySelector('[data-act="locate"]').onclick = () => locate(m.map, true);
    setTimeout(() => { m.map.invalidateSize(); emit(); }, 60);
    return { ...m, center: () => m.map.getCenter(), set: (la, ln, z) => m.map.setView([la, ln], z || m.map.getZoom()) };
  }

  function locate(map, pan = false) {
    if (!navigator.geolocation) return toast('Location is not available on this device', 'warn');
    navigator.geolocation.getCurrentPosition(pos => {
      const ll = [pos.coords.latitude, pos.coords.longitude];
      map._me && map.removeLayer(map._me);
      map._me = L.layerGroup([
        L.circle(ll, { radius: Math.min(pos.coords.accuracy, 80), className: 'me-acc' }),
        L.circleMarker(ll, { radius: 7, className: 'me-dot' }),
      ]).addTo(map);
      if (pan) map.setView(ll, Math.max(map.getZoom(), 19)); else map.flyTo(ll, Math.max(map.getZoom(), 18));
    }, () => toast('Could not get your location — allow location access and try again', 'warn'), { enableHighAccuracy: true, timeout: 10000 });
  }

  // ── submissions: a report travels as a link (no server needed) ──────────
  // JSON → deflate → base64url. The desk opens admin.html#submit=<code> to review it.
  const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function encodeSubmission(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (window.CompressionStream) {
      const cs = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      return 'z' + b64u(new Uint8Array(await new Response(cs).arrayBuffer()));
    }
    return 'j' + b64u(bytes);
  }
  async function decodeSubmission(code) {
    code = String(code || '').trim();
    const m = code.match(/submit=([A-Za-z0-9_-]+)/); if (m) code = m[1];
    const kind = code[0], bytes = unb64u(code.slice(1));
    let text;
    if (kind === 'z') {
      const ds = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      text = await new Response(ds).text();
    } else text = new TextDecoder().decode(bytes);
    return JSON.parse(text);
  }

  // ── search ──────────────────────────────────────────────────────────────
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function matches(text, q) {
    const t = norm(text);
    return norm(q).split(/\s+/).filter(Boolean).every(w => t.includes(w));
  }
  const itemText = i => [i.title, i.note, i.color, i.building, floorLabel(i.floor), i.room, i.spot, i.ref, (ITEM_CATS[i.category] || [])[1], i.type].join(' ');
  const placeText = p => [p.name, p.aliases, p.building, floorLabel(p.floor), p.room, p.note, (PLACE_CATS[p.category] || [])[1]].join(' ');

  return {
    DEMO, RAW, OWNER, REPO, BRANCH, DB_FILE, LEGACY_FILE, CAMPUS, ITEM_CATS, PLACE_CATS, STATUS, DEFAULT_CONFIG,
    $, $$, esc, icon, imgFail, uid, shortRef, floorLabel, ago, toast, thumb, img, uploadImage,
    normalize, loadDb, cached, loadCampus, inPoly, buildingAt, buildingName, inCampus, dist,
    createMap, pinIcon, clusterIcon, placeIcon, makePicker, locate, encodeSubmission, decodeSubmission,
    matches, itemText, placeText, norm,
  };
})();
