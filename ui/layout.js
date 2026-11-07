/* Sensor-layout dock: the new layout figures (map, table, installation photos) at the right edge, next to the sensor data.
   Images are embedded by tools/inject_layout.py as window.PSW_LAYOUT_IMG = { st1: { map, table, photos }, st2: {...} }. */
(function(){
const TABS = [['map', 'ผัง'], ['table', 'ตาราง'], ['photos', 'รูปติดตั้ง']];
const TITLES = { st1: 'ST1 · สฎ.6063 หน้าอำเภอ–บ้านเหนือ', st2: 'ST2 · สฎ.6064 บ้านใต้–หาดริ้น' };
const KEY = 'psw_lay_v1';
let state = { open: null, tab: 'map' };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch(e){}
let dock = null, lastStation = null, lastPage = null;
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){} }
function wide(){ return window.innerWidth >= 1280; }
function ready(){ return typeof STATIONS !== 'undefined' && typeof activeStation !== 'undefined' && window.PSW_LAYOUT_IMG && document.getElementById('app') && document.getElementById('rb'); }
let tries = 0; (function wait(){ if (ready()){ init(); return; } if (++tries > 300) return; setTimeout(wait, 100); })();

function init(){
  dock = el('aside', 'lay-dock'); dock.id = 'lay-dock'; dock.setAttribute('aria-label', 'sensor layout');
  dock.innerHTML = '<div class="lay-head"><b id="lay-title"></b><button type="button" class="lay-x" aria-label="close">×</button></div><div class="lay-tabs" id="lay-tabs"></div><div class="lay-body" id="lay-body"></div><div class="lay-foot">คลิกรูปเพื่อขยาย</div>';
  document.body.appendChild(dock);
  const handle = el('button', 'lay-handle', 'ผังเซนเซอร์ ◂'); handle.type = 'button'; handle.id = 'lay-handle'; handle.onclick = () => setOpen(true); document.body.appendChild(handle);
  dock.querySelector('.lay-x').onclick = () => setOpen(false);
  const lb = el('div', 'lay-lb'); lb.id = 'lay-lb'; lb.hidden = true; lb.onclick = () => { lb.hidden = true; };
  lb.innerHTML = '<img alt="sensor layout">'; document.body.appendChild(lb);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') lb.hidden = true; });
  // ribbon button
  const pageRow = [...document.querySelectorAll('#rb .rb-grp')].find(g => /Page/.test(g.textContent));
  if (pageRow){ const b = el('button', 'rb-btn'); b.type = 'button'; b.title = 'show / hide the sensor layout panel beside the data'; b.append(el('span', null, 'Layout')); b.onclick = () => setOpen(!isOpen()); pageRow.firstChild.appendChild(b); }
  setInterval(tick, 300); window.addEventListener('resize', apply); tick(true);
}
function onHome(){ return document.body.classList.contains('home-on'); }
function isOpen(){ return state.open === true || (state.open === null && wide() && typeof activePage !== 'undefined' && activePage === 'overview'); }
function setOpen(v){ state.open = !!v; save(); apply(); }
function tick(force){
  const pg = typeof activePage !== 'undefined' ? activePage : '';
  if (force || activeStation !== lastStation || pg !== lastPage){ lastStation = activeStation; lastPage = pg; render(); }
  apply();
}
function render(){
  const img = window.PSW_LAYOUT_IMG[activeStation]; if (!img){ return; }
  document.getElementById('lay-title').textContent = TITLES[activeStation] || activeStation;
  const tabs = document.getElementById('lay-tabs'); tabs.innerHTML = '';
  TABS.forEach(([k, l]) => { const b = el('button', 'lay-tab' + (state.tab === k ? ' on' : ''), l); b.type = 'button'; b.onclick = () => { state.tab = k; save(); render(); }; tabs.appendChild(b); });
  const body = document.getElementById('lay-body'); body.innerHTML = '';
  const im = el('img'); im.src = img[state.tab] || img.map; im.alt = TITLES[activeStation] + ' ' + state.tab; im.onclick = () => { const lb = document.getElementById('lay-lb'); lb.firstChild.src = im.src; lb.hidden = false; };
  body.appendChild(im);
}
function apply(){
  if (!dock) return;
  const show = !onHome() && isOpen();
  dock.classList.toggle('show', show);
  document.getElementById('lay-handle').style.display = (!onHome() && !show) ? '' : 'none';
  const want = show && wide();
  if (document.body.classList.contains('lay-open') !== want){ document.body.classList.toggle('lay-open', want); setTimeout(() => window.dispatchEvent(new Event('resize')), 60); }
}
window.PSWLayout = { open: () => setOpen(true), close: () => setOpen(false) };
})();
