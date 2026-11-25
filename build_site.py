"""Package the national dashboard for static hosting."""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pages_climate
from verify_national_release import EXPORTS

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "_site"
ASSETS = (
    "national.css", "history.css", "seasons.css", "compare.css",
    "national_annotations.js", "national.js", "intro-states.js", "intro.js",
    "intro-tiles.js", "history.js", "seasons.js", "compare_core.js", "compare.js",
    "dashboard_state.js", "dashboard_metrics.js", "dashboard_data.js", "dashboard_tabs.js",
    "logo.png", "BG.jpg", "australia_states.geojson", *EXPORTS.values(),
)

def build(climate_dir=None):
    if climate_dir is not None:
        available, expected = pages_climate.check(climate_dir, ROOT / "locations.json")
        print(f"Publishing climate readings for {available}/{expected} locations")
    elif not (ROOT / "static/national_data.json").exists():
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
        if climate_dir is not None and name in EXPORTS.values():
            source = climate_dir / name
        if not source.exists():
            if name in ("national_history.json", "national_seasons.json"):
                continue
            raise FileNotFoundError(source)
        target = OUT / "static" / name
        if source.suffix == ".js":
            target.write_text(source.read_text().replace("/static/", "./static/"))
        elif source.suffix == ".css":
            # CSS resolves image URLs from static/, not from index.html.
            target.write_text(source.read_text().replace("/static/", "./"))
        else:
            shutil.copyfile(source, target)
    html = (ROOT / "static/national.html").read_text()
    html = html.replace('"/static/', '"./static/').replace('href="/"', 'href="./"')
    (OUT / "index.html").write_text(html)
    (OUT / ".nojekyll").touch()
    print("Built _site. Missing historical exports remain unavailable.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--climate-dir", type=Path)
    build(parser.parse_args().climate_dir)
