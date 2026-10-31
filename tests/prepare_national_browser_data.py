"""Build a browser-test dataset from real catalogue coordinates.

No weather values are invented. Missing measurements stay null, which also
lets browser tests check how the UI handles unavailable data.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from historical_weather import save_atomic
from national_map import markers
TARGET = ROOT / "static" / "national_data.json"
METRICS = (
    "annual_mean_c", "annual_average_max_c", "annual_average_min_c",
    "average_annual_rainfall_mm", "average_days_at_least_35c",
)

if __name__ == "__main__":
    if TARGET.exists():
        raise SystemExit("Refusing to overwrite existing national_data.json")
    records = markers(ROOT / "locations.json")
    rows = []
    for record in records:
        item = {field: record[field] for field in
                ("id", "name", "state", "latitude", "longitude", "x", "y")}
        item.update({metric: None for metric in METRICS})
        rows.append(item)
    assert len(rows) == 112
    save_atomic(TARGET, {
        "locations": rows,
        "count": 112,
        "source": "Catalogue only. No historical measurements supplied.",
        "start_date": None,
        "end_date": None,
        "skipped": [],
    })
    print("Prepared 112 catalogue locations; climate readings remain unavailable")
