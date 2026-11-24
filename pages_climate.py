"""Prepare and check the summary files published to the national dashboard."""
import argparse
import json
from math import isfinite
from pathlib import Path
from tempfile import TemporaryDirectory

import historical_weather as hist
import history_export
import national_export
import seasonal_export
from national_map import markers
from verify_national_release import EXPORTS


def check(directory, catalogue=hist.CATALOGUE):
    """Check that all three files describe the same readings and coverage."""
    expected = {point["id"] for point in markers(catalogue)}
    data = {}
    ids = {}
    for name, filename in EXPORTS.items():
        export = json.loads((directory / filename).read_text(encoding="utf-8"))
        if (export.get("source") != "Open-Meteo Historical Weather API"
                or export.get("model") != hist.MODEL
                or export.get("start_date") != hist.START.isoformat()
                or export.get("end_date") != hist.END.isoformat()):
            raise ValueError(f"{filename}: wrong climate source, model or date range")
        data[name] = export
        rows = [row["id"] for row in export["locations"]]
        ids[name] = set(rows)
        if len(rows) != len(ids[name]) or not ids[name] <= expected:
            raise ValueError(f"{filename}: duplicate or unknown location")

    available = {row["id"] for row in data["map"]["locations"]
                 if type(row.get("annual_mean_c")) in (int, float)
                 and isfinite(row["annual_mean_c"])}
    if not available or ids["map"] != expected or available != ids["history"] or available != ids["seasons"]:
        raise ValueError("The Pages exports disagree about which locations have climate readings")
    missing = expected - available
    for name, export in data.items():
        skipped = export["skipped"]
        if len(skipped) != len(missing) or set(skipped) != missing:
            raise ValueError(f"{EXPORTS[name]}: missing-location list disagrees with coverage")
    if data["map"]["count"] != len(expected):
        raise ValueError("Map location count disagrees with the catalogue")
    return len(available), len(expected)


def prepare(data_dir, output):
    """Summarise saved snapshots and keep every catalogue location on the map."""
    with TemporaryDirectory() as directory:
        staging = Path(directory)
        mapped = national_export.export(data_dir=data_dir, output=staging / EXPORTS["map"])
        by_id = {row["id"]: row for row in mapped["locations"]}
        mapped["locations"] = [by_id.get(point["id"], point) for point in markers(hist.CATALOGUE)]
        mapped["count"] = len(mapped["locations"])
        for name, export in (
            ("map", mapped),
            ("history", history_export.build(data_dir=data_dir)),
            ("seasons", seasonal_export.build(data_dir=data_dir)),
        ):
            (staging / EXPORTS[name]).write_text(
                json.dumps(export, allow_nan=False, ensure_ascii=False, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
        available, expected = check(staging)
        output.mkdir(parents=True, exist_ok=True)
        for filename in EXPORTS.values():
            (output / filename).write_bytes((staging / filename).read_bytes())
    print(f"Pages climate readings: {available}/{expected} locations")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=Path("data/national"))
    parser.add_argument("--output", type=Path, default=Path("data/pages-climate"))
    args = parser.parse_args()
    prepare(args.data_dir, args.output)


if __name__ == "__main__":
    main()
