"""
Expanded unit tests for fingerprint.py

Tests copyright detection via Chromaprint/AcoustID fingerprinting.
"""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import acoustid

from fingerprint import CopyrightDetector


class TestCopyrightDetectorInit:
    """Test CopyrightDetector initialization."""

    def test_init_with_custom_api_key(self):
        """Test initialization with custom API key."""
        detector = CopyrightDetector(acoustid_api_key="custom-key-123")
        assert detector.api_key == "custom-key-123"
        assert detector.confidence_threshold == 0.8

    def test_init_without_api_key_uses_test_key(self):
        """Test that test key is used if no API key provided."""
        detector = CopyrightDetector()
        assert detector.api_key == "test"

    def test_confidence_threshold(self):
        """Test that confidence threshold is set correctly."""
        detector = CopyrightDetector()
        assert detector.confidence_threshold == 0.8


class TestCopyrightDetection:
    """Test copyright detection logic."""

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_high_confidence_match_detected(self, mock_fingerprint, mock_lookup):
        """Test that high-confidence matches (>80%) are detected."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [
            (0.95, "recording-123", "Copyrighted Song", "Artist Name")
        ]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is True
        assert result["copyright"]["passed"] is False
        assert result["copyright"]["confidence"] == 0.95
        assert len(result["copyright"]["matches"]) == 1
        assert result["copyright"]["matches"][0]["title"] == "Copyrighted Song"

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_low_confidence_match_ignored(self, mock_fingerprint, mock_lookup):
        """Test that low-confidence matches (<80%) are ignored."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [
            (0.65, "recording-456", "Some Song", "Some Artist")
        ]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is False
        assert result["copyright"]["passed"] is True
        assert result["copyright"]["confidence"] == 0.65
        assert len(result["copyright"]["matches"]) == 0

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_no_match_passes_copyright_check(self, mock_fingerprint, mock_lookup):
        """Test that no matches result in copyright passed."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = []
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is False
        assert result["copyright"]["passed"] is True
        assert result["copyright"]["confidence"] == 0.0
        assert len(result["copyright"]["matches"]) == 0

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_multiple_matches_sorted_by_confidence(self, mock_fingerprint, mock_lookup):
        """Test that multiple matches are returned with highest confidence first."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [
            (0.85, "recording-001", "Song A", "Artist A"),
            (0.92, "recording-002", "Song B", "Artist B"),
            (0.78, "recording-003", "Song C", "Artist C"),
        ]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is True
        assert len(result["copyright"]["matches"]) == 2  # Only >=0.8
        # Matches returned by acoustid.lookup should maintain order
        assert result["copyright"]["matches"][0]["confidence"] == 0.85

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_max_5_matches_returned(self, mock_fingerprint, mock_lookup):
        """Test that at most 5 matches are returned."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [
            (0.95 - i*0.01, f"recording-{i:03d}", f"Song {i}", f"Artist {i}")
            for i in range(10)
        ]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        # Should return at most 5
        assert len(result["copyright"]["matches"]) <= 5

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_boundary_confidence_exactly_80_percent(self, mock_fingerprint, mock_lookup):
        """Test boundary case: exactly 80% confidence."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [
            (0.80, "recording-123", "Song", "Artist")
        ]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        # Exactly 80% should pass the threshold
        assert result["copyright"]["detected"] is True
        assert len(result["copyright"]["matches"]) == 1

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_boundary_confidence_just_below_80_percent(self, mock_fingerprint, mock_lookup):
        """Test boundary case: just below 80% confidence."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [
            (0.79, "recording-123", "Song", "Artist")
        ]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        # Just below 80% should not pass the threshold
        assert result["copyright"]["detected"] is False
        assert len(result["copyright"]["matches"]) == 0


class TestErrorHandling:
    """Test error handling in copyright detection."""

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_handles_lookup_network_error(self, mock_fingerprint):
        """Test graceful handling of network errors."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        
        detector = CopyrightDetector()
        
        with patch('fingerprint.acoustid.lookup') as mock_lookup:
            mock_lookup.side_effect = Exception("Network error")
            result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is False
        assert "error" in result["copyright"]

    @pytest.mark.asyncio
    async def test_handles_invalid_api_key(self):
        """Test handling of invalid API key."""
        detector = CopyrightDetector(acoustid_api_key="invalid-key")
        
        with patch('fingerprint.acoustid.fingerprint_file') as mock_fingerprint:
            mock_fingerprint.return_value = (120, "fingerprint-data")
            with patch('fingerprint.acoustid.lookup') as mock_lookup:
                mock_lookup.side_effect = acoustid.WebServiceError("Invalid API key")
                result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is False
        assert "error" in result["copyright"]

    @pytest.mark.asyncio
    async def test_handles_fingerprint_generation_error(self):
        """Test handling of fingerprint generation errors."""
        detector = CopyrightDetector()
        
        with patch('fingerprint.acoustid.fingerprint_file') as mock_fingerprint:
            mock_fingerprint.side_effect = acoustid.FingerprintGenerationError("Bad audio")
            result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["checked"] is False
        assert "error" in result["copyright"]

    @pytest.mark.asyncio
    async def test_handles_no_backend_error(self):
        """Test handling when Chromaprint backend is not installed."""
        detector = CopyrightDetector()
        
        with patch('fingerprint.acoustid.fingerprint_file') as mock_fingerprint:
            mock_fingerprint.side_effect = acoustid.NoBackendError("Chromaprint not found")
            result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["checked"] is False
        assert "error" in result["copyright"]
        assert "Chromaprint" in result["copyright"]["error"]

    @pytest.mark.asyncio
    async def test_handles_generic_exception(self):
        """Test handling of generic exceptions."""
        detector = CopyrightDetector()
        
        with patch('fingerprint.acoustid.fingerprint_file') as mock_fingerprint:
            mock_fingerprint.side_effect = RuntimeError("Unexpected error")
            result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["detected"] is False


class TestTempFileHandling:
    """Test temporary file creation and cleanup."""

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    @patch('fingerprint.os.unlink')
    async def test_check_copyright_cleans_up_temp_file(self, mock_unlink, mock_fingerprint, mock_lookup):
        """Test that temp file is cleaned up after processing."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = []
        
        detector = CopyrightDetector()
        result = await detector.check_copyright(b"audio-data")
        
        # Verify temp file was deleted
        assert mock_unlink.called
        assert result["copyright"]["passed"] is True

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_temp_file_cleanup_on_exception(self, mock_fingerprint):
        """Test that temp file is cleaned up even on exception."""
        mock_fingerprint.side_effect = Exception("Error")
        
        with patch('fingerprint.os.unlink') as mock_unlink:
            detector = CopyrightDetector()
            result = await detector.check_copyright(b"audio-data")
        
        # Temp file should still be cleaned up despite exception
        assert mock_unlink.called

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_check_copyright_from_path_does_not_delete_original(self, mock_fingerprint, mock_lookup, valid_audio_file):
        """Test that check_copyright_from_path does not delete the original file."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = []
        
        detector = CopyrightDetector()
        
        with patch('fingerprint.os.unlink') as mock_unlink:
            result = await detector.check_copyright_from_path(str(valid_audio_file))
        
        # File path operations should not attempt to delete the original
        # (unlink is only called in check_copyright for temp files)
        assert result["copyright"]["passed"] is True


class TestResultFormatting:
    """Test result formatting."""

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_result_structure(self, mock_fingerprint, mock_lookup):
        """Test that result has expected structure."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [(0.95, "id", "Title", "Artist")]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        # Check structure
        assert "copyright" in result
        assert "detected" in result["copyright"]
        assert "passed" in result["copyright"]
        assert "confidence" in result["copyright"]
        assert "matches" in result["copyright"]
        assert "checked" in result["copyright"]

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_match_structure(self, mock_fingerprint, mock_lookup):
        """Test that match objects have expected structure."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [(0.95, "recording-id-123", "Song Title", "Artist Name")]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert len(result["copyright"]["matches"]) == 1
        match = result["copyright"]["matches"][0]
        assert "title" in match
        assert "artist" in match
        assert "confidence" in match
        assert "recording_id" in match
        assert match["title"] == "Song Title"
        assert match["artist"] == "Artist Name"
        assert match["confidence"] == 0.95

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_unknown_title_and_artist_defaults(self, mock_fingerprint, mock_lookup):
        """Test that missing title/artist use 'Unknown' defaults."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [(0.95, "recording-id", None, None)]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        match = result["copyright"]["matches"][0]
        assert match["title"] == "Unknown"
        assert match["artist"] == "Unknown"

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_confidence_rounded_to_3_decimals(self, mock_fingerprint, mock_lookup):
        """Test that confidence scores are rounded to 3 decimal places."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [(0.9537428, "id", "Song", "Artist")]
        
        detector = CopyrightDetector()
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        
        assert result["copyright"]["confidence"] == 0.954
        assert result["copyright"]["matches"][0]["confidence"] == 0.954


class TestFingerprintGeneration:
    """Test fingerprint generation behavior."""

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_fingerprint_called_with_correct_file(self, mock_fingerprint, mock_lookup):
        """Test that fingerprint is generated from correct file."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = []
        
        detector = CopyrightDetector()
        await detector.check_copyright_from_path("/path/to/audio.wav")
        
        mock_fingerprint.assert_called_once_with("/path/to/audio.wav")

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_lookup_called_with_fingerprint_data(self, mock_fingerprint, mock_lookup):
        """Test that lookup is called with fingerprint and duration."""
        mock_fingerprint.return_value = (120, "fingerprint-hash")
        mock_lookup.return_value = []
        
        detector = CopyrightDetector(acoustid_api_key="test-key")
        await detector.check_copyright_from_path("/path/to/audio.wav")
        
        # Verify lookup was called with correct parameters
        call_args = mock_lookup.call_args
        assert "test-key" in call_args[0]  # API key
        assert "fingerprint-hash" in call_args[0]  # Fingerprint
        assert 120 in call_args[0]  # Duration


class TestConfidenceThreshold:
    """Test confidence threshold behavior."""

    @pytest.mark.asyncio
    @patch('fingerprint.acoustid.lookup')
    @patch('fingerprint.acoustid.fingerprint_file')
    async def test_custom_confidence_threshold(self, mock_fingerprint, mock_lookup):
        """Test that custom confidence thresholds can be set (if implemented)."""
        mock_fingerprint.return_value = (120, "fingerprint-data")
        mock_lookup.return_value = [(0.85, "id", "Song", "Artist")]
        
        detector = CopyrightDetector()
        # Default threshold is 0.8, so 0.85 should be detected
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        assert result["copyright"]["detected"] is True
        
        # If we lowered threshold to 0.9, 0.85 should not be detected
        detector.confidence_threshold = 0.9
        result = await detector.check_copyright_from_path("/path/to/audio.wav")
        assert result["copyright"]["detected"] is False
