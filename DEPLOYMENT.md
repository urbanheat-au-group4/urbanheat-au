# Hosting UrbanHeat AU

## GitHub Pages

In Settings → Pages, choose GitHub Actions as the build source. The Deploy national dashboard workflow runs on pushes to main and can also be started manually.

Site address: https://urbanheat-au-group4.github.io/urbanheat-au/

The build checks the Python tests, downloads the real state boundaries and packages the national page. Only the national dashboard assets are published. Paths in the generated site work under the repository URL.

## Climate data

The raw historical snapshots are not stored in Git. Without generated exports, the deployed map shows the 112 catalogue locations and marks climate readings as unavailable. Historical and seasonal charts show their unavailable-data messages. No weather values are invented.

For a build with actual climate readings, supply validated exports in static/national_data.json, static/national_history.json and static/national_seasons.json before running build_site.py. The automatic workflow currently starts from the repository contents; local uncommitted datasets will not be uploaded by it.

## Local build

Run `python fetch_national_boundaries.py`, then `python build_site.py`. Preview with `python -m http.server 8000 --directory _site`.

The output is static HTML, CSS, JavaScript and data files. GitHub Pages does not run server.py or the legacy timed weather refresh job.
