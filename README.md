# UrbanHeat AU: SVG suburb map update

Replaces the broken tile map with a plain SVG built from **official Vicmap locality polygons**. No Leaflet required. Six suburbs are highlighted with saved modelled temperature values.

## Install (Ubuntu / zsh)

From your existing working directory `~/b2/urban-heat/urbanheat_sprint2`:

```bash
cp -a static "static.backup.$(date +%Y%m%d-%H%M%S)"
# Download/extract this ZIP to /tmp, then:
cp -a /tmp/urbanheat_vector_update/static/. static/
cp /tmp/urbanheat_vector_update/fetch_boundaries.py .
python3 fetch_boundaries.py
python3 weather.py
python3 server.py
```

Then refresh http://localhost:8000 (Ctrl+Shift+R). The map uses SVG so OpenStreetMap/Leaflet tiles cannot spill outside the map panel.

Boundary source: https://vicmap.land.vic.gov.au/agsgis/rest/services/vicmap/Vicmap_Admin/MapServer/11

The suburb fills are **not** remotely sensed surface temperatures or uniform measurements throughout the suburb. The single representative Open-Meteo forecast estimate for each selected locality is applied to its administrative outline.

The map intentionally shows **six Melbourne localities**, rather than inventing an inaccurate Victoria-wide outline. A separate Victoria overview can be added after sourcing a state polygon.

GeoJSON is fetched once and saved locally, so the website does not depend on the Vicmap service during normal use. If the download fails, leave the existing weather JSON untouched and retry when internet is available.
