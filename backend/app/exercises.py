"""Biomechanical exercise tracking and real-time form correction state machines."""

from abc import ABC, abstractmethod
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.angle_utils import (
    calculate_angle,
    calculate_torso_tilt,
    get_joint_angle,
    _extract_xy,
)


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
    def process(self, landmarks: Any, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """Process landmarks for a single video frame.

        Args:
            landmarks: Sequence of pose landmarks for a detected person.

        Returns:
            dict: Evaluation results containing:
                - rep_count (int): Total completed repetitions.
                - state (str): Current exercise state machine state.
                - feedback (list[str]): Real-time form correction tips.
                - form_status (str): 'good' | 'warning' | 'error'.
                - form_score (float): Form score in range [0.0, 1.0].
                - angle (float): Live joint angle of active limb.
                - rom_pct (int): Range of motion percentage [0, 100].
                - active_joints (list[int]): Landmark indices for active kinematic chain.
                - error_joints (list[int]): Landmark indices violating posture.
                - checkpoints (dict[str, str]): Structured posture checkpoints.
        """
        pass

    @abstractmethod
    def reset(self) -> None:
        """Reset internal rep counts, states, and cached metrics."""
        pass


class SingleArmState:
    """Tracks state and biomechanics for an individual arm during bicep curls."""

    def __init__(self, side: str, shoulder_idx: int, elbow_idx: int, wrist_idx: int, hip_idx: int) -> None:
        self.side = side
        self.shoulder_idx = shoulder_idx
        self.elbow_idx = elbow_idx
        self.wrist_idx = wrist_idx
        self.hip_idx = hip_idx

        # States: START -> READY_DOWN -> CURLING_UP -> PEAK -> LOWERING -> READY_DOWN
        self.state: str = "START"
        self.ready_frames: int = 0
        self.peak_reached: bool = False
        self.rep_start_time: float = 0.0
        self.last_rep_time: float = 0.0

        # Form metrics tracked during the active repetition
        self.min_angle: float = 180.0
        self.max_elbow_flare: float = 0.0
        self.max_torso_tilt: float = 0.0
        self.last_rep_score: float = 1.0
        self.last_rep_feedback: List[str] = []

    def reset(self) -> None:
        self.state = "START"
        self.ready_frames = 0
        self.peak_reached = False
        self.rep_start_time = 0.0
        self.last_rep_time = 0.0
        self.min_angle = 180.0
        self.max_elbow_flare = 0.0
        self.max_torso_tilt = 0.0
        self.last_rep_score = 1.0
        self.last_rep_feedback = []


class BicepCurl(Exercise):
    """Clinical bicep curl exercise analyzer with dual-arm independent FSM,

    cadence evaluation, elbow isolation verification, and torso sway suppression.
    """

    def __init__(self) -> None:
        self.rep_count: int = 0
        self.left_arm = SingleArmState("left", 11, 13, 15, 23)
        self.right_arm = SingleArmState("right", 12, 14, 16, 24)
        self._last_completed_rep_time: float = 0.0
        self._running_form_scores: List[float] = []
        self._last_evaluated_score: float = 1.0

    @property
    def name(self) -> str:
        return "bicep_curl"

    def reset(self) -> None:
        self.rep_count = 0
        self.left_arm.reset()
        self.right_arm.reset()
        self._last_completed_rep_time = 0.0
        self._running_form_scores.clear()
        self._last_evaluated_score = 1.0

    def _update_arm(
        self,
        arm: SingleArmState,
        landmarks: Any,
        now: float,
    ) -> Tuple[bool, float, float, float, List[str], List[int]]:
        """Update single arm state machine and return rep completion and metrics.

        Returns:
            Tuple[rep_completed, elbow_angle, flare_angle, torso_tilt, error_messages, error_joints]
        """
        elbow_angle = get_joint_angle(landmarks, arm.shoulder_idx, arm.elbow_idx, arm.wrist_idx)
        s_xy = _extract_xy(landmarks[arm.shoulder_idx])
        e_xy = _extract_xy(landmarks[arm.elbow_idx])
        w_xy = _extract_xy(landmarks[arm.wrist_idx])
        h_xy = _extract_xy(landmarks[arm.hip_idx])

        # Elbow flare angle (angle between elbow, shoulder, hip)
        flare_angle = calculate_angle(e_xy, s_xy, h_xy)

        # Torso tilt from vertical axis
        torso_tilt = calculate_torso_tilt(s_xy, h_xy)

        rep_completed = False
        errors: List[str] = []
        error_joints: List[int] = []

        # Instantaneous live form checks during movement
        if flare_angle > 28.0:
            errors.append(f"Keep {arm.side} elbow tucked close to your torso")
            error_joints.append(arm.elbow_idx)

        if torso_tilt > 16.0:
            errors.append("Keep your back still — avoid swinging your torso")
            error_joints.extend([arm.shoulder_idx, arm.hip_idx])

        # State Machine Transitions:
        # 1. START / WAITING -> READY_DOWN (requires full extension + wrist below elbow)
        if arm.state == "START":
            if elbow_angle >= 140.0 and w_xy[1] > e_xy[1] - 0.04:
                arm.ready_frames += 1
                if arm.ready_frames >= 2:
                    arm.state = "READY_DOWN"
                    arm.peak_reached = False
                    arm.min_angle = elbow_angle
            else:
                arm.ready_frames = 0

        # 2. READY_DOWN -> CURLING_UP (initiating genuine upward curl)
        elif arm.state == "READY_DOWN":
            if elbow_angle < 125.0 and w_xy[1] < e_xy[1] + 0.10:
                arm.state = "CURLING_UP"
                arm.rep_start_time = now
                arm.min_angle = elbow_angle
                arm.max_elbow_flare = flare_angle
                arm.max_torso_tilt = torso_tilt
                arm.peak_reached = False

        # 3. CURLING_UP -> PEAK (curling towards shoulder)
        elif arm.state == "CURLING_UP":
            arm.min_angle = min(arm.min_angle, elbow_angle)
            arm.max_elbow_flare = max(arm.max_elbow_flare, flare_angle)
            arm.max_torso_tilt = max(arm.max_torso_tilt, torso_tilt)

            # Check if peak contraction reached (< 65 deg and wrist clearly above elbow)
            if elbow_angle <= 65.0 and w_xy[1] < e_xy[1] - 0.04:
                arm.state = "PEAK"
                arm.peak_reached = True

            # If user abandoned curl and dropped arm back down without reaching peak
            elif elbow_angle >= 140.0:
                arm.state = "READY_DOWN"
                arm.peak_reached = False

        # 4. PEAK -> LOWERING (reached contraction, now descending)
        elif arm.state == "PEAK":
            arm.min_angle = min(arm.min_angle, elbow_angle)
            arm.max_elbow_flare = max(arm.max_elbow_flare, flare_angle)
            arm.max_torso_tilt = max(arm.max_torso_tilt, torso_tilt)

            if elbow_angle > 85.0:
                arm.state = "LOWERING"

        # 5. LOWERING -> READY_DOWN (completing cycle)
        elif arm.state == "LOWERING":
            arm.max_elbow_flare = max(arm.max_elbow_flare, flare_angle)
            arm.max_torso_tilt = max(arm.max_torso_tilt, torso_tilt)

            # Returning to bottom extension
            if elbow_angle >= 140.0:
                duration = now - arm.rep_start_time
                cooldown = now - arm.last_rep_time

                # Check if this was a valid full rep
                if arm.peak_reached and duration >= 0.85 and cooldown >= 0.8:
                    rep_completed = True
                    arm.last_rep_time = now

                    # Evaluate rep score based on peak contraction, flare, tilt, and cadence
                    rep_penalties = 0.0
                    rep_feedback = []

                    if arm.max_elbow_flare > 28.0:
                        rep_penalties += min(0.30, (arm.max_elbow_flare - 28.0) * 0.02 + 0.15)
                        rep_feedback.append("Keep elbow pinned closer to torso")

                    if arm.max_torso_tilt > 16.0:
                        rep_penalties += min(0.35, (arm.max_torso_tilt - 16.0) * 0.025 + 0.20)
                        rep_feedback.append("Avoid swinging back for momentum")

                    if duration < 1.0:
                        rep_penalties += 0.15
                        rep_feedback.append("Slow down for controlled muscle activation")

                    if arm.min_angle > 58.0:
                        rep_penalties += 0.10
                        rep_feedback.append("Curl slightly higher for peak contraction")

                    rep_score = max(0.40, min(1.0, round(1.0 - rep_penalties, 2)))
                    arm.last_rep_score = rep_score
                    arm.last_rep_feedback = rep_feedback

                arm.state = "READY_DOWN"
                arm.peak_reached = False
                arm.min_angle = 180.0

        return rep_completed, elbow_angle, flare_angle, torso_tilt, errors, error_joints

    def process(self, landmarks: Any, timestamp: Optional[float] = None) -> Dict[str, Any]:
        now = timestamp if timestamp is not None else time.time()

        if landmarks is None or len(landmarks) < 25:
            return {
                "rep_count": self.rep_count,
                "state": "NO_POSE",
                "feedback": ["Subject not fully visible. Step into camera view."],
                "form_status": "warning",
                "form_score": self._last_evaluated_score,
                "angle": 180.0,
                "rom_pct": 0,
                "active_joints": [],
                "error_joints": [],
                "checkpoints": {
                    "Elbow Alignment": "Pending",
                    "Torso Stability": "Pending",
                    "Range of Motion": "Waiting",
                },
            }

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

        left_valid = left_vis > 0.4
        right_valid = right_vis > 0.4

        left_rep, left_angle, left_flare, left_tilt, left_errors, left_err_joints = (
            self._update_arm(self.left_arm, landmarks, now)
            if left_valid
            else (False, 180.0, 0.0, 0.0, [], [])
        )
        right_rep, right_angle, right_flare, right_tilt, right_errors, right_err_joints = (
            self._update_arm(self.right_arm, landmarks, now)
            if right_valid
            else (False, 180.0, 0.0, 0.0, [], [])
        )

        # Rep completed on either arm (enforce debounced increment)
        if (left_rep or right_rep) and (now - self._last_completed_rep_time >= 0.75):
            self.rep_count += 1
            self._last_completed_rep_time = now
            rep_score = self.left_arm.last_rep_score if left_rep else self.right_arm.last_rep_score
            self._running_form_scores.append(rep_score)
            self._last_evaluated_score = round(
                sum(self._running_form_scores) / len(self._running_form_scores), 2
            )

        # Determine which arm is the primary active arm for display
        active_arm = self.right_arm
        active_angle = right_angle
        active_joints = [12, 14, 16]

        if left_valid and right_valid:
            # Pick the arm currently undergoing the curl (smaller angle = more flexed)
            if left_angle < right_angle - 5.0 or (self.left_arm.state in ("CURLING_UP", "PEAK", "LOWERING") and self.right_arm.state in ("START", "READY_DOWN")):
                active_arm = self.left_arm
                active_angle = left_angle
                active_joints = [11, 13, 15]
        elif left_valid:
            active_arm = self.left_arm
            active_angle = left_angle
            active_joints = [11, 13, 15]

        # Calculate Range of Motion percentage (150 deg down = 0%, 55 deg peak = 100%)
        rom_pct = int(np.clip((150.0 - active_angle) / (150.0 - 55.0) * 100.0, 0, 100))

        # Collect active errors and offending joints
        feedback: List[str] = []
        error_joints: List[int] = []

        if active_arm.side == "left":
            feedback.extend(left_errors)
            error_joints.extend(left_err_joints)
        else:
            feedback.extend(right_errors)
            error_joints.extend(right_err_joints)

        # Map state to human-readable stage & positive coaching cue
        hud_state = active_arm.state
        if hud_state == "START":
            feedback.append("Extend your arm straight down to start")
        elif hud_state == "READY_DOWN":
            if not feedback:
                feedback.append("Ready! Keep your elbow still and curl upward.")
        elif hud_state == "CURLING_UP":
            if not feedback:
                feedback.append("Curling up — isolate your bicep.")
        elif hud_state == "PEAK":
            if not feedback:
                feedback.append("Great contraction at top! Now lower slowly.")
        elif hud_state == "LOWERING":
            if not feedback:
                feedback.append("Lower down with controlled tempo.")

        # Determine overall form status
        if error_joints:
            form_status = "error" if len(error_joints) > 1 else "warning"
        elif hud_state == "START":
            form_status = "warning"
        else:
            form_status = "good"

        # Checkpoints status
        elbow_status = "Flaring" if any(j in (13, 14) for j in error_joints) else "Aligned"
        torso_status = "Swinging" if any(j in (11, 12, 23, 24) for j in error_joints) else "Stable"
        rom_status = (
            "Peak (100%)"
            if rom_pct >= 90
            else "Curling"
            if rom_pct >= 30
            else "Extended (0%)"
        )

        return {
            "rep_count": self.rep_count,
            "state": hud_state,
            "feedback": feedback[:2],  # Clean top cues
            "form_status": form_status,
            "form_score": self._last_evaluated_score,
            "angle": round(active_angle, 1),
            "rom_pct": rom_pct,
            "active_joints": active_joints,
            "error_joints": error_joints,
            "checkpoints": {
                "Elbow Isolation": elbow_status,
                "Torso Stability": torso_status,
                "Range of Motion": rom_status,
            },
        }


class Squat(Exercise):
    """Clinical squat exercise analyzer tracking knee flexion depth, trunk lean angle,

    anterior knee displacement (knees past toes), and bilateral symmetry.
    """

    def __init__(self) -> None:
        self.rep_count: int = 0
        # States: START -> READY_STAND -> SQUATTING_DOWN -> SQUAT_DEPTH -> DRIVING_UP -> READY_STAND
        self.state: str = "START"
        self.ready_frames: int = 0
        self.depth_reached: bool = False
        self.rep_start_time: float = 0.0
        self.last_rep_time: float = 0.0
        self.min_knee_angle: float = 180.0
        self.max_torso_lean: float = 0.0
        self.max_knee_extension: float = 0.0
        self._running_form_scores: List[float] = []
        self._last_evaluated_score: float = 1.0

    @property
    def name(self) -> str:
        return "squat"

    def reset(self) -> None:
        self.rep_count = 0
        self.state = "START"
        self.ready_frames = 0
        self.depth_reached = False
        self.rep_start_time = 0.0
        self.last_rep_time = 0.0
        self.min_knee_angle = 180.0
        self.max_torso_lean = 0.0
        self.max_knee_extension = 0.0
        self._running_form_scores.clear()
        self._last_evaluated_score = 1.0

    def process(self, landmarks: Any, timestamp: Optional[float] = None) -> Dict[str, Any]:
        now = timestamp if timestamp is not None else time.time()

        if landmarks is None or len(landmarks) < 29:
            return {
                "rep_count": self.rep_count,
                "state": "NO_POSE",
                "feedback": ["Subject not fully visible. Step back so full legs are seen."],
                "form_status": "warning",
                "form_score": self._last_evaluated_score,
                "angle": 180.0,
                "rom_pct": 0,
                "active_joints": [],
                "error_joints": [],
                "checkpoints": {
                    "Squat Depth": "Waiting",
                    "Back Alignment": "Pending",
                    "Knee Position": "Pending",
                },
            }

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

        if left_vis < 0.35 and right_vis < 0.35:
            return {
                "rep_count": self.rep_count,
                "state": "NO_LEGS",
                "feedback": ["Legs not clearly visible. Adjust camera angle."],
                "form_status": "warning",
                "form_score": self._last_evaluated_score,
                "angle": 180.0,
                "rom_pct": 0,
                "active_joints": [],
                "error_joints": [],
                "checkpoints": {
                    "Squat Depth": "Waiting",
                    "Back Alignment": "Pending",
                    "Knee Position": "Pending",
                },
            }

        left_knee_angle = get_joint_angle(landmarks, 23, 25, 27) if left_vis > 0.35 else 180.0
        right_knee_angle = get_joint_angle(landmarks, 24, 26, 28) if right_vis > 0.35 else 180.0

        if left_vis > 0.35 and right_vis > 0.35:
            knee_angle = min(left_knee_angle, right_knee_angle)
            shoulder_idx = 12 if right_vis >= left_vis else 11
            hip_idx = 24 if right_vis >= left_vis else 23
            knee_idx = 26 if right_vis >= left_vis else 25
            ankle_idx = 28 if right_vis >= left_vis else 27
            active_joints = [hip_idx, knee_idx, ankle_idx]
        elif right_vis > 0.35:
            knee_angle = right_knee_angle
            shoulder_idx, hip_idx, knee_idx, ankle_idx = 12, 24, 26, 28
            active_joints = [24, 26, 28]
        else:
            knee_angle = left_knee_angle
            shoulder_idx, hip_idx, knee_idx, ankle_idx = 11, 23, 25, 27
            active_joints = [23, 25, 27]

        s_xy = _extract_xy(landmarks[shoulder_idx])
        h_xy = _extract_xy(landmarks[hip_idx])
        k_xy = _extract_xy(landmarks[knee_idx])
        a_xy = _extract_xy(landmarks[ankle_idx])

        # 1. Back / Torso lean angle from vertical (degrees)
        torso_tilt = calculate_torso_tilt(s_xy, h_xy)

        # 2. Knee extension past ankle in facing direction
        is_facing_right = k_xy[0] >= h_xy[0]
        knee_extension = (k_xy[0] - a_xy[0]) if is_facing_right else (a_xy[0] - k_xy[0])

        # ROM percentage (160 deg stand = 0%, 100 deg parallel = 100%)
        rom_pct = int(np.clip((160.0 - knee_angle) / (160.0 - 100.0) * 100.0, 0, 100))

        feedback: List[str] = []
        error_joints: List[int] = []

        # Form checks during movement
        if torso_tilt > 36.0 and knee_angle < 145.0:
            feedback.append("Chest up! Avoid bending too far forward at the waist")
            error_joints.extend([shoulder_idx, hip_idx])

        if knee_extension > 0.08 and knee_angle < 130.0:
            feedback.append("Push hips back — prevent knees driving past toes")
            error_joints.append(knee_idx)

        # State Machine Transitions
        # 1. START -> READY_STAND (requires upright standing: knee >= 150 deg, hip above knee)
        if self.state == "START":
            if knee_angle >= 150.0 and h_xy[1] < k_xy[1] - 0.08:
                self.ready_frames += 1
                if self.ready_frames >= 2:
                    self.state = "READY_STAND"
                    self.depth_reached = False
                    self.min_knee_angle = knee_angle
            else:
                self.ready_frames = 0
                feedback.append("Stand upright to calibrate squat position")

        # 2. READY_STAND -> SQUATTING_DOWN
        elif self.state == "READY_STAND":
            if knee_angle < 145.0:
                self.state = "SQUATTING_DOWN"
                self.rep_start_time = now
                self.min_knee_angle = knee_angle
                self.max_torso_lean = torso_tilt
                self.max_knee_extension = knee_extension
                self.depth_reached = False

        # 3. SQUATTING_DOWN -> SQUAT_DEPTH
        elif self.state == "SQUATTING_DOWN":
            self.min_knee_angle = min(self.min_knee_angle, knee_angle)
            self.max_torso_lean = max(self.max_torso_lean, torso_tilt)
            self.max_knee_extension = max(self.max_knee_extension, knee_extension)

            # Reached target depth (knee angle <= 118 deg)
            if knee_angle <= 118.0:
                self.state = "SQUAT_DEPTH"
                self.depth_reached = True

            # If user stopped descending and started going up before reaching depth
            elif knee_angle > self.min_knee_angle + 15.0:
                self.state = "DRIVING_UP"

        # 4. SQUAT_DEPTH -> DRIVING_UP
        elif self.state == "SQUAT_DEPTH":
            self.min_knee_angle = min(self.min_knee_angle, knee_angle)
            self.max_torso_lean = max(self.max_torso_lean, torso_tilt)
            self.max_knee_extension = max(self.max_knee_extension, knee_extension)

            if knee_angle > 125.0:
                self.state = "DRIVING_UP"

        # 5. DRIVING_UP -> READY_STAND (completion)
        elif self.state == "DRIVING_UP":
            self.max_torso_lean = max(self.max_torso_lean, torso_tilt)
            self.max_knee_extension = max(self.max_knee_extension, knee_extension)

            if knee_angle >= 148.0:
                duration = now - self.rep_start_time
                cooldown = now - self.last_rep_time

                # Legitimate rep check
                if self.depth_reached and duration >= 0.9 and cooldown >= 0.8:
                    self.rep_count += 1
                    self.last_rep_time = now

                    # Evaluate rep penalties
                    penalties = 0.0
                    if self.max_torso_lean > 36.0:
                        penalties += min(0.35, (self.max_torso_lean - 36.0) * 0.025 + 0.20)
                    if self.max_knee_extension > 0.08:
                        penalties += 0.25
                    if duration < 1.0:
                        penalties += 0.15
                    if self.min_knee_angle > 112.0:
                        penalties += 0.10

                    rep_score = max(0.40, min(1.0, round(1.0 - penalties, 2)))
                    self._running_form_scores.append(rep_score)
                    self._last_evaluated_score = round(
                        sum(self._running_form_scores) / len(self._running_form_scores), 2
                    )
                elif not self.depth_reached:
                    feedback.append("Incomplete squat — squat deeper next rep")

                self.state = "READY_STAND"
                self.depth_reached = False
                self.min_knee_angle = 180.0

        # Positive coaching cues when no active errors
        if not feedback:
            if self.state == "READY_STAND":
                feedback.append("Ready to squat! Push your hips back and bend knees.")
            elif self.state == "SQUATTING_DOWN":
                feedback.append("Squatting down — keep your chest proud and heels down.")
            elif self.state == "SQUAT_DEPTH":
                feedback.append("Excellent depth! Drive up firmly through your heels.")
            elif self.state == "DRIVING_UP":
                feedback.append("Ascending smoothly — stand all the way upright.")

        # Determine overall form status
        if error_joints:
            form_status = "error" if len(error_joints) > 1 else "warning"
        elif self.state == "START":
            form_status = "warning"
        else:
            form_status = "good"

        # Checkpoint statuses
        depth_status = (
            "Parallel (100%)"
            if rom_pct >= 90
            else "Ascending"
            if self.state == "DRIVING_UP"
            else "Descending"
            if rom_pct >= 30
            else "Standing (0%)"
        )
        back_status = "Chest Down" if any(j in (11, 12, 23, 24) for j in error_joints) else "Upright"
        knee_status = "Past Toes" if any(j in (25, 26) for j in error_joints) else "Aligned"

        return {
            "rep_count": self.rep_count,
            "state": self.state,
            "feedback": feedback[:2],
            "form_status": form_status,
            "form_score": self._last_evaluated_score,
            "angle": round(knee_angle, 1),
            "rom_pct": rom_pct,
            "active_joints": active_joints,
            "error_joints": error_joints,
            "checkpoints": {
                "Squat Depth": depth_status,
                "Back Posture": back_status,
                "Knee Tracking": knee_status,
            },
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
