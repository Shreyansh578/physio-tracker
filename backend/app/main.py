"""FastAPI backend application entrypoint for physiotherapy tracker."""

from contextlib import asynccontextmanager
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.auth import (
    create_access_token,
    decode_access_token,
    get_current_user_optional,
    get_current_user_required,
    parse_google_credential,
)
from app.database import get_session, get_sessions, get_user_by_id, init_db, upsert_user
from app.pose_detector import PoseDetector
from app.ws_handler import VideoWebSocketHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("physio-tracker")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Lifespan context manager for database initialization and model preparation."""
    logger.info("Initializing database...")
    await init_db()

    # Attempt to download/verify the pose detection model file if network is reachable
    try:
        PoseDetector.download_model()
    except Exception as exc:
        logger.warning(
            f"Pose landmarker model download check skipped or failed on startup: {exc}"
        )

    logger.info("PhysioTracker backend successfully started.")
    yield
    logger.info("PhysioTracker backend shutting down.")


app = FastAPI(
    title="PhysioTracker API",
    description="Real-time physiotherapy exercise recognition, form feedback, and Google OAuth / JWT authentication backend.",
    version="1.1.0",
    lifespan=lifespan,
)

# CORS configuration
origins: List[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = None
    demo: Optional[bool] = False
    demo_email: Optional[str] = None
    demo_name: Optional[str] = None


@app.get("/", summary="Health Check")
async def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.post("/api/auth/google", summary="Google OAuth 2.0 / JWT Login")
async def auth_google(req: GoogleAuthRequest) -> Dict[str, Any]:
    """Exchange a Google OAuth credential token or trigger quick demo Google login.

    Issues a signed JWT access token and returns user profile.
    """
    if req.credential:
        profile = parse_google_credential(req.credential)
    elif req.demo or req.demo_email:
        # Pre-configured demo login for instant teacher/examiner presentation testing
        email = req.demo_email or "student.physio@gmail.com"
        name = req.demo_name or "Alex Mercer (Physio Patient)"
        sub = str(abs(hash(email)))[:12]
        profile = {
            "id": f"google_{sub}",
            "email": email,
            "name": name,
            "picture": f"https://api.dicebear.com/7.x/avataaars/svg?seed={sub}",
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Google OAuth credential token or demo parameters",
        )

    user = await upsert_user(
        user_id=profile["id"],
        email=profile["email"],
        name=profile["name"],
        picture=profile.get("picture"),
    )

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture", ""),
    })

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@app.get("/api/auth/me", summary="Current Authenticated User Profile")
async def current_user_profile(
    user_claims: Dict[str, Any] = Depends(get_current_user_required),
) -> Dict[str, Any]:
    """Return the profile of the currently logged-in user from Bearer JWT token."""
    user = await get_user_by_id(user_claims["sub"])
    if not user:
        return user_claims
    return user


@app.get("/api/sessions", summary="List Sessions")
async def list_sessions(
    user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
) -> List[Dict[str, Any]]:
    """Retrieve exercise sessions. Filters by user if authenticated."""
    user_id = user.get("sub") if user else None
    return await get_sessions(user_id=user_id)


@app.get("/api/sessions/{session_id}", summary="Get Session by ID")
async def retrieve_session(session_id: int) -> Dict[str, Any]:
    """Retrieve details of a single session."""
    session = await get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session with ID {session_id} not found")
    return session


@app.websocket("/ws/video")
async def video_stream_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for streaming video frames and receiving real-time posture feedback."""
    handler = VideoWebSocketHandler()
    try:
        await handler.handle_connection(websocket)
    except WebSocketDisconnect:
        logger.info("Client disconnected from /ws/video")
    except Exception as exc:
        logger.error(f"Error in websocket connection: {exc}")
