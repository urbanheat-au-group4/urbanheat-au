"""Tests for the one-command dashboard startup. No network calls."""
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import run


def place(n):
    return {"id": f"place-{n}", "name": f"Place {n}", "state": "VIC",
            "latitude": -37.0, "longitude": 145.0,
            "region": "Victoria", "groups": ["australia_historical"]}


class StartupTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.boundaries = self.root / "static" / "australia_states.geojson"
        self.boundaries.parent.mkdir()
        self.boundaries.write_text(json.dumps({"type": "FeatureCollection", "features": []}))
        self.locations = [place(1), place(2)]
        self.data = self.root / "data" / "national" / "locations"
        self.data.mkdir(parents=True)
        self.root_patch = patch.object(run, "ROOT", self.root)
        self.dir_patch = patch.object(run, "DATA_DIR", self.data.parent)
        self.boundary_patch = patch.object(run, "BOUNDARIES", self.boundaries)
        self.load_patch = patch.object(run, "load_catalogue", return_value=self.locations)
        self.check_patch = patch.object(run, "check_boundaries", return_value=8)
        for item in (self.root_patch, self.dir_patch, self.boundary_patch,
                     self.load_patch, self.check_patch):
            item.start()

    def tearDown(self):
        for item in (self.check_patch, self.load_patch, self.boundary_patch,
                     self.dir_patch, self.root_patch):
            item.stop()
        self.folder.cleanup()

    def save_files(self):
        for item in self.locations:
            (self.data / (item["id"] + ".json")).write_text("{}")

    def test_missing_history_stops_before_running_any_scripts(self):
        with patch.object(run, "run_script") as command:
            self.assertFalse(run.prepare())
            command.assert_not_called()

    def test_incomplete_history_stops_before_export(self):
        self.save_files()
        with patch.object(run, "run_script", return_value=False) as command:
            self.assertFalse(run.prepare())
            command.assert_called_once_with("national_coverage.py")

    def test_ready_history_builds_every_export(self):
        self.save_files()
        with patch.object(run, "run_script", return_value=True) as command:
            self.assertTrue(run.prepare())
            self.assertEqual([call.args[0] for call in command.call_args_list],
                             ["national_coverage.py", *run.EXPORT_SCRIPTS])

    def test_missing_boundaries_are_downloaded(self):
        self.save_files()
        self.boundaries.unlink()
        with patch.object(run, "run_script", return_value=True) as command:
            self.assertTrue(run.prepare())
            self.assertEqual(command.call_args_list[-1].args[0],
                             "fetch_national_boundaries.py")

    def test_broken_boundary_json_is_downloaded_again(self):
        self.save_files()
        self.boundaries.write_text("[]")
        with patch.object(run, "check_boundaries", side_effect=AttributeError("bad format")):
            with patch.object(run, "run_script", return_value=True) as command:
                self.assertTrue(run.prepare())
                self.assertEqual(command.call_args_list[-1].args[0],
                                 "fetch_national_boundaries.py")

    def test_boundary_download_failure_stops_startup(self):
        self.save_files()
        self.boundaries.unlink()
        def command(name):
            return name != "fetch_national_boundaries.py"
        with patch.object(run, "run_script", side_effect=command):
            self.assertFalse(run.prepare())

    def test_check_mode_does_not_start_server(self):
        with patch.object(run, "prepare", return_value=True), patch.object(
            run.subprocess, "run"
        ) as command:
            self.assertEqual(run.main(["--check"]), 0)
            command.assert_not_called()

    def test_normal_mode_starts_the_server_after_preparing(self):
        with patch.object(run, "prepare", return_value=True), patch.object(
            run.subprocess, "run", return_value=SimpleNamespace(returncode=0)
        ) as command:
            self.assertEqual(run.main([]), 0)
            self.assertEqual(command.call_args.args[0][-1], str(self.root / "server.py"))

    def test_preparation_failure_does_not_start_server(self):
        with patch.object(run, "prepare", return_value=False), patch.object(
            run.subprocess, "run"
        ) as command:
            self.assertEqual(run.main([]), 1)
            command.assert_not_called()


if __name__ == "__main__":
    unittest.main()
