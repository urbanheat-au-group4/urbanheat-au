# Hosting UrbanHeat AU

## GitHub Pages

In Settings → Pages, choose GitHub Actions as the build source. The Deploy national dashboard workflow runs on pushes to main and can also be started manually.

Site address: https://urbanheat-au-group4.github.io/urbanheat-au/

The build checks the Python tests, downloads the real state boundaries and packages the national page. Only the national dashboard assets are published. Paths in the generated site work under the repository URL.

## Climate data

The Pages workflow publishes the three summary JSON files in `data/pages-climate/`. The source is Open-Meteo ERA5 (2015–2025), licensed CC BY 4.0. These files contain calculations from the daily data. The raw historical snapshots stay in the local cache.

To refresh the hosted summaries from saved snapshots, run `python3 pages_climate.py` and commit the three files under `data/pages-climate/`. The exporter uses the existing weather checks and keeps all catalogue markers. Places without a validated snapshot show `No data` and are left out of the charts. The coverage line on the dashboard shows how many locations have readings.

Use `python3 build_site.py --climate-dir data/pages-climate` to preview exactly what the workflow publishes.

## Local build

Run `python fetch_national_boundaries.py`, then `python build_site.py`. Preview with `python -m http.server 8000 --directory _site`.

The output is static HTML, CSS, JavaScript and data files. GitHub Pages does not run server.py or the legacy timed weather refresh job.
