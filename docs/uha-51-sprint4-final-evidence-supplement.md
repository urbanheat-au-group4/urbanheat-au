# Sprint 4 | Extra testing and progress notes

**Updated:** 25 November 2026  
**Main report:** [Sprint 4 report in Confluence](https://urban-heatmap.atlassian.net/wiki/spaces/UHA/pages/13205506)

This page records what I have checked and what we still need to finish. It is not our final Sprint 4 result.

## 1. What has been completed

We have built the national dashboard, with 112 locations across all eight Australian states and territories. The app includes a map, historical charts, seasonal information and a way to compare locations.

The latest checks I could confirm are from [GitHub CI run #207](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45400496287). Both the test job and the eight-state browser job passed. These cover Python code, JavaScript, comparisons, loading errors and map navigation.

That is useful evidence, but the browser tests use location names and test data without real weather measurements. They do not prove our actual 2015–2025 readings.

## 2. What I still need to test

On 18 November, I reported 112 saved location files and none missing. I still need to save a new, dated audit from the final version of the project.

I have added `scripts/collect_final_evidence.sh` to PR #94. It runs our checks and saves the logs in one folder. I need to run it on the computer holding our real weather files.

I also need to start the website and run `npm run test:real-data`. This compares the displayed figures against the generated exports.

Until these checks are recorded, UHA-44 and UHA-46 should stay In Progress.

## 3. UI work and team contributions

Dale submitted and merged UI PRs #74, #75, #76, #77 and #81 during 12–13 November. These improved spacing, map labels, selected-location details, charts and phone controls.

I worked on the national map, data imports, testing, documentation, delivery planning and the shared data/state code in PRs #91–93. Those last three PRs help with Dale's next layout, but they do not create the layout itself.

Dale still owns UHA-94 and UHA-112–120. The updated desktop tabs have not been accepted yet.

## 4. Problems we still need to deal with

- **Keyboard focus:** UHA-111 records a problem after selecting a map marker. Accessibility PR #89 remains open.
- **Historical data:** CI does not have our local weather archive. We need the actual audit results.
- **Location accuracy:** the marker IDs are tested, but the coordinates need checking against real locations.
- **Hosting:** GitHub issues #63–67 still require proof that the public site and updates work.
- **Demonstration:** the script is ready, but we have not recorded the final rehearsal.

## 5. What I have learned

A test can pass without proving every part of the app works. For example, browser tests can check whether the map opens even when real weather files are unavailable. We need both code tests and checks using the real exported data.

We also need to keep everyone's work separate in Jira. That makes it clearer who built each part, what is finished, and what still needs checking.

## 6. Final evidence checklist

- [ ] Record the final Git commit and CI result
- [ ] Save the historical data audit
- [ ] Check real values in the browser
- [ ] Take final map and mobile screenshots
- [ ] Test keyboard, focus, contrast and screen reader
- [ ] Confirm the public website works
- [ ] Rehearse the demonstration and save evidence
- [ ] Update the final report with our sprint results
- [ ] Complete Jira reviews and record who approved them

The final sprint report is still being completed. I will update it with actual results rather than guessing what passed.

**Evidence:** [PR #94](https://github.com/urbanheat-au-group4/urbanheat-au/pull/94), [CI #207](https://github.com/urbanheat-au-group4/urbanheat-au/actions/runs/45400496287), [UHA-51](https://urban-heatmap.atlassian.net/browse/UHA-51).
