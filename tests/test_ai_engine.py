import importlib
import pytest
from unittest.mock import MagicMock, patch


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
    mock_model = MagicMock()
    mock_model.generate_content.return_value = [mock_chunk]
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model

    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("prompt", "system", [], "fake-key"))

    assert result == ["<h1>Test</h1>"]
    mock_genai.configure.assert_called_once_with(api_key="fake-key")
    mock_genai.GenerativeModel.assert_called_once_with(
        model_name="gemini-2.0-flash",
        system_instruction="system",
    )


def test_stream_gemini_skips_empty_chunks():
    chunk1 = MagicMock()
    chunk1.text = ""
    chunk2 = MagicMock()
    chunk2.text = "<p>Contenu</p>"
    mock_model = MagicMock()
    mock_model.generate_content.return_value = [chunk1, chunk2]
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model

    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("p", "s", [], "k"))

    assert result == ["<p>Contenu</p>"]


def test_stream_gemini_with_images():
    mock_chunk = MagicMock()
    mock_chunk.text = "<p>Page 1</p>"
    mock_model = MagicMock()
    mock_model.generate_content.return_value = [mock_chunk]
    mock_genai = MagicMock()
    mock_genai.GenerativeModel.return_value = mock_model
    fake_png = b"\x89PNG\r\n\x1a\n"

    with patch.dict("sys.modules", {"google.generativeai": mock_genai}):
        import ai_engine
        importlib.reload(ai_engine)
        result = list(ai_engine._stream_gemini("Page 1 du CV :", "system", [fake_png], "key"))

    assert result == ["<p>Page 1</p>"]
    call_contents = mock_model.generate_content.call_args[0][0]
    assert {"mime_type": "image/png", "data": fake_png} in call_contents
    assert "Page 1 du CV :" in call_contents


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
