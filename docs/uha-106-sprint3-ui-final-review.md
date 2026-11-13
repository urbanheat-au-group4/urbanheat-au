# Sprint 3 UI final review (UHA-106)

**Checked:** 13 November 2026  
**Sprint:** Sprint 3 – Historical Analysis  
**Parent task:** UHA-94

## What we finished

- UHA-98: Three small layout ideas and the chosen map-first design. PR #78.
- UHA-99: Less scrolling and a simpler national dashboard. PR #74.
- UHA-100: Consistent colours, type and controls. Already checked in Jira.
- UHA-101: More readable map labels, selected marker and legend. PR #75.
- UHA-102: Location details and monthly highs in one expandable section. PR #76.
- UHA-103: Clearer historical and seasonal chart titles and descriptions. PR #79.
- UHA-104: Check the page at phone, tablet and desktop sizes. PR #80.
- UHA-105: Keyboard use, visible focus and missing-data messages. PR #80.

All these changes were merged through pull requests. See Jira for the individual task notes.

## Tests and evidence

The final UI browser workflow passed:

- [GitHub CI run #170](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/43364252419)
- Python tests: passed.
- Eight-state Chromium browser tests: passed.
- National map: 112 markers, eight state views, 14 labels each.
- Browser regression tests: selection, values, old data files and errors.
- Chart tests: year-by-year and seasonal charts, missing values and phone widths.
- New UI tests: 1440px desktop, 768px tablet and 390px phone; no horizontal page overflow; location changes; keyboard map markers; visible focus; the mobile Menu; and missing-data messages.

The same workflow saved screenshots for the three screen sizes, together with the earlier state map checks:

[Browser screenshots artifact](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/43364252419/artifacts/14009283610)

The screenshots are automated test evidence. They still need a human visual check before a final presentation if fonts or spacing look wrong on a different computer.

## The development process we used

1. Work on a task in its own branch.
2. Run the Python and browser checks.
3. Add screenshots and proof.
4. Open a pull request.
5. Fix any review or test problems.
6. Merge when all checks are green.
7. Mark the matching Jira task Done.

## Limits to remember

- The browser tests use real catalogue names and map positions, but most weather values in the tests are **unavailable**. Separate numeric browser tests use clearly marked made-up test values, never production weather readings.
- Actual 2015–2025 weather measurements are stored in local files and must be prepared with `python3 run.py` before the live demo.
- The 112 location coordinates still need independent checking. That work is tracked separately for Sprint 4.
- The full screen-reader accessibility review is UHA-47 in Sprint 4. Passing the keyboard checks does not prove complete accessibility.

## Sprint 3 result

The map-first dashboard, location climate details, historical/seasonal charts, comparison and responsive/keyboard checks are ready for final project testing. Further changes should be tracked as separate bugs or Sprint 4 tasks, rather than reopening completed Sprint 3 UI work.
