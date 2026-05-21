"""Tests pour l'endpoint POST /api/editor-chat."""
import json
from unittest.mock import patch

_HTML = "<div><h1>Jean Dupont</h1><p>Développeur Python</p></div>"
_CSS  = "body { font-family: Arial; }"

_VALID_PAYLOAD = {
    "html":     _HTML,
    "css":      _CSS,
    "messages": [{"role": "user", "content": "Rends le CV plus professionnel"}],
    "doc_type": "CV",
}

_PROPOSAL_RESULT = {
    "reply": "J'ai amélioré la formulation.",
    "proposals": [
        {
            "id":      "p1",
            "title":   "Version améliorée",
            "summary": "Reformulation professionnelle.",
            "html":    "<div><h1>Jean Dupont</h1><p>Expert Python</p></div>",
            "css":     _CSS,
        }
    ],
}


def test_editor_chat_missing_html_returns_400(client):
    resp = client.post(
        "/api/editor-chat",
        json={"messages": [{"role": "user", "content": "test"}]},
    )
    assert resp.status_code == 400
    assert "HTML" in resp.get_json()["error"]


def test_editor_chat_missing_messages_returns_400(client):
    resp = client.post("/api/editor-chat", json={"html": _HTML})
    assert resp.status_code == 400
    assert "messages" in resp.get_json()["error"]


def test_editor_chat_empty_messages_returns_400(client):
    resp = client.post("/api/editor-chat", json={"html": _HTML, "messages": []})
    assert resp.status_code == 400


def test_editor_chat_payload_too_large_returns_413(client):
    big_html = "A" * 1_100_000
    resp = client.post(
        "/api/editor-chat",
        json={"html": big_html, "messages": [{"role": "user", "content": "test"}]},
    )
    assert resp.status_code == 413


def test_editor_chat_quota_exceeded_returns_429(client):
    with patch("app.quota.check_and_increment", return_value=False):
        resp = client.post("/api/editor-chat", json=_VALID_PAYLOAD)
    assert resp.status_code == 429


def test_editor_chat_user_key_bypasses_quota(client):
    with patch("app.ai_engine.complete_chat", return_value=_PROPOSAL_RESULT), \
         patch("app.quota.check_and_increment") as mock_quota:
        resp = client.post(
            "/api/editor-chat",
            json=_VALID_PAYLOAD,
            headers={"X-Api-Key": "AIzaUserKey"},
        )
    mock_quota.assert_not_called()
    assert resp.status_code == 200


def test_editor_chat_valid_response_returns_proposals(client):
    with patch("app.ai_engine.complete_chat", return_value=_PROPOSAL_RESULT), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post("/api/editor-chat", json=_VALID_PAYLOAD)

    assert resp.status_code == 200
    data = resp.get_json()
    assert "reply" in data
    assert "proposals" in data
    assert len(data["proposals"]) == 1
    p = data["proposals"][0]
    assert p["id"] == "p1"
    assert "html" in p
    assert "css" in p


def test_editor_chat_invalid_json_from_ai_returns_400(client):
    with patch("app.ai_engine.complete_chat",
               side_effect=ValueError("Réponse IA invalide (JSON malformé)")), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post("/api/editor-chat", json=_VALID_PAYLOAD)

    assert resp.status_code == 400
    assert "invalide" in resp.get_json()["error"].lower()


def test_editor_chat_runtime_error_returns_429(client):
    with patch("app.ai_engine.complete_chat",
               side_effect=RuntimeError("Quota Gemini épuisé")), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post("/api/editor-chat", json=_VALID_PAYLOAD)

    assert resp.status_code == 429


def test_editor_chat_generic_error_returns_500(client):
    with patch("app.ai_engine.complete_chat",
               side_effect=Exception("Erreur inattendue")), \
         patch("app.quota.check_and_increment", return_value=True):
        resp = client.post("/api/editor-chat", json=_VALID_PAYLOAD)

    assert resp.status_code == 500
