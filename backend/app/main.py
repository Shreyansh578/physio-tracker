"""FastAPI backend application entrypoint for physiotherapy tracker."""

from contextlib import asynccontextmanager
import logging
from typing import Any, AsyncGenerator, Dict, List

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.database import get_session, get_sessions, init_db
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
    description="Real-time physiotherapy exercise recognition and form feedback backend.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
origins: List[str] = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", summary="Health Check")
async def health_check() -> Dict[str, str]:
    """Health check endpoint.

    Returns:
        dict: {"status": "ok"}
    """
    return {"status": "ok"}


@app.get("/api/sessions", summary="List All Sessions")
async def list_sessions() -> List[Dict[str, Any]]:
    """Retrieve all exercise sessions ordered by start time descending.

    Returns:
        list[dict]: Array of past exercise sessions.
    """
    return await get_sessions()


@app.get("/api/sessions/{session_id}", summary="Get Session by ID")
async def retrieve_session(session_id: int) -> Dict[str, Any]:
    """Retrieve details of a single session.

    Args:
        session_id: Database ID of the session.

    Returns:
        dict: The session details.

    Raises:
        HTTPException: 404 if the session ID does not exist.
    """
    session = await get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session with ID {session_id} not found")
    return session


@app.websocket("/ws/video")
async def video_stream_endpoint(websocket: WebSocket) -> None:
    """WebSocket endpoint for streaming video frames and receiving real-time posture feedback.

    Accepts JSON messages:
        { "frame": "<base64_data>", "exercise": "bicep_curl" | "squat" }

    Returns JSON messages:
        { "rep_count": int, "state": str, "feedback": list[str], "form_score": float, "frame": "<base64_annotated>" }
    """
    handler = VideoWebSocketHandler()
    try:
        await handler.handle_connection(websocket)
    except WebSocketDisconnect:
        logger.info("Client disconnected from /ws/video")
    except Exception as exc:
        logger.error(f"Error in websocket connection: {exc}")
