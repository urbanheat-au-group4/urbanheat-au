# UrbanHeat AU — final closeout and acceptance tracker

**Audit date:** 25 November 2026  
**Owner:** Paul (release coordination)  
**Status:** NOT RELEASE-ACCEPTED. This is a closeout worklist, not a claim of completed testing.

## Scope freeze

No new product features before the final demonstration. Keep Dale's UI files and Jira UHA-94/UHA-112 implementation ownership with Dale. Changes should use a branch, supporting tests/evidence, PR review and CI validation.

## Release gates (all must have actual evidence)

| Gate | Responsible | Tracking | Required evidence | Current disposition |
| --- | --- | --- | --- | --- |
| A. Historical snapshot coverage and integrity | Paul | UHA-46, UHA-107, UHA-82 | `python3 run.py --check`; `python3 verify_national_release.py`; 112/112 coverage only if verified, dated artifact with source/model/period | Pending verified run on final dataset |
| B. Real values match map/history/seasonal UI | Paul | UHA-44, UHA-46 | `npm run test:real-data` on final data; manually inspect sample locations, units and no-data cases | Pending verified run |
| C. National mapping and interaction | Paul + reviewer | UHA-44, UHA-74, UHA-82 | Eight states, 14 locations each, legible labels/annotations, keyboard selection, return navigation, screenshot evidence | Pending final-main check |
| D. UI redesign and responsive acceptance | Dale | UHA-94, UHA-98–106, UHA-112–120, UHA-111 | Overview/Historical/Compare tabs, persistent selections, no page scroll at desktop target if shipped, screenshots 1440×900 and 1366×768; tablet/mobile; documented keyboard and focus checks | Dale-owned tasks remain open in Jira |
| E. Automated regression and accessibility | Paul + Dale for UI defects | UHA-44, UHA-47 | Exact tested commit, green CI URL, Python + Node/Playwright runs, manual focus/contrast/screen-reader notes | Manual accessibility evidence pending; PR #89 is open |
| F. Hosted demonstration | Paul | GitHub issues #63–67, UHA-50 | Live URL, deployed SHA, real-export provenance or clearly stated unavailable-data mode, 390px/mobile screenshots, verified redeploy | Deployment acceptance checklist open |
| G. Coursework delivery | Paul/team | UHA-26, UHA-46, UHA-50, UHA-51 | Final Sprint 4 report, acceptance matrix, demo rehearsal evidence, team contributions, known limitations and submission checklist | Drafts and tasks exist; final submission not recorded |

## Immediate ordered execution

1. **Release baseline:** record final `main` commit SHA and CI URLs. Do not accept PRs just because they exist. Review #89 and confirm tests; treat #91–93 as support wiring for Dale, not proof the redesigned UI ships.
2. **Real data:** confirm the saved historical snapshots, execute `python3 run.py --check`, `python3 verify_national_release.py`, and `npm run test:real-data`; attach exact results. If snapshots are unavailable, record the blocker and use no-weather mode honestly.
3. **Core regression:** run `python3 -m unittest discover -s tests -p 'test_*.py' -v` and the relevant Node/browser checks. Use a separate clean clone for fixture-based UI tests; never overwrite validated exports.
4. **Dale UI acceptance:** reconcile UHA-94 and UHA-112, obtain a reviewed PR and evidence for desktop, responsive and keyboard requirements. UHA-111 focus loss needs resolution or a documented exception.
5. **Public deployment:** verify site URL, exported data provenance, screenshot navigation, deployment/redeployment runs; update GitHub #63–67 and README only after demonstrated.
6. **Handover:** perform the five-minute rehearsal using `docs/uha-50-demonstration-plan.md`, record screenshots and a real-data/fixture label; complete `docs/uha-46-acceptance-matrix.md` and Sprint 4 report.
7. **Close Jira:** only transition tickets to Done with matching PR/test/rehearsal evidence. Parent issues follow child acceptance, not the reverse.

## Critical presentation limitations

- Data are Open-Meteo ERA5 **modelled** historical estimates for **2015–2025**, not live sensor observations or forecasts.
- State colours summarise selected sample locations, not exhaustive state-wide temperature measurements.
- Nearby locations share approximately 25 km model grids; avoid false precision in comparisons.
- Independent location geocoding validation is outstanding unless separately evidenced.
- The illustrative design's 1981–2010 baseline and placeholder values are NOT supported production data.
- Offline fixture browser screenshots do **not** establish historical measurement accuracy.
- Do not mark the project or demonstration complete until actual test outputs and reviewer acceptance are recorded.

## Final evidence manifest (fill after execution)

| Evidence | Result / link |
| --- | --- |
| Release commit SHA and date | Pending |
| Python tests and CI workflow | Pending |
| Node + browser tests and CI workflow | Pending |
| Historical snapshot count and coverage report | Pending |
| UHA-46 export audit artifact | Pending |
| Real-data browser check | Pending |
| Desktop/mobile and keyboard screenshots | Pending |
| Hosted deployment / redeployment URLs | Pending |
| Dale UI acceptance / UHA-111 disposition | Pending |
| Demo rehearsal / final report / reviewer sign-off | Pending |

**Exit criterion:** Every required gate has linked evidence or a documented, accepted exception. A draft or a passing fixture test by itself is not release sign-off.
