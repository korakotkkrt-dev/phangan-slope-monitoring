"""Insert ui/trends.css + ui/trends.js + ui/trends_ui.js into template/index.template.html between marker comments (re-runnable).

    python tools/inject_trends.py
"""
import os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "template", "index.template.html")
rd = lambda n: open(os.path.join(ROOT, "ui", n), encoding="utf-8").read()
CSS, JS = rd("trends.css"), rd("trends.js") + "\n" + rd("trends_ui.js")
t = open(TPL, encoding="utf-8", newline="").read()
css_block = "/*TRENDS-CSS:START*/\n" + CSS + "\n/*TRENDS-CSS:END*/"
js_block = "<!--TRENDS-JS:START--><script>\n" + JS + "\n</script><!--TRENDS-JS:END-->"
if "/*TRENDS-CSS:START*/" in t:
    t = re.sub(r"/\*TRENDS-CSS:START\*/.*?/\*TRENDS-CSS:END\*/", lambda m: css_block, t, flags=re.S)
else:
    i = t.index("</style>"); t = t[:i] + css_block + "\n" + t[i:]
if "<!--TRENDS-JS:START-->" in t:
    t = re.sub(r"<!--TRENDS-JS:START-->.*?<!--TRENDS-JS:END-->", lambda m: js_block, t, flags=re.S)
else:
    j = t.rindex("</body>"); t = t[:j] + js_block + "\n" + t[j:]
open(TPL, "w", encoding="utf-8", newline="").write(t)
print("injected: css %d, js %d chars" % (len(CSS), len(JS)))
