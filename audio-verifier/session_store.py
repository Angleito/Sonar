"""
Vercel KV Session Store for Verification Sessions.

Stores verification session data in Vercel KV (Redis-compatible).
Replaces on-chain session tracking with simple key-value storage.
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

# Vercel KV REST API configuration
KV_REST_API_URL = os.getenv("KV_REST_API_URL")
KV_REST_API_TOKEN = os.getenv("KV_REST_API_TOKEN")


class SessionStore:
    """
    Vercel KV-based session storage for verification sessions.
    
    Uses Vercel KV REST API to store and retrieve session data.
    """

    def __init__(self):
        """Initialize session store with Vercel KV credentials."""
        if not KV_REST_API_URL:
            raise RuntimeError("KV_REST_API_URL must be set for session storage")
        if not KV_REST_API_TOKEN:
            raise RuntimeError("KV_REST_API_TOKEN must be set for session storage")
        
        self.kv_url = KV_REST_API_URL.rstrip('/')
        self.kv_token = KV_REST_API_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.kv_token}",
            "Content-Type": "application/json"
        }
        logger.info("Initialized Vercel KV session store")

    def _get_key(self, session_id: str) -> str:
        """Get KV key for session ID."""
        return f"session:{session_id}"

    async def create_session(
        self,
        verification_id: str,
        initial_data: Dict[str, Any]
    ) -> str:
        """
        Create a new verification session in KV.
        
        Args:
            verification_id: Unique verification identifier
            initial_data: Initial session data containing:
                - plaintext_cid or encrypted_cid: Walrus blob ID
                - plaintext_size_bytes: Size in bytes
                - duration_seconds: Audio duration
                - file_format: Audio format (e.g., "audio/wav")
        
        Returns:
            Session ID (UUID)
        """
        import uuid
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        session_data = {
            "id": session_id,
            "verification_id": verification_id,
            "status": "processing",
            "stage": "queued",
            "progress": 0.0,
            "created_at": now,
            "updated_at": now,
            "initial_data": initial_data,
            "results": None,
            "error": None
        }
        
        try:
            # Store session in Vercel KV using REST API (Upstash format)
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Upstash REST API format: POST /set with {"key": "...", "value": "..."}
                response = await client.post(
                    f"{self.kv_url}/set",
                    json={
                        "key": self._get_key(session_id),
                        "value": json.dumps(session_data)
                    },
                    headers=self.headers
                )
                response.raise_for_status()
            
            logger.info(f"Created session {session_id[:8]}... in Vercel KV")
            return session_id
            
        except Exception as e:
            logger.error(f"Failed to create session in KV: {e}", exc_info=True)
            raise RuntimeError(f"Failed to create session: {str(e)}")

    async def update_session(
        self,
        session_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """
        Update verification session data in KV.
        
        Args:
            session_id: Session ID
            updates: Dictionary with updates:
                - stage: Stage name (str) or stage number (int)
                - progress: Progress percentage (0.0-1.0)
                - status: Optional status update
                - results: Optional results data
                - error: Optional error message
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Fetch current session
            session = await self.get_session(session_id)
            if not session:
                logger.warning(f"Session {session_id[:8]}... not found for update")
                return False
            
            # Apply updates
            if "stage" in updates:
                session["stage"] = updates["stage"]
            if "progress" in updates:
                session["progress"] = float(updates["progress"])
            if "status" in updates:
                session["status"] = updates["status"]
            if "results" in updates:
                session["results"] = updates["results"]
            if "error" in updates:
                session["error"] = updates["error"]
            
            session["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            # Update in KV (Upstash REST API format)
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.kv_url}/set",
                    json={
                        "key": self._get_key(session_id),
                        "value": json.dumps(session)
                    },
                    headers=self.headers
                )
                response.raise_for_status()
            
            logger.debug(f"Updated session {session_id[:8]}... stage={session.get('stage')} progress={session.get('progress')}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to update session in KV: {e}", exc_info=True)
            return False

    async def mark_completed(
        self,
        session_id: str,
        result_data: Dict[str, Any]
    ) -> bool:
        """
        Mark verification as completed in KV.
        
        Args:
            session_id: Session ID
            result_data: Final verification results containing:
                - approved: bool
                - quality: dict with score
                - copyright: dict
                - transcript: string
                - transcriptPreview: string
                - analysis: dict
                - safetyPassed: bool
        
        Returns:
            True if successful, False otherwise
        """
        try:
            updates = {
                "status": "completed",
                "stage": "completed",
                "progress": 1.0,
                "results": result_data
            }
            return await self.update_session(session_id, updates)
            
        except Exception as e:
            logger.error(f"Failed to mark session completed: {e}", exc_info=True)
            return False

    async def mark_failed(
        self,
        session_id: str,
        error_data: Dict[str, Any]
    ) -> bool:
        """
        Mark verification as failed in KV.
        
        Args:
            session_id: Session ID
            error_data: Error information containing:
                - errors: List of error messages
                - stage_failed: Stage where failure occurred
                - cancelled: Optional bool if cancelled
        
        Returns:
            True if successful, False otherwise
        """
        try:
            status = "cancelled" if error_data.get("cancelled") else "failed"
            updates = {
                "status": status,
                "stage": "failed",
                "progress": 0.0,
                "error": error_data.get("errors", [error_data.get("stage_failed", "unknown")])
            }
            return await self.update_session(session_id, updates)
            
        except Exception as e:
            logger.error(f"Failed to mark session failed: {e}", exc_info=True)
            return False

    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get verification session from KV.
        
        Args:
            session_id: Session ID
        
        Returns:
            Session data if found, None otherwise
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Upstash REST API format: GET /get/{key}
                response = await client.get(
                    f"{self.kv_url}/get/{self._get_key(session_id)}",
                    headers=self.headers
                )
                
                if response.status_code == 404:
                    logger.warning(f"Session {session_id[:8]}... not found in KV")
                    return None
                
                response.raise_for_status()
                result = response.json()
                
                # Upstash returns {"result": "value"} format, where value is a JSON string
                if "result" in result:
                    session_data = json.loads(result["result"])
                else:
                    # Fallback: try parsing directly
                    session_data = result if isinstance(result, dict) else json.loads(result)
                
                logger.debug(f"Retrieved session {session_id[:8]}... from KV")
                return session_data
                
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            logger.error(f"Failed to get session from KV: {e}", exc_info=True)
            return None
        except Exception as e:
            logger.error(f"Error retrieving session: {e}", exc_info=True)
            return None

    async def update_stage(
        self,
        session_id: str,
        stage_name: str,
        progress: float
    ) -> bool:
        """
        Update verification stage and progress.
        
        Convenience method that wraps update_session.
        
        Args:
            session_id: Session ID
            stage_name: Stage name (e.g., "quality", "copyright", "transcription")
            progress: Progress percentage (0.0-1.0)
        
        Returns:
            True if successful, False otherwise
        """
        return await self.update_session(session_id, {
            "stage": stage_name,
            "progress": progress
        })

