#!/usr/bin/env bash
# UrbanHeat AU: collect release evidence from actual locally saved snapshots.
# Run at repository root: bash scripts/collect_final_evidence.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
SHA="$(git rev-parse HEAD 2>/dev/null || printf unknown)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/artifacts/final-acceptance/$STAMP"
mkdir -p "$OUT"
printf 'UrbanHeat release evidence\nUTC: %s\ncommit: %s\nroot: %s\n' "$STAMP" "$SHA" "$ROOT" | tee "$OUT/manifest.txt"
printf '%s\n' 'IMPORTANT: Run against verified real snapshots, not the browser test fixture.'
printf 'Evidence directory: %s\n' "$OUT"
failed=0
run_check() {
  name="$1"; shift
  printf '\n=== %s ===\n' "$name" | tee -a "$OUT/manifest.txt"
  printf 'command:' >> "$OUT/manifest.txt"
  printf ' %q' "$@" >> "$OUT/manifest.txt"
  printf '\n' >> "$OUT/manifest.txt"
  "$@" > "$OUT/$name.log" 2>&1
  result=$?
  printf '%s exit=%s\n' "$name" "$result" | tee -a "$OUT/manifest.txt"
  tail -n 12 "$OUT/$name.log"
  if [ "$result" -ne 0 ]; then failed=1; fi
}
run_check python-tests python3 -m unittest discover -s tests -p 'test_*.py' -v
run_check real-data-build python3 run.py --check
if [ -f static/national_data.json ] && [ -f static/national_history.json ] && [ -f static/national_seasons.json ]; then
  run_check export-audit python3 verify_national_release.py
  if [ -f artifacts/uha-46-export-audit.json ]; then
    cp artifacts/uha-46-export-audit.json "$OUT/export-audit.json"
  fi
else
  printf 'export-audit SKIPPED: three real exports not present\n' | tee -a "$OUT/manifest.txt"
  failed=1
fi
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  if [ -d node_modules ]; then
    run_check js-comparison node --test tests/test_compare.cjs
  else
    printf 'js-comparison SKIPPED: npm dependencies not installed\n' | tee -a "$OUT/manifest.txt"
  fi
else
  printf 'js-comparison SKIPPED: Node/npm not available\n' | tee -a "$OUT/manifest.txt"
fi
printf '\nManual checks outstanding regardless of exit code: actual 2015–2025 values in browser, state label legibility, keyboard focus, screen reader, demo rehearsal, deployment provenance.\n' | tee -a "$OUT/manifest.txt"
printf 'To run browser real-data test, start the actual local app in a separate terminal: python3 server.py\nthen: npm run test:real-data\n' | tee -a "$OUT/manifest.txt"
printf 'DO NOT report success unless manifest and logs are reviewed.\n' | tee -a "$OUT/manifest.txt"
exit "$failed"
