"""Utility functions for calculating geometric angles between anatomical landmarks."""

from typing import Any, Mapping, Sequence, Tuple, Union
import numpy as np

Point2D = Union[Tuple[float, float], Sequence[float], np.ndarray]


def calculate_angle(a: Point2D, b: Point2D, c: Point2D) -> float:
    """Calculate the interior angle (in degrees) at vertex b formed by points a, b, and c.

    The returned angle is normalized to fall within the range [0.0, 180.0].

    Args:
        a: Coordinates (x, y) of the first point.
        b: Coordinates (x, y) of the vertex point.
        c: Coordinates (x, y) of the third point.

    Returns:
        float: The calculated angle at vertex b in degrees between 0.0 and 180.0.
    """
    ax, ay = float(a[0]), float(a[1])
    bx, by = float(b[0]), float(b[1])
    cx, cy = float(c[0]), float(c[1])

    radians = np.arctan2(cy - by, cx - bx) - np.arctan2(ay - by, ax - bx)
    angle = np.abs(radians * 180.0 / np.pi)

    if angle > 180.0:
        angle = 360.0 - angle

    return float(angle)


def _extract_xy(landmark: Any) -> Tuple[float, float]:
    """Extract (x, y) coordinates from a landmark object, dict, or sequence.

    Args:
        landmark: Object with .x/.y attributes, dict with 'x'/'y' keys, or sequence of floats.

    Returns:
        Tuple[float, float]: Extracted (x, y) coordinates.

    Raises:
        TypeError: If the landmark structure cannot be parsed.
    """
    if hasattr(landmark, "x") and hasattr(landmark, "y"):
        return float(landmark.x), float(landmark.y)
    if isinstance(landmark, Mapping) and "x" in landmark and "y" in landmark:
        return float(landmark["x"]), float(landmark["y"])
    if isinstance(landmark, (list, tuple, np.ndarray)) and len(landmark) >= 2:
        return float(landmark[0]), float(landmark[1])
    raise TypeError(f"Cannot extract (x, y) from landmark: {landmark!r}")


def get_joint_angle(landmarks: Any, idx_a: int, idx_b: int, idx_c: int) -> float:
    """Extract coordinates from a collection of landmarks and calculate joint angle at vertex b.

    Args:
        landmarks: Collection of landmarks (e.g. MediaPipe NormalizedLandmark sequence).
        idx_a: Index of the first landmark.
        idx_b: Index of the vertex landmark.
        idx_c: Index of the third landmark.

    Returns:
        float: Calculated interior angle at landmark idx_b in degrees [0.0, 180.0].
    """
    a = _extract_xy(landmarks[idx_a])
    b = _extract_xy(landmarks[idx_b])
    c = _extract_xy(landmarks[idx_c])
    return calculate_angle(a, b, c)
