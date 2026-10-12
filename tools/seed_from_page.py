"""ONE-TIME: create data/ (meta.json + monthly .npz) and template/index.template.html from a finished page.
usage: python tools/seed_from_page.py <page.html> [--template-only]
--template-only: only regenerate template/index.template.html (use this when the page UI changed; data/ is left untouched)."""
import json, os, re, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

TEMPLATE_ONLY = "--template-only" in sys.argv
html = open(sys.argv[1], encoding="utf-8").read()
meta = {}
for st, name in (("st1", "EXTRA_ST1"), ("st2", "EXTRA_ST2")):
    m = re.search(r"^const %s = (\{.*\});$" % name, html, re.M)
    ex = json.loads(m.group(1))
    assert ex["t0"] == T0
    n = ex["n"]
    meta[st] = [{"name": s["name"], "scale": s["scale"], "lo": s["lo"]} for s in ex["series"]]
    arrs = {}
    for s in ex["series"]:
        q = np.cumsum(inflate_i32(s["z"]).astype("int64"))
        assert len(q) == n and np.all(np.abs(q) < 2 ** 31)
        arrs[s["name"]] = q.astype(np.int32)
    if not TEMPLATE_ONLY:
        json.dump(meta, open(os.path.join(DATA, "meta.json"), "w"), indent=1)
        print(st, "channels", len(arrs), "minutes", n, "files", save_station(st, meta, arrs))
    html = html.replace(m.group(0), "const %s = __EXTRA_%s__;" % (name, st.upper()), 1)
# static date text in the header note -> placeholder
html, k = re.subn(r"(25 Jun 2026 &ndash; )\d{1,2} \w{3} 2026 \d\d:\d\d( ICT\. 25 Jun)", r"\1__DATA_END__\2", html, count=1)
assert k == 1, "header note date not found"
os.makedirs(os.path.join(ROOT, "template"), exist_ok=True)
open(os.path.join(ROOT, "template", "index.template.html"), "w", encoding="utf-8").write(html)
print("template written", len(html.encode("utf-8")), "bytes")
