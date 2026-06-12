import importlib
import pytest
from unittest.mock import MagicMock, patch


def _make_genai_mocks(chunks):
    """Crée les mocks pour google.genai (nouveau SDK)."""
    mock_client = MagicMock()
    mock_client.models.generate_content_stream.return_value = chunks
    mock_genai = MagicMock()
    mock_genai.Client.return_value = mock_client
    mock_types = MagicMock()
    return mock_genai, mock_types, mock_client


def test_raises_without_api_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    import ai_engine
    importlib.reload(ai_engine)
    with pytest.raises(ValueError, match="Aucune clé API"):
        list(ai_engine.stream_completion("test", "system"))


def test_is_anthropic_key_true():
    import ai_engine
    assert ai_engine._is_anthropic_key("sk-ant-abc123") is True


def test_is_anthropic_key_false():
    import ai_engine
    assert ai_engine._is_anthropic_key("AIzaSyAbc123") is False


def test_stream_gemini_text():
    mock_chunk = MagicMock()
    mock_chunk.text = "<h1>Test</h1>"
    mock_genai, mock_types, mock_client = _make_genai_mocks([mock_chunk])

    with patch.dict("sys.modules", {"google.genai": mock_genai, "google.genai.types": mock_types}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("prompt", "system", [], "fake-key"))

    assert result == ["<h1>Test</h1>"]
    mock_genai.Client.assert_called_once_with(api_key="fake-key")
    mock_client.models.generate_content_stream.assert_called_once()
    call_kwargs = mock_client.models.generate_content_stream.call_args[1]
    import ai_engine
    assert call_kwargs["model"] == ai_engine.GEMINI_MODEL


def test_stream_gemini_skips_empty_chunks():
    chunk1 = MagicMock()
    chunk1.text = ""
    chunk2 = MagicMock()
    chunk2.text = "<p>Contenu</p>"
    mock_genai, mock_types, mock_client = _make_genai_mocks([chunk1, chunk2])

    with patch.dict("sys.modules", {"google.genai": mock_genai, "google.genai.types": mock_types}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("p", "s", [], "k"))

    assert result == ["<p>Contenu</p>"]


def test_stream_gemini_with_images():
    mock_chunk = MagicMock()
    mock_chunk.text = "<p>Page 1</p>"
    fake_png = b"\x89PNG\r\n\x1a\n"
    mock_genai, mock_types, mock_client = _make_genai_mocks([mock_chunk])

    with patch.dict("sys.modules", {"google.genai": mock_genai, "google.genai.types": mock_types}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("Page 1 du CV :", "system", [fake_png], "key"))

    assert result == ["<p>Page 1</p>"]
    # Vérifie que Part.from_bytes a été appelé avec l'image
    # (types est résolu via mock_genai.types, pas mock_types directement)
    mock_genai.types.Part.from_bytes.assert_called_once_with(data=fake_png, mime_type="image/png")
    # Vérifie que la requête contient le prompt textuel
    call_kwargs = mock_client.models.generate_content_stream.call_args[1]
    assert "Page 1 du CV :" in call_kwargs["contents"]


def test_anthropic_rejects_images():
    import ai_engine
    importlib.reload(ai_engine)
    with pytest.raises(ValueError, match="ne supporte pas la conversion PDF"):
        list(ai_engine.stream_completion(
            "test", "system", images=[b"png"], api_key="sk-ant-fake"
        ))


def test_stream_anthropic():
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = ["<h2>Expé", "rience</h2>"]
    mock_client = MagicMock()
    mock_client.messages.stream.return_value = mock_stream
    mock_anthropic_mod = MagicMock()
    mock_anthropic_mod.Anthropic.return_value = mock_client

    with patch.dict("sys.modules", {"anthropic": mock_anthropic_mod}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_anthropic("prompt", "system", "sk-ant-key"))

    assert result == ["<h2>Expé", "rience</h2>"]
    mock_anthropic_mod.Anthropic.assert_called_once_with(api_key="sk-ant-key")
    call_kwargs = mock_client.messages.stream.call_args[1]
    assert call_kwargs["model"] == "claude-haiku-4-5-20251001"
    assert call_kwargs["system"] == "system"


# ---- Parité du schéma JSON (M1.1) ------------------------------------------
# _normalize_resume ne doit PAS perdre les sections projects / certifications /
# volunteer, supportées par le pipeline HTML. (Règle n°3 du CLAUDE.md.)

def test_normalize_resume_preserves_projects_certifications_volunteer():
    import ai_engine
    src = {
        "name": "Jean Test",
        "projects": [
            {"title": "Projet A", "date": "2024", "description": "Une description."},
        ],
        "certifications": ["AWS Certified", "Scrum Master"],
        "volunteer": [
            {"title": "Bénévole", "organization": "Croix-Rouge",
             "location": "Paris", "date": "2023", "bullets": ["Aide alimentaire."]},
        ],
    }
    out = ai_engine._normalize_resume(src)

    assert out["projects"] == [
        {"title": "Projet A", "date": "2024", "description": "Une description."}
    ]
    assert out["certifications"] == ["AWS Certified", "Scrum Master"]
    assert out["volunteer"] == [
        {"title": "Bénévole", "organization": "Croix-Rouge",
         "location": "Paris", "date": "2023", "bullets": ["Aide alimentaire."]}
    ]


def test_normalize_resume_new_sections_default_empty():
    import ai_engine
    out = ai_engine._normalize_resume({"name": "Vide"})
    assert out["projects"] == []
    assert out["certifications"] == []
    assert out["volunteer"] == []


def test_resume_schema_desc_mentions_new_sections():
    import ai_engine
    assert "projects" in ai_engine._RESUME_SCHEMA_DESC
    assert "certifications" in ai_engine._RESUME_SCHEMA_DESC
    assert "volunteer" in ai_engine._RESUME_SCHEMA_DESC


# ---- Round-trip tailor_resume : champs non mentionnés par l'IA survivent ----

def test_tailor_resume_preserves_extra_sections_when_ai_drops_them():
    """Si l'IA omet projects/certifications/volunteer, les données d'entrée sont préservées."""
    import json
    import ai_engine
    importlib.reload(ai_engine)

    input_resume = {
        "name": "Jean Test",
        "title": "Dev",
        "projects": [{"title": "Projet X", "date": "2024", "description": "Desc"}],
        "certifications": ["AWS", "Scrum"],
        "volunteer": [{"title": "Bénévole", "organization": "ONG",
                       "location": "Paris", "date": "2023", "bullets": []}],
    }

    # L'IA renvoie un JSON qui oublie projects/certifications/volunteer
    ai_response = json.dumps({
        "name": "Jean Test",
        "title": "Dev Senior",
        "summary": "Profil adapté.",
        "experience": [], "education": [], "skills": [],
        "languages": [], "interests": [],
    })

    mock_complete = MagicMock(return_value=ai_response)
    with patch("ai_engine._complete_gemini", mock_complete), \
         patch("ai_engine._require_key", return_value="fake-gemini-key"):
        result = ai_engine.tailor_resume(input_resume, "Offre dev senior", level="adapte")

    # Les données d'entrée sont préservées (fallback) quand l'IA les omet
    assert result["projects"] == [{"title": "Projet X", "date": "2024", "description": "Desc"}]
    assert result["certifications"] == ["AWS", "Scrum"]
    assert len(result["volunteer"]) == 1
    assert result["volunteer"][0]["title"] == "Bénévole"
    # Les champs IA présents sont bien là
    assert result["title"] == "Dev Senior"


def test_tailor_resume_preserves_extra_sections_when_ai_returns_them():
    """Quand l'IA renvoie correctement tous les champs, ils survivent."""
    import json
    import ai_engine
    importlib.reload(ai_engine)

    input_resume = {
        "name": "Jean Test",
        "projects": [{"title": "Projet X", "date": "2024", "description": "Desc"}],
        "certifications": ["AWS"],
        "volunteer": [],
    }

    ai_response = json.dumps({
        "name": "Jean Test",
        "title": "Dev",
        "summary": "Profil.",
        "experience": [], "education": [], "skills": [],
        "languages": [], "interests": [],
        "projects": [{"title": "Projet X adapté", "date": "2024", "description": "Desc IA"}],
        "certifications": ["AWS", "GCP"],
        "volunteer": [],
    })

    with patch("ai_engine._complete_gemini", return_value=ai_response), \
         patch("ai_engine._require_key", return_value="fake-gemini-key"):
        result = ai_engine.tailor_resume(input_resume, "Offre dev", level="adapte")

    assert result["projects"][0]["title"] == "Projet X adapté"
    assert result["certifications"] == ["AWS", "GCP"]
