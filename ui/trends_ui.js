/* "Auto trend lines (slide method)": step-corrected daily tilt + piecewise trend lines, speed classes and a table - the same analysis as the slides (see trends.js). */
(function(){
const COL = { 'ช้ามาก': '#2E8B57', 'ช้า': '#C99A1B', 'ปานกลาง': '#E8751A', 'เร็ว': '#C62828' };
const KIND = { trend: 'แนวโน้ม', wander: 'แนวโน้มไม่สม่ำเสมอ', stable: 'นิ่ง', event: 'เหตุการณ์ช่วงสั้น', step: 'ขั้น (step)', settle: 'ปรับตัวหลังรีสตาร์ท' };
const STEPK = { common: 'หลายช่องพร้อมกัน', single: 'ช่องเดียวกระโดดผิดปกติ', visit: 'เข้าซ่อมหน้างาน (ผู้ใช้แจ้ง)' };
let R = null, sel = { st: null, ch: null }, plot = null, ov = null;
function el(tag, cls, txt){ const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function compute(){
  if (R) return R;
  const input = {}; STATIONS.forEach(st => { input[st.id] = { xs: st.xs, CH: st.CH }; });
  R = PSWTrends.analyze(input); return R;
}
function isLine(p){ return p.slopeDay !== undefined && (p.kind === 'trend' || p.kind === 'wander' || (p.kind === 'stable' && p.n >= 5) || (p.kind === 'event' && p.r2 >= 0.7)); }
function perH(p){ return p.slopeDay / 24; }
function fmtS(v){ return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(Math.abs(v) < 0.001 ? 5 : 4); }
function dayEpoch(d){ return d * 86400 - 25200; }
function css(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888'; }

function build(){
  ov = el('div', 'tr-ov'); ov.id = 'tr-ov'; ov.hidden = true;
  const pn = el('div', 'tr-panel'); ov.appendChild(pn);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && !ov.hidden) close(); });
  pn.innerHTML =
    '<div class="tr-head"><h2>Auto trend lines · เส้นแนวโน้มวิธีเดียวกับสไลด์</h2><button class="tr-x" type="button" aria-label="close">×</button></div>' +
    '<div class="tr-ctl" id="tr-ctl"></div><div class="tr-chart" id="tr-chart"></div><div class="tr-leg" id="tr-leg"></div>' +
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
  ov.hidden = false; document.body.classList.add('tr-open');
  render();
}
function render(){
  const r = compute(), S = r[sel.st];
  const ctl = document.getElementById('tr-ctl'); ctl.innerHTML = '';
  Object.keys(r).forEach(k => { const b = el('button', 'tr-b' + (k === sel.st ? ' on' : ''), STATIONS.find(s => s.id === k).label); b.type = 'button'; b.onclick = () => { sel.st = k; if (r[k].tc.indexOf(sel.ch) < 0) sel.ch = r[k].tc[0]; render(); }; ctl.appendChild(b); });
  const cs = el('select'); cs.setAttribute('aria-label', 'channel');
  S.tc.forEach(c => cs.add(new Option(c, c))); cs.value = sel.ch; cs.onchange = () => { sel.ch = cs.value; render(); }; ctl.appendChild(cs);
  const info = el('span', 'tr-info', 'ข้อมูลถึง ' + PSWTrends.dayLabel(S.d0 + S.nd - 1) + ' · ฐาน = ค่าเฉลี่ย 3 วันแรกตั้งแต่ ' + PSWTrends.CONST.BASE_DATE); ctl.appendChild(info);
  drawChart(S); fillTables(S);
  document.getElementById('tr-leg').innerHTML = ['ช้ามาก <0.004', 'ช้า 0.004–0.04', 'ปานกลาง 0.04–0.4', 'เร็ว >0.4'].map(t => '<span><i style="background:' + COL[t.split(' ')[0]] + '"></i>' + t + ' °/ชม.</span>').join('') +
    '<span><i class="tr-step"></i>ขั้นที่หักออก (step)</span><span><i class="tr-set"></i>ปรับตัวหลังรีสตาร์ท</span><span><i class="tr-gap"></i>ไม่มีข้อมูล</span>';
  document.getElementById('tr-method').innerHTML =
    'ล้างข้อมูลรายนาที (|tilt| &lt; 45°, นาทีที่ ≥70% ของช่องอ่านเป็น 0 = logger ดับ, ช่องอนาล็อกตัดค่ากระโดด, เซนเซอร์แช่แข็ง) → ค่ารายวัน (มัธยฐาน/ค่าเฉลี่ยในช่วง ±0.2°) → หักขั้น (หลายช่อง &gt;0.5° พร้อมกัน, ช่องเดียว &gt;5°, เข้าซ่อม 10 ต.ค. ST2, ต่อเนื่องหลังข้อมูลขาด ≥2 วัน) → ลบฐาน 3 วันแรก → ' +
    'ตัดเป็นช่วงที่มีข้อมูล → fit เส้นตรงหลายช่วง (สั้นสุด 5 วัน, ≤8 ช่วง) → รวมช่วงที่ต่างกันน้อยกว่า max(0.02°, 10% ของพิสัย) → จัดกลุ่ม: แนวโน้ม (≥10 วัน, |เปลี่ยน| ≥0.02°, R² ≥0.7), ไม่สม่ำเสมอ, นิ่ง, เหตุการณ์ (5–9 วัน) → ความเร็วตามเกณฑ์ Sheikh et al. 2021.<br>' +
    'ตรวจเทียบกับสคริปต์ Python ที่ใช้ทำสไลด์ด้วยข้อมูลชุดเดียวกัน (ถึง 3 พ.ย. 2569): ค่ารายวันหลังหักขั้นต่างกัน ≤ 3×10⁻¹³°, ขั้น 39/39 ตรงกัน, ช่วง 197/197 ตรงกัน.';
}
function drawChart(S){
  const holder = document.getElementById('tr-chart'); if (plot){ plot.destroy(); plot = null; } holder.innerHTML = '';
  const ch = sel.ch, corr = S.corr[ch], xs = [], ys = [];
  for (let d = S.bdDay - S.d0; d < S.nd; d++){ xs.push(dayEpoch(d + S.d0)); ys.push(corr[d] === corr[d] ? corr[d] : null); }
  const ph = S.phases.filter(p => p.ch === ch), steps = S.steps.filter(s => s.ch === ch);
  const lines = ph.filter(isLine).sort((a, b) => a.start - b.start);
  const ink = css('--ink-2'), grid = css('--line-soft');
  const hook = u => {
    const { ctx } = u, dpr = devicePixelRatio || 1, L = u.bbox.left, T = u.bbox.top, W = u.bbox.width, H = u.bbox.height;
    ctx.save(); ctx.beginPath(); ctx.rect(L, T, W, H); ctx.clip();
    const X = d => u.valToPos(dayEpoch(d), 'x', true), Y = v => u.valToPos(v, 'y', true);
    // no-data stretches (usable day missing) as red hatch
    let gs = null; const pat = (typeof gapPattern === 'function') ? gapPattern(ctx, dpr) : null;
    for (let d = S.bdDay; d <= S.d0 + S.nd; d++){
      const miss = d < S.d0 + S.nd && !(corr[d - S.d0] === corr[d - S.d0]);
      if (miss && gs === null) gs = d;
      if (!miss && gs !== null){ const x1 = X(gs), x2 = X(d); ctx.fillStyle = 'rgba(178,58,42,0.08)'; ctx.fillRect(x1, T, x2 - x1, H); if (pat){ ctx.fillStyle = pat; ctx.fillRect(x1, T, x2 - x1, H); } gs = null; }
    }
    ph.filter(p => p.kind === 'settle').forEach(p => { const x1 = X(p.start), x2 = X(p.end + 1); ctx.fillStyle = 'rgba(120,130,140,0.22)'; ctx.fillRect(x1, T, x2 - x1, H); });
    ctx.font = (10 * dpr) + 'px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top';
    steps.forEach(s => {
      const x = X(s.d); ctx.strokeStyle = 'rgba(178,58,42,0.9)'; ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.lineWidth = 1.2 * dpr; ctx.beginPath(); ctx.moveTo(x, T); ctx.lineTo(x, T + H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(178,58,42,1)'; ctx.fillText('step ' + (s.v >= 0 ? '+' : '−') + Math.abs(s.v).toFixed(2) + '°', x + 3 * dpr, T + 3 * dpr);
    });
    const tags = [];
    lines.forEach(p => {
      const c = COL[PSWTrends.speedOf(perH(p))], x0 = p.start - p.blk0, x1 = p.end - p.blk0;
      const a = Y(p.slopeDay * x0 + p.icpt), b = Y(p.slopeDay * x1 + p.icpt);
      ctx.strokeStyle = css('--panel'); ctx.lineWidth = 5 * dpr; ctx.globalAlpha = .8; ctx.beginPath(); ctx.moveTo(X(p.start), a); ctx.lineTo(X(p.end), b); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = c; ctx.lineWidth = 2.6 * dpr; ctx.beginPath(); ctx.moveTo(X(p.start), a); ctx.lineTo(X(p.end), b); ctx.stroke();
      if (X(p.end) - X(p.start) > 70 * dpr) tags.push({ x: (X(p.start) + X(p.end)) / 2, y: (a + b) / 2, c, t: fmtS(perH(p)) + ' °/h' });
    });
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.font = 'bold ' + (10 * dpr) + 'px "IBM Plex Mono", monospace';
    tags.sort((p, q) => p.x - q.x).forEach((t, i) => { const w = ctx.measureText(t.t).width + 8 * dpr, y = t.y - (8 + (i % 2) * 14) * dpr; ctx.fillStyle = t.c; ctx.fillRect(t.x - w / 2, y - 12 * dpr, w, 14 * dpr); ctx.fillStyle = '#fff'; ctx.fillText(t.t, t.x, y + 1 * dpr); });
    ctx.restore();
  };
  const opts = {
    width: holder.clientWidth || 900, height: 360, tzDate: ts => uPlot.tzDate(new Date(ts * 1e3), 'Asia/Bangkok'),
    scales: { x: { time: true }, y: { auto: true } }, legend: { show: false }, cursor: { drag: { x: false, y: false } },
    axes: [{ stroke: ink, grid: { stroke: grid, width: 1 }, ticks: { stroke: grid }, label: 'วันที่ (เวลาไทย)', labelSize: 18, font: '11px "IBM Plex Mono", monospace', labelFont: 'bold 12px "IBM Plex Sans", sans-serif' },
           { stroke: ink, grid: { stroke: grid, width: 1 }, ticks: { stroke: grid }, size: 60, label: 'ค่าเอียงสะสมหลังหักขั้น (°)', labelFont: 'bold 12px "IBM Plex Sans", sans-serif', font: '11px "IBM Plex Mono", monospace' }],
    series: [{}, { label: ch, stroke: css('--ink-3'), width: 1, points: { show: true, size: 4, fill: css('--ink-3') }, spanGaps: false }], hooks: { draw: [hook] }
  };
  plot = new uPlot(opts, [xs, ys], holder);
}
function fillTables(S){
  const ch = sel.ch, rows = S.phases.filter(p => p.ch === ch).sort((a, b) => a.start - b.start || (a.kind === 'step' ? -1 : 1));
  let h = '<table><thead><tr><th>ประเภท</th><th>จาก</th><th>ถึง</th><th>วัน</th><th>เปลี่ยน (°)</th><th>ความชัน (°/ชม.)</th><th>ระดับ</th><th>R²</th></tr></thead><tbody>';
  rows.forEach(p => {
    const hasS = isLine(p), sp = hasS ? PSWTrends.speedOf(perH(p)) : '';
    h += '<tr><td>' + (KIND[p.kind] || p.kind) + '</td><td>' + PSWTrends.dayLabel(p.start) + '</td><td>' + PSWTrends.dayLabel(p.end) + '</td><td>' + p.n + '</td><td>' + (p.net >= 0 ? '+' : '−') + Math.abs(p.net).toFixed(3) + '</td><td>' + (hasS ? fmtS(perH(p)) : '') + '</td><td>' + (hasS ? '<span class="tr-pill" style="background:' + COL[sp] + '">' + sp + '</span>' : '') + '</td><td>' + (p.r2 === p.r2 && p.r2 != null ? p.r2.toFixed(2) : '') + '</td></tr>';
  });
  const st = S.steps.filter(s => s.ch === ch);
  if (st.length){ h += '<tr class="tr-sep"><td colspan="8">ขั้นที่หักออกของช่องนี้</td></tr>'; st.sort((a, b) => a.d - b.d).forEach(s => { h += '<tr><td>step</td><td colspan="2">' + PSWTrends.dayLabel(s.d) + '</td><td></td><td>' + (s.v >= 0 ? '+' : '−') + Math.abs(s.v).toFixed(3) + '</td><td colspan="3">' + (STEPK[s.kind] || (s.kind.indexOf('gap') === 0 ? 'ต่อเนื่องหลังข้อมูลขาด ' + s.kind.slice(4, -1) + ' วัน' : s.kind)) + '</td></tr>'; }); }
  document.getElementById('tr-ph').innerHTML = h + '</tbody></table>';
  let a = '<table><thead><tr><th>ช่อง</th><th>เส้น</th><th>เร็วสุด (°/ชม.)</th><th>ระดับ</th><th>ขั้น</th></tr></thead><tbody>';
  S.tc.forEach(c => {
    const ls = S.phases.filter(p => p.ch === c && isLine(p)); let fast = null; ls.forEach(p => { if (!fast || Math.abs(p.slopeDay) > Math.abs(fast.slopeDay)) fast = p; });
    const sp = fast ? PSWTrends.speedOf(perH(fast)) : '';
    a += '<tr class="tr-row' + (c === sel.ch ? ' on' : '') + '" data-ch="' + c + '"><td><b>' + c + '</b></td><td>' + ls.length + '</td><td>' + (fast ? fmtS(perH(fast)) : '') + '</td><td>' + (fast ? '<span class="tr-pill" style="background:' + COL[sp] + '">' + sp + '</span>' : '') + '</td><td>' + S.steps.filter(s => s.ch === c).length + '</td></tr>';
  });
  const box = document.getElementById('tr-all'); box.innerHTML = a + '</tbody></table>';
  box.querySelectorAll('.tr-row').forEach(r => r.onclick = () => { sel.ch = r.dataset.ch; render(); });
}
window.PSWTrendsUI = { open, close, compute, get result(){ return R; } };
})();
