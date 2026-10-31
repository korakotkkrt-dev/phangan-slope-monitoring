(function(){
function boot(){
  if (typeof STATIONS === 'undefined' || typeof applyPage !== 'function' || typeof navGroup === 'undefined' || typeof stationBtns === 'undefined') return false;
  const app = document.getElementById('app');
  if (!app || app.style.display === 'none') return false;
  if (document.getElementById('rb')) return true;
  init();
  return true;
}
let tries = 0;
(function wait(){ if (boot() || ++tries > 200) return; setTimeout(wait, 100); })();

function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function init(){
  let dataOn = false, G = null;
  const app = document.getElementById('app');
  const pageData = el('div'); pageData.id = 'page-data';
  app.insertBefore(pageData, document.getElementById('charts'));
  const rb = el('div'); rb.id = 'rb';
  const top = el('div', 'rb-top');
  const tabsEl = el('div', 'rb-tabs');
  const msg = el('div', 'rb-msg', '');
  top.append(tabsEl, msg);
  rb.appendChild(top);
  app.insertBefore(rb, app.firstChild);

  let msgT = null;
  function say(t, kind){ msg.textContent = t; msg.className = 'rb-msg ' + (kind || ''); clearTimeout(msgT); msgT = setTimeout(() => { msg.textContent = chartLabel(); msg.className = 'rb-msg'; }, 4500); }

  let hoverChart = null;
  document.addEventListener('pointerover', e => { const c = e.target.closest && e.target.closest('.chart'); if (c && c.offsetParent !== null){ hoverChart = c; if (!msgT) msg.textContent = chartLabel(); } });
  function visibleCharts(){ return [...document.querySelectorAll('#charts .chart')].filter(c => c.offsetParent !== null); }
  function activeChart(){
    if (hoverChart && hoverChart.offsetParent !== null) return hoverChart;
    const v = visibleCharts();
    return v.find(c => { const r = c.getBoundingClientRect(); return r.bottom > 140 && r.top < innerHeight; }) || v[0] || null;
  }
  function chartLabel(){ const c = activeChart(); const h = c && c.querySelector('h3'); return h ? 'tools apply to: ' + h.textContent.slice(0, 48) : ''; }
  function ensureCharts(){ if (dataOn || activePage === 'overview'){ dataOff(); activePage = 'readings'; applyPage(); } }
  function chartTool(text){
    ensureCharts();
    if (!activeChart()) return say('open a chart page first', 'bad');
    const find = () => { const w = activeChart(); return w && [...w.querySelectorAll('button')].find(x => x.textContent.trim().toLowerCase().indexOf(text) === 0); };
    const go = () => { const b = find(); if (!b) return say('this chart has no "' + text + '" tool - point at another chart', 'bad'); b.click(); };
    if (find()) return go();
    const w0 = activeChart();
    if (w0.querySelector('.chart-tool-btn') && !/trendline|draw|measure/.test(text)) return go();
    w0.scrollIntoView({ block: 'center' });
    say('building the chart...', 'ok');
    let n = 0;
    const iv = setInterval(() => { if (find() || ++n > 40){ clearInterval(iv); go(); } }, 150);
  }

  const bodies = {};
  function body(name){ const b = el('div', 'rb-body'); bodies[name] = b; rb.appendChild(b); return b; }
  function grp(parent, label){ const g = el('div', 'rb-grp'); const r = el('div', 'rb-row'); g.append(r, el('div', 'rb-lbl', label)); parent.appendChild(g); return r; }
  function btn(row, ico, label, fn, tip){ const b = el('button', 'rb-btn'); b.type = 'button'; b.append(el('span', 'rb-ico', ico), el('span', null, label)); if (tip) b.title = tip; b.onclick = fn; row.appendChild(b); return b; }

  const TABS = ['Home', 'Data', 'Clean', 'Analyze', 'Export'];
  let tab = 'Home';
  function showTab(t){
    tab = t;
    if (G && t !== 'Data') G.colsPop.classList.remove('show');
    [...tabsEl.children].forEach(b => b.classList.toggle('on', b.dataset.t === t));
    Object.keys(bodies).forEach(k => bodies[k].classList.toggle('on', k === t));
    if (t === 'Data') dataOn || dataShow(); else if (dataOn && t !== 'Data' && t !== 'Export') { /* keep data page while browsing other ribbon tabs */ }
  }
  TABS.forEach(t => { const b = el('button', 'rb-tab', t); b.type = 'button'; b.dataset.t = t; b.onclick = () => showTab(t); tabsEl.appendChild(b); });

  const homeB = body('Home'), datB = body('Data'), clnB = body('Clean'), anaB = body('Analyze'), expB = body('Export');

  const gPage = grp(homeB, 'Page');
  const pageButtons = {};
  [['overview', 'O', 'Overview', 'live status tiles and the site map'], ['readings', 'R', 'Readings', 'raw charts per channel'], ['analysis', 'A', 'Analysis', 'rain envelope, tilt rate, compare']].forEach(([p, i, l, tip]) => {
    pageButtons[p] = btn(gPage, i, l, () => { dataOff(); activePage = p; applyPage(); syncOn(); showTab('Home'); }, tip);
  });
  pageButtons.data = btn(gPage, '#', 'Data grid', () => { dataShow(); showTab('Data'); }, 'spreadsheet view of every channel');

  const gSt = grp(homeB, 'Station');
  stationBtns.forEach(b => gSt.appendChild(b));
  const gShow = grp(homeB, 'Show / view');
  gShow.append(readingsToggleWrap, categoryTabWrap);
  const gTime = grp(homeB, 'Time range');
  gTime.append(back, btn6h, btn24h, home);
  const gSet = grp(homeB, 'Page tools');
  gSet.appendChild(settingsBtn);
  [...navGroup.querySelectorAll('.sync-btn')].forEach(b => gSet.appendChild(b));

  buildData(datB);

  const gFilter = grp(clnB, 'Exclude bad data');
  btn(gFilter, 'F', 'Filter', () => chartTool('filter'), 'hide sensor-fault points or values outside a range, on the chart you point at');
  btn(gFilter, 'S', 'Show', () => chartTool('show'), 'show or hide channels on the chart you point at');
  btn(gFilter, '!', 'Fault filter', () => { openSettingsModal(); }, 'settings: the automatic sensor-fault filter and warning thresholds');
  const gAlign = grp(clnB, 'Align');
  btn(gAlign, '~', 'Splice', () => chartTool('splice'), 'join a channel across a sensor swap or reinstall (visual what-if)');
  const gNote = grp(clnB, 'Document');
  [...document.querySelectorAll('.sync-btn')].forEach(b => { const t = b.textContent.trim(); if (t === 'notes' || t === 'rename') btn(gNote, t === 'notes' ? 'N' : 'T', t === 'notes' ? 'Field notes' : 'Rename', () => b.click(), b.title); });
  const gUndo = grp(clnB, 'History');
  btn(gUndo, '<', 'Undo zoom', () => back.click(), 'undo the last zoom (Backspace)');

  const gFit = grp(anaB, 'Fit');
  btn(gFit, '/', 'Trendline', () => chartTool('trendline'), 'fit a straight line over the window you are looking at');
  btn(gFit, '+', 'Draw & fit', () => chartTool('draw'), 'click two points: fit the nearest series');
  btn(gFit, 'K', 'Measure rate', () => chartTool('measure'), 'rate of change over the zoomed window');
  const gCh = grp(anaB, 'Chart');
  btn(gCh, '^', 'Taller', () => chartTool('size'), 'cycle the chart height');
  anaB.appendChild(Object.assign(el('div', 'rb-note'), { textContent: 'These tools work on the chart under your mouse. Drag on a chart to zoom time, shift-drag to pan, double-click an axis to type a range.' }));

  const gShare = grp(expB, 'Chart');
  btn(gShare, 'P', 'PNG image', () => chartTool('png'), 'save the chart you point at as an image');
  const gTbl = grp(expB, 'Data grid');
  btn(gTbl, 'C', 'Copy selection', () => { dataShow(); showTab('Export'); G.copy(); }, 'copy the selected cells as a table for Excel');
  btn(gTbl, 'X', 'Export CSV', () => { dataShow(); showTab('Export'); G.csv(); }, 'download the grid rows as CSV');

  function syncOn(){ Object.keys(pageButtons).forEach(p => pageButtons[p].classList.toggle('on', p === 'data' ? dataOn : (!dataOn && p === activePage))); }

  const _ap = applyPage;
  applyPage = function(){ if (dataOn) dataOff(); _ap(); syncOn(); };
  const _as = applyStation;
  applyStation = function(){ _as(); if (dataOn) G.rebuild(); };

  function dataShow(){
    dataOn = true;
    ['page-overview', 'hint-overview', 'hint-readings', 'hint-analysis', 'charts'].forEach(id => { const e = document.getElementById(id); if (e) e.dataset.hiddenByGrid = e.style.display || '_', e.style.display = 'none'; });
    pageData.style.display = 'block';
    G.rebuild(); syncOn();
    msg.textContent = 'data grid - click a cell, shift-click to extend, Ctrl+C to copy';
  }
  function dataOff(){
    if (!dataOn) return;
    dataOn = false;
    if (G) G.colsPop.classList.remove('show');
    pageData.style.display = 'none';
    ['page-overview', 'hint-overview', 'hint-readings', 'hint-analysis', 'charts'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = ''; });
    syncOn();
  }
  const closeCols = () => G.colsPop.classList.remove('show');
  document.addEventListener('mousedown', e => { if (!e.target.closest('.gd-cols') && !e.target.closest('[data-colsbtn]')) closeCols(); });

  function buildData(dat){
    const ICT = 25200;
    const st = () => STATIONS.find(s => s.id === activeStation);
    const S = { res: 3600, days: 7, cols: [], sortC: null, sortD: 1, filt: false, flt: {}, a: null, f: null, rows: 0, view: null, vals: null, tms: null, names: [], fault: null };
    const RES = [['1 min', 60], ['10 min', 600], ['1 hour', 3600], ['6 hours', 21600], ['1 day', 86400]];
    const RNG = [['last 24 h', 1], ['last 3 days', 3], ['last 7 days', 7], ['last 30 days', 30], ['all data', 0]];

    const gView = grp(dat, 'Resolution and range');
    const c1 = el('label', 'rb-ctl', 'every '); const sRes = el('select'); RES.forEach(r => sRes.add(new Option(r[0], r[1]))); sRes.value = 3600; c1.appendChild(sRes);
    const c2 = el('label', 'rb-ctl', 'show '); const sRng = el('select'); RNG.forEach(r => sRng.add(new Option(r[0], r[1]))); sRng.value = 7; c2.appendChild(sRng);
    gView.append(c1, c2);
    sRes.onchange = () => { S.res = +sRes.value; rebuild(); };
    sRng.onchange = () => { S.days = +sRng.value; rebuild(); };
    const gCols = grp(dat, 'Columns');
    const bCols = btn(gCols, '|||', 'Pick columns', () => togglePop(bCols), 'choose which channels are columns'); bCols.dataset.colsbtn = '1';
    const gRows = grp(dat, 'Rows');
    const bFilt = btn(gRows, 'V', 'Filter rows', () => { S.filt = !S.filt; bFilt.classList.toggle('on', S.filt); draw(true); }, 'show a min / max box under each column heading');
    btn(gRows, 'A', 'Clear sort', () => { S.sortC = null; makeView(); draw(true); }, 'back to time order');
    const gClip = grp(dat, 'Clipboard and file');
    btn(gClip, 'C', 'Copy', () => copy(), 'copy the selected cells (tab separated, paste into Excel). Ctrl+C also works');
    btn(gClip, 'X', 'CSV', () => csv(), 'download the rows shown as a CSV file');
    dat.appendChild(Object.assign(el('div', 'rb-note'), { textContent: 'The grid shows the record as received (before splice or filters). Values are averages per time step; rain_mm is the rainfall integrated from rainfall_rate.' }));

    const wrap = el('div', 'gd-wrap');
    const scroll = el('div', 'gd-scroll'); scroll.tabIndex = 0;
    const inner = el('div', 'gd-inner');
    const hrow = el('div', 'gd-hrow'); const frow = el('div', 'gd-frow');
    const rowsEl = el('div');
    inner.append(hrow, frow, rowsEl);
    scroll.appendChild(inner);
    const stat = el('div', 'gd-stat', '');
    wrap.append(scroll, stat);
    pageData.appendChild(wrap);
    const pop = el('div', 'gd-cols'); document.body.appendChild(pop);

    function togglePop(b){
      if (pop.classList.contains('show')) { pop.classList.remove('show'); return; }
      pop.innerHTML = '';
      const s = st();
      const groups = (s.groups || []).map(g => [g[1], g[2].filter(n => s.CH[n])]);
      groups.push(['Rainfall', ['rain_mm']]);
      groups.forEach(([title, names]) => {
        if (!names.length) return;
        pop.appendChild(el('h4', null, title));
        names.forEach(n => { const l = el('label'); const cb = el('input'); cb.type = 'checkbox'; cb.checked = S.cols.indexOf(n) >= 0; cb.onchange = () => { if (cb.checked) S.cols.push(n); else S.cols = S.cols.filter(x => x !== n); rebuild(true); }; l.append(cb, document.createTextNode(n)); pop.appendChild(l); });
      });
      const r = b.getBoundingClientRect(); pop.style.left = Math.max(8, Math.min(innerWidth - 310, r.left)) + 'px'; pop.style.top = (r.bottom + 6) + 'px'; pop.classList.add('show');
    }

    function lb(xs, v, n){ let lo = 0, hi = n; while (lo < hi){ const m = (lo + hi) >> 1; if (xs[m] < v) lo = m + 1; else hi = m; } return lo; }
    function defaults(s){
      const out = []; if (s.CH.rainfall_rate) out.push('rain_mm');
      const tg = (s.groups || []).find(g => g[0] === 'tilt'); if (tg){ const want = ['tilt_5', 'tilt_6', 'tilt_7']; const names = tg[2].filter(n => s.CH[n]); names.sort((a, b) => (want.indexOf(a) < 0 ? 9 : want.indexOf(a)) - (want.indexOf(b) < 0 ? 9 : want.indexOf(b))); names.slice(0, 5).forEach(n => out.push(n)); }
      const sg = (s.groups || []).find(g => g[0] === 'soilm'); if (sg) sg[2].filter(n => s.CH[n]).slice(0, 2).forEach(n => out.push(n));
      return out;
    }
    function rebuild(keepCols){
      const s = st(); if (!s) return;
      if (!keepCols && (!S.cols.length || S.cols.some(n => n !== 'rain_mm' && !s.CH[n]))) S.cols = defaults(s);
      S.cols = S.cols.filter(n => n === 'rain_mm' ? !!s.CH.rainfall_rate : !!s.CH[n]);
      let days = S.days;
      if (S.res === 60 && (days === 0 || days > 14)){ days = 14; say('1-minute rows: showing the last 14 days at most', 'ok'); }
      const xs = s.xs, n = s.n, end = xs[n - 1];
      const t0 = days ? end - days * 86400 : xs[0];
      const i0 = lb(xs, t0, n), res = S.res;
      const b0 = Math.floor((xs[i0] + ICT) / res) * res - ICT, b1 = Math.floor((end + ICT) / res) * res - ICT;
      const M = Math.round((b1 - b0) / res) + 1;
      const names = S.cols.slice(); S.names = names;
      const sums = names.map(() => new Float64Array(M)), cnt = names.map(() => new Int32Array(M)), fl = names.map(() => new Uint8Array(M));
      const src = names.map(nm => nm === 'rain_mm' ? s.CH.rainfall_rate : s.CH[nm]);
      const faultSrc = names.map(nm => (s.FAULT && s.FAULT[nm]) || null);
      for (let i = i0; i < n; i++){
        const k = Math.round((Math.floor((xs[i] + ICT) / res) * res - ICT - b0) / res);
        for (let c = 0; c < names.length; c++){
          const v = src[c][i]; if (v !== v) continue;
          if (names[c] === 'rain_mm'){ if (i === 0) continue; const dt = (xs[i] - xs[i - 1]) / 3600; if (dt > 0 && dt < 1){ sums[c][k] += v * dt; cnt[c][k]++; } }
          else { sums[c][k] += v; cnt[c][k]++; }
          if (faultSrc[c] && faultSrc[c][i]) fl[c][k] = 1;
        }
      }
      S.vals = names.map((nm, c) => { const o = new Float64Array(M); for (let k = 0; k < M; k++) o[k] = cnt[c][k] ? (nm === 'rain_mm' ? sums[c][k] : sums[c][k] / cnt[c][k]) : NaN; return o; });
      S.fault = fl; S.b0 = b0; S.M = M; S.sortC = null; S.a = null; S.f = null; S.flt = {};
      makeView(); draw(true);
    }
    function makeView(){
      const M = S.M; let idx = [];
      for (let k = M - 1; k >= 0; k--){
        let ok = true;
        for (const key in S.flt){ const m = S.flt[key], v = S.vals[+key] && S.vals[+key][k]; if (m.min !== '' && !(v >= +m.min)) { ok = false; break; } if (m.max !== '' && !(v <= +m.max)) { ok = false; break; } }
        if (ok) idx.push(k);
      }
      if (S.sortC !== null){ const c = S.sortC, d = S.sortD, V = S.vals[c]; idx.sort((x, y) => { const p = V[x], q = V[y]; if (p !== p) return 1; if (q !== q) return -1; return d * (p - q); }); }
      S.view = idx; S.rows = idx.length;
    }
    function tfmt(k){
      const t = new Date((S.b0 + k * S.res + ICT) * 1000);
      const p = x => (x < 10 ? '0' : '') + x;
      const day = t.getUTCFullYear() + '-' + p(t.getUTCMonth() + 1) + '-' + p(t.getUTCDate());
      return S.res >= 86400 ? day : day + ' ' + p(t.getUTCHours()) + ':' + p(t.getUTCMinutes());
    }
    function nf(v, nm){ if (v !== v) return ''; const a = Math.abs(v); return nm.indexOf('moisture') >= 0 || nm === 'rain_mm' ? v.toFixed(2) : (a >= 100 ? v.toFixed(1) : v.toFixed(2)); }
    function sel(){ if (!S.a || !S.f) return null; return { r1: Math.min(S.a.p, S.f.p), r2: Math.max(S.a.p, S.f.p), c1: Math.min(S.a.c, S.f.c), c2: Math.max(S.a.c, S.f.c) }; }
    const RH = 25;
    function draw(full){
      if (full){
        hrow.innerHTML = ''; frow.innerHTML = ''; frow.style.display = S.filt ? 'flex' : 'none';
        const t = el('div', 'gd-c gd-t', 'time (ICT)'); t.dataset.sort = 't'; hrow.appendChild(t);
        const ft = el('div', 'gd-c gd-t', ''); frow.appendChild(ft);
        S.names.forEach((nm, c) => {
          const h = el('div', 'gd-c', nm + (S.sortC === c ? (S.sortD > 0 ? ' ▲' : ' ▼') : '')); h.dataset.sort = c; h.title = nm + ' (click to sort, double-click to select the column)'; hrow.appendChild(h);
          const f = el('div', 'gd-c');
          ['min', 'max'].forEach(w => { const i = el('input'); i.placeholder = w; i.value = (S.flt[c] || {})[w] || ''; i.onchange = () => { S.flt[c] = S.flt[c] || { min: '', max: '' }; S.flt[c][w] = i.value; S.a = null; S.f = null; makeView(); draw(true); }; f.appendChild(i); });
          frow.appendChild(f);
        });
        const wpx = 136 + 96 * S.names.length;
        hrow.style.width = wpx + 'px'; frow.style.width = wpx + 'px'; inner.style.width = wpx + 'px';
        inner.style.height = (S.rows * RH + 25 + (S.filt ? 28 : 0)) + 'px';
      }
      const top = S.filt ? 53 : 25;
      const first = Math.max(0, Math.floor(scroll.scrollTop / RH) - 6), cnt = Math.ceil(scroll.clientHeight / RH) + 12;
      const sb = sel(); let h = '';
      for (let p = first; p < Math.min(S.rows, first + cnt); p++){
        const k = S.view[p];
        h += '<div class="gd-row" style="top:' + (top + p * RH) + 'px"><div class="gd-c gd-t" style="background:inherit">' + tfmt(k) + '</div>';
        for (let c = 0; c < S.names.length; c++){
          const v = S.vals[c][k], ins = sb && p >= sb.r1 && p <= sb.r2 && c >= sb.c1 && c <= sb.c2;
          h += '<div class="gd-c' + (ins ? ' sel' : '') + (S.fault[c][k] ? ' flt' : '') + (v !== v ? ' nan' : '') + '" data-p="' + p + '" data-c="' + c + '">' + nf(v, S.names[c]) + '</div>';
        }
        h += '</div>';
      }
      rowsEl.innerHTML = h;
      stats();
    }
    function stats(){
      const sb = sel(); let t = S.rows.toLocaleString() + ' rows x ' + S.names.length + ' columns';
      if (sb){
        let n = 0, sum = 0, mn = Infinity, mx = -Infinity, first = null, last = null;
        for (let p = sb.r1; p <= sb.r2; p++) for (let c = sb.c1; c <= sb.c2; c++){ const v = S.vals[c][S.view[p]]; if (v !== v) continue; n++; sum += v; if (v < mn) mn = v; if (v > mx) mx = v; if (first === null) first = v; last = v; }
        t = n ? '<span>Count <b>' + n + '</b></span><span>Sum <b>' + sum.toFixed(2) + '</b></span><span>Average <b>' + (sum / n).toFixed(2) + '</b></span><span>Min <b>' + mn.toFixed(2) + '</b></span><span>Max <b>' + mx.toFixed(2) + '</b></span><span>Last - first <b>' + (last - first).toFixed(2) + '</b></span>' : '<span>no values in the selection</span>';
        t += '<span>(' + (sb.r2 - sb.r1 + 1) + ' rows x ' + (sb.c2 - sb.c1 + 1) + ' cols)</span>';
      } else t = '<span>' + t + '</span><span>click a cell, shift-click to extend, Ctrl+C to copy, click a heading to sort</span>';
      stat.innerHTML = t;
    }
    function block(){
      const sb = sel(); if (!sb) return null; let lines = [];
      lines.push(['time'].concat(S.names.slice(sb.c1, sb.c2 + 1)).join('\t'));
      for (let p = sb.r1; p <= sb.r2; p++){ const k = S.view[p]; const l = [tfmt(k)]; for (let c = sb.c1; c <= sb.c2; c++){ const v = S.vals[c][k]; l.push(v === v ? String(+v.toFixed(4)) : ''); } lines.push(l.join('\t')); }
      return lines.join('\n');
    }
    function copy(){
      const t = block(); if (!t) return say('select cells first', 'bad');
      const done = () => say('copied ' + (t.split('\n').length - 1) + ' rows - paste into Excel', 'ok');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback());
      else fallback();
      function fallback(){ const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { say('copy was blocked by the browser', 'bad'); } ta.remove(); }
    }
    function csv(){
      const lines = [['time_ict'].concat(S.names).join(',')];
      for (let p = 0; p < S.rows; p++){ const k = S.view[p]; const l = [tfmt(k)]; for (let c = 0; c < S.names.length; c++){ const v = S.vals[c][k]; l.push(v === v ? String(+v.toFixed(5)) : ''); } lines.push(l.join(',')); }
      const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'phangan_' + activeStation + '_' + S.res + 's.csv'; document.body.appendChild(a); a.click(); a.remove();
      say('CSV with ' + S.rows.toLocaleString() + ' rows downloaded', 'ok');
    }
    scroll.addEventListener('scroll', () => draw(false));
    scroll.addEventListener('click', e => {
      const h = e.target.closest('[data-sort]');
      if (h){ const k = h.dataset.sort; if (k === 't') S.sortC = null; else { const c = +k; if (S.sortC === c) S.sortD = -S.sortD; else { S.sortC = c; S.sortD = 1; } } S.a = null; S.f = null; makeView(); draw(true); return; }
      const td = e.target.closest('[data-p]'); if (!td) return;
      const p = +td.dataset.p, c = +td.dataset.c;
      if (e.shiftKey && S.a) S.f = { p: p, c: c }; else { S.a = { p: p, c: c }; S.f = { p: p, c: c }; }
      draw(false);
    });
    scroll.addEventListener('dblclick', e => { const h = e.target.closest('[data-sort]'); if (h && h.dataset.sort !== 't'){ const c = +h.dataset.sort; S.a = { p: 0, c: c }; S.f = { p: Math.max(0, S.rows - 1), c: c }; draw(false); } });
    scroll.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c'){ e.preventDefault(); copy(); } });
    new ResizeObserver(() => { if (dataOn) draw(false); }).observe(scroll);
    G = { rebuild: rebuild, copy: copy, csv: csv, colsPop: pop };
  }

  showTab('Home');
  syncOn();
  msg.textContent = chartLabel();
}
})();
