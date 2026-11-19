# UHA-47 Accessibility and usability evidence

**Status:** Automated checks prepared. Manual review not yet completed.

## What the automated check covers

Run `npm run test:a11y` after starting the national dashboard with catalogue-only test data. It uses Chromium at desktop (1440 px), tablet (768 px) and mobile (390 px) widths to check:

- visible labels for the nine main selection controls;
- alternative text for the home logo and an accessible label for the map;
- status roles on loading, warning, chart and comparison feedback;
- selecting NSW, then selecting a location by focusing a marker and pressing Enter;
- preserved selection and absence of horizontal page overflow;
- no browser JavaScript exceptions.

This runs as part of GitHub's eight-state browser CI. It does **not** certify WCAG conformance or screen-reader accessibility.

## Manual checks still required

| Test | Procedure | Evidence to record |
| --- | --- | --- |
| Screen reader | Open the site using NVDA/Firefox or VoiceOver/Safari. Navigate from the title into state selection, markers and detail panels | Reader/browser versions, spoken marker names and any unlabeled controls |
| Keyboard order | Tab from page header to state selector, map markers, location details, charts and comparison controls. Go backwards with Shift+Tab | Unreachable controls, unexpected jumps and lost focus |
| Focus visibility | Observe outlines on light map areas, tags, summary rows, nav buttons and dropdowns | Actual screenshots and any hard-to-find focus |
| Zoom and mobile | Try browser zoom at 200% and a 390 px viewport; check text and controls | Whether content overlaps or clips, with screenshot |
| Contrast | Check representative text, label backgrounds, colour legend and status warnings with a contrast checker | Measurements and any contrast failures |
| Errors and missing data | Load the catalogue-only fixture and switch locations / heat measures | Whether no-data information is understandable without colour |
| Label readability | Review NSW and Victoria state views, especially Melbourne clusters and connector lines | Screenshots and a reproducible note for confusing labels |

## Recording results

Complete the following after a real manual session:

- Date / tester: **Pending**
- Browser / device / screen reader: **Pending**
- Tested Git commit SHA: **Pending**
- Automated CI result: **Pending**
- Screenshot or recording link: **Pending**
- Manual results and defects: **Pending**
- Final outcome: **Pending**

Keep Jira UHA-47 **In Progress** until manual results are recorded. If an issue is found, file a separate Jira bug with expected/actual behaviour and the relevant screenshot. Dale owns UHA-94 UI implementation; this task is testing and reporting, not taking over those changes.
