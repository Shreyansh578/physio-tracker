"""Authentication and JWT utilities for PhysioTrack with Google OAuth 2.0 support."""

from datetime import datetime, timedelta, timezone
import logging
import os
from typing import Any, Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

logger = logging.getLogger(__name__)

# JWT configuration
SECRET_KEY = os.getenv("JWT_SECRET", "physiotrack-jwt-secret-key-rehab-2026-auth-token-salt")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 14

security = HTTPBearer(auto_error=False)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token.

    Args:
        data: Claims to encode (e.g. sub, email, name, picture).
        expires_delta: Token validity duration.

    Returns:
        str: Encoded JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a signed JWT access token.

    Args:
        token: JWT string.

    Returns:
        Optional[dict]: Decoded payload if valid, None if expired or invalid.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError as err:
        logger.warning(f"Invalid access token: {err}")
        return None


def parse_google_credential(credential: str) -> Dict[str, Any]:
    """Parse a Google Identity Services JWT credential token.

    Extracts user profile attributes (sub, email, name, picture).

    Args:
        credential: Raw Google ID token JWT string.

    Returns:
        dict: Standardized user profile dictionary.
    """
    try:
        # Decode Google ID token payload without requiring local certificate fetching
        payload = jwt.decode(credential, options={"verify_signature": False})
        user_id = payload.get("sub") or payload.get("id") or str(payload.get("email"))
        email = payload.get("email", "")
        name = payload.get("name") or payload.get("given_name") or email.split("@")[0]
        picture = payload.get("picture", "")

        if not email:
            raise ValueError("Google token payload does not contain an email address")

        return {
            "id": f"google_{user_id}",
            "email": email,
            "name": name,
            "picture": picture,
        }
    except Exception as exc:
        logger.error(f"Failed to parse Google credential token: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Google credential token: {exc}",
        )


async def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[Dict[str, Any]]:
    """Optional dependency that returns the authenticated user payload if a valid Bearer token is sent."""
    if not auth or not auth.credentials:
        return None
    return decode_access_token(auth.credentials)


async def get_current_user_required(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Dict[str, Any]:
    """Mandatory dependency that enforces valid JWT Bearer authentication."""
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = decode_access_token(auth.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session has expired or token is invalid. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
