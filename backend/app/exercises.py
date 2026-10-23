"""Exercise tracking and form evaluation state machines for physiotherapy workouts."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from app.angle_utils import calculate_angle, get_joint_angle, _extract_xy


def _get_visibility(landmark: Any) -> float:
    """Extract visibility score from a landmark object or dict.

    Args:
        landmark: Object with visibility attribute or dict containing 'visibility'.

    Returns:
        float: Visibility score in [0.0, 1.0], defaulting to 1.0 if not available.
    """
    if hasattr(landmark, "visibility") and landmark.visibility is not None:
        return float(landmark.visibility)
    if isinstance(landmark, dict) and "visibility" in landmark and landmark["visibility"] is not None:
        return float(landmark["visibility"])
    return 1.0


class Exercise(ABC):
    """Abstract base class for exercise rep counting and form analysis."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Name identifier of the exercise."""
        pass

    @abstractmethod
    def process(self, landmarks: Any) -> Dict[str, Any]:
        """Process landmarks for a single video frame.

        Args:
            landmarks: Sequence of pose landmarks for a detected person.

        Returns:
            dict: Evaluation results containing:
                - rep_count (int): Total completed repetitions.
                - state (str): Current exercise state machine state.
                - feedback (list[str]): Real-time form correction tips.
                - form_score (float): Form score in range [0.0, 1.0].
        """
        pass

    @abstractmethod
    def reset(self) -> None:
        """Reset internal rep counts, states, and cached metrics."""
        pass


class BicepCurl(Exercise):
    """Bicep curl exercise tracker tracking elbow flexion and upper-arm stability."""

    def __init__(self) -> None:
        self.rep_count: int = 0
        self.state: str = "START"
        self._feedback: List[str] = []
        self._last_form_score: float = 1.0

    @property
    def name(self) -> str:
        return "bicep_curl"

    def reset(self) -> None:
        """Reset counter and state to initial values."""
        self.rep_count = 0
        self.state = "START"
        self._feedback = []
        self._last_form_score = 1.0

    def process(self, landmarks: Any) -> Dict[str, Any]:
        """Analyze bicep curl form and repetition progression.

        Landmark indices:
            Left arm: 11 (shoulder), 13 (elbow), 15 (wrist), 23 (hip)
            Right arm: 12 (shoulder), 14 (elbow), 16 (wrist), 24 (hip)

        States:
            - DOWN: elbow angle > 160°
            - UP: elbow angle < 40°
            - Rep count increments on UP -> DOWN transition.

        Form checks:
            - Shoulder-elbow-hip angle: elbow flaring out > 25° from torso.
        """
        if landmarks is None or len(landmarks) < 25:
            return {
                "rep_count": self.rep_count,
                "state": self.state,
                "feedback": ["Subject not fully visible"],
                "form_score": self._last_form_score,
            }

        feedback: List[str] = []
        form_score: float = 1.0

        # Evaluate visibility of left vs right arm landmarks
        left_vis = (
            _get_visibility(landmarks[11])
            + _get_visibility(landmarks[13])
            + _get_visibility(landmarks[15])
        ) / 3.0
        right_vis = (
            _get_visibility(landmarks[12])
            + _get_visibility(landmarks[14])
            + _get_visibility(landmarks[16])
        ) / 3.0

        if right_vis > left_vis:
            shoulder_idx, elbow_idx, wrist_idx, hip_idx = 12, 14, 16, 24
        else:
            shoulder_idx, elbow_idx, wrist_idx, hip_idx = 11, 13, 15, 23

        # Primary elbow flexion angle
        elbow_angle = get_joint_angle(landmarks, shoulder_idx, elbow_idx, wrist_idx)

        # Form check: Elbow drift / flare away from the torso
        # Measured as the angle at the shoulder between the elbow and hip
        arm_body_angle = calculate_angle(
            _extract_xy(landmarks[elbow_idx]),
            _extract_xy(landmarks[shoulder_idx]),
            _extract_xy(landmarks[hip_idx]),
        )
        if arm_body_angle > 25.0:
            feedback.append("Keep your elbow closer to your body")
            penalty = min(0.4, (arm_body_angle - 25.0) / 40.0 * 0.4 + 0.1)
            form_score -= penalty

        # State machine and rep counting
        if elbow_angle > 160.0:
            if self.state == "UP":
                self.rep_count += 1
            self.state = "DOWN"
        elif elbow_angle < 40.0:
            self.state = "UP"
        # In-between angles (40° - 160°) maintain current state with no penalty

        form_score = max(0.0, min(1.0, round(form_score, 2)))
        self._last_form_score = form_score
        self._feedback = feedback

        return {
            "rep_count": self.rep_count,
            "state": self.state,
            "feedback": feedback,
            "form_score": form_score,
        }


class Squat(Exercise):
    """Squat exercise tracker tracking knee flexion, back posture, and knee alignment."""

    def __init__(self) -> None:
        self.rep_count: int = 0
        self.state: str = "START"
        self._feedback: List[str] = []
        self._last_form_score: float = 1.0

    @property
    def name(self) -> str:
        return "squat"

    def reset(self) -> None:
        """Reset counter and state to initial values."""
        self.rep_count = 0
        self.state = "START"
        self._feedback = []
        self._last_form_score = 1.0

    def process(self, landmarks: Any) -> Dict[str, Any]:
        """Analyze squat form and repetition progression.

        Landmark indices:
            Left leg: 11 (shoulder), 23 (hip), 25 (knee), 27 (ankle)
            Right leg: 12 (shoulder), 24 (hip), 26 (knee), 28 (ankle)

        States:
            - DOWN: knee angle < 100°
            - UP: knee angle > 160°
            - Rep count increments on DOWN -> UP transition.

        Form checks:
            - Back angle: shoulder-hip-knee angle < 45°
            - Knee over toes: knee extends significantly past ankle in facing direction
        """
        if landmarks is None or len(landmarks) < 29:
            return {
                "rep_count": self.rep_count,
                "state": self.state,
                "feedback": ["Subject not fully visible"],
                "form_score": self._last_form_score,
            }

        feedback: List[str] = []
        form_score: float = 1.0

        # Evaluate visibility of left vs right leg landmarks
        left_vis = (
            _get_visibility(landmarks[23])
            + _get_visibility(landmarks[25])
            + _get_visibility(landmarks[27])
        ) / 3.0
        right_vis = (
            _get_visibility(landmarks[24])
            + _get_visibility(landmarks[26])
            + _get_visibility(landmarks[28])
        ) / 3.0

        if right_vis > left_vis:
            shoulder_idx, hip_idx, knee_idx, ankle_idx = 12, 24, 26, 28
        else:
            shoulder_idx, hip_idx, knee_idx, ankle_idx = 11, 23, 25, 27

        # Knee angle
        knee_angle = get_joint_angle(landmarks, hip_idx, knee_idx, ankle_idx)

        # Form check 1: Back angle (shoulder - hip - knee angle at hip)
        back_angle = get_joint_angle(landmarks, shoulder_idx, hip_idx, knee_idx)
        if back_angle < 45.0:
            feedback.append("Keep your back straighter")
            form_score -= 0.3

        # Form check 2: Knee over toes (compare knee x to ankle x in facing direction)
        knee_x = _extract_xy(landmarks[knee_idx])[0]
        ankle_x = _extract_xy(landmarks[ankle_idx])[0]
        hip_x = _extract_xy(landmarks[hip_idx])[0]

        # Determine horizontal facing direction based on knee relative to hip
        is_facing_right = knee_x >= hip_x
        knee_extension = (knee_x - ankle_x) if is_facing_right else (ankle_x - knee_x)

        # Flag excessive forward knee travel when knees are significantly past ankles (> 0.06 normalized)
        if knee_extension > 0.06 and knee_angle < 140.0:
            feedback.append("Don't let your knees go past your toes")
            form_score -= 0.3

        # State machine and rep counting: Rep counts on transition from DOWN -> UP
        if knee_angle < 100.0:
            self.state = "DOWN"
        elif knee_angle > 160.0:
            if self.state == "DOWN":
                self.rep_count += 1
            self.state = "UP"

        form_score = max(0.0, min(1.0, round(form_score, 2)))
        self._last_form_score = form_score
        self._feedback = feedback

        return {
            "rep_count": self.rep_count,
            "state": self.state,
            "feedback": feedback,
            "form_score": form_score,
        }


def get_exercise(name: str) -> Exercise:
    """Factory function returning an Exercise instance matching the requested exercise name.

    Args:
        name: Name of the exercise ('bicep_curl' or 'squat').

    Returns:
        Exercise: An initialized Exercise instance.

    Raises:
        ValueError: If the exercise name is unsupported.
    """
    normalized_name = name.strip().lower().replace("-", "_").replace(" ", "_")
    if normalized_name in ("bicep_curl", "bicep", "curl", "bicep_curls"):
        return BicepCurl()
    elif normalized_name in ("squat", "squats"):
        return Squat()
    else:
        raise ValueError(
            f"Unsupported exercise: '{name}'. Supported exercises are 'bicep_curl' and 'squat'."
        )
