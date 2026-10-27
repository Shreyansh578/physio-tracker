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
    """Bicep curl exercise tracker tracking elbow flexion on both arms and upper-arm stability."""

    def __init__(self) -> None:
        self.rep_count: int = 0
        self.state: str = "START"
        self._left_state: str = "START"
        self._right_state: str = "START"
        self._last_rep_time: float = 0.0
        self._feedback: List[str] = []
        self._last_form_score: float = 1.0

    @property
    def name(self) -> str:
        return "bicep_curl"

    def reset(self) -> None:
        """Reset counter and state to initial values."""
        self.rep_count = 0
        self.state = "START"
        self._left_state = "START"
        self._right_state = "START"
        self._last_rep_time = 0.0
        self._feedback = []
        self._last_form_score = 1.0

    def process(self, landmarks: Any) -> Dict[str, Any]:
        """Analyze bicep curl form and repetition progression for both arms.

        Landmark indices:
            Left arm: 11 (shoulder), 13 (elbow), 15 (wrist), 23 (hip)
            Right arm: 12 (shoulder), 14 (elbow), 16 (wrist), 24 (hip)

        States:
            - DOWN: elbow angle > 145° (relaxed arm)
            - UP: elbow angle < 60° (curled arm)
            - Rep count increments when an arm returns from UP -> DOWN.
        """
        import time
        now = time.time()

        if landmarks is None or len(landmarks) < 17:
            return {
                "rep_count": self.rep_count,
                "state": self.state,
                "feedback": ["Subject not fully visible"],
                "form_score": self._last_form_score,
                "angle": 180.0,
            }

        feedback: List[str] = []
        form_score: float = 1.0

        # Calculate angles for both arms
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

        left_angle = get_joint_angle(landmarks, 11, 13, 15) if left_vis > 0.3 else 180.0
        right_angle = get_joint_angle(landmarks, 12, 14, 16) if right_vis > 0.3 else 180.0

        # Determine active arm (the one with smaller elbow angle = more flexed)
        active_angle = min(left_angle, right_angle) if (left_vis > 0.3 or right_vis > 0.3) else 180.0

        rep_added = False

        # Track left arm rep
        if left_vis > 0.3:
            if left_angle < 60.0:
                self._left_state = "UP"
            elif left_angle > 145.0:
                if self._left_state == "UP" and (now - self._last_rep_time > 0.4):
                    self.rep_count += 1
                    self._last_rep_time = now
                    rep_added = True
                self._left_state = "DOWN"

        # Track right arm rep
        if right_vis > 0.3:
            if right_angle < 60.0:
                self._right_state = "UP"
            elif right_angle > 145.0:
                if self._right_state == "UP" and (now - self._last_rep_time > 0.4) and not rep_added:
                    self.rep_count += 1
                    self._last_rep_time = now
                self._right_state = "DOWN"

        # Overall state for HUD
        if self._left_state == "UP" or self._right_state == "UP" or active_angle < 60.0:
            self.state = "UP"
        elif active_angle < 120.0:
            self.state = "CURLING"
        else:
            self.state = "DOWN"

        # Form check: Elbow drift / flare away from the torso (only if hip landmark is visible)
        tracked_shoulder = 12 if right_angle < left_angle else 11
        tracked_elbow = 14 if right_angle < left_angle else 13
        tracked_hip = 24 if right_angle < left_angle else 23

        if len(landmarks) > tracked_hip and _get_visibility(landmarks[tracked_hip]) > 0.4:
            arm_body_angle = calculate_angle(
                _extract_xy(landmarks[tracked_elbow]),
                _extract_xy(landmarks[tracked_shoulder]),
                _extract_xy(landmarks[tracked_hip]),
            )
            if arm_body_angle > 30.0:
                feedback.append("Keep your elbow closer to your body")
                penalty = min(0.3, (arm_body_angle - 30.0) / 40.0 * 0.3 + 0.1)
                form_score -= penalty

        if not feedback:
            feedback.append("Good form! Full range of motion.")

        form_score = max(0.0, min(1.0, round(form_score, 2)))
        self._last_form_score = form_score
        self._feedback = feedback

        return {
            "rep_count": self.rep_count,
            "state": self.state,
            "feedback": feedback,
            "form_score": form_score,
            "angle": round(active_angle, 1),
        }


class Squat(Exercise):
    """Squat exercise tracker tracking knee flexion, back posture, and knee alignment."""

    def __init__(self) -> None:
        self.rep_count: int = 0
        self.state: str = "START"
        self._last_rep_time: float = 0.0
        self._feedback: List[str] = []
        self._last_form_score: float = 1.0

    @property
    def name(self) -> str:
        return "squat"

    def reset(self) -> None:
        """Reset counter and state to initial values."""
        self.rep_count = 0
        self.state = "START"
        self._last_rep_time = 0.0
        self._feedback = []
        self._last_form_score = 1.0

    def process(self, landmarks: Any) -> Dict[str, Any]:
        """Analyze squat form and repetition progression.

        Landmark indices:
            Left leg: 23 (hip), 25 (knee), 27 (ankle)
            Right leg: 24 (hip), 26 (knee), 28 (ankle)

        States:
            - DOWN: knee angle < 115°
            - UP: knee angle > 150°
            - Rep count increments on DOWN -> UP transition.
        """
        import time
        now = time.time()

        if landmarks is None or len(landmarks) < 29:
            return {
                "rep_count": self.rep_count,
                "state": self.state,
                "feedback": ["Subject not fully visible"],
                "form_score": self._last_form_score,
                "angle": 180.0,
            }

        feedback: List[str] = []
        form_score: float = 1.0

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

        left_knee_angle = get_joint_angle(landmarks, 23, 25, 27) if left_vis > 0.3 else 180.0
        right_knee_angle = get_joint_angle(landmarks, 24, 26, 28) if right_vis > 0.3 else 180.0

        if left_vis > 0.3 and right_vis > 0.3:
            knee_angle = min(left_knee_angle, right_knee_angle)
            shoulder_idx = 12 if right_vis >= left_vis else 11
            hip_idx = 24 if right_vis >= left_vis else 23
            knee_idx = 26 if right_vis >= left_vis else 25
            ankle_idx = 28 if right_vis >= left_vis else 27
        elif right_vis > 0.3:
            knee_angle = right_knee_angle
            shoulder_idx, hip_idx, knee_idx, ankle_idx = 12, 24, 26, 28
        else:
            knee_angle = left_knee_angle
            shoulder_idx, hip_idx, knee_idx, ankle_idx = 11, 23, 25, 27

        # Form check 1: Back angle
        back_angle = get_joint_angle(landmarks, shoulder_idx, hip_idx, knee_idx)
        if back_angle < 45.0:
            feedback.append("Keep your back straighter")
            form_score -= 0.3

        # Form check 2: Knee over toes
        knee_x = _extract_xy(landmarks[knee_idx])[0]
        ankle_x = _extract_xy(landmarks[ankle_idx])[0]
        hip_x = _extract_xy(landmarks[hip_idx])[0]

        is_facing_right = knee_x >= hip_x
        knee_extension = (knee_x - ankle_x) if is_facing_right else (ankle_x - knee_x)

        if knee_extension > 0.08 and knee_angle < 130.0:
            feedback.append("Don't let your knees go past your toes")
            form_score -= 0.3

        # State machine and rep counting: Rep counts on transition from DOWN -> UP
        if knee_angle < 115.0:
            self.state = "DOWN"
        elif knee_angle > 150.0:
            if self.state == "DOWN" and (now - self._last_rep_time > 0.5):
                self.rep_count += 1
                self._last_rep_time = now
            self.state = "UP"

        if not feedback:
            feedback.append("Good squat form!")

        form_score = max(0.0, min(1.0, round(form_score, 2)))
        self._last_form_score = form_score
        self._feedback = feedback

        return {
            "rep_count": self.rep_count,
            "state": self.state,
            "feedback": feedback,
            "form_score": form_score,
            "angle": round(knee_angle, 1),
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
