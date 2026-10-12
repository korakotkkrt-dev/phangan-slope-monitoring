"""Pull the newest 1-minute samples from the public ThingsBoard dashboard and merge them into data/<station>/<month>.npz.
usage: python tools/update_data.py [--overlap-hours 12]
Only channels already listed in data/meta.json are kept (the page's channel set); the last 12 h are re-read so late samples fill in."""
import sys, time
import numpy as np
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from common import *

overlap_h = 12.0
if "--overlap-hours" in sys.argv:
    overlap_h = float(sys.argv[sys.argv.index("--overlap-hours") + 1])

meta = load_meta()
arrs = {st: load_station(st, meta) for st in TB_DEVICES}
last = max(T0 + 60 * last_valid_index(a) for a in arrs.values())
start = last - overlap_h * 3600
end = time.time()
print("last stored sample:", datetime.datetime.fromtimestamp(last, ICT).isoformat(), "| fetching", datetime.datetime.fromtimestamp(start, ICT).isoformat(), "->", datetime.datetime.fromtimestamp(end, ICT).isoformat())
got = tb_fetch(start, end, {st: [c["name"] for c in meta[st]] for st in TB_DEVICES})
changed_any = False
for st in TB_DEVICES:
    scales = {c["name"]: c["scale"] for c in meta[st]}
    a = arrs[st]
    n_old = len(next(iter(a.values())))
    newest = n_old - 1
    updates = {}
    for ch, pts in got[st].items():
        for ts, val in pts:
            i = int(round((ts - T0) / 60))
            if i < 0:
                continue
            updates.setdefault(ch, {})[i] = quantize(val, scales[ch])
            newest = max(newest, i)
    n_new = newest + 1
    if n_new > n_old:
        for ch in a:
            a[ch] = np.concatenate([a[ch], np.full(n_new - n_old, NAN_Q, dtype=np.int32)])
    n_chg = 0
    for ch, d in updates.items():
        for i, q in d.items():
            if a[ch][i] != q:
                a[ch][i] = q
                n_chg += 1
    changed = save_station(st, meta, a)
    print(st, "samples fetched:", sum(len(v) for v in got[st].values()), "| cells changed:", n_chg, "| minutes", n_old, "->", n_new, "| files rewritten:", changed)
    changed_any = changed_any or bool(changed)
print("CHANGED" if changed_any else "NO_CHANGE")
