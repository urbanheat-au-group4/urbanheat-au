"""Validate location metadata independently of dashboard rendering.

The current dashboard intentionally stays on its existing six locations.
Historical ingestion can select another location group with an environment variable.
"""
import json
import math
import re
from pathlib import Path

STATES = {"VIC", "NSW", "QLD", "WA", "SA", "TAS", "ACT", "NT"}
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
GROUP_PATTERN = re.compile(r"^[a-z0-9]+(?:[_-][a-z0-9]+)*$")


def validate_catalogue(data):
    """Return validated location records, rejecting ambiguous identifiers."""
    entries = data.get("locations") if isinstance(data, dict) else data
    if not isinstance(entries, list) or not entries:
        raise ValueError("Catalogue must contain a nonempty locations list")
    records = []
    ids, names = set(), set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError("Catalogue entry must be an object")
        key, name = entry.get("id"), entry.get("name")
        state, region = entry.get("state"), entry.get("region")
        groups = entry.get("groups")
        lat, lon = entry.get("latitude"), entry.get("longitude")
        if not isinstance(key, str) or not ID_PATTERN.fullmatch(key) or key in ids:
            raise ValueError("Missing, malformed or duplicate location id")
        if not isinstance(name, str) or not name.strip():
            raise ValueError("Missing location name")
        if state not in STATES:
            raise ValueError("Missing or invalid state/territory")
        if not isinstance(region, str) or not region.strip():
            raise ValueError("Missing region")
        if not isinstance(groups, list) or not groups or any(
            not isinstance(g, str) or not GROUP_PATTERN.fullmatch(g) for g in groups
        ) or len(groups) != len(set(groups)):
            raise ValueError("Missing or invalid location groups")
        if type(lat) not in (int, float) or type(lon) not in (int, float):
            raise ValueError("Invalid coordinates")
        if not math.isfinite(lat) or not math.isfinite(lon) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
            raise ValueError("Coordinates out of range")
        identity = (state, name.strip().casefold())
        if identity in names:
            raise ValueError("Duplicate name within state")
        ids.add(key)
        names.add(identity)
        records.append(dict(entry))
    return records


def load_catalogue(path, group=None):
    """Return matching locations, or the full verified catalogue."""
    records = validate_catalogue(json.loads(Path(path).read_text(encoding="utf-8")))
    selected = [r for r in records if group is None or group in r["groups"]]
    if not selected:
        raise ValueError(f"No locations found for group: {group}")
    return selected
