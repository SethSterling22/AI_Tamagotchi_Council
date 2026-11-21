import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from council import db  # noqa: E402
from council.app import create_app  # noqa: E402
from council.monitor import Monitor  # noqa: E402
from tools.fake_ollama import FakeOllama  # noqa: E402


@pytest.fixture
def app(tmp_path, monkeypatch):
    monkeypatch.setenv("COUNCIL_DB", str(tmp_path / "t.db"))
    db._local.__dict__.clear()
    mon = Monitor(interval_ok=0.2, interval_bad=0.1, fails_to_drop=2, timeout=1.0)
    return create_app(mon, autostart=False)


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def ollama():
    f = FakeOllama(models=["qwen3:0.6b"]).start()
    yield f
    f.stop()
