"""Insert ui/home.css and ui/home.js into template/index.template.html between marker comments (re-runnable).

    python tools/inject_home.py
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "template", "index.template.html")
CSS = open(os.path.join(ROOT, "ui", "home.css"), encoding="utf-8").read()
JS = open(os.path.join(ROOT, "ui", "home.js"), encoding="utf-8").read()
t = open(TPL, encoding="utf-8", newline="").read()
css_block = "/*HOME-CSS:START*/\n" + CSS + "\n/*HOME-CSS:END*/"
js_block = "<!--HOME-JS:START--><script>\n" + JS + "\n</script><!--HOME-JS:END-->"
if "/*HOME-CSS:START*/" in t:
    t = re.sub(r"/\*HOME-CSS:START\*/.*?/\*HOME-CSS:END\*/", lambda m: css_block, t, flags=re.S)
else:
    assert t.count("</style>") >= 1
    i = t.index("</style>")
    t = t[:i] + css_block + "\n" + t[i:]
if "<!--HOME-JS:START-->" in t:
    t = re.sub(r"<!--HOME-JS:START-->.*?<!--HOME-JS:END-->", lambda m: js_block, t, flags=re.S)
else:
    assert t.rstrip().endswith("</body></html>")
    j = t.rindex("</body>")
    t = t[:j] + js_block + "\n" + t[j:]
open(TPL, "w", encoding="utf-8", newline="").write(t)
print("injected: css %d bytes, js %d bytes -> %s" % (len(CSS), len(JS), TPL))
