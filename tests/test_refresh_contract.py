"""UHA-44: deterministic server refresh and atomic-file regression tests.

All subprocesses, clocks and failures are mocked; never contacts weather APIs.
"""
import subprocess
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import historical_weather as hist
import server


class WeatherRefreshContractTests(unittest.TestCase):
    def setUp(self):
        with server.refresh_state_lock:
            self.previous = dict(server.refresh_state)
            server.refresh_state.update({
                "running": False, "last_attempt_utc": None,
                "last_success_utc": None, "last_error": None
            })

    def tearDown(self):
        with server.refresh_state_lock:
            server.refresh_state.clear()
            server.refresh_state.update(self.previous)

    def test_success_records_timestamp_and_clears_error(self):
        completed = subprocess.CompletedProcess(["weather.py"], 0, "ok", "")
        with patch.object(server.subprocess, "run", return_value=completed) as execute:
            self.assertTrue(server.refresh_weather())
        self.assertEqual(execute.call_count, 1)
        self.assertEqual(execute.call_args.kwargs["timeout"], server.REFRESH_TIMEOUT_SECONDS)
        with server.refresh_state_lock:
            self.assertFalse(server.refresh_state["running"])
            self.assertIsNone(server.refresh_state["last_error"])
            self.assertIsNotNone(server.refresh_state["last_attempt_utc"])
            self.assertIsNotNone(server.refresh_state["last_success_utc"])

    def test_failed_refresh_preserves_previous_success(self):
        with server.refresh_state_lock:
            server.refresh_state["last_success_utc"] = "2026-11-01T00:00:00+00:00"
        failed = subprocess.CompletedProcess(["weather.py"], 1, "", "Provider unavailable")
        with patch.object(server.subprocess, "run", return_value=failed):
            self.assertFalse(server.refresh_weather())
        with server.refresh_state_lock:
            self.assertEqual(server.refresh_state["last_success_utc"],
                             "2026-11-01T00:00:00+00:00")
            self.assertIn("Provider unavailable", server.refresh_state["last_error"])
            self.assertFalse(server.refresh_state["running"])

    def test_timeout_is_recoverable_and_does_not_mark_success(self):
        with patch.object(server.subprocess, "run",
                          side_effect=subprocess.TimeoutExpired("weather.py", 90)):
            self.assertFalse(server.refresh_weather())
        with server.refresh_state_lock:
            self.assertIsNone(server.refresh_state["last_success_utc"])
            self.assertIsNotNone(server.refresh_state["last_error"])
            self.assertFalse(server.refresh_state["running"])

    def test_overlapping_refresh_does_not_spawn_second_process(self):
        started, release = threading.Event(), threading.Event()
        results = []

        def delayed(*args, **kwargs):
            started.set()
            if not release.wait(timeout=5):
                raise RuntimeError("test worker timed out")
            return subprocess.CompletedProcess(args[0], 0, "", "")

        with patch.object(server.subprocess, "run", side_effect=delayed) as execute:
            worker = threading.Thread(target=lambda: results.append(server.refresh_weather()))
            worker.start()
            try:
                self.assertTrue(started.wait(3), "refresh worker never started")
                self.assertFalse(server.refresh_weather(), "overlap should not start a second job")
                self.assertEqual(execute.call_count, 1)
                with server.refresh_state_lock:
                    self.assertTrue(server.refresh_state["running"])
            finally:
                release.set()
                worker.join(timeout=5)
            self.assertFalse(worker.is_alive())
        self.assertEqual(results, [True])
        with server.refresh_state_lock:
            self.assertFalse(server.refresh_state["running"])


class AtomicSnapshotTests(unittest.TestCase):
    def test_replace_failure_keeps_prior_data_and_removes_temp_file(self):
        with tempfile.TemporaryDirectory() as directory:
            original = Path(directory) / "national_data.json"
            original.write_text('{"source":"previous valid snapshot"}', encoding="utf-8")
            previous = original.read_bytes()
            with patch.object(hist.os, "replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError):
                    hist.save_atomic(original, {"source": "new snapshot"})
            self.assertEqual(original.read_bytes(), previous)
            self.assertEqual(sorted(p.name for p in Path(directory).iterdir()),
                             ["national_data.json"], "Temporary file was not cleaned up")


if __name__ == "__main__":
    unittest.main()
