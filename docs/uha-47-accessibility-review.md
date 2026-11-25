# UHA-47 Accessibility and usability evidence

The automated checks cover the main keyboard, labelling, contrast and reflow requirements. An independent review with a screen reader is still open.

## What the automated check covers

Run `npm run test:a11y` against the national dashboard. GitHub Actions runs it with the catalogue-only fixture and the packaged Pages build. It checks Overview, Historical and Compare in Chromium at 320, 390, 768, 1366 and 1440 px.

- visible labels and accessible names for the dashboard controls;
- alternative text for the home logo and an accessible label for the map;
- status roles on loading, warning, chart and comparison feedback;
- the skip link and visible keyboard focus on the state selector;
- keyboard selection from state navigation, state summary buttons, SVG markers and the mobile location list;
- keyboard scrolling in the annual data table and no horizontal page overflow with chart tables open;
- 44 px targets for the main phone controls and automated axe checks on all three tabs;
- representative contrast checks on headings, coverage, control labels and map callouts in the populated build;
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

Keep Jira UHA-47 open until the manual session is recorded. Link the browser workflow, describe any remaining defects and include the browser and assistive technology versions used.
