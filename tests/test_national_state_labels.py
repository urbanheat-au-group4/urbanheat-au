"""The state map must display all 14 location tags automatically."""
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which("node"), "Node.js is needed for map layout tests")
class StateZoomLabelsTests(unittest.TestCase):
    def test_all_state_labels_fit_without_overlap(self):
        script = r"""
const fs = require('fs');
const annotations = require('./static/national_annotations.js');
const places = JSON.parse(fs.readFileSync('locations.json', 'utf8')).locations;
for (const state of ['NSW','VIC','QLD','WA','SA','TAS','ACT','NT']) {
  const sample = places.filter(p => p.state === state && p.groups.includes('australia_historical'))
    .map((p, index) => ({
      id:p.id, name:p.name, state:p.state,
      x:36+(p.longitude-112)*928/42.5,
      y:36+(-10-p.latitude)*688/34.5,
      annual_mean_c:14+index
    }));
  if (sample.length !== 14) throw Error(state+' missing catalogue locations');
  const view = annotations.stateViewBox(sample, state);
  const tags = annotations.labelLayout(sample, 'annual_mean_c', state, '', view);
  if (tags.length !== 14) throw Error(state+' has only '+tags.length+' tags');
  const ids = new Set(tags.map(t=>t.point.id));
  if (ids.size !== 14) throw Error(state+' duplicate tags');
  const gap = 0.01;
  for (let i=0;i<tags.length;i++) {
    const a=tags[i];
    if (a.x<view.x || a.y<view.y ||
        a.x+a.width>view.x+view.width || a.y+a.height>view.y+view.height) {
      throw Error(state+' label outside map: '+a.point.name);
    }
    if (!a.annotation) throw Error(state+' missing annotation');
    for (let j=i+1;j<tags.length;j++) {
      const b=tags[j];
      if (a.x<b.x+b.width-gap && a.x+a.width>b.x+gap &&
          a.y<b.y+b.height-gap && a.y+a.height>b.y+gap) {
        throw Error(state+' overlapping labels: '+a.point.name+' / '+b.point.name);
      }
    }
  }
}
"""
        result = subprocess.run(
            ["node", "-e", script], cwd=ROOT, text=True,
            capture_output=True, check=False, timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == "__main__":
    unittest.main()
