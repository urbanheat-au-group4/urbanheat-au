#!/usr/bin/env bash
# UrbanHeat AU final release evidence. Never substitutes fixture data for real snapshots.
# Usage from the repo root: bash scripts/collect_final_evidence.sh
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
SHA="$(git rev-parse HEAD 2>/dev/null || printf unknown)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/artifacts/final-acceptance/$STAMP"
mkdir -p "$OUT"
printf 'UrbanHeat final release evidence\nUTC: %s\ncommit: %s\nroot: %s\n' "$STAMP" "$SHA" "$ROOT" | tee "$OUT/manifest.txt"
printf 'Git worktree changes (review these for reproducibility):\n' >> "$OUT/manifest.txt"
git status --short >> "$OUT/manifest.txt" 2>&1 || true
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
  return "$result"
}
printf '\nThis script requires genuine historical snapshots under data/national/locations.\n' | tee -a "$OUT/manifest.txt"
if [ ! -d data/national/locations ]; then
  printf 'BLOCKED: data/national/locations missing. No fixture substitution permitted.\n' | tee -a "$OUT/manifest.txt"
  exit 2
fi
printf 'Snapshot JSON file count (not a validation result): %s\n' "$(find data/national/locations -maxdepth 1 -type f -name '*.json' | wc -l)" | tee -a "$OUT/manifest.txt"
run_check python-tests python3 -m unittest discover -s tests -p 'test_*.py' -v || true
if run_check real-data-build python3 run.py --check; then
  if [ -f static/national_data.json ] && [ -f static/national_history.json ] && [ -f static/national_seasons.json ]; then
    run_check export-audit python3 verify_national_release.py || true
    if [ -f artifacts/uha-46-export-audit.json ]; then
      cp artifacts/uha-46-export-audit.json "$OUT/export-audit.json"
    fi
  else
    printf 'BLOCKED: validated build returned success but three exports are not present.\n' | tee -a "$OUT/manifest.txt"
    failed=1
  fi
else
  printf 'BLOCKED: export audit skipped, because real-data build failed; stale outputs MUST NOT be accepted.\n' | tee -a "$OUT/manifest.txt"
fi
if command -v node >/dev/null 2>&1 && [ -f tests/test_compare.cjs ]; then
  run_check js-comparison node --test tests/test_compare.cjs || true
else
  printf 'SKIPPED: Node comparison test unavailable.\n' | tee -a "$OUT/manifest.txt"
fi
printf '\nBrowser real-data check requires a separately running local server and installed dependencies:\n  python3 server.py\n  npm run test:real-data\n' | tee -a "$OUT/manifest.txt"
printf 'MANUAL GATES: map geography, keyboard focus, screen reader, actual browser values, deployment and demo rehearsal remain pending.\n' | tee -a "$OUT/manifest.txt"
if [ "$failed" -ne 0 ]; then
  printf 'FINAL: FAIL/BLOCKED; inspect logs.\n' | tee -a "$OUT/manifest.txt"
  exit 1
fi
printf 'FINAL: automated local checks exited successfully; NOT full release acceptance.\n' | tee -a "$OUT/manifest.txt"
