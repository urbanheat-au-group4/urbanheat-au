"""Place catalogue locations on the national SVG map.

The markers are individual locations, not temperature areas.
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
    """Convert a latitude and longitude to SVG x/y coordinates."""
    if not (WEST <= longitude <= EAST and SOUTH <= latitude <= NORTH):
        raise ValueError("Location outside Australian map extent")

    x = PADDING + (longitude - WEST) * (WIDTH - 2 * PADDING) / (EAST - WEST)
    y = PADDING + (NORTH - latitude) * (HEIGHT - 2 * PADDING) / (NORTH - SOUTH)
    return round(x, 2), round(y, 2)


def markers(path, state=None):
    """Return map markers, optionally for just one state."""
    if state is not None and state not in STATES:
        raise ValueError("Unknown jurisdiction")

    places = load_catalogue(path, "australia_historical")
    selected = [place for place in places if state is None or place["state"] == state]

    if len({place["id"] for place in selected}) != len(selected):
        raise ValueError("Duplicate marker ID")

    result = []
    for place in selected:
        x, y = project(place["latitude"], place["longitude"])
        result.append({**place, "x": x, "y": y})
    return result


def marker_svg(locations):
    """Make accessible SVG circles from our checked map markers."""
    parts = ['<g class="national-location-markers" role="group" aria-label="Australian locations">']
    for place in locations:
        label = escape(f'{place["name"]}, {place["state"]}', quote=True)
        key = escape(place["id"], quote=True)
        parts.append(
            f'<circle data-location-id="{key}" cx="{place["x"]}" cy="{place["y"]}" '
            f'r="4.5" role="img" aria-label="{label}"><title>{label}</title></circle>'
        )
    parts.append("</g>")
    return "".join(parts)


def jurisdiction_counts(locations):
    return dict(Counter(place["state"] for place in locations))
