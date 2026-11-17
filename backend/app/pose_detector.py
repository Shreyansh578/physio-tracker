"""MediaPipe Pose Landmarker wrapper using the Tasks Vision API for video-stream detection."""

import logging
from pathlib import Path
from typing import Any, List, Optional, Tuple, Union
import urllib.request

import cv2
import numpy as np

import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision.pose_landmarker import PoseLandmarkerResult

logger = logging.getLogger(__name__)

# Root directory of backend application
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Official MediaPipe Pose Landmarker model URL
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task"
)

# Standard MediaPipe 33-landmark skeleton connection pairs
POSE_CONNECTIONS: Tuple[Tuple[int, int], ...] = (
    # Head / Face
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10),
    # Torso
    (11, 12), (11, 23), (12, 24), (23, 24),
    # Left Arm
    (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    # Right Arm
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    # Left Leg
    (23, 25), (25, 27), (27, 29), (27, 31), (29, 31),
    # Right Leg
    (24, 26), (26, 28), (28, 30), (28, 32), (30, 32),
)


class PoseDetector:
    """Wrapper around MediaPipe Tasks API PoseLandmarker configured for video stream tracking."""

    def __init__(
        self,
        model_path: Union[str, Path] = "models/pose_landmarker_heavy.task",
        auto_download: bool = True,
    ) -> None:
        """Initialize the PoseDetector instance.

        Args:
            model_path: Relative or absolute path to the .task model file.
            auto_download: If True, attempts to download the model from Google if not found.
        """
        path = Path(model_path)
        if not path.is_absolute():
            self.model_path = BACKEND_DIR / path
        else:
            self.model_path = path

        if not self.model_path.exists() and auto_download:
            try:
                self.download_model(self.model_path)
            except Exception as exc:
                logger.warning(
                    f"Could not auto-download model to {self.model_path}: {exc}. "
                    "Inference will fail until the model file is supplied."
                )

        self._last_timestamp_ms: int = 0
        self.landmarker: Optional[vision.PoseLandmarker] = None

        if self.model_path.exists():
            self._init_landmarker()

    @staticmethod
    def download_model(target_path: Optional[Union[str, Path]] = None) -> Path:
        """Download the Pose Landmarker heavy model from Google's cloud storage.

        Args:
            target_path: Path to write the downloaded model. Defaults to backend/models/pose_landmarker_heavy.task.

        Returns:
            Path: Resolved path to the downloaded model.
        """
        if target_path is None:
            resolved_path = BACKEND_DIR / "models" / "pose_landmarker_heavy.task"
        else:
            resolved_path = Path(target_path)
            if not resolved_path.is_absolute():
                resolved_path = BACKEND_DIR / resolved_path

        if resolved_path.exists() and resolved_path.stat().st_size > 0:
            logger.info(f"PoseLandmarker model already present at {resolved_path}")
            return resolved_path

        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        logger.info(f"Downloading MediaPipe pose landmarker model to {resolved_path}...")
        urllib.request.urlretrieve(MODEL_URL, str(resolved_path))
        logger.info(f"Model successfully saved to {resolved_path}")
        return resolved_path

    def _init_landmarker(self) -> None:
        """Instantiate the MediaPipe PoseLandmarker Tasks object in VIDEO mode."""
        base_options = python.BaseOptions(model_asset_path=str(self.model_path))
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
            output_segmentation_masks=False,
        )
        self.landmarker = vision.PoseLandmarker.create_from_options(options)

    def detect(self, frame: np.ndarray, timestamp_ms: int) -> Optional[PoseLandmarkerResult]:
        """Detect pose landmarks on a single video frame.

        Args:
            frame: BGR image array from OpenCV (height, width, 3).
            timestamp_ms: Monotonically increasing frame timestamp in milliseconds.

        Returns:
            PoseLandmarkerResult or None: Detection result containing pose landmarks, or None on failure.
        """
        if self.landmarker is None:
            if self.model_path.exists():
                self._init_landmarker()
            else:
                logger.error(f"Cannot run detection: model file missing at {self.model_path}")
                return None

        # Enforce strictly monotonic timestamp required by RunningMode.VIDEO
        if timestamp_ms <= self._last_timestamp_ms:
            timestamp_ms = self._last_timestamp_ms + 1
        self._last_timestamp_ms = timestamp_ms

        # MediaPipe requires RGB color format
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)

        try:
            assert self.landmarker is not None
            return self.landmarker.detect_for_video(mp_image, timestamp_ms)
        except Exception as err:
            logger.error(f"Pose detection failed: {err}")
            return None

    def draw_landmarks(
        self,
        frame: np.ndarray,
        detection_result: Any,
        telemetry: Optional[Dict[str, Any]] = None,
    ) -> np.ndarray:
        """Render skeleton connections, joint highlights, and live telemetry on the image frame.

        - Active exercise kinematic chain is drawn in Emerald Green, Amber, or Red based on posture.
        - Form violation joints are marked with a prominent red alert ring.
        - The active joint angle (e.g. 58°) is drawn directly beside the joint.

        Args:
            frame: Input BGR image array.
            detection_result: PoseLandmarkerResult or container with pose_landmarks attribute.
            telemetry: Optional evaluation dictionary containing active_joints, error_joints,
                angle, form_status, and feedback.

        Returns:
            np.ndarray: Annotated BGR image frame.
        """
        if detection_result is None:
            return frame

        pose_landmarks_list = getattr(detection_result, "pose_landmarks", None)
        if not pose_landmarks_list:
            if isinstance(detection_result, list) and len(detection_result) > 0:
                if isinstance(detection_result[0], list):
                    pose_landmarks_list = detection_result
                else:
                    pose_landmarks_list = [detection_result]
            else:
                return frame

        annotated = frame.copy()
        height, width = frame.shape[:2]

        # Extract telemetry parameters
        active_joints = set()
        error_joints = set()
        active_angle: Optional[float] = None
        form_status = "good"

        if telemetry:
            active_joints = set(telemetry.get("active_joints", []))
            error_joints = set(telemetry.get("error_joints", []))
            form_status = telemetry.get("form_status", "good")
            if "angle" in telemetry and isinstance(telemetry["angle"], (int, float)):
                active_angle = float(telemetry["angle"])

        # Determine active chain color based on posture
        if form_status == "error":
            active_color = (40, 40, 240)  # Vivid Red
        elif form_status == "warning":
            active_color = (0, 165, 255)  # Amber
        else:
            active_color = (30, 220, 60)  # Emerald Green

        default_bone_color = (220, 200, 40)  # Soft cyan
        default_joint_color = (255, 60, 180)  # Magenta

        def _get_coords(lm: Any) -> Tuple[float, float]:
            if hasattr(lm, "x") and hasattr(lm, "y"):
                return float(lm.x), float(lm.y)
            if isinstance(lm, dict):
                return float(lm.get("x", 0.0)), float(lm.get("y", 0.0))
            if isinstance(lm, (list, tuple)) and len(lm) >= 2:
                return float(lm[0]), float(lm[1])
            return 0.0, 0.0

        for landmarks in pose_landmarks_list:
            # 1. Draw skeleton connection lines
            for start_idx, end_idx in POSE_CONNECTIONS:
                if start_idx < len(landmarks) and end_idx < len(landmarks):
                    lm1 = landmarks[start_idx]
                    lm2 = landmarks[end_idx]

                    vis1 = getattr(lm1, "visibility", 1.0)
                    vis2 = getattr(lm2, "visibility", 1.0)
                    if (vis1 is None or vis1 > 0.3) and (vis2 is None or vis2 > 0.3):
                        x1_n, y1_n = _get_coords(lm1)
                        x2_n, y2_n = _get_coords(lm2)
                        x1, y1 = int(x1_n * width), int(y1_n * height)
                        x2, y2 = int(x2_n * width), int(y2_n * height)

                        # Highlight active exercise chain
                        if start_idx in active_joints and end_idx in active_joints:
                            cv2.line(annotated, (x1, y1), (x2, y2), active_color, thickness=3, lineType=cv2.LINE_AA)
                        else:
                            cv2.line(annotated, (x1, y1), (x2, y2), default_bone_color, thickness=2, lineType=cv2.LINE_AA)

            # 2. Draw joint landmark circles
            for idx, lm in enumerate(landmarks):
                vis = getattr(lm, "visibility", 1.0)
                if vis is None or vis > 0.3:
                    x_n, y_n = _get_coords(lm)
                    x, y = int(x_n * width), int(y_n * height)

                    # Prominent red ring for joints violating posture
                    if idx in error_joints:
                        cv2.circle(annotated, (x, y), radius=9, color=(30, 30, 240), thickness=-1, lineType=cv2.LINE_AA)
                        cv2.circle(annotated, (x, y), radius=13, color=(255, 255, 255), thickness=2, lineType=cv2.LINE_AA)
                    elif idx in active_joints:
                        cv2.circle(annotated, (x, y), radius=6, color=active_color, thickness=-1, lineType=cv2.LINE_AA)
                        cv2.circle(annotated, (x, y), radius=8, color=(255, 255, 255), thickness=1, lineType=cv2.LINE_AA)
                    else:
                        cv2.circle(annotated, (x, y), radius=4, color=default_joint_color, thickness=-1, lineType=cv2.LINE_AA)

            # 3. Draw live angle pill on active vertex joint (e.g. elbow or knee)
            # Active vertex is typically elbow (13 or 14) or knee (25 or 26)
            if active_angle is not None and active_angle > 0.0:
                vertex_candidates = [14, 13, 26, 25]
                for v_idx in vertex_candidates:
                    if v_idx in active_joints and v_idx < len(landmarks):
                        vx_n, vy_n = _get_coords(landmarks[v_idx])
                        vx = int(vx_n * width)
                        vy = int(vy_n * height)

                        angle_str = f"{int(round(active_angle))} deg"
                        font = cv2.FONT_HERSHEY_SIMPLEX
                        scale = 0.45
                        thickness = 1
                        (tw, th), baseline = cv2.getTextSize(angle_str, font, scale, thickness)

                        # Place badge slightly to the right of joint
                        bx = min(width - tw - 12, vx + 12)
                        by = max(th + 10, vy - 10)

                        # Dark pill background with border
                        cv2.rectangle(annotated, (bx - 5, by - th - 5), (bx + tw + 5, by + 5), (15, 23, 42), -1)
                        cv2.rectangle(annotated, (bx - 5, by - th - 5), (bx + tw + 5, by + 5), active_color, 1, lineType=cv2.LINE_AA)
                        cv2.putText(annotated, angle_str, (bx, by), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)
                        break

        return annotated

    def close(self) -> None:
        """Release underlying MediaPipe landmarker resources."""
        if self.landmarker is not None:
            self.landmarker.close()
            self.landmarker = None

    def __enter__(self) -> "PoseDetector":
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        self.close()
