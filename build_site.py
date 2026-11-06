"""Package the national dashboard for static hosting."""
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "_site"
ASSETS = ("national.css", "history.css", "seasons.css", "national_annotations.js",
          "national.js", "history.js", "seasons.js", "national_data.json",
          "australia_states.geojson", "national_history.json", "national_seasons.json")

def build():
    if not (ROOT / "static/national_data.json").exists():
        subprocess.run([sys.executable, str(ROOT / "tests/prepare_national_browser_data.py")],
                       cwd=ROOT, check=True)
    boundary = ROOT / "static/australia_states.geojson"
    from fetch_national_boundaries import validate
    validate(json.loads(boundary.read_text()))
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "static").mkdir(parents=True)
    for name in ASSETS:
        source = ROOT / "static" / name
        if not source.exists():
            if name in ("national_history.json", "national_seasons.json"):
                continue
            raise FileNotFoundError(source)
        target = OUT / "static" / name
        if source.suffix in (".js", ".css"):
            target.write_text(source.read_text().replace("/static/", "./static/"))
        else:
            shutil.copyfile(source, target)
    html = (ROOT / "static/national.html").read_text()
    html = html.replace('"/static/', '"./static/').replace('href="/"', 'href="./"')
    (OUT / "index.html").write_text(html)
    (OUT / ".nojekyll").touch()
    print("Built _site. Missing historical exports remain unavailable.")

if __name__ == "__main__":
    build()
