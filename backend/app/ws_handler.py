"""WebSocket connection handler for real-time video stream pose analysis."""

import base64
import json
import logging
import time
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import WebSocket, WebSocketDisconnect

from app.database import create_session, update_session
from app.exercises import Exercise, get_exercise
from app.pose_detector import PoseDetector

logger = logging.getLogger(__name__)


class VideoWebSocketHandler:
    """Manages real-time video streaming, pose tracking, and workout session state per connection."""

    def __init__(self, pose_detector: Optional[PoseDetector] = None) -> None:
        """Initialize connection handler.

        Args:
            pose_detector: Shared or per-connection PoseDetector instance.
        """
        self.pose_detector: PoseDetector = pose_detector or PoseDetector()
        self.exercise: Optional[Exercise] = None
        self.session_id: Optional[int] = None
        self.last_timestamp_ms: int = 0
        self.form_scores: List[float] = []
        self.feedback_history: List[str] = []

    async def _finalize_session(self) -> None:
        """Commit final session statistics and feedback log to the database."""
        if self.session_id is not None and self.exercise is not None:
            avg_score = (
                round(sum(self.form_scores) / len(self.form_scores), 2)
                if self.form_scores
                else 0.0
            )
            try:
                await update_session(
                    session_id=self.session_id,
                    total_reps=self.exercise.rep_count,
                    avg_form_score=avg_score,
                    feedback_log=self.feedback_history,
                )
                logger.info(
                    f"Session {self.session_id} finalized: {self.exercise.name}, "
                    f"total reps: {self.exercise.rep_count}, avg form: {avg_score}"
                )
            except Exception as exc:
                logger.error(f"Failed to finalize session {self.session_id}: {exc}")

    async def _switch_exercise(self, exercise_name: str) -> None:
        """Handle exercise change during or at start of a session.

        Args:
            exercise_name: Target exercise identifier.
        """
        if self.exercise is not None and self.exercise.name == exercise_name:
            return

        # Finalize existing session before switching
        if self.session_id is not None:
            await self._finalize_session()

        self.exercise = get_exercise(exercise_name)
        self.form_scores.clear()
        self.feedback_history.clear()
        self.session_id = await create_session(self.exercise.name)
        logger.info(f"Started new session {self.session_id} for exercise '{self.exercise.name}'")

    async def handle_connection(self, websocket: WebSocket) -> None:
        """Main WebSocket loop receiving video frames, running inference, and sending feedback.

        Args:
            websocket: FastAPI WebSocket instance.
        """
        await websocket.accept()
        logger.info("WebSocket connection established.")

        try:
            while True:
                # 1. Receive JSON message
                message_text = await websocket.receive_text()
                try:
                    payload: Dict[str, Any] = json.loads(message_text)
                except Exception as err:
                    logger.warning(f"Malformed JSON payload: {err}")
                    await websocket.send_json({"error": "Invalid JSON format"})
                    continue

                frame_data: str = payload.get("frame", "")
                exercise_name: str = payload.get("exercise", "bicep_curl")

                # Handle exercise switching or initial exercise setup
                if self.exercise is None or self.exercise.name != exercise_name:
                    try:
                        await self._switch_exercise(exercise_name)
                    except ValueError as ve:
                        await websocket.send_json({
                            "error": str(ve),
                            "rep_count": self.exercise.rep_count if self.exercise else 0,
                            "state": "ERROR",
                            "feedback": [str(ve)],
                            "form_score": 0.0,
                            "frame": "",
                        })
                        continue

                # 2. Decode base64 frame (strip data URI prefix if present)
                if not frame_data:
                    continue

                if "," in frame_data:
                    frame_data = frame_data.split(",", 1)[1]

                try:
                    image_bytes = base64.b64decode(frame_data)
                    np_arr = np.frombuffer(image_bytes, np.uint8)
                    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                except Exception as dec_err:
                    logger.warning(f"Failed to decode image frame: {dec_err}")
                    continue

                if frame is None:
                    continue

                # 3. Monotonic timestamp in milliseconds for MediaPipe VIDEO mode
                current_time_ms = int(time.time() * 1000)
                if current_time_ms <= self.last_timestamp_ms:
                    current_time_ms = self.last_timestamp_ms + 33
                self.last_timestamp_ms = current_time_ms

                # Run pose detection
                detection_result = self.pose_detector.detect(frame, self.last_timestamp_ms)

                # 4. If landmarks found, run exercise logic
                has_landmarks = (
                    detection_result is not None
                    and getattr(detection_result, "pose_landmarks", None)
                    and len(detection_result.pose_landmarks) > 0
                )

                if has_landmarks:
                    landmarks = detection_result.pose_landmarks[0]
                    assert self.exercise is not None
                    result = self.exercise.process(landmarks)
                    rep_count = result["rep_count"]
                    state = result["state"]
                    feedback = result["feedback"]
                    form_score = result["form_score"]

                    self.form_scores.append(form_score)
                    for item in feedback:
                        if item not in self.feedback_history:
                            self.feedback_history.append(item)
                else:
                    rep_count = self.exercise.rep_count if self.exercise else 0
                    state = self.exercise.state if self.exercise else "NO_POSE"
                    feedback = ["No person detected"]
                    form_score = 0.0

                # 5. Draw landmarks on frame
                annotated_frame = self.pose_detector.draw_landmarks(frame, detection_result)

                # 6. Encode annotated frame back to base64 JPEG (quality 80)
                encode_params = [int(cv2.IMWRITE_JPEG_QUALITY), 80]
                success, buffer = cv2.imencode(".jpg", annotated_frame, encode_params)
                encoded_frame_b64 = (
                    base64.b64encode(buffer).decode("utf-8") if success else ""
                )

                # 7. Send JSON response
                await websocket.send_json({
                    "rep_count": rep_count,
                    "state": state,
                    "feedback": feedback,
                    "form_score": form_score,
                    "frame": encoded_frame_b64,
                })

        except WebSocketDisconnect:
            logger.info("WebSocket disconnected by client.")
        except Exception as exc:
            logger.error(f"Unexpected error in WebSocket loop: {exc}")
        finally:
            # 8. On disconnect, finalize the session in database
            await self._finalize_session()
