/* "Auto trend lines (slide method)" workbench: step-corrected daily tilt, trend lines for EVERY stretch, speed classes, a table,
   plus Filter (cleaning rules, excluded date ranges) and Shift (which steps are removed, add your own, faint line = data before the shift). */
(function(){
const COL = { 'ช้ามาก': '#2E8B57', 'ช้า': '#C99A1B', 'ปานกลาง': '#E8751A', 'เร็ว': '#C62828' };
const KIND = { trend: 'แนวโน้ม', wander: 'แนวโน้มไม่สม่ำเสมอ', stable: 'นิ่ง', event: 'เหตุการณ์ช่วงสั้น', step: 'ขั้น (step)', settle: 'ปรับตัวหลังรีสตาร์ท' };
const STEPK = { common: 'หลายช่องพร้อมกัน', single: 'ช่องเดียวกระโดดผิดปกติ', visit: 'เข้าซ่อมหน้างาน (ผู้ใช้แจ้ง)', manual: 'เพิ่มเอง' };
const OPT_KEY = 'psw_trendopts_v1';
const DEF = () => ({ clean: { limit45: true, allzero: true, analog: true, frozen: true }, exclude: {}, skip: [], add: [] });
let opts = DEF(), R = null, Rkey = '', sel = { st: null, ch: null }, ui = { ghost: true, fitGhost: false, pop: null }, plot = null, ov = null;
try { const o = JSON.parse(localStorage.getItem(OPT_KEY)); if (o && o.clean) opts = Object.assign(DEF(), o); } catch(e){}
function saveOpts(){ try { localStorage.setItem(OPT_KEY, JSON.stringify(opts)); } catch(e){} }
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function compute(){
  const key = JSON.stringify(opts);
  if (R && key === Rkey) return R;
  const input = {}; STATIONS.forEach(st => { input[st.id] = { xs: st.xs, CH: st.CH }; });
  R = PSWTrends.analyze(input, opts); Rkey = key; return R;
}
function isLine(p){ return p.slopeDay !== undefined && p.kind !== 'step' && p.kind !== 'settle'; }
function weak(p){ return !(p.r2 >= 0.7); }
function perH(p){ return p.slopeDay / 24; }
function fmtS(v){ return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) < 0.001 ? 5 : 4); }
function dayEpoch(d){ return d * 86400 - 25200; }
function css(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }
function isDefault(){ return JSON.stringify(opts) === JSON.stringify(DEF()); }

function build(){
  ov = el('div', 'tr-ov'); ov.id = 'tr-ov'; ov.hidden = true;
  const pn = el('div', 'tr-panel'); ov.appendChild(pn);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) close(); });
  pn.innerHTML =
    '<div class="tr-head"><h2>Auto trend lines · เส้นแนวโน้มวิธีเดียวกับสไลด์</h2><button class="tr-x" type="button" aria-label="close">×</button></div>' +
    '<div class="tr-ctl" id="tr-ctl"></div><div class="tr-tools" id="tr-tools"></div><div class="tr-pop" id="tr-pop" hidden></div>' +
    '<div class="tr-chart" id="tr-chart"></div><div class="tr-leg" id="tr-leg"></div>' +
    '<div class="tr-grid"><div><h3>ช่วงของช่องที่เลือก</h3><div class="tr-tw" id="tr-ph"></div></div><div><h3>ทุกช่องของสถานี</h3><div class="tr-tw" id="tr-all"></div></div></div>' +
    '<details class="tr-note"><summary>วิธีคำนวณ (ตรงกับสไลด์)</summary><div id="tr-method"></div></details>';
  pn.querySelector('.tr-x').onclick = close;
  document.body.appendChild(ov);
}
function close(){ ov.hidden = true; document.body.classList.remove('tr-open'); if (plot){ plot.destroy(); plot = null; } }
function open(){
  if (!ov) build();
  const r = compute();
  if (!sel.st || !r[sel.st]) sel.st = (typeof activeStation !== 'undefined' && r[activeStation]) ? activeStation : Object.keys(r)[0];
  if (!sel.ch || r[sel.st].tc.indexOf(sel.ch) < 0) sel.ch = r[sel.st].tc[0];
  ov.hidden = false; document.body.classList.add('tr-open'); render();
}
function recompute(){
  const busy = document.getElementById('tr-info'); if (busy) busy.textContent = 'กำลังคำนวณ…';
  setTimeout(() => { saveOpts(); const r = compute(); if (r[sel.st].tc.indexOf(sel.ch) < 0) sel.ch = r[sel.st].tc[0]; render(); }, 20);
}
function render(){
  const r = compute(), S = r[sel.st];
  const ctl = document.getElementById('tr-ctl'); ctl.innerHTML = '';
  Object.keys(r).forEach(k => { const b = el('button', 'tr-b' + (k === sel.st ? ' on' : ''), STATIONS.find(s => s.id === k).label); b.type = 'button'; b.onclick = () => { sel.st = k; if (r[k].tc.indexOf(sel.ch) < 0) sel.ch = r[k].tc[0]; ui.pop = null; render(); }; ctl.appendChild(b); });
  const cs = el('select'); cs.setAttribute('aria-label', 'channel'); S.tc.forEach(c => cs.add(new Option(c, c))); cs.value = sel.ch; cs.onchange = () => { sel.ch = cs.value; render(); }; ctl.appendChild(cs);
  const info = el('span', 'tr-info', 'ข้อมูลถึง ' + PSWTrends.dayLabel(S.d0 + S.nd - 1) + ' · ฐาน = ค่าเฉลี่ย 3 วันแรกตั้งแต่ ' + PSWTrends.CONST.BASE_DATE + (isDefault() ? ' · ตั้งค่าตามสไลด์' : ' · ปรับตั้งค่าแล้ว')); info.id = 'tr-info'; ctl.appendChild(info);
  renderTools(S); renderPop(S); drawChart(S); fillTables(S);
  document.getElementById('tr-leg').innerHTML = ['ช้ามาก <0.004', 'ช้า 0.004–0.04', 'ปานกลาง 0.04–0.4', 'เร็ว >0.4'].map(t => '<span><i style="background:' + COL[t.split(' ')[0]] + '"></i>' + t + ' °/ชม.</span>').join('') +
    '<span><i class="tr-dash"></i>เส้นประ = R² &lt; 0.7 (แนวโน้มไม่ชัด)</span><span><i class="tr-step"></i>ขั้นที่หักออก</span><span><i class="tr-set"></i>ปรับตัวหลังรีสตาร์ท</span><span><i class="tr-gap"></i>ไม่มีข้อมูล</span><span><i class="tr-ghost"></i>ข้อมูลก่อนชิป</span>';
  document.getElementById('tr-method').innerHTML =
    'ล้างข้อมูลรายนาที (|tilt| &lt; 45°, นาทีที่ ≥70% ของช่องอ่านเป็น 0 = logger ดับ, ช่องอนาล็อกตัดค่ากระโดด, เซนเซอร์แช่แข็ง) → ค่ารายวัน (มัธยฐาน/ค่าเฉลี่ยในช่วง ±0.2°) → หักขั้น (หลายช่อง &gt;0.5° พร้อมกัน, ช่องเดียว &gt;5°, เข้าซ่อม 10 ต.ค. ST2, ต่อเนื่องหลังข้อมูลขาด ≥2 วัน) → ลบฐาน 3 วันแรก → ' +
    'ตัดเป็นช่วงที่มีข้อมูล → fit เส้นตรงหลายช่วง (สั้นสุด 5 วัน, ≤8 ช่วง) → รวมช่วงที่ต่างกันน้อยกว่า max(0.02°, 10% ของพิสัย) → จัดกลุ่ม: แนวโน้ม (≥10 วัน, |เปลี่ยน| ≥0.02°, R² ≥0.7), ไม่สม่ำเสมอ, นิ่ง, เหตุการณ์ (5–9 วัน) → ความเร็วตามเกณฑ์ Sheikh et al. 2021. หน้านี้วาดเส้นให้ทุกช่วง (สไลด์วาดเฉพาะเส้นที่เข้าเกณฑ์) ช่วงที่ R² ต่ำเป็นเส้นประ.<br>' +
    'ตรวจเทียบกับสคริปต์ Python ที่ใช้ทำสไลด์ด้วยข้อมูลชุดเดียวกัน (ถึง 3 พ.ย. 2569) ตอนตั้งค่าตามสไลด์: ค่ารายวันหลังหักขั้นต่างกัน ≤ 3×10⁻¹³°, ขั้น 39/39 ตรงกัน, ช่วง 197/197 ตรงกัน.';
}
function renderTools(S){
  const t = document.getElementById('tr-tools'); t.innerHTML = '';
  const mk = (label, key, tip) => { const b = el('button', 'tr-b tr-t' + (ui.pop === key ? ' on' : ''), label); b.type = 'button'; b.title = tip; b.onclick = () => { ui.pop = ui.pop === key ? null : key; renderTools(S); renderPop(S); }; t.appendChild(b); };
  mk('Filter · ฟิลเตอร์', 'filter', 'เลือกกฎล้างข้อมูล และตัดช่วงวันที่ที่ไม่ใช้');
  mk('Shift · ชิป', 'shift', 'เลือกว่าจะหักขั้นไหน เพิ่มขั้นเอง และดูข้อมูลก่อนชิปเป็นเส้นจาง');
  const g = el('label', 'tr-chk'); const gc = document.createElement('input'); gc.type = 'checkbox'; gc.checked = ui.ghost; gc.onchange = () => { ui.ghost = gc.checked; drawChart(S); };
  g.append(gc, document.createTextNode(' เส้นจาง = ข้อมูลก่อนชิป')); t.appendChild(g);
  const rs = el('button', 'tr-b', 'คืนค่าตามสไลด์'); rs.type = 'button'; rs.disabled = isDefault(); rs.onclick = () => { opts = DEF(); ui.pop = null; recompute(); }; t.appendChild(rs);
}
function renderPop(S){
  const p = document.getElementById('tr-pop'); p.innerHTML = ''; p.hidden = !ui.pop; if (!ui.pop) return;
  if (ui.pop === 'filter'){
    p.appendChild(el('div', 'tr-pt', 'กฎล้างข้อมูลรายนาที (ติ๊กออก = ไม่ใช้กฎนั้น)'));
    [['limit45', 'ตัดค่าที่ |tilt| > 45° (ค่าขยะตอน logger รีสตาร์ท)'], ['allzero', 'ตัดนาทีที่ ≥70% ของช่องอ่านเป็น 0 (logger ดับ)'], ['analog', 'ตัดค่ากระโดดของช่องอนาล็อก และช่วงเปลี่ยนเซนเซอร์'], ['frozen', 'ตัดช่วงที่เซนเซอร์แช่แข็ง (ค่าไม่เปลี่ยน ≥ 6 ชม.)']].forEach(([k, l]) => {
      const lb = el('label', 'tr-chk'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!opts.clean[k]; c.onchange = () => { opts.clean[k] = c.checked; recompute(); }; lb.append(c, document.createTextNode(' ' + l)); p.appendChild(lb);
    });
    p.appendChild(el('div', 'tr-pt', 'ตัดช่วงวันที่ออก (ไม่ใช้ข้อมูลช่วงนี้)'));
    const row = el('div', 'tr-row'); const chs = el('select'); chs.add(new Option('ทุกช่องของสถานี', '')); S.tc.forEach(c => chs.add(new Option(c, c)));
    const f = document.createElement('input'); f.type = 'datetime-local'; const to = document.createElement('input'); to.type = 'datetime-local';
    const add = el('button', 'tr-b', 'ตัดออก'); add.type = 'button';
    add.onclick = () => { const a = PSWTrends.epochOfLocal(f.value), b = PSWTrends.epochOfLocal(to.value); if (!(a === a && b === b && b > a)) { err.textContent = 'ใส่วันเวลาเริ่มและสิ้นสุดให้ถูกต้อง'; return; } (opts.exclude[sel.st] = opts.exclude[sel.st] || []).push({ from: a, to: b, ch: chs.value || null }); recompute(); };
    row.append(chs, document.createTextNode(' จาก '), f, document.createTextNode(' ถึง '), to, add); p.appendChild(row);
    const err = el('div', 'tr-err'); p.appendChild(err);
    (opts.exclude[sel.st] || []).forEach((r, i) => {
      const d = el('div', 'tr-li'); d.append(document.createTextNode((r.ch || 'ทุกช่อง') + ' · ' + new Date((r.from + 25200) * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' → ' + new Date((r.to + 25200) * 1000).toISOString().slice(0, 16).replace('T', ' ') + ' '));
      const x = el('button', 'tr-b', '×'); x.type = 'button'; x.onclick = () => { opts.exclude[sel.st].splice(i, 1); recompute(); }; d.appendChild(x); p.appendChild(d);
    });
  } else {
    p.appendChild(el('div', 'tr-pt', 'ขั้นของ ' + sel.ch + ' (ติ๊กออก = ไม่หักขั้นนั้น)'));
    const mine = S.steps.filter(s => s.ch === sel.ch).sort((a, b) => a.d - b.d);
    const skipped = opts.skip.filter(k => k.indexOf(sel.st + '|') === 0 && k.slice(-sel.ch.length - 1) === '|' + sel.ch).map(k => k.split('|')[1]);
    const rows = mine.map(s => ({ d: PSWTrends.dayLabel(s.d), v: s.v, kind: s.kind, on: true })).concat(skipped.map(d => ({ d, v: null, kind: 'skipped', on: false })));
    rows.sort((a, b) => a.d < b.d ? -1 : 1);
    if (!rows.length) p.appendChild(el('div', 'tr-li', 'ช่องนี้ไม่มีขั้นที่ต้องหัก'));
    rows.forEach(r => {
      const lb = el('label', 'tr-chk'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = r.on;
      const key = sel.st + '|' + r.d + '|' + sel.ch;
      c.onchange = () => { if (c.checked) opts.skip = opts.skip.filter(k => k !== key); else opts.skip.push(key); recompute(); };
      const kind = STEPK[r.kind] || (r.kind.indexOf('gap') === 0 ? 'ต่อเนื่องหลังข้อมูลขาด ' + r.kind.slice(4, -1) + ' วัน' : r.kind === 'skipped' ? 'ไม่หักขั้นนี้' : r.kind);
      lb.append(c, document.createTextNode(' ' + r.d + (r.v != null ? '  ' + (r.v >= 0 ? '+' : '−') + Math.abs(r.v).toFixed(3) + '°' : '') + ' · ' + kind)); p.appendChild(lb);
    });
    p.appendChild(el('div', 'tr-pt', 'เพิ่มขั้นเอง (เช่นวันที่เข้าซ่อม)'));
    const row = el('div', 'tr-row'); const dt = document.createElement('input'); dt.type = 'date'; const sz = document.createElement('input'); sz.type = 'number'; sz.step = 'any'; sz.placeholder = 'ขนาด ° (ว่าง = อ่านจากข้อมูล)'; sz.style.width = '210px';
    const sc = el('select'); sc.add(new Option('เฉพาะ ' + sel.ch, sel.ch)); sc.add(new Option('ทุกช่องของสถานี', ''));
    const ad = el('button', 'tr-b', 'เพิ่มขั้น'); ad.type = 'button'; const err = el('div', 'tr-err');
    ad.onclick = () => { if (!dt.value){ err.textContent = 'เลือกวันที่'; return; } opts.add.push({ st: sel.st, date: dt.value, ch: sc.value || null, v: sz.value === '' ? null : Number(sz.value) }); recompute(); };
    row.append(dt, sc, sz, ad); p.appendChild(row); p.appendChild(err);
    opts.add.filter(a => a.st === sel.st).forEach(a => {
      const d = el('div', 'tr-li'); d.append(document.createTextNode('เพิ่ม ' + a.date + ' · ' + (a.ch || 'ทุกช่อง') + (a.v != null ? ' · ' + a.v + '°' : ' · ขนาดจากข้อมูล') + ' '));
      const x = el('button', 'tr-b', '×'); x.type = 'button'; x.onclick = () => { opts.add = opts.add.filter(z => z !== a); recompute(); }; d.appendChild(x); p.appendChild(d);
    });
    const fg = el('label', 'tr-chk'); const fc = document.createElement('input'); fc.type = 'checkbox'; fc.checked = ui.fitGhost; fc.onchange = () => { ui.fitGhost = fc.checked; drawChart(S); };
    fg.append(fc, document.createTextNode(' ขยายแกนให้เห็นข้อมูลก่อนชิปทั้งหมด')); p.appendChild(fg);
  }
}
function drawChart(S){
  const holder = document.getElementById('tr-chart'); if (plot){ plot.destroy(); plot = null; } holder.innerHTML = '';
  const ch = sel.ch, corr = S.corr[ch], raw = S.raw[ch], xs = [], ys = [], gs = [];
  for (let d = S.bdDay - S.d0; d < S.nd; d++){ xs.push(dayEpoch(d + S.d0)); ys.push(corr[d] === corr[d] ? corr[d] : null); gs.push(raw[d] === raw[d] ? raw[d] : null); }
  const ph = S.phases.filter(p => p.ch === ch), steps = S.steps.filter(s => s.ch === ch);
  const lines = ph.filter(isLine).sort((a, b) => a.start - b.start);
  const ink = css('--ink-2'), grid = css('--line-soft');
  const hook = u => {
    const { ctx } = u, dpr = devicePixelRatio || 1, L = u.bbox.left, T = u.bbox.top, W = u.bbox.width, H = u.bbox.height;
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, W, H); ctx.clip();
    const X = d => u.valToPos(dayEpoch(d), 'x', true), Y = v => u.valToPos(v, 'y', true);
    let gs0 = null; const pat = (typeof gapPattern === 'function') ? gapPattern(ctx, dpr) : null;
    for (let d = S.bdDay; d <= S.d0 + S.nd; d++){
      const miss = d < S.d0 + S.nd && !(corr[d - S.d0] === corr[d - S.d0]);
      if (miss && gs0 === null) gs0 = d;
      if (!miss && gs0 !== null){ const x1 = X(gs0), x2 = X(d); ctx.fillStyle = 'rgba(178,58,42,0.08)'; ctx.fillRect(x1, T, x2 - x1, H); if (pat){ ctx.fillStyle = pat; ctx.fillRect(x1, T, x2 - x1, H); } gs0 = null; }
    }
    ph.filter(p => p.kind === 'settle').forEach(p => { const x1 = X(p.start), x2 = X(p.end + 1); ctx.fillStyle = 'rgba(120,130,140,0.22)'; ctx.fillRect(x1, T, x2 - x1, H); });
    ctx.font = (10 * dpr) + 'px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top';
    steps.forEach(s => {
      const x = X(s.d); ctx.strokeStyle = 'rgba(178,58,42,0.9)'; ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(178,58,42,1)'; ctx.fillText('step ' + (s.v >= 0 ? '+' : '−') + Math.abs(s.v).toFixed(2) + '°', x + 3 * dpr, T + 3 * dpr);
    });
    const tags = [];
    lines.forEach(p => {
      const c = COL[PSWTrends.speedOf(perH(p))], x0 = p.start - p.blk0, x1 = p.end - p.blk0, dashed = weak(p);
      const a = Y(p.slopeDay * x0 + p.icpt), b = Y(p.slopeDay * x1 + p.icpt);
      ctx.strokeStyle = css('--panel'); ctx.lineWidth = 5 * dpr; ctx.globalAlpha = .8; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(X(p.start), a); ctx.lineTo(X(p.end), b); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = c; ctx.lineWidth = 2.6 * dpr; ctx.setLineDash(dashed ? [6 * dpr, 4 * dpr] : []); ctx.beginPath(); ctx.moveTo(X(p.start), a); ctx.lineTo(X(p.end), b); ctx.stroke(); ctx.setLineDash([]);
      if (X(p.end) - X(p.start) > 56 * dpr) tags.push({ x: (X(p.start) + X(p.end)) / 2, y: (a + b) / 2, c, t: fmtS(perH(p)) + ' °/h' + (dashed ? ' *' : '') });
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = 'bold ' + (10 * dpr) + 'px "IBM Plex Mono", monospace';
    tags.sort((p, q) => p.x - q.x).forEach((t, i) => { const w = ctx.measureText(t.t).width + 8 * dpr, y = t.y - (8 + (i % 2) * 14) * dpr; ctx.fillStyle = t.c; ctx.fillRect(t.x - w / 2, y - 12 * dpr, w, 14 * dpr); ctx.fillStyle = '#fff'; ctx.fillText(t.t, t.x, y + 1 * dpr); });
    ctx.restore();
  };
  const vals = ys.filter(v => v != null), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  const series = [{}, { label: ch, stroke: css('--ink-3'), width: 1, points: { show: true, size: 4, fill: css('--ink-3') }, spanGaps: false }];
  const data = [xs, ys];
  if (ui.ghost && S.steps.some(s => s.ch === ch)){ series.push({ label: 'ก่อนชิป', stroke: css('--ink-3'), width: 1.4, dash: [5, 4], points: { show: false }, spanGaps: false, alpha: 0.5 }); data.push(gs); }
  const yRange = (u, dMin, dMax) => {
    let a = lo, b = hi; if (ui.fitGhost){ const g = gs.filter(v => v != null); if (g.length){ a = Math.min(a, Math.min.apply(null, g)); b = Math.max(b, Math.max.apply(null, g)); } }
    if (!(isFinite(a) && isFinite(b))) return [0, 1]; const pad = Math.max((b - a) * 0.12, 0.03); return [a - pad, b + pad];
  };
  const opt = {
    width: holder.clientWidth || 900, height: 360, tzDate: ts => uPlot.tzDate(new Date(ts * 1e3), 'Asia/Bangkok'),
    scales: { x: { time: true }, y: { auto: true, range: yRange } }, legend: { show: false }, cursor: { drag: { x: false, y: false } },
    axes: [{ stroke: ink, grid: { stroke: grid, width: 1 }, ticks: { stroke: grid }, label: 'วันที่ (เวลาไทย)', labelSize: 18, font: '11px "IBM Plex Mono", monospace', labelFont: 'bold 12px "IBM Plex Sans", sans-serif' },
           { stroke: ink, grid: { stroke: grid, width: 1 }, ticks: { stroke: grid }, size: 60, label: 'ค่าเอียงสะสมหลังหักขั้น (°)', labelFont: 'bold 12px "IBM Plex Sans", sans-serif', font: '11px "IBM Plex Mono", monospace' }],
    series, hooks: { draw: [hook] }
  };
  plot = new uPlot(opt, data, holder);
}
function fillTables(S){
  const ch = sel.ch, rows = S.phases.filter(p => p.ch === ch).sort((a, b) => a.start - b.start || (a.kind === 'step' ? -1 : 1));
  let h = '<table><thead><tr><th>ประเภท</th><th>จาก</th><th>ถึง</th><th>วัน</th><th>เปลี่ยน (°)</th><th>ความชัน (°/ชม.)</th><th>ระดับ</th><th>R²</th></tr></thead><tbody>';
  rows.forEach(p => {
    const hasS = isLine(p), sp = hasS ? PSWTrends.speedOf(perH(p)) : '';
    h += '<tr><td>' + (KIND[p.kind] || p.kind) + '</td><td>' + PSWTrends.dayLabel(p.start) + '</td><td>' + PSWTrends.dayLabel(p.end) + '</td><td>' + p.n + '</td><td>' + (p.net >= 0 ? '+' : '−') + Math.abs(p.net).toFixed(3) + '</td><td>' + (hasS ? fmtS(perH(p)) : '') + '</td><td>' + (hasS ? '<span class="tr-pill" style="background:' + COL[sp] + '">' + sp + '</span>' : '') + '</td><td>' + (p.r2 === p.r2 && p.r2 != null ? p.r2.toFixed(2) + (hasS && weak(p) ? ' *' : '') : '') + '</td></tr>';
  });
  const st = S.steps.filter(s => s.ch === ch);
  if (st.length){ h += '<tr class="tr-sep"><td colspan="8">ขั้นที่หักออกของช่องนี้</td></tr>'; st.sort((a, b) => a.d - b.d).forEach(s => { h += '<tr><td>step</td><td colspan="2">' + PSWTrends.dayLabel(s.d) + '</td><td></td><td>' + (s.v >= 0 ? '+' : '−') + Math.abs(s.v).toFixed(3) + '</td><td colspan="3">' + (STEPK[s.kind] || (s.kind.indexOf('gap') === 0 ? 'ต่อเนื่องหลังข้อมูลขาด ' + s.kind.slice(4, -1) + ' วัน' : s.kind)) + '</td></tr>'; }); }
  document.getElementById('tr-ph').innerHTML = h + '</tbody></table><div class="tr-fn">* R² &lt; 0.7: แนวโน้มไม่ชัด วาดเป็นเส้นประเพื่อให้เห็นความเร็วของช่วงนั้น</div>';
  let a = '<table><thead><tr><th>ช่อง</th><th>เส้น</th><th>เร็วสุด (°/ชม.)</th><th>ระดับ</th><th>ขั้น</th></tr></thead><tbody>';
  S.tc.forEach(c => {
    const ls = S.phases.filter(p => p.ch === c && isLine(p)); let fast = null; ls.forEach(p => { if (!fast || Math.abs(p.slopeDay) > Math.abs(fast.slopeDay)) fast = p; });
    const sp = fast ? PSWTrends.speedOf(perH(fast)) : '';
    a += '<tr class="tr-row' + (c === sel.ch ? ' on' : '') + '" data-ch="' + c + '"><td><b>' + c + '</b></td><td>' + ls.length + '</td><td>' + (fast ? fmtS(perH(fast)) : '') + '</td><td>' + (fast ? '<span class="tr-pill" style="background:' + COL[sp] + '">' + sp + '</span>' : '') + '</td><td>' + S.steps.filter(s => s.ch === c).length + '</td></tr>';
  });
  const box = document.getElementById('tr-all'); box.innerHTML = a + '</tbody></table>';
  box.querySelectorAll('.tr-row').forEach(r => r.onclick = () => { sel.ch = r.dataset.ch; render(); });
}
window.PSWTrendsUI = { open, close, compute, get result(){ return R; }, get opts(){ return opts; } };
})();
