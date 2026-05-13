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
