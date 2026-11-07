/* Slide-method tilt analysis in JavaScript: the same steps as prep_analysis.py (the analysis behind the slides).
 *   clean minutes -> daily median / daily mean -> step detection -> step-corrected daily series (base = first 3 days from 27 Jun)
 *   -> blocks of usable days -> piecewise-linear fit -> merge -> classify (trend / wander / stable / event) -> speed class.
 * Pure functions: works in the browser (window.PSWTrends) and in Node (module.exports) so it can be checked against Python.
 * Input: { st1: { xs: epoch seconds (1-min grid), CH: { tilt_1_x: Float64Array, ... } }, st2: {...} }   (all constants below = prep_analysis.py)
 */
(function (root) {
'use strict';
const TILT_MAX = 45.0, ALLZERO_FRAC = 0.7, ZERO_EPS = 0.005, MIN_MIN_TILT = 240, MEAN_BAND = 0.2, MEAN_MIN_KEEP = 120, MIN_MIN_VALID = 720;
const STEP_SMALL = 0.5, STEP_COMMON_N = 3, STEP_SINGLE = 5.0;
const BASE_DATE = '2026-06-27', BASE_NDAYS = 3;
const EP_EV_MIN = 0.02, EP_REL_MIN = 0.10, EP_TREND_R2 = 0.7, EP_TREND_DAYS = 10, EP_MINSEG = 5, EP_KMAX = 8, EP_SIG_MIN = 0.002;
const EP_SETTLE_K = 3.0, EP_SETTLE_DAYS = 3, EP_SETTLE_MAX = 7, EP_BREAK_MIN = EP_EV_MIN, EP_SPLIT_GAIN = 0.5;
const ANALOG_TOL = 0.5, ANALOG_NIGHT_MIN = 60, GAP_CONT_DAYS = 2;
const ANALOG_CUT = { st1: [['2026-10-09 10:00', '2026-10-10 09:59', ['tilt_5', 'tilt_6', 'tilt_7']]], st2: [['2026-10-09 15:00', '2026-10-10 20:59', ['tilt_5', 'tilt_6']]] };
const FIRST_VALID = { st1: '2026-06-25 16:00', st2: '2026-06-25 16:30' };
const VISIT_STEPS = { st2: ['2026-10-10'] }, VISIT_STEP_MIN = 0.1;
const BOXES = { st1: { '10': ['tilt_8', 'soil_moisture_1', 'soil_moisture_2', 'soil_moisture_3', 'soil_temp_1', 'soil_temp_2', 'soil_temp_3'],
                       '12': ['tilt_9', 'soil_moisture_4', 'soil_moisture_5', 'soil_moisture_6', 'soil_temp_4', 'soil_temp_5', 'soil_temp_6'] } };
const FROZEN_MIN = 360, FROZEN_MERGE = 180;

function epochOfLocal(s) { const m = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/.exec(s); return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) / 1000 - 25200; }
function dayOf(t) { return Math.floor((t + 25200) / 86400); }
function dayOfStr(s) { return dayOf(epochOfLocal(s)); }
function dayLabel(d) { return new Date(d * 86400000).toISOString().slice(0, 10); }
function median(a) { const n = a.length; if (!n) return NaN; const s = Float64Array.from(a).sort(); return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
function tiltKey(c) { const p = c.split('_'); return [parseInt(p[1], 10), p[2] || '']; }
function cmpTilt(a, b) { const x = tiltKey(a), y = tiltKey(b); return x[0] - y[0] || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0); }
function upperBound(xs, t) { let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] <= t) lo = m + 1; else hi = m; } return lo; }
function lowerBound(xs, t) { let lo = 0, hi = xs.length; while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < t) lo = m + 1; else hi = m; } return lo; }

function lin(x, y) {                       // least squares, like np.polyfit(x, y, 1); returns [slope, intercept, SSE]
  const n = x.length; let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n; let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx; sxx += dx * dx; sxy += dx * (y[i] - my); }
  const a = sxx > 0 ? sxy / sxx : 0, b = my - a * mx; let sse = 0;
  for (let i = 0; i < n; i++) { const r = y[i] - (a * x[i] + b); sse += r * r; }
  return [a, b, sse];
}

// ---------------------------------------------------------------- minutes -> clean minutes
function findFrozen(k, xs, cols) {
  const out = [], bx = BOXES[k] || {};
  Object.keys(bx).forEach(box => {
    const cs = bx[box].filter(c => cols[c]); if (!cs.length) return;
    const n = xs.length, runs = []; let start = -1;
    for (let i = 0; i <= n; i++) {
      let still = false;
      if (i > 0 && i < n) { still = true; for (const c of cs) { const v = cols[c][i], p = cols[c][i - 1]; if (!(v === v && p === p && v === p)) { still = false; break; } } }
      if (still && start < 0) start = i;
      if (!still && start >= 0) { if (i - start >= FROZEN_MIN) runs.push([start, i - 1]); start = -1; }
    }
    const merged = [];
    runs.forEach(([a, b]) => { if (merged.length && (xs[a] - xs[merged[merged.length - 1][1]]) < FROZEN_MERGE * 60) merged[merged.length - 1][1] = b; else merged.push([a, b]); });
    merged.forEach(([a, b]) => out.push({ box, a, b, chans: cs }));
  });
  return out;
}
function cleanTilt(k, S) {
  const xs = S.xs, n = xs.length, cols = {};
  const need = new Set(); Object.keys(BOXES[k] || {}).forEach(bx => BOXES[k][bx].forEach(c => need.add(c)));
  Object.keys(S.CH).filter(c => /^tilt_\d+(_[xy])?$/.test(c) || need.has(c)).forEach(c => { cols[c] = Float64Array.from(S.CH[c]); });
  const fv = FIRST_VALID[k];
  if (fv) { const e = upperBound(xs, epochOfLocal(fv)); Object.keys(cols).filter(c => /^(tilt|soil)/.test(c)).forEach(c => { for (let i = 0; i < e; i++) cols[c][i] = NaN; }); }
  const frozen = findFrozen(k, xs, cols);
  frozen.forEach(f => f.chans.forEach(c => { for (let i = f.a; i <= f.b; i++) cols[c][i] = NaN; }));
  const tc = Object.keys(cols).filter(c => /^tilt_\d+(_[xy])?$/.test(c)).sort(cmpTilt);
  const t = {}; tc.forEach(c => { const a = new Float64Array(n); for (let i = 0; i < n; i++) { const v = cols[c][i]; a[i] = Math.abs(v) < TILT_MAX ? v : NaN; } t[c] = a; });
  let nAllZero = 0;
  for (let i = 0; i < n; i++) {
    let z = 0; for (const c of tc) if (Math.abs(cols[c][i]) < ZERO_EPS) z++;
    if (z >= ALLZERO_FRAC * tc.length) { nAllZero++; for (const c of tc) t[c][i] = NaN; }
  }
  (ANALOG_CUT[k] || []).forEach(([a, b, cs]) => { const i0 = lowerBound(xs, epochOfLocal(a)), i1 = upperBound(xs, epochOfLocal(b)); cs.forEach(c => { if (t[c]) for (let i = i0; i < i1; i++) t[c][i] = NaN; }); });
  // analog (one underscore) channels: drop minutes further than ANALOG_TOL from BOTH night-time levels of their day
  const day = new Int32Array(n), hr = new Int8Array(n);
  for (let i = 0; i < n; i++) { const l = xs[i] + 25200; day[i] = Math.floor(l / 86400); hr[i] = Math.floor((l % 86400) / 3600); }
  tc.filter(c => c.split('_').length === 2).forEach(c => {
    const v = t[c], g = [new Map(), new Map()];
    for (let i = 0; i < n; i++) { if (v[i] !== v[i]) continue; const m = hr[i] < 6 ? 0 : hr[i] >= 18 ? 1 : -1; if (m < 0) continue; (g[m].get(day[i]) || g[m].set(day[i], []).get(day[i])).push(v[i]); }
    const ref = g.map(mp => { const r = new Map(); mp.forEach((a, d) => { if (a.length >= ANALOG_NIGHT_MIN) r.set(d, median(a)); }); return r; });
    const drop = [];
    for (let i = 0; i < n; i++) {
      const r0 = ref[0].get(day[i]), r1 = ref[1].get(day[i]);
      if (r0 === undefined && r1 === undefined) continue;
      const good = (r0 !== undefined && Math.abs(v[i] - r0) <= ANALOG_TOL) || (r1 !== undefined && Math.abs(v[i] - r1) <= ANALOG_TOL);
      if (!good) drop.push(i);
    }
    drop.forEach(i => { v[i] = NaN; });
  });
  return { tc, t, frozen, nAllZero };
}

// ---------------------------------------------------------------- daily frames
function dailyFrames(xs, tc, t) {
  const n = xs.length, d0 = dayOf(xs[0]), d1 = dayOf(xs[n - 1]), nd = d1 - d0 + 1;
  const starts = new Int32Array(nd + 1).fill(-1);
  for (let i = n - 1; i >= 0; i--) starts[dayOf(xs[i]) - d0] = i;
  for (let d = nd - 1; d >= 0; d--) if (starts[d] < 0) starts[d] = d + 1 <= nd ? starts[d + 1] : n; starts[nd] = n;
  const med = {}, mean = {}, cnt = {};
  tc.forEach(c => {
    const m = new Float64Array(nd).fill(NaN), mu = new Float64Array(nd).fill(NaN), ct = new Int32Array(nd), digital = c.split('_').length === 3, v = t[c];
    for (let d = 0; d < nd; d++) {
      const vals = []; for (let i = starts[d]; i < starts[d + 1]; i++) if (v[i] === v[i]) vals.push(v[i]);
      ct[d] = vals.length; if (!vals.length) continue;
      const md = median(vals);
      let out = md;
      if (digital) { let s = 0, k = 0; for (const x of vals) if (Math.abs(x - md) <= MEAN_BAND) { s += x; k++; } if (k >= MEAN_MIN_KEEP) out = s / k; }
      if (vals.length >= MIN_MIN_TILT) { m[d] = md; mu[d] = out; }
    }
    med[c] = m; mean[c] = mu; cnt[c] = ct;
  });
  return { d0, nd, med, mean, cnt };
}
function deltas(arr, from) {                 // difference to the previous non-NaN day, from day index `from` on
  const out = new Float64Array(arr.length).fill(NaN); let prev = NaN;
  for (let d = from; d < arr.length; d++) { if (arr[d] !== arr[d]) continue; if (prev === prev) out[d] = arr[d] - prev; prev = arr[d]; }
  return out;
}
function movedCount(fr, tc, from) {
  const n = new Int32Array(fr.nd), dl = {};
  tc.forEach(c => { dl[c] = deltas(fr.med[c], from); for (let d = 0; d < fr.nd; d++) if (Math.abs(dl[c][d]) > STEP_SMALL) n[d]++; });
  return { n, dl };
}

// ---------------------------------------------------------------- episodes (piecewise linear fit, merge, classify)
function piecewise(x, y) {
  const n = y.length, cs = new Map();
  const cost = (i, j) => { const k = i * 100000 + j; let v = cs.get(k); if (v === undefined) { v = (j - i < EP_MINSEG) ? 1e9 : lin(x.slice(i, j), y.slice(i, j))[2]; cs.set(k, v); } return v; };
  const K = Math.min(EP_KMAX, Math.floor(n / EP_MINSEG));
  const C = [], B = []; for (let k = 0; k <= K; k++) { C.push(new Float64Array(n + 1).fill(1e18)); B.push(new Int32Array(n + 1)); }
  C[0][0] = 0;
  for (let k = 1; k <= K; k++) for (let j = k * EP_MINSEG; j <= n; j++) for (let i = (k - 1) * EP_MINSEG; i <= j - EP_MINSEG; i++) {
    const v = C[k - 1][i] + cost(i, j); if (v < C[k][j] - 1e-12) { C[k][j] = v; B[k][j] = i; }   // ties (quantised data) go to the earliest break, like the Python run
  }
  let j = n; const st = [];
  for (let kk = K; kk > 0; kk--) { const i = B[kk][j]; st.push(i); j = i; }
  return st.sort((a, b) => a - b).concat([n]);
}
function mergeDev(x, y, a0, m0, b0) {
  const xa = x.slice(a0, m0), xb = x.slice(m0, b0), la = lin(xa, y.slice(a0, m0)), lb = lin(xb, y.slice(m0, b0)), lm = lin(x.slice(a0, b0), y.slice(a0, b0));
  let mx = 0;
  xa.forEach(v => { mx = Math.max(mx, Math.abs((lm[0] * v + lm[1]) - (la[0] * v + la[1]))); });
  xb.forEach(v => { mx = Math.max(mx, Math.abs((lm[0] * v + lm[1]) - (lb[0] * v + lb[1]))); });
  return mx;
}
function mkfit(x, y, a, b) {
  const xs = x.slice(a, b), ys = y.slice(a, b), f = lin(xs, ys), my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let sst = 0; ys.forEach(v => { sst += (v - my) * (v - my); });
  const r2 = sst > 0 ? 1 - f[2] / sst : 0;
  return { a, b, slope: f[0], icpt: f[1], r2, sd: Math.sqrt(f[2] / ys.length) };
}
function episodes(ch, sr, ok, bdDay, d0, rows) {            // sr: corrected daily values (index = day - d0); ok(day) -> usable
  const blocks = []; let cur = [];
  for (let d = bdDay; d < d0 + sr.length; d++) { if (ok(d)) cur.push(d); else { if (cur.length) blocks.push(cur); cur = []; } }
  if (cur.length) blocks.push(cur);
  const d2 = [];
  blocks.forEach(b => { if (b.length >= 3) for (let i = 0; i + 2 < b.length; i++) d2.push(sr[b[i + 2] - d0] - 2 * sr[b[i + 1] - d0] + sr[b[i] - d0]); });
  let sig = EP_SIG_MIN;
  if (d2.length) { const m = median(d2), mad = median(d2.map(v => Math.abs(v - m))); sig = Math.max(1.4826 * mad / Math.sqrt(6), EP_SIG_MIN); }
  const phases = [];
  blocks.forEach((blk, bi) => {
    let y = blk.map(d => sr[d - d0]), x = blk.map(d => d - blk[0]), i0 = 0;
    if (bi > 0 || blk[0] > bdDay + 3) {
      const dy = []; for (let i = 0; i + 1 < y.length; i++) dy.push(Math.abs(y[i + 1] - y[i]));
      const lim = Math.max(EP_SETTLE_K * sig, 0.005);
      for (let i = 0; i < Math.min(y.length - EP_SETTLE_DAYS, EP_SETTLE_MAX + 1); i++) {
        let all = true; for (let q = i; q < i + EP_SETTLE_DAYS; q++) if (!(dy[q] < lim)) { all = false; break; }
        if (all) { i0 = i; break; }
      }
      if (i0 > 0) phases.push({ ch, start: blk[0], end: blk[i0 - 1], kind: 'settle', n: i0, net: y[i0 - 1] - y[0], r2: NaN, size: null });
    }
    const bk = blk.slice(i0); y = y.slice(i0); x = x.slice(i0);
    if (y.length < EP_MINSEG) return;
    const bnd = piecewise(x, y); let segs = []; for (let i = 0; i + 1 < bnd.length; i++) segs.push([bnd[i], bnd[i + 1]]);
    const thr = Math.max(EP_BREAK_MIN, EP_REL_MIN * (Math.max.apply(null, y) - Math.min.apply(null, y)));
    while (segs.length > 1) {
      const devs = []; for (let i = 0; i + 1 < segs.length; i++) devs.push(mergeDev(x, y, segs[i][0], segs[i][1], segs[i + 1][1]));
      let m = 0; for (let i = 1; i < devs.length; i++) if (devs[i] < devs[m] - 1e-12) m = i;
      if (devs[m] >= thr) break;
      segs[m] = [segs[m][0], segs[m + 1][1]]; segs.splice(m + 1, 1);
    }
    let fits = segs.map(s => mkfit(x, y, s[0], s[1]));
    const fits2 = [];
    fits.forEach(f => {
      const net = f.slope * (x[f.b - 1] - x[f.a]), n_ = f.b - f.a;
      if (n_ >= 2 * EP_TREND_DAYS && Math.abs(net) >= EP_EV_MIN && f.r2 < EP_TREND_R2) {
        let best = null;
        for (let m = f.a + EP_TREND_DAYS; m <= f.b - EP_TREND_DAYS; m++) {
          const s = lin(x.slice(f.a, m), y.slice(f.a, m))[2] + lin(x.slice(m, f.b), y.slice(m, f.b))[2];
          if (!best || s < best[0] || (s === best[0] && m < best[1])) best = [s, m];
        }
        if (best) {
          const f1 = mkfit(x, y, f.a, best[1]), f2 = mkfit(x, y, best[1], f.b);
          if (f1.r2 >= EP_TREND_R2 && f2.r2 >= EP_TREND_R2 && best[0] <= EP_SPLIT_GAIN * lin(x.slice(f.a, f.b), y.slice(f.a, f.b))[2]) { fits2.push(f1, f2); return; }
        }
      }
      fits2.push(f);
    });
    fits = fits2;
    fits.forEach((f, si) => {
      const span = x[f.b - 1] - x[f.a], net = f.slope * span;
      let kind;
      if (f.b - f.a < EP_TREND_DAYS && Math.abs(net) >= EP_EV_MIN) kind = 'event';
      else if ((f.b - f.a) >= EP_TREND_DAYS && Math.abs(net) >= EP_EV_MIN) kind = f.r2 >= EP_TREND_R2 ? 'trend' : 'wander';
      else kind = 'stable';
      if (si > 0) {
        const pf = fits[si - 1], jump = (f.slope * x[f.a] + f.icpt) - (pf.slope * x[pf.b - 1] + pf.icpt);
        if (Math.abs(jump) >= EP_EV_MIN) phases.push({ ch, start: bk[f.a], end: bk[f.a], kind: 'step', n: 1, net: jump, r2: NaN, size: jump });
      }
      const line = (kind === 'trend' || kind === 'wander' || (kind === 'stable' && f.b - f.a >= EP_MINSEG) || (kind === 'event' && f.r2 >= EP_TREND_R2));
      phases.push({ ch, start: bk[f.a], end: bk[f.b - 1], kind, n: f.b - f.a, net, r2: f.r2, sd: f.sd, size: null,
                    slopeDay: f.slope, icpt: f.icpt, x0: bk[f.a] - blk[0], blk0: blk[0], line });
    });
  });
  return phases;
}

// ---------------------------------------------------------------- whole analysis
function analyze(stations) {
  const bdDay = dayOfStr(BASE_DATE), pre = {}, out = {};
  Object.keys(stations).forEach(k => {
    const c = cleanTilt(k, stations[k]), fr = dailyFrames(stations[k].xs, c.tc, c.t), from = bdDay - fr.d0, mc = movedCount(fr, c.tc, from);
    const cd = new Set(); for (let d = from; d < fr.nd; d++) if (mc.n[d] >= STEP_COMMON_N) cd.add(d + fr.d0);
    pre[k] = { c, fr, from, mc, cd };
  });
  Object.keys(pre).forEach(k => {
    const { c, fr, from, mc } = pre[k], tc = c.tc, other = new Set();
    Object.keys(pre).forEach(o => { if (o !== k) pre[o].cd.forEach(d => other.add(d)); });
    const stepsMed = [];
    for (let d = from; d < fr.nd; d++) {
      const common = mc.n[d] >= STEP_COMMON_N, shared = other.has(d + fr.d0);
      tc.forEach(ch => {
        const v = mc.dl[ch][d]; if (v !== v) return;
        if (Math.abs(v) > STEP_SMALL && (common || shared)) stepsMed.push({ d: d + fr.d0, ch, v, kind: 'common' });
        else if (Math.abs(v) > STEP_SINGLE) stepsMed.push({ d: d + fr.d0, ch, v, kind: 'single' });
      });
    }
    const mean = fr.mean, prevVal = (ch, d) => { for (let q = d - 1; q >= from; q--) if (mean[ch][q] === mean[ch][q]) return mean[ch][q]; return NaN; };
    const steps = stepsMed.map(s => { const i = s.d - fr.d0, pv = prevVal(s.ch, i); return { d: s.d, ch: s.ch, v: (mean[s.ch][i] === mean[s.ch][i] && pv === pv) ? mean[s.ch][i] - pv : s.v, kind: s.kind }; });
    (VISIT_STEPS[k] || []).forEach(vs => {
      const vd = dayOfStr(vs), have = new Set(steps.map(s => s.d + '|' + s.ch));
      tc.forEach(ch => { const i = vd - fr.d0, pv = prevVal(ch, i); if (mean[ch][i] === mean[ch][i] && pv === pv && !have.has(vd + '|' + ch)) { const dv = mean[ch][i] - pv; if (Math.abs(dv) > VISIT_STEP_MIN) steps.push({ d: vd, ch, v: dv, kind: 'visit' }); } });
    });
    if (GAP_CONT_DAYS) {
      const have = new Set(steps.map(s => s.d + '|' + s.ch));
      tc.forEach(ch => {
        let prev = -1;
        for (let d = from; d < fr.nd; d++) {
          if (mean[ch][d] !== mean[ch][d]) continue;
          if (prev >= 0) { const miss = d - prev - 1; if (miss >= GAP_CONT_DAYS && !have.has((d + fr.d0) + '|' + ch)) steps.push({ d: d + fr.d0, ch, v: mean[ch][d] - mean[ch][prev], kind: 'gap(' + miss + ')' }); }
          prev = d;
        }
      });
    }
    const base = {}; tc.forEach(ch => { let s = 0, n = 0; for (let d = from; d < from + BASE_NDAYS; d++) if (mean[ch][d] === mean[ch][d]) { s += mean[ch][d]; n++; } base[ch] = n ? s / n : NaN; });
    const corr = {}; tc.forEach(ch => {
      const a = new Float64Array(fr.nd).fill(NaN);
      for (let d = from; d < fr.nd; d++) { let off = 0; steps.forEach(s => { if (s.ch === ch && s.d - fr.d0 <= d) off += s.v; }); a[d] = mean[ch][d] - base[ch] - off; }
      corr[ch] = a;
    });
    const phases = [], lines = [];
    tc.forEach(ch => {
      const stepDays = new Set(steps.filter(s => s.ch === ch).map(s => s.d));
      const ok = d => d >= bdDay && corr[ch][d - fr.d0] === corr[ch][d - fr.d0] && fr.cnt[ch][d - fr.d0] >= MIN_MIN_VALID && !stepDays.has(d);
      episodes(ch, corr[ch], ok, bdDay, fr.d0, null).forEach(p => phases.push(p));
    });
    out[k] = { tc, d0: fr.d0, nd: fr.nd, bdDay, dm: fr.med, dmean: fr.mean, cnt: fr.cnt, corr, base, steps, phases, frozen: pre[k].c.frozen, nAllZero: pre[k].c.nAllZero };
  });
  return out;
}
const SPEED = [[0.004, 'ช้ามาก'], [0.04, 'ช้า'], [0.4, 'ปานกลาง'], [Infinity, 'เร็ว']];
function speedOf(slopePerHour) { const a = Math.abs(slopePerHour); for (const s of SPEED) if (a < s[0]) return s[1]; return 'เร็ว'; }

const api = { _t: { piecewise, mergeDev, lin }, analyze, speedOf, dayOfStr, dayLabel, epochOfLocal, cleanTilt, dailyFrames, CONST: { BASE_DATE, EP_TREND_R2, EP_TREND_DAYS, EP_EV_MIN } };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PSWTrends = api;
})(typeof window !== 'undefined' ? window : globalThis);
