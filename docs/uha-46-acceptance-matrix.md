# UHA-46: Final acceptance checklist (working draft)

**Started:** 18 November 2026  
**Owner:** Paul  
**Status:** In Progress. This is a test plan, not final sign-off.

## Acceptance checklist

| Check | Existing evidence | Still needed before sign-off |
| --- | --- | --- |
| National homepage is the single public entry point | UHA-82; `tests/test_homepage_route.py` | Run against the final `main` build and verify manually |
| All eight states/territories display and zoom correctly | `tests/national_browser_smoke.cjs` | Review actual state screenshot legibility |
| Each state has 14 matching selectable locations | `locations.json`, browser smoke test | Independently verify catalogue coordinates |
| Map label, selected marker and measure dropdown agree | Browser regression and cross-state tests | Confirm sample figures against validated real exports |
| Annual, monthly and seasonal climate charts render | `tests/national_browser_charts.cjs` and regression tests | Check real 2015–2025 values and missing-year behaviour |
| Comparison of two or three locations works | `tests/test_compare.cjs`, UHA-63 | Review real-data comparisons and no-data states |
| Missing and bad readings are not invented | Historic validation and fixture tests | Review current real-data coverage, rejected files and audit |
| One-command startup works from saved snapshots | `tests/test_run.py`, UHA-108 | Test from a clean clone with real historical files |
| Historical source, dates and limitations are visible | UHA-43 and existing HTML | Confirm UI text and documentation match final exported model |
| Phone/tablet/desktop and keyboard operation | Existing national browser tests | Manual accessible navigation and contrast review under UHA-47 |
| All required automated tests pass | GitHub CI | Record final `main` commit SHA and green CI URL |
| Demonstration can be repeated | UHA-50 runbook | Complete an actual rehearsal with screenshots or recording |

## Important open questions

- **UHA-107:** the national batch import of all 112 locations in one API call triggered HTTP 400. A later request received HTTP 429. Do not assume a complete real dataset until the importer and audit are verified.
- **UHA-97 reference:** Jira comments refer to a data audit under UHA-97, but that issue key was not visible when checked on 18 November. Locate or restore the actual tracking item before recording the audit as complete.
- **UHA-47:** screen-reader testing and manual focus order are not covered by simple automated keyboard activation.
- **Dale's UI work:** UHA-94 and its unfinished subtasks belong to Dale. This checklist does not implement or close his tasks.

## Evidence record (complete after checks)

- Tested Git commit SHA: **Pending**
- Date and computer used: **Pending**
- Real snapshot coverage: **Pending**
- Python CI URL and result: **Pending**
- Browser CI URL and result: **Pending**
- Actual screenshot/recording links: **Pending**
- Defects and exceptions: **Pending**
- Reviewer and acceptance decision: **Pending**

## Acceptance rule

Keep UHA-46 In Progress until each required item has evidence, any exceptions are recorded, and a reviewer confirms the outcome. Synthetic browser data proves interface handling, not historical weather accuracy.
