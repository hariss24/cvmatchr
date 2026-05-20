from unittest.mock import patch, MagicMock
import app as _app_module


def test_local_mode_leaves_convert_open(client, monkeypatch):
    monkeypatch.delenv("APP_MODE", raising=False)
    monkeypatch.delenv("REMOTE_AUTH_PASSWORD", raising=False)
    monkeypatch.delenv("AUTH_PASSWORD", raising=False)
    monkeypatch.delenv("RENDER", raising=False)

    with patch("app.html_to_pdf_bytes", return_value=b"%PDF-fake"):
        resp = client.post("/convert", json={"html": "<h1>Test</h1>"})

    assert resp.status_code == 200


def test_remote_mode_requires_auth_for_convert(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.setenv("REMOTE_AUTH_PASSWORD", "secret")

    resp = client.post("/convert", json={"html": "<h1>Test</h1>"})

    assert resp.status_code == 401
    assert resp.get_json()["error"] == "Authentication required."


def test_remote_mode_redirects_page_requests_to_login(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.setenv("REMOTE_AUTH_PASSWORD", "secret")

    resp = client.get("/history")

    assert resp.status_code == 302
    assert "/login" in resp.headers["Location"]


def test_remote_login_rejects_wrong_password(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.setenv("REMOTE_AUTH_PASSWORD", "secret")

    resp = client.post("/login", json={"password": "wrong"})

    assert resp.status_code == 401
    assert resp.get_json()["error"] == "Invalid password."


def test_remote_login_allows_convert(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.setenv("REMOTE_AUTH_PASSWORD", "secret")

    login = client.post("/login", json={"password": "secret"})
    assert login.status_code == 200

    with patch("app.html_to_pdf_bytes", return_value=b"%PDF-fake"):
        resp = client.post("/convert", json={"html": "<h1>CV</h1>"})

    assert resp.status_code == 200


def test_remote_mode_without_password_reports_setup_error(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.delenv("REMOTE_AUTH_PASSWORD", raising=False)
    monkeypatch.delenv("AUTH_PASSWORD", raising=False)

    resp = client.post("/convert", json={"html": "<h1>Test</h1>"})

    assert resp.status_code == 503
    assert "REMOTE_AUTH_PASSWORD" in resp.get_json()["error"]


def test_logout_get_not_allowed(client):
    resp = client.get("/logout")
    assert resp.status_code == 405


def test_login_rate_limited_after_max_failures(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.setenv("REMOTE_AUTH_PASSWORD", "secret")

    ip = "10.0.0.1"

    def fake_rate_ok():
        return False

    with patch("app._login_rate_limit_ok", side_effect=fake_rate_ok):
        resp = client.post("/login", json={"password": "wrong"})

    assert resp.status_code == 429
    assert "tentatives" in resp.get_json()["error"].lower()


def test_next_param_open_redirect_blocked(client, monkeypatch):
    monkeypatch.setenv("APP_MODE", "remote")
    monkeypatch.setenv("REMOTE_AUTH_PASSWORD", "secret")

    resp = client.post("/login", json={"password": "secret"})
    assert resp.status_code == 200
