"""Insert ui/layout.css + the layout images (ui/img/*.jpg, base64) + ui/layout.js into template/index.template.html (re-runnable).

    python tools/inject_layout.py
"""
import os, re, base64, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "template", "index.template.html")
CSS = open(os.path.join(ROOT, "ui", "layout.css"), encoding="utf-8").read()
JS = open(os.path.join(ROOT, "ui", "layout.js"), encoding="utf-8").read()
img = {}
for st in ("st1", "st2"):
    img[st] = {}
    for kind in ("map", "table", "photos"):
        p = os.path.join(ROOT, "ui", "img", "%s_%s.jpg" % (st, kind))
        img[st][kind] = "data:image/jpeg;base64," + base64.b64encode(open(p, "rb").read()).decode()
DATA = "window.PSW_LAYOUT_IMG = " + json.dumps(img) + ";\n"
t = open(TPL, encoding="utf-8", newline="").read()
css_block = "/*LAYOUT-CSS:START*/\n" + CSS + "\n/*LAYOUT-CSS:END*/"
js_block = "<!--LAYOUT-JS:START--><script>\n" + DATA + JS + "\n</script><!--LAYOUT-JS:END-->"
if "/*LAYOUT-CSS:START*/" in t:
    t = re.sub(r"/\*LAYOUT-CSS:START\*/.*?/\*LAYOUT-CSS:END\*/", lambda m: css_block, t, flags=re.S)
else:
    i = t.index("</style>"); t = t[:i] + css_block + "\n" + t[i:]
if "<!--LAYOUT-JS:START-->" in t:
    t = re.sub(r"<!--LAYOUT-JS:START-->.*?<!--LAYOUT-JS:END-->", lambda m: js_block, t, flags=re.S)
else:
    j = t.rindex("</body>"); t = t[:j] + js_block + "\n" + t[j:]
open(TPL, "w", encoding="utf-8", newline="").write(t)
print("injected layout: %d KB of images" % (len(DATA) // 1024))
