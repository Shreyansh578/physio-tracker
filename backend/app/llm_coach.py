"""AI Physical Therapy and Biomechanical Coach powered by LLM reasoning and clinical heuristics."""

import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


def query_gemini_api(prompt: str, system_instruction: str = "") -> Optional[str]:
    """Call Google Gemini API if GEMINI_API_KEY is configured in the environment."""
    if not GEMINI_API_KEY:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
    headers = {"Content-Type": "application/json"}
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "maxOutputTokens": 600,
        },
    }
    if system_instruction:
        body["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    try:
        req = urllib.request.Request(
            url, data=json.dumps(body).encode("utf-8"), headers=headers, method="POST"
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            candidates = res_data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "").strip()
    except Exception as exc:
        logger.warning(f"Gemini API request failed or timed out: {exc}")
    return None


def evaluate_live_form_coaching(
    exercise: str,
    rep_count: int,
    angle: float,
    rom_pct: float,
    state: str,
    checkpoints: Dict[str, str],
    recent_feedback: List[str],
) -> Dict[str, Any]:
    """Analyze real-time biomechanical stream to deliver immediate voice coaching, auditory buzzer alerts, and STOP directives.

    Args:
        exercise: Name of exercise ('bicep_curl', 'squat', etc.)
        rep_count: Number of completed repetitions
        angle: Current joint angle in degrees
        rom_pct: Range of motion percentage [0..100]
        state: State machine step ('READY_DOWN', 'CURLING_UP', etc.)
        checkpoints: Status dictionary of individual checkpoints
        recent_feedback: List of current feedback warnings

    Returns:
        dict: Coaching verdict with stop flag, buzzer trigger, voice cue, and clinical rationale.
    """
    feedback_str = " ".join(recent_feedback).lower()
    
    # Checkpoint issues
    elbow_drift = checkpoints.get("Elbow Drift", "").lower()
    torso_stability = checkpoints.get("Torso Stability", "").lower()
    
    # Rule 1: CRITICAL STOP - Torso hyperextension / excessive swing
    # When a patient swings their torso > 22-25 degrees to jerk weight up, lumbar discs L4-L5 are at risk of herniation.
    if "swing" in feedback_str or "torso" in torso_stability or "back" in feedback_str:
        return {
            "should_stop": True,
            "buzzer_type": "danger",
            "alert_banner": "STOP EXERCISE: EXCESSIVE TORSO SWING",
            "voice_cue": "Stop! You are swinging your lower back. Stand tall and lock your core.",
            "severity": "critical",
            "clinical_advice": "Momentum compensation detected. Arching the lumbar spine shifts load away from the biceps to the lower spine, causing shear stress on lumbar vertebrae.",
        }

    # Rule 2: CRITICAL STOP - Excessive Knee Valgus on Squats
    if exercise == "squat" and ("valgus" in feedback_str or "knees caving" in feedback_str):
        return {
            "should_stop": True,
            "buzzer_type": "danger",
            "alert_banner": "STOP SQUAT: KNEES CAVING INWARD",
            "voice_cue": "Stop! Push your knees outward over your toes.",
            "severity": "critical",
            "clinical_advice": "Severe knee valgus collapse detected. This places extreme rotational tension on the anterior cruciate ligament (ACL) and patellar tendon.",
        }

    # Rule 3: WARNING BUZZER - Elbow Flaring / Forward Drift
    if "drift" in elbow_drift or "elbow" in feedback_str:
        return {
            "should_stop": False,
            "buzzer_type": "warning",
            "alert_banner": "FORM DEFECT: ELBOW DRIFT",
            "voice_cue": "Keep your elbow pinned to your side.",
            "severity": "warning",
            "clinical_advice": "Elbow anterior displacement shifts tension to the anterior deltoid and rotator cuff, reducing target muscular activation.",
        }

    # Rule 4: WARNING BUZZER - Incomplete Range of Motion
    if "incomplete" in feedback_str or "extend" in feedback_str:
        return {
            "should_stop": False,
            "buzzer_type": "warning",
            "alert_banner": "FORM DEFECT: INCOMPLETE EXTENSION",
            "voice_cue": "Lower down fully before next rep.",
            "severity": "warning",
            "clinical_advice": "Shortened eccentric phase limits muscle spindle lengthening and tendon elasticity benefits.",
        }

    # Rule 5: ENCOURAGEMENT / GOOD FORM
    if state == "PEAK" and rom_pct > 80:
        return {
            "should_stop": False,
            "buzzer_type": "success",
            "alert_banner": None,
            "voice_cue": "Great squeeze! Control the lowering.",
            "severity": "good",
            "clinical_advice": "Optimal peak concentric contraction reached with steady joint alignment.",
        }

    return {
        "should_stop": False,
        "buzzer_type": "none",
        "alert_banner": None,
        "voice_cue": None,
        "severity": "neutral",
        "clinical_advice": "Form is within acceptable clinical tolerances.",
    }


def generate_physio_response(user_query: str, user_name: str = "Patient") -> str:
    """Generate an intelligent clinical physical therapy consultation response.

    Uses Google Gemini if available, otherwise falls back to the clinical heuristics engine.
    """
    sys_prompt = (
        "You are Dr. Alex, a Doctor of Physical Therapy (DPT) and expert biomechanical AI rehab specialist. "
        "Provide direct, highly accurate, and empathetic clinical advice. Include joint angles, target muscles, "
        "and injury prevention tips. Keep answers structured with: 1. Assessment, 2. Biomechanical Fix, 3. Rehab Protocol."
    )

    # 1. Attempt Gemini LLM response
    gemini_resp = query_gemini_api(user_query, sys_prompt)
    if gemini_resp:
        return gemini_resp

    # 2. Comprehensive Clinical Inference Engine (Zero external dependencies)
    q = user_query.lower()

    if "shoulder" in q or "rotator cuff" in q or "impingement" in q:
        return f"""### 🩺 Clinical Assessment for Shoulder Pain & Mechanics

Hello {user_name}. Shoulder discomfort during upper body exercises (especially overhead movements or improper bicep curls) is commonly caused by **subacromial impingement** or anterior deltoid compensation.

#### 1. Biomechanical Analysis
* **Mechanism:** When the elbow drifts forward during a bicep curl or lateral raise, the supraspinatus tendon is compressed beneath the acromion process.
* **Target Joint Angle:** Keep humerus-torso angle at **0° to 10°** (arm pinned directly against your mid-axillary line).

#### 2. Immediate Corrective Actions
* **Pin Your Elbows:** Do not allow the elbow to elevate during curls.
* **Scapular Retraction:** Pull shoulder blades down and back ("into your back pockets") before initiating movement.
* **Weight Adjustment:** Reduce resistance by 25% to eliminate momentum swinging.

#### 3. Recommended 3-Phase Rehab Protocol
1. **Sleeper Stretch / Cross-Body Stretch:** 3 sets of 30 seconds hold per side.
2. **External Rotations with Resistance Band:** 3 sets of 12 reps at controlled 3-second eccentric tempo.
3. **Prone Y-T-W Scapular Stabilizers:** 2 sets of 10 reps daily.

> ⚠️ *Red Flag Warning:* If you experience sharp, shooting pain radiating down the arm or weakness raising your arm sideways above 90°, discontinue resistance and consult an orthopedic clinician."""

    elif "squat" in q or "knee" in q or "patella" in q:
        return f"""### 🩺 Clinical Assessment for Knee Pain & Squat Biomechanics

Hello {user_name}. Knee discomfort during squats is most frequently caused by **patellofemoral stress syndrome** due to knee valgus (inward caving) or excessive anterior tibial translation (knees pushing too far beyond toes without hip hinge).

#### 1. Biomechanical Analysis
* **Knee Valgus Angle:** The femur and tibia should maintain a linear 180° frontal plane alignment. Inward collapse puts tensile strain on the medial collateral ligament (MCL) and lateral patellar facet.
* **Target Knee Flexion:** Aim for **90° to 100°** flexion while maintaining an upright trunk angle (> 45° relative to horizontal).

#### 2. Key Posture Fixes
* **Screw Your Feet into the Floor:** Actively torque your feet outwards to engage the gluteus medius.
* **Hip Hinge First:** Initiate the squat by breaking at the hips, not just bending the knees.
* **Foot Placement:** Set stance shoulder-width with toes flared out 15°–20°.

#### 3. Rehabilitation Progression
1. **Box Squats:** 3 sets of 8 reps to a 90° seated depth to eliminate bounce impact.
2. **Side-Lying Clamshells with Mini-Band:** 3 sets of 15 reps to strengthen hip abductors.
3. **Spanish Squats with Isometric Hold:** 4 sets of 30 seconds hold for patellar tendon stiffness."""

    elif "bicep" in q or "curl" in q or "elbow" in q:
        return f"""### 🩺 Biomechanical Guide: Optimizing Bicep Rehabilitation

Hello {user_name}. To rehabilitate or build the biceps brachii safely, following kinematic angle constraints is critical.

#### 1. Primary Kinematic Angles
* **Starting Extension (Rest):** 160°–175° (near full anatomical extension without elbow hyperextension).
* **Peak Concentric Contraction:** 50°–65° (full contraction where the bicep belly is under maximum peak tension).
* **Torso Sway Limit:** Must remain strictly under **10°** of deviation from vertical.

#### 2. Common Defective Motions
* **Elbow Anterior Flaring:** Elbows shooting forward transfers torque to anterior deltoids and supraspinatus.
* **Hyperextension Bounce:** Snapping the elbow straight below 175° shocks the distal biceps tendon and olecranon fossa.

#### 3. Therapeutic Repetition Cadence
* **Concentric Phase (Up):** 1.5 seconds explosive and controlled.
* **Peak Isometric Squeeze:** 1.0 second pause at top contraction.
* **Eccentric Phase (Down):** 3.0 seconds controlled negative (crucial for tendon collagen alignment)."""

    elif "back" in q or "spine" in q or "lumbar" in q:
        return f"""### 🩺 Clinical Assessment for Lower Back Safety & Posture

Hello {user_name}. Lumbar hyperextension during standing exercises is the #1 cause of acute lower back pain during workout sessions.

#### 1. Why it Happens
When arm or leg muscles reach fatigue, the nervous system attempts to cheat the movement by leaning the trunk backward, generating momentum through the lumbar spine and erector spinae.

#### 2. Immediate Clinical Corrections
* **Staggered Stance:** Place one foot slightly behind the other to automatically prevent pelvic tilting.
* **Bracing the Core:** Contract abdominal muscles as if anticipating a light impact to maintain intra-abdominal pressure.
* **Glute Squeeze:** Contracting glutes locks the pelvis in neutral alignment.

#### 3. Spine Stability Exercises (McGill Big 3)
1. **Bird-Dog:** 3 sets of 8 reps holding 5 seconds at full extension.
2. **Side Plank:** 3 sets of 20 seconds hold per side.
3. **Modified Curl-Up:** 3 sets of 8 reps without spinal flexion."""

    else:
        return f"""### 🩺 AI Physio Consultation Summary

Hello {user_name}! I have reviewed your inquiry regarding `{user_query}`.

#### 1. Biomechanical Health Analysis
In clinical rehabilitation and physical therapy, movement efficiency is dictated by three primary principles:
* **Joint Alignment:** Keeping joints centered within their anatomical neutral zone.
* **Controlled Velocity:** Limiting rapid jerking motions to protect ligaments and tendons.
* **Symmetrical Load:** Ensuring equal bilateral force distribution across joints.

#### 2. Exercise Recommendations
1. **Warm-up:** 5 minutes of dynamic joint mobility before resistance workouts.
2. **Real-time Form Monitoring:** Utilize the PhysioTrack vision engine with audio buzzer enabled to alert you on angular breakdown.
3. **Volume:** Perform 3 sets of 10 to 12 reps with strict 3-second eccentric tempo.

Feel free to ask about specific joint pains, exercise instructions, or recovery routines!"""
