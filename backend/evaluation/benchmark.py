"""Benchmark Evaluation Suite for PhysioTrack AI against the Kaggle Exercise Pose Dataset.

Evaluates:
1. Full Repetition Counting Accuracy (Valid repetitions correctly counted)
2. Incomplete Repetition Rejection Rate (Preventing false counts)
3. Defect / Posture Error Detection Sensitivity & Specificity
4. Precision, Recall, F1-Score, and Latency Benchmarks
"""

import csv
import json
from pathlib import Path
import sys
import time
from typing import Any, Dict, List

# Ensure backend root is on python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.exercises import BicepCurl, Squat

DATASET_CSV = Path(__file__).resolve().parent.parent / "data" / "datasets" / "kaggle_exercise_pose_dataset.csv"
RESULTS_JSON = Path(__file__).resolve().parent.parent / "data" / "datasets" / "benchmark_summary.json"


class LandmarkWrapper:
    """Mock MediaPipe NormalizedLandmark object from CSV landmark attributes."""
    def __init__(self, x, y, z, v):
        self.x = float(x)
        self.y = float(y)
        self.z = float(z)
        self.visibility = float(v)


def run_benchmark() -> Dict[str, Any]:
    if not DATASET_CSV.exists():
        raise FileNotFoundError(f"Dataset not found at {DATASET_CSV}")

    # Read frames grouped by rep_id
    reps_data: Dict[int, List[Dict[str, Any]]] = {}
    with open(DATASET_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rep_id = int(row["rep_id"])
            if rep_id not in reps_data:
                reps_data[rep_id] = []
            reps_data[rep_id].append(row)

    total_attempts = len(reps_data)
    valid_reps_ground_truth = 0
    incomplete_reps_ground_truth = 0

    counted_valid_reps = 0
    rejected_incomplete_reps = 0

    # Classification Metrics for Form Defects:
    # Positive = Form Error / Defect
    # Negative = Good Form
    tp = 0  # Ground truth error & detected error
    fp = 0  # Ground truth good & detected error
    tn = 0  # Ground truth good & detected good
    fn = 0  # Ground truth error & detected good

    latencies_ms = []

    bicep_engine = BicepCurl()
    squat_engine = Squat()

    # Running simulated time: 10 FPS = 0.10s per frame, with 1.0s pause between reps
    sim_time = 100.0

    for rep_id, frames in reps_data.items():
        exercise_name = frames[0]["exercise"]
        gt_form = frames[0]["ground_truth_form"]  # "good" or "error"
        gt_defect = frames[0]["defect_type"]

        is_valid_attempt = (gt_defect != "incomplete_rom")
        if is_valid_attempt:
            valid_reps_ground_truth += 1
        else:
            incomplete_reps_ground_truth += 1

        engine = bicep_engine if exercise_name == "bicep_curl" else squat_engine
        prev_count = engine.rep_count
        detected_form_errors = False
        min_form_score = 1.0

        for frame_row in frames:
            sim_time += 0.10  # 10 FPS

            # Reconstruct 33 landmarks
            landmarks = []
            for i in range(33):
                x = frame_row[f"x_{i}"]
                y = frame_row[f"y_{i}"]
                z = frame_row[f"z_{i}"]
                v = frame_row[f"v_{i}"]
                landmarks.append(LandmarkWrapper(x, y, z, v))

            t0 = time.perf_counter()
            result = engine.process(landmarks, timestamp=sim_time)
            dt = (time.perf_counter() - t0) * 1000.0
            latencies_ms.append(dt)

            if result.get("form_status") == "error" or result.get("form_score", 1.0) < 0.75:
                detected_form_errors = True
            min_form_score = min(min_form_score, result.get("form_score", 1.0))

        sim_time += 1.0  # 1.0s rest between reps

        # Evaluate rep counting
        new_count = engine.rep_count
        rep_was_counted = (new_count > prev_count)

        if is_valid_attempt:
            if rep_was_counted:
                counted_valid_reps += 1
        else:
            if not rep_was_counted:
                rejected_incomplete_reps += 1

        # Evaluate defect classification
        if gt_form == "error":
            if detected_form_errors or min_form_score < 0.80 or not rep_was_counted:
                tp += 1
            else:
                fn += 1
        else:  # gt_form == "good"
            if detected_form_errors or min_form_score < 0.80:
                fp += 1
            else:
                tn += 1

    # Statistical Computations
    valid_rep_accuracy = (counted_valid_reps / valid_reps_ground_truth) * 100.0 if valid_reps_ground_truth > 0 else 0.0
    false_positive_rejection = (rejected_incomplete_reps / incomplete_reps_ground_truth) * 100.0 if incomplete_reps_ground_truth > 0 else 100.0
    precision = (tp / (tp + fp)) * 100.0 if (tp + fp) > 0 else 0.0
    recall = (tp / (tp + fn)) * 100.0 if (tp + fn) > 0 else 0.0
    f1_score = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0
    specificity = (tn / (tn + fp)) * 100.0 if (tn + fp) > 0 else 0.0
    avg_latency = sum(latencies_ms) / len(latencies_ms) if latencies_ms else 0.0

    summary = {
        "dataset_name": "Kaggle Exercise Pose Benchmark (Physical Exercise Recognition Dataset)",
        "total_test_attempts": total_attempts,
        "total_frames_evaluated": len(latencies_ms),
        "repetition_counting": {
            "ground_truth_valid_reps": valid_reps_ground_truth,
            "detected_valid_reps": counted_valid_reps,
            "valid_repetition_accuracy_pct": round(valid_rep_accuracy, 2),
            "incomplete_reps_tested": incomplete_reps_ground_truth,
            "incomplete_reps_suppressed": rejected_incomplete_reps,
            "false_rep_rejection_rate_pct": round(false_positive_rejection, 2),
        },
        "form_defect_classification": {
            "true_positives": tp,
            "false_positives": fp,
            "true_negatives": tn,
            "false_negatives": fn,
            "precision_pct": round(precision, 2),
            "recall_sensitivity_pct": round(recall, 2),
            "specificity_pct": round(specificity, 2),
            "f1_score_pct": round(f1_score, 2),
        },
        "computational_performance": {
            "mean_processing_latency_ms": round(avg_latency, 3),
            "max_sustainable_fps": round(1000.0 / max(avg_latency, 0.001), 1),
        },
    }

    with open(RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print("\n=================================================================")
    print("      PHYSIOTRACK AI — KAGGLE DATASET BENCHMARK RESULTS          ")
    print("=================================================================")
    print(f"Dataset Evaluated:                {summary['dataset_name']}")
    print(f"Total Exercise Attempts Tested:   {total_attempts}")
    print(f"Total Video Frames Processed:     {len(latencies_ms)}")
    print(f"Valid Repetition Counting Acc:    {valid_rep_accuracy:.2f}% ({counted_valid_reps}/{valid_reps_ground_truth})")
    print(f"False-Rep Suppression Rate:       {false_positive_rejection:.2f}% ({rejected_incomplete_reps}/{incomplete_reps_ground_truth})")
    print(f"Form Defect Detection Sensitivity: {recall:.2f}%")
    print(f"Form Defect Detection Precision:   {precision:.2f}%")
    print(f"Form Defect Detection F1-Score:    {f1_score:.2f}%")
    print(f"Healthy Posture Specificity:       {specificity:.2f}%")
    print(f"Mean Kinematic Latency / Frame:    {avg_latency:.3f} ms")
    print(f"Theoretical Max Ingestion Rate:    {1000.0 / avg_latency:.1f} FPS")
    print("=================================================================")
    print(f"Detailed JSON results saved to: {RESULTS_JSON}\n")

    return summary


if __name__ == "__main__":
    run_benchmark()
