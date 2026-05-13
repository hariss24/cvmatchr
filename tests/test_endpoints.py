import pytest
from unittest.mock import patch, MagicMock
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def client():
    import app as flask_app
    flask_app.app.config["TESTING"] = True
    with flask_app.app.test_client() as c:
        yield c


def test_text_to_html_empty_body_returns_400(client):
    resp = client.post("/api/text-to-html", json={"text": ""})
    assert resp.status_code == 400


def test_text_to_html_quota_exceeded_returns_429(client):
    with patch("app.quota.check_and_increment", return_value=False):
        resp = client.post("/api/text-to-html", json={"text": "Jean Dupont"})
    assert resp.status_code == 429


def test_text_to_html_streams_sse(client):
    def fake_stream(prompt, system, images=None, api_key=None):
        yield "<h1>Jean"
        yield " Dupont</h1>"

    with patch("app.ai_engine.stream_completion", side_effect=fake_stream), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post("/api/text-to-html", json={"text": "Jean Dupont\nDéveloppeur"})

    assert resp.status_code == 200
    assert "text/event-stream" in resp.content_type
    body = resp.data.decode()
    assert "Jean" in body
    assert "[DONE]" in body


def test_text_to_html_user_key_bypasses_quota(client):
    def fake_stream(prompt, system, images=None, api_key=None):
        yield "<h1>Test</h1>"

    with patch("app.ai_engine.stream_completion", side_effect=fake_stream), \
         patch("app.quota.check_and_increment") as mock_quota:
        resp = client.post(
            "/api/text-to-html",
            json={"text": "some CV"},
            headers={"X-Api-Key": "AIzaUserKey"},
        )

    mock_quota.assert_not_called()
    assert resp.status_code == 200
