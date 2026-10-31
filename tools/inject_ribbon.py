"""Insert ui/ribbon.css and ui/ribbon.js into template/index.template.html between marker comments (re-runnable).

    python tools/inject_ribbon.py
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TPL = os.path.join(ROOT, "template", "index.template.html")
CSS = open(os.path.join(ROOT, "ui", "ribbon.css"), encoding="utf-8").read()
JS = open(os.path.join(ROOT, "ui", "ribbon.js"), encoding="utf-8").read()
t = open(TPL, encoding="utf-8", newline="").read()
css_block = "/*RIBBON-CSS:START*/\n" + CSS + "\n/*RIBBON-CSS:END*/"
js_block = "<!--RIBBON-JS:START--><script>\n" + JS + "\n</script><!--RIBBON-JS:END-->"
if "/*RIBBON-CSS:START*/" in t:
    t = re.sub(r"/\*RIBBON-CSS:START\*/.*?/\*RIBBON-CSS:END\*/", lambda m: css_block, t, flags=re.S)
else:
    assert t.count("</style>") >= 1
    i = t.index("</style>")
    t = t[:i] + css_block + "\n" + t[i:]
if "<!--RIBBON-JS:START-->" in t:
    t = re.sub(r"<!--RIBBON-JS:START-->.*?<!--RIBBON-JS:END-->", lambda m: js_block, t, flags=re.S)
else:
    assert t.rstrip().endswith("</body></html>")
    j = t.rindex("</body>")
    t = t[:j] + js_block + "\n" + t[j:]
open(TPL, "w", encoding="utf-8", newline="").write(t)
print("injected: css %d bytes, js %d bytes -> %s" % (len(CSS), len(JS), TPL))
