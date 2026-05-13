import io
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


def test_pdf_to_html_no_file_returns_400(client):
    resp = client.post("/api/pdf-to-html", data={})
    assert resp.status_code == 400


def test_pdf_to_html_non_pdf_returns_400(client):
    resp = client.post(
        "/api/pdf-to-html",
        data={"file": (io.BytesIO(b"content"), "document.txt")},
        content_type="multipart/form-data",
    )
    assert resp.status_code == 400


def test_pdf_to_html_streams_sse(client):
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100

    def fake_fitz_open(**kwargs):
        mock_doc = MagicMock()
        mock_page = MagicMock()
        mock_pix = MagicMock()
        mock_pix.tobytes.return_value = fake_png
        mock_page.get_pixmap.return_value = mock_pix
        mock_doc.__len__ = MagicMock(return_value=1)
        mock_doc.__getitem__ = MagicMock(return_value=mock_page)
        mock_doc.close = MagicMock()
        return mock_doc

    def fake_stream(prompt, system, images=None, api_key=None):
        yield "<h1>CV</h1>"

    with patch("app.quota.check_and_increment", return_value=True), \
         patch("app.ai_engine.stream_completion", side_effect=fake_stream):
        import fitz
        with patch("fitz.open", side_effect=fake_fitz_open):
            resp = client.post(
                "/api/pdf-to-html",
                data={"file": (io.BytesIO(b"fake pdf bytes"), "cv.pdf")},
                content_type="multipart/form-data",
            )

    assert resp.status_code == 200
    assert "[DONE]" in resp.data.decode()
