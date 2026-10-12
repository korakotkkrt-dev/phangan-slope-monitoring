"""Build dist/index.html from template/index.template.html + data/ (run after update_data.py)."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
stamp, size = build_page(os.path.join(ROOT, "template", "index.template.html"), os.path.join(ROOT, "dist", "index.html"))
print("built dist/index.html:", size, "bytes; data up to", stamp, "ICT")
