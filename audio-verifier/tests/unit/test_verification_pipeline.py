"""
Unit tests for verification_pipeline.py

Tests the 6-stage audio verification pipeline with mocked external services.
"""

import json
import pytest
from unittest.mock import patch, MagicMock, AsyncMock, mock_open
import tempfile
import os

from verification_pipeline import VerificationPipeline


class TestVerificationPipelineInit:
    """Test VerificationPipeline initialization."""

    def test_init_with_required_params(self, mock_session_store):
        """Test pipeline initialization."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key",
            acoustid_api_key="acoustid-key"
        )
        
        assert pipeline.session_store == mock_session_store
        assert pipeline.openai_client is not None
        assert pipeline.quality_checker is not None
        assert pipeline.copyright_detector is not None

    def test_init_without_acoustid_key(self, mock_session_store):
        """Test pipeline initialization without AcoustID key."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        assert pipeline.session_store == mock_session_store
        assert pipeline.openai_client is not None


class TestQualityCheckStage:
    """Test Stage 1: Quality Check."""

    @pytest.mark.asyncio
    async def test_quality_check_stage_executes(self, mock_session_store, mock_audio_quality_checker, valid_audio_file):
        """Test that quality check stage executes and updates progress."""
        with patch('verification_pipeline.AudioQualityChecker', return_value=mock_audio_quality_checker):
            pipeline = VerificationPipeline(
                session_store=mock_session_store,
                openrouter_api_key="test-key"
            )
            pipeline.quality_checker = mock_audio_quality_checker
            
            result = await pipeline._stage_quality_check("session-id", str(valid_audio_file))
            
            assert result["quality"]["passed"] is True
            assert "duration" in result["quality"]
            # Verify update_stage was called
            assert mock_session_store.update_stage.call_count >= 2

    @pytest.mark.asyncio
    async def test_quality_check_fails_fast(self, mock_session_store, valid_audio_file):
        """Test that pipeline fails if quality check fails."""
        mock_quality_checker = AsyncMock()
        mock_quality_checker.check_audio_file = AsyncMock(return_value={
            "quality": {"passed": False},
            "errors": ["Too much silence"]
        })
        
        with patch('verification_pipeline.AudioQualityChecker', return_value=mock_quality_checker):
            pipeline = VerificationPipeline(
                session_store=mock_session_store,
                openrouter_api_key="test-key"
            )
            pipeline.quality_checker = mock_quality_checker
            
            result = await pipeline._stage_quality_check("session-id", str(valid_audio_file))
            
            assert result["quality"]["passed"] is False


class TestCopyrightCheckStage:
    """Test Stage 2: Copyright Check."""

    @pytest.mark.asyncio
    async def test_copyright_check_stage_executes(self, mock_session_store, mock_fingerprinter, valid_audio_file):
        """Test that copyright check stage executes."""
        with patch('verification_pipeline.CopyrightDetector', return_value=mock_fingerprinter):
            pipeline = VerificationPipeline(
                session_store=mock_session_store,
                openrouter_api_key="test-key"
            )
            pipeline.copyright_detector = mock_fingerprinter
            
            result = await pipeline._stage_copyright_check("session-id", str(valid_audio_file))
            
            assert "copyright" in result
            assert mock_session_store.update_stage.call_count >= 2

    @pytest.mark.asyncio
    async def test_copyright_check_detects_copyrighted_content(self, mock_session_store, valid_audio_file):
        """Test copyright detection during stage."""
        mock_copyright_detector = AsyncMock()
        mock_copyright_detector.check_copyright_from_path = AsyncMock(return_value={
            "copyright": {
                "detected": True,
                "passed": False,
                "confidence": 0.95,
                "matches": [{"title": "Song", "artist": "Artist"}]
            }
        })
        
        with patch('verification_pipeline.CopyrightDetector', return_value=mock_copyright_detector):
            pipeline = VerificationPipeline(
                session_store=mock_session_store,
                openrouter_api_key="test-key"
            )
            pipeline.copyright_detector = mock_copyright_detector
            
            result = await pipeline._stage_copyright_check("session-id", str(valid_audio_file))
            
            assert result["copyright"]["detected"] is True
            assert result["copyright"]["passed"] is False


class TestTranscriptionStage:
    """Test Stage 3: Transcription."""

    @pytest.mark.asyncio
    async def test_transcription_stage_executes(self, mock_session_store, valid_audio_file):
        """Test that transcription stage calls OpenRouter."""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Transcribed text here"
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_transcription("session-id", str(valid_audio_file))
        
        assert "Transcribed" in result
        assert mock_client.chat.completions.create.called
        assert mock_session_store.update_stage.call_count >= 2

    @pytest.mark.asyncio
    async def test_transcription_encodes_audio_base64(self, mock_session_store, valid_audio_file):
        """Test that audio is base64 encoded for API call."""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Test transcript"
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_transcription("session-id", str(valid_audio_file))
        
        # Verify base64 encoding happened
        call_args = mock_client.chat.completions.create.call_args
        assert call_args is not None
        messages = call_args[1]["messages"]
        assert "data:" in str(messages)  # Data URL format

    @pytest.mark.asyncio
    async def test_transcription_handles_api_error(self, mock_session_store, valid_audio_file):
        """Test that transcription errors are properly raised."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        with pytest.raises(Exception, match="Failed to transcribe"):
            await pipeline._stage_transcription("session-id", str(valid_audio_file))

    @pytest.mark.asyncio
    @pytest.mark.timeout(5)
    async def test_transcription_completes_quickly(self, mock_session_store, valid_audio_file):
        """Test that transcription doesn't hang."""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Quick transcript"
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_transcription("session-id", str(valid_audio_file))
        assert result == "Quick transcript"


class TestAnalysisStage:
    """Test Stage 4: AI Analysis."""

    @pytest.mark.asyncio
    async def test_analysis_stage_calls_gemini(self, mock_session_store):
        """Test that analysis stage calls Gemini Flash."""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        analysis_json = {
            "qualityScore": 0.85,
            "safetyPassed": True,
            "insights": ["Good quality"],
            "concerns": [],
            "recommendations": []
        }
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = f"```json\n{json.dumps(analysis_json)}\n```"
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_analysis(
            "session-id",
            "Test transcript",
            {"title": "Test", "description": "Test dataset"},
            {"duration": 10, "sample_rate": 16000}
        )
        
        assert result["qualityScore"] == 0.85
        assert result["safetyPassed"] is True
        assert mock_client.chat.completions.create.called

    @pytest.mark.asyncio
    async def test_analysis_parses_markdown_json(self, mock_session_store):
        """Test that JSON in markdown code blocks is parsed correctly."""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        analysis_json = {
            "qualityScore": 0.75,
            "safetyPassed": True,
            "insights": ["Test insight"],
            "concerns": [],
            "recommendations": []
        }
        # Response with markdown code block
        response = f"""Here's my analysis:

```json
{json.dumps(analysis_json)}
```

Hope this helps!"""
        
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = response
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_analysis(
            "session-id",
            "Test transcript",
            {"title": "Test"},
            {}
        )
        
        assert result["qualityScore"] == 0.75

    @pytest.mark.asyncio
    async def test_analysis_returns_safe_defaults_on_parsing_error(self, mock_session_store):
        """Test that safe defaults are returned if response parsing fails."""
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Invalid JSON response"
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_analysis(
            "session-id",
            "Test transcript",
            {"title": "Test"},
            {}
        )
        
        # Should return safe defaults
        assert "qualityScore" in result
        assert result["qualityScore"] == 0.5
        assert result["safetyPassed"] is True

    @pytest.mark.asyncio
    async def test_analysis_handles_api_error(self, mock_session_store):
        """Test that API errors are handled gracefully."""
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = Exception("API Error")
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.openai_client = mock_client
        
        result = await pipeline._stage_analysis(
            "session-id",
            "Test transcript",
            {"title": "Test"},
            {}
        )
        
        # Should return safe defaults
        assert result["qualityScore"] == 0.5
        assert result["safetyPassed"] is True


class TestApprovalCalculation:
    """Test approval calculation logic."""

    def test_approval_requires_all_checks_passing(self, mock_session_store):
        """Test that approval requires quality, no copyright, and safety."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        # All checks passing
        approved = pipeline._calculate_approval(
            {"quality": {"passed": True}},
            {"copyright": {"detected": False}},
            {"safetyPassed": True}
        )
        assert approved is True

    def test_approval_fails_if_quality_failed(self, mock_session_store):
        """Test that approval fails if quality check failed."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        approved = pipeline._calculate_approval(
            {"quality": {"passed": False}},
            {"copyright": {"detected": False}},
            {"safetyPassed": True}
        )
        assert approved is False

    def test_approval_fails_if_high_confidence_copyright(self, mock_session_store):
        """Test that approval fails if high-confidence copyright match."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        approved = pipeline._calculate_approval(
            {"quality": {"passed": True}},
            {"copyright": {"detected": True, "confidence": 0.95}},
            {"safetyPassed": True}
        )
        assert approved is False

    def test_approval_fails_if_safety_failed(self, mock_session_store):
        """Test that approval fails if safety check failed."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        approved = pipeline._calculate_approval(
            {"quality": {"passed": True}},
            {"copyright": {"detected": False}},
            {"safetyPassed": False}
        )
        assert approved is False

    def test_approval_ignores_low_confidence_copyright(self, mock_session_store):
        """Test that low-confidence copyright match doesn't block approval."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        approved = pipeline._calculate_approval(
            {"quality": {"passed": True}},
            {"copyright": {"detected": True, "confidence": 0.65}},
            {"safetyPassed": True}
        )
        # Low confidence copyright shouldn't block
        assert approved is True


class TestBuildAnalysisPrompt:
    """Test analysis prompt building."""

    def test_prompt_includes_metadata(self, mock_session_store):
        """Test that analysis prompt includes dataset metadata."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        prompt = pipeline._build_analysis_prompt(
            "Test transcript",
            {"title": "Test Dataset", "description": "A test dataset"},
            {"duration": 10}
        )
        
        assert "Test Dataset" in prompt
        assert "A test dataset" in prompt

    def test_prompt_truncates_long_transcript(self, mock_session_store):
        """Test that long transcripts are truncated in prompt."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        long_transcript = "word " * 1000  # Very long transcript
        prompt = pipeline._build_analysis_prompt(
            long_transcript,
            {"title": "Test"},
            {}
        )
        
        # Should contain ellipsis indicating truncation
        assert "..." in prompt
        # Prompt should not be unnecessarily large
        assert len(prompt) < len(long_transcript)

    def test_prompt_includes_json_format_instructions(self, mock_session_store):
        """Test that prompt includes JSON format instructions."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        prompt = pipeline._build_analysis_prompt(
            "Test",
            {"title": "Test"},
            {}
        )
        
        assert "qualityScore" in prompt
        assert "safetyPassed" in prompt
        assert "json" in prompt.lower()


class TestParseAnalysisResponse:
    """Test analysis response parsing."""

    def test_parses_plain_json(self, mock_session_store):
        """Test parsing plain JSON response."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        response = json.dumps({
            "qualityScore": 0.85,
            "safetyPassed": True,
            "insights": ["Good quality"],
            "concerns": [],
            "recommendations": []
        })
        
        result = pipeline._parse_analysis_response(response)
        
        assert result["qualityScore"] == 0.85
        assert result["safetyPassed"] is True

    def test_parses_markdown_code_block(self, mock_session_store):
        """Test parsing JSON in markdown code blocks."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        response = f"""```json
{json.dumps({
            "qualityScore": 0.9,
            "safetyPassed": True,
            "insights": ["Test"],
            "concerns": [],
            "recommendations": []
        })}
```"""
        
        result = pipeline._parse_analysis_response(response)
        assert result["qualityScore"] == 0.9

    def test_clamps_quality_score_to_0_1(self, mock_session_store):
        """Test that quality score is clamped to 0-1 range."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        response = json.dumps({
            "qualityScore": 1.5,  # Above max
            "safetyPassed": True,
            "insights": [],
            "concerns": [],
            "recommendations": []
        })
        
        result = pipeline._parse_analysis_response(response)
        assert result["qualityScore"] == 1.0
        
        response = json.dumps({
            "qualityScore": -0.5,  # Below min
            "safetyPassed": True,
            "insights": [],
            "concerns": [],
            "recommendations": []
        })
        
        result = pipeline._parse_analysis_response(response)
        assert result["qualityScore"] == 0.0

    def test_returns_safe_defaults_on_invalid_json(self, mock_session_store):
        """Test that invalid JSON returns safe defaults."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        result = pipeline._parse_analysis_response("Not valid JSON at all")
        
        assert result["qualityScore"] == 0.5
        assert result["safetyPassed"] is True
        assert "insights" in result


class TestTempFileHandling:
    """Test temporary file context manager."""

    @pytest.mark.asyncio
    async def test_temp_file_created_and_cleaned_up(self, mock_session_store):
        """Test that temp files are created and cleaned up."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        test_data = b"test audio data"
        
        async with pipeline._temp_audio_file(test_data, ".wav") as temp_path:
            # File should exist
            assert os.path.exists(temp_path)
            # File should contain our data
            with open(temp_path, "rb") as f:
                assert f.read() == test_data
        
        # File should be cleaned up after context
        assert not os.path.exists(temp_path)

    @pytest.mark.asyncio
    async def test_temp_file_cleaned_up_on_exception(self, mock_session_store):
        """Test that temp files are cleaned up even on exception."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        temp_path = None
        try:
            async with pipeline._temp_audio_file(b"data", ".wav") as path:
                temp_path = path
                raise ValueError("Test exception")
        except ValueError:
            pass
        
        # File should be cleaned up despite exception
        assert temp_path is not None
        assert not os.path.exists(temp_path)


class TestUpdateStage:
    """Test stage update helper."""

    @pytest.mark.asyncio
    async def test_update_stage_calls_session_store(self, mock_session_store):
        """Test that _update_stage calls session store."""
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        await pipeline._update_stage("session-id", "quality", 0.3)
        
        mock_session_store.update_stage.assert_called_with("session-id", "quality", 0.3)

    @pytest.mark.asyncio
    async def test_update_stage_raises_on_failure(self, mock_session_store):
        """Test that _update_stage raises if session store update fails."""
        mock_session_store.update_stage = AsyncMock(return_value=False)
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        
        with pytest.raises(RuntimeError):
            await pipeline._update_stage("session-id", "quality", 0.3)


class TestTimeoutScenarios:
    """Test timeout and performance scenarios."""

    @pytest.mark.asyncio
    @pytest.mark.timeout(30)
    async def test_full_pipeline_timeout_bounded(self, mock_session_store, valid_audio_file):
        """Test that full pipeline doesn't exceed reasonable timeout."""
        # Mock all external services
        mock_session_store.update_stage = AsyncMock(return_value=True)
        mock_session_store.mark_failed = AsyncMock(return_value=True)
        mock_session_store.mark_completed = AsyncMock(return_value=True)
        
        mock_quality_checker = AsyncMock()
        mock_quality_checker.check_audio_file = AsyncMock(return_value={
            "quality": {"passed": True, "duration": 10, "sample_rate": 16000}
        })
        
        mock_copyright = AsyncMock()
        mock_copyright.check_copyright_from_path = AsyncMock(return_value={
            "copyright": {"detected": False}
        })
        
        mock_client = MagicMock()
        mock_completion = MagicMock()
        mock_completion.choices = [MagicMock()]
        mock_completion.choices[0].message.content = "Test transcript"
        mock_client.chat.completions.create.return_value = mock_completion
        
        pipeline = VerificationPipeline(
            session_store=mock_session_store,
            openrouter_api_key="test-key"
        )
        pipeline.quality_checker = mock_quality_checker
        pipeline.copyright_detector = mock_copyright
        pipeline.openai_client = mock_client
        
        # Run should complete within timeout
        await pipeline.run("session-id", str(valid_audio_file), {"title": "Test"})
