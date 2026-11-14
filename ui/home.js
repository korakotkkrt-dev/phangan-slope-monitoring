/* Station-map landing page: first screen = where our stations are; click one -> its sensor layout (Overview).
   Adding a station = one more entry in HOME_STATIONS (id must match STATIONS[].id in the dashboard). */
(function(){
const HOME_STATIONS = [
  { id: 'st1', code: 'สฎ.6063', name: 'หน้าอำเภอ–บ้านเหนือ', area: 'เกาะพะงัน จ.สุราษฎร์ธานี', lat: 9.7484, lon: 100.0657 },
  { id: 'st2', code: 'สฎ.6064', name: 'บ้านใต้–หาดริ้น', area: 'เกาะพะงัน จ.สุราษฎร์ธานี', lat: 9.6830, lon: 100.0558 },
];
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const WORDS = { ok: 'ปกติ · Normal', warn: 'เฝ้าระวัง · Watch', crit: 'วิกฤต · Critical', stale: 'ข้อมูลล่าช้า · Delayed' };

if (!/^#(st\d+)$/.test(location.hash || '')) document.body.classList.add('home-on');
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function ready(){
  return typeof STATIONS !== 'undefined' && typeof applyPage === 'function' && typeof applyStation === 'function' &&
    typeof dgRainWindow === 'function' && document.getElementById('app') && document.getElementById('app').style.display !== 'none' &&
    document.querySelector('#summary .rtile') && document.getElementById('rb');
}
let tries = 0;
(function wait(){ if (ready()){ init(); return; } if (++tries > 300){ return; } setTimeout(wait, 100); })();

function stationData(meta){
  const st = STATIONS.find(s => s.id === meta.id); if (!st) return null;
  const T = st.xs[st.n - 1];
  const ageH = (Date.now() / 1000 - T) / 3600;
  const tiles = [...document.querySelectorAll('#summary [data-section="' + st.id + '"] .rtile')];
  const c = { ok: 0, warn: 0, crit: 0, fault: 0, stale: 0 };
  tiles.forEach(t => { const k = [...t.classList].find(x => x.indexOf('risk-') === 0); if (k && c[k.slice(5)] != null) c[k.slice(5)]++; });
  let level = c.crit ? 'crit' : c.warn ? 'warn' : 'ok';
  const delayed = ageH > 24;
  const soil = Object.keys(st.CH).filter(n => /^soil_moisture_/.test(n)).map(n => lastValid(st.CH[n])).filter(v => v === v);
  const when = new Date((T + 7 * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' ');
  return { st, T, ageH, delayed, level, c, when,
    rain24: dgRainWindow(st, T - 86400, T), rain1: dgRainWindow(st, T - 3600, T),
    soilMax: soil.length ? Math.max.apply(null, soil) : NaN, nTiles: tiles.length };
}
function fmt(v, d){ return v === v && v != null ? v.toFixed(d == null ? 1 : d) : '–'; }
function ageText(h){ return h < 48 ? Math.round(h) + ' ชม.' : (h / 24).toFixed(1) + ' วัน'; }
function cardHTML(meta, d){
  const lv = d.delayed && d.level === 'ok' ? 'stale' : d.level;
  return '<div class="hm-row"><div><h4 style="margin:0;font:600 15px IBM Plex Sans,sans-serif">' + meta.code + ' · ' + meta.name + '</h4>' +
    '<div class="hm-loc" style="font-size:12px;color:var(--ink-3)">' + meta.area + '</div></div>' +
    '<span class="hm-chip ' + lv + '">' + WORDS[lv] + '</span></div>' +
    '<div style="font-size:12px;color:var(--ink-3);margin-top:4px">ข้อมูลล่าสุด ' + d.when + ' ICT' + (d.delayed ? ' (ผ่านมา ' + ageText(d.ageH) + ' · * ค่าฝนนับย้อนจากข้อมูลล่าสุด)' : '') + '</div>' +
    '<div class="hm-tiles">' +
    '<div class="hm-t"><span>ฝน 24 ชม. · Rain 24 h' + (d.delayed ? '*' : '') + '</span><b>' + fmt(d.rain24) + '</b><em>mm</em></div>' +
    '<div class="hm-t"><span>ฝน 1 ชม. · Rain 1 h' + (d.delayed ? '*' : '') + '</span><b>' + fmt(d.rain1) + '</b><em>mm</em></div>' +
    '<div class="hm-t"><span>ความชื้นดินสูงสุด · Soil max</span><b>' + fmt(d.soilMax) + '</b><em>%</em></div>' +
    '<div class="hm-t"><span>ช่องวัด เฝ้าระวัง / วิกฤต</span><b>' + d.c.warn + ' / ' + d.c.crit + '</b><em>จาก ' + d.nTiles + '</em></div></div>';
}
function openStation(id){
  const st = STATIONS.find(s => s.id === id); if (!st) return;
  activeStation = id; activePage = 'overview';
  document.body.classList.remove('home-on');
  try { applyStation(); applyPage(); } catch (e) { console.error(e); }
  window.scrollTo(0, 0);
  window.dispatchEvent(new Event('resize'));
}
function showHome(){
  document.body.classList.add('home-on');
  window.scrollTo(0, 0);
  if (window.__hmMap) setTimeout(() => window.__hmMap.invalidateSize(), 60);
}
function route(){
  const h = (location.hash || '').replace('#', '');
  if (STATIONS.some(s => s.id === h)) openStation(h); else showHome();
}
function init(){
  const app = document.getElementById('app');
  const home = el('section'); home.id = 'home';
  home.innerHTML =
    '<div class="hm-head"><h2>แผนที่สถานีติดตาม · Station map</h2><span class="hm-sub">เลือกสถานีเพื่อดูผังเซนเซอร์และค่าล่าสุด</span></div>' +
    '<div class="hm-grid"><div class="hm-card hm-mapwrap"><div id="hm-map" role="application" aria-label="แผนที่สถานีติดตามบนเกาะพะงัน"></div>' +
    '<div class="hm-fallback" id="hm-fb">โหลดแผนที่ไม่ได้ (ต้องต่ออินเทอร์เน็ต) ใช้รายชื่อสถานีทางขวาแทนได้</div></div>' +
    '<div class="hm-card hm-list" id="hm-list"><h3>Stations · สถานี</h3></div></div>';
  app.parentNode.insertBefore(home, app);

  const list = document.getElementById('hm-list');
  const data = HOME_STATIONS.map(m => ({ m, d: stationData(m) })).filter(x => x.d);
  const cardBtns = [];
  data.forEach(({ m, d }) => {
    const b = el('button', 'hm-st'); b.type = 'button';
    b.innerHTML = cardHTML(m, d); b.onclick = () => { location.hash = m.id; };
    list.appendChild(b); cardBtns.push({ b, m, d });
  });
  // live: time of the last sample and the rain tiles follow the minutes that arrive after the page was opened
  if (typeof LIVE !== 'undefined') LIVE.on(() => cardBtns.forEach(c => {
    const T = LIVE.tail[c.d.st.id]; if (!T || !T.xs.length) return;
    const t = T.xs[T.xs.length - 1], rs = LIVE.rainStation(c.d.st), ageH = (Date.now() / 1000 - t) / 3600;
    const d2 = Object.assign({}, c.d, { T: t, ageH, delayed: ageH > 24, when: new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' '),
      rain24: dgRainWindow(rs, t - 86400, t), rain1: dgRainWindow(rs, t - 3600, t) });
    c.b.innerHTML = cardHTML(c.m, d2);
  }));
  list.appendChild(el('div', 'hm-note',
    'ตำแหน่งบนแผนที่เป็นจุดกลางพื้นที่ติดตั้งโดยประมาณ ไม่ใช่พิกัดเซนเซอร์ · สถานะนับจากเกณฑ์เดิมของหน้าผังเซนเซอร์ ยังไม่ใช่การประเมินเชิงพื้นที่'));

  // back button inside the ribbon (and a fallback under the title)
  const top = document.querySelector('#rb .rb-top');
  if (top){ const b = el('button', 'home-back', '← แผนที่สถานี'); b.type = 'button'; b.onclick = () => { location.hash = 'map'; }; top.insertBefore(b, top.firstChild); }

  window.addEventListener('hashchange', route);
  route();
  loadMap(data);
}
function loadMap(data){
  const fb = document.getElementById('hm-fb'), mapEl = document.getElementById('hm-map');
  function fail(){ mapEl.style.display = 'none'; fb.style.display = 'block'; }
  if (window.L){ buildMap(data); return; }
  const css = el('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
  const s = el('script'); s.src = LEAFLET_JS; s.onload = () => { try { buildMap(data); } catch (e) { console.error(e); fail(); } }; s.onerror = fail;
  document.head.appendChild(s);
}
function buildMap(data){
  const map = L.map('hm-map', { zoomControl: true }).fitBounds(data.map(x => [x.m.lat, x.m.lon]), { padding: [60, 60], maxZoom: 13 });
  window.__hmMap = map;
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Esri World Imagery' });
  const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
  sat.addTo(map); L.control.layers({ 'ดาวเทียม': sat, 'ถนน': osm }, null, { position: 'topright' }).addTo(map);
  data.forEach((x, i) => {
    const lv = x.d.delayed && x.d.level === 'ok' ? 'stale' : x.d.level;
    const icon = L.divIcon({ html: '<div class="hm-mk ' + lv + '">' + (i + 1) + '</div>', className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    const mk = L.marker([x.m.lat, x.m.lon], { icon, title: x.m.code + ' ' + x.m.name }).addTo(map);
    mk.bindPopup('<div class="hm-pop">' + cardHTML(x.m, x.d) + '<button class="hm-open" data-open="' + x.m.id + '">เปิดผังเซนเซอร์ · Open sensor layout →</button></div>', { maxWidth: 300 });
  });
  map.on('popupopen', e => { const b = e.popup.getElement().querySelector('[data-open]'); if (b) b.onclick = () => { location.hash = b.dataset.open; }; });
}
})();
