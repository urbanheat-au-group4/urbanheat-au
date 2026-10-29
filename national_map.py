"""National map coordinate and marker geometry independent of dashboard JS.

Marker coordinates are modelled location points, not state-wide temperature areas.
This module does not invent geographical outlines. State boundaries require an
authoritative, licensed GeoJSON source before the full SVG UI is marked Done.
"""
from collections import Counter
from html import escape
from location_catalogue import load_catalogue

WIDTH = 1000
HEIGHT = 760
WEST, EAST = 112.0, 154.5
NORTH, SOUTH = -10.0, -44.5
PADDING = 36
STATES = ("NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT")


def project(latitude, longitude):
    """Project mainland, Tasmanian and territorial locations onto one SVG grid."""
    if not (WEST <= longitude <= EAST and SOUTH <= latitude <= NORTH):
        raise ValueError("Location outside Australian map extent")
    x = PADDING + (longitude - WEST) * (WIDTH - 2 * PADDING) / (EAST - WEST)
    y = PADDING + (NORTH - latitude) * (HEIGHT - 2 * PADDING) / (NORTH - SOUTH)
    return round(x, 2), round(y, 2)


def markers(path, state=None):
    """Select verified catalogue *format* with no silent duplicate IDs."""
    if state is not None and state not in STATES:
        raise ValueError("Unknown jurisdiction")
    records = load_catalogue(path, "australia_historical")
    selected = [r for r in records if state is None or r["state"] == state]
    if len({r["id"] for r in selected}) != len(selected):
        raise ValueError("Duplicate marker ID")
    return [{**r, "x": project(r["latitude"], r["longitude"])[0],
             "y": project(r["latitude"], r["longitude"])[1]} for r in selected]


def marker_svg(locations):
    """Produce an SVG marker group; never treat a point as a locality polygon."""
    parts = ['<g class="national-location-markers" role="group" aria-label="Australian locations">']
    for item in locations:
        label = escape(f'{item["name"]}, {item["state"]}', quote=True)
        key = escape(item["id"], quote=True)
        parts.append(
            f'<circle data-location-id="{key}" cx="{item["x"]}" cy="{item["y"]}" '
            f'r="4.5" role="img" aria-label="{label}"><title>{label}</title></circle>'
        )
    parts.append("</g>")
    return "".join(parts)


def jurisdiction_counts(locations):
    return dict(Counter(item["state"] for item in locations))
