# PhysioTrack: Technical Specification, Biomechanics & Architecture Defense

> **Project Title:** Interactive Real-Time Physiotherapy Exercise Recognition & Form Correction System  
> **Author:** Shreyansh Shukla  
> **Tech Stack:** Python 3.14, FastAPI, MediaPipe Pose (Tasks API), OpenCV, NumPy, SQLite (`aiosqlite`), React 18, TypeScript, Vite, Tailwind CSS v4  

---

## Table of Contents
1. [Project Overview & Problem Statement](#1-project-overview--problem-statement)
2. [Biomechanical Angle Formulations & Thresholds](#2-biomechanical-angle-formulations--thresholds)
   - [Angle Calculation Formula (Vectors & arctan2)](#angle-calculation-formula)
   - [Bicep Curl Biomechanics & Thresholds](#bicep-curl-biomechanics--thresholds)
   - [Squat Biomechanics & Thresholds](#squat-biomechanics--thresholds)
   - [Scientific Rationale: How These Thresholds Were Determined](#scientific-rationale)
3. [Data Architecture & Storage Rationale](#3-data-architecture--storage-rationale)
   - [Database Schema & Stored Attributes](#database-schema--stored-attributes)
   - [Why SQLite with aiosqlite?](#why-sqlite-with-aiosqlite)
4. [Tech Stack & System Design Rationale](#4-tech-stack--system-design-rationale)
   - [Why FastAPI for the Backend?](#why-fastapi-for-the-backend)
   - [Why React + TypeScript + Vite for the Frontend?](#why-react--typescript--vite-for-the-frontend)
   - [Why MediaPipe Pose Tasks API?](#why-mediapipe-pose-tasks-api)
   - [Video Pipeline: WebSockets vs WebRTC vs HTTP Polling](#video-pipeline-websockets-vs-webrtc-vs-http-polling)
5. [Instructor & Examiner Defense Q&A (Viva Preparation)](#5-instructor--examiner-defense-qa-viva-preparation)

---

## 1. Project Overview & Problem Statement

Physiotherapy patients performing exercises at home frequently suffer from:
1. **Incorrect Form / Compensatory Movements:** Leading to reinjury or lack of rehabilitation efficacy.
2. **Absence of Real-Time Feedback:** Patients must wait for weekly clinical visits to discover errors.
3. **Lack of Objective Progress Tracking:** Repetition count, range of motion (ROM), and form quality are rarely logged accurately.

**PhysioTrack** provides a zero-hardware-overhead, webcam-based solution that:
- Captures human posture at 10 frames per second using standard consumer webcams.
- Tracks 33 anatomical 3D landmarks using Google MediaPipe Pose.
- Computes real-time joint angles and runs deterministic finite state machines (FSM) to count repetitions.
- Evaluates kinematic deviations (e.g., elbow flaring, knee valgus / knees past toes, trunk lean) to produce a dynamic form score (0.0 - 1.0) with instantaneous corrective cues.
- Persists historical workout metrics into an asynchronous local database for longitudinal rehabilitation monitoring.

---

## 2. Biomechanical Angle Formulations & Thresholds

### Angle Calculation Formula

Angles between three anatomical landmarks $A$, $B$, and $C$ (where $B$ is the vertex joint) are computed in 2D normalized image space $(x, y) \in [0.0, 1.0]^2$ using vector trigonometry.

Given three points:
- $A = (x_A, y_A)$
- $B = (x_B, y_B)$ (Vertex)
- $C = (x_C, y_C)$

Vectors $\vec{BA}$ and $\vec{BC}$ are defined as:
$$\vec{BA} = (x_A - x_B, y_A - y_B)$$
$$\vec{BC} = (x_C - x_B, y_C - y_B)$$

The interior angle $\theta$ (in degrees) is calculated using the four-quadrant inverse tangent function ($\text{arctan2}$):
$$\theta = \left| \text{arctan2}(y_C - y_B, x_C - x_B) - \text{arctan2}(y_A - y_B, x_A - x_B) \right| \times \frac{180^\circ}{\pi}$$

If $\theta > 180^\circ$, it is normalized to the interior angle:
$$\theta = 360^\circ - \theta$$

**Why $\text{arctan2}$ instead of Dot Product ($\vec{u} \cdot \vec{v} = |\vec{u}||\vec{v}|\cos\theta$)?**
The dot product formula involves division by vector magnitudes and $\arccos()$. When points are close or float precision drifts, $\cos\theta$ can exceed $1.0$ or fall below $-1.0$, producing `NaN` domain errors. $\text{arctan2}(y, x)$ is numerically stable across all quadrants and never produces domain errors.

---

### Bicep Curl Biomechanics & Thresholds

#### 1. Landmark Triplet
- **Left Arm:** Shoulder ($11$), Elbow ($13$), Wrist ($15$)
- **Right Arm:** Shoulder ($12$), Elbow ($14$), Wrist ($16$)
- **Torso Anchor (Hip):** Left Hip ($23$), Right Hip ($24$)

#### 2. Robust Finite State Machine (Full-Cycle Verification)
To prevent accidental counts (e.g. sitting with bent arm at a desk and then straightening the hand), the system strictly enforces a **5-stage deterministic cycle**:

```
   [START / CALIBRATION]
            │
            ▼ (Arm extended downwards: θ ≥ 140°, wrist below elbow)
     [READY_DOWN]  ◄──────────────────────────────────────┐
            │                                             │
            ▼ (Concentric flexion: θ < 125°, wrist rising)│
     [CURLING_UP]                                         │
            │                                             │
            ▼ (Peak contraction: θ ≤ 65°, wrist > elbow) │
       [PEAK_UP]                                          │ (Rep Count + 1
            │                                             │  ONLY if peak
            ▼ (Eccentric extension: θ > 85°)             │  was achieved)
       [LOWERING] ────────────────────────────────────────┘
```

1. **`START`:** The user initializes. **No reps can ever count from `START`!**
2. **`READY_DOWN` (Baseline Priming):** Requires elbow angle $\theta_{\text{elbow}} \ge 140^\circ$ and $y_{\text{wrist}} > y_{\text{elbow}} - 0.04$ for at least 2 consecutive frames. This confirms the arm is straight and extended.
3. **`CURLING_UP`:** Arm flexes upward ($\theta_{\text{elbow}} < 125^\circ$). If the user lowers their arm without reaching peak, the cycle resets cleanly with an *"Incomplete rep"* warning and **no rep is counted**.
4. **`PEAK_UP`:** Full contraction achieved ($\theta_{\text{elbow}} \le 65^\circ$ with $y_{\text{wrist}} < y_{\text{elbow}} - 0.04$).
5. **`LOWERING`:** Controlled eccentric descent ($\theta_{\text{elbow}} > 85^\circ$).
6. **Rep Completion:** Re-entering $\theta_{\text{elbow}} \ge 140^\circ$ registers $+1$ repetition only if `peak_reached == True` and rep duration $\ge 0.85\text{s}$.

#### 3. Real-Time Form Analysis & Penalties
- **Elbow Flare Out (Abduction):**
  - Measures angle $\angle(\text{Elbow}, \text{Shoulder}, \text{Hip})$ at the shoulder.
  - **Threshold:** $> 28^\circ$.
  - **Cue:** ⚠️ *"Keep elbow tucked close to your torso"*
  - **Visual:** Offending elbow turns red on skeleton. Penalty: $-0.25$.
- **Torso Sway / Lower-Back Cheating:**
  - Measures the tilt angle of the spine vector $(\text{Shoulder} - \text{Hip})$ from the vertical axis.
  - **Threshold:** $> 16^\circ$ deviation during concentric curl.
  - **Cue:** ⚠️ *"Avoid swinging your torso — maintain strict upright posture"*
  - **Visual:** Spine / torso line turns red. Penalty: $-0.30$.
- **Incomplete Range of Motion:**
  - Abandoning curl before $\le 65^\circ$ or failing to extend to $\ge 140^\circ$.
  - **Cue:** ⚠️ *"Incomplete rep — squeeze at peak and extend fully"*
- **Movement Cadence:**
  - Total rep cycle $< 1.0\text{s}$ flags jerky momentum lifting.
  - **Cue:** ⚠️ *"Slow down for controlled muscle activation"*

---

### Squat Biomechanics & Thresholds

#### 1. Landmark Triplet
- **Left Leg:** Hip ($23$), Knee ($25$), Ankle ($27$)
- **Right Leg:** Hip ($24$), Knee ($26$), Ankle ($28$)
- **Torso Anchor (Shoulder):** Left Shoulder ($11$), Right Shoulder ($12$)

#### 2. Robust Finite State Machine
- **`READY_STAND`:** Both knees $\theta_{\text{knee}} \ge 150^\circ$, hips positioned vertically above knees.
- **`SQUATTING_DOWN`:** Knees bending ($\theta_{\text{knee}} < 145^\circ$), hips sinking down.
- **`SQUAT_DEPTH`:** Functional clinical depth achieved ($\theta_{\text{knee}} \le 118^\circ$).
- **`DRIVING_UP`:** Ascending through heels ($\theta_{\text{knee}} > 125^\circ$).
- **Rep Completion:** Returning to standing lockout ($\ge 148^\circ$) after achieving depth with duration $\ge 0.9\text{s}$.

#### 3. Real-Time Form Analysis & Penalties
- **Excessive Forward Trunk Lean (Chest Down):**
  - Evaluates torso tilt from vertical axis: $> 36^\circ$ while squatting.
  - **Cue:** ⚠️ *"Chest up! Avoid bending too far forward at the waist"*
  - **Biomechanical Justification:** Protects $L4-L5/S1$ lumbar vertebrae from shear forces. Penalty: $-0.30$.
- **Knees Past Toes (Anterior Knee Shear):**
  - Measures horizontal displacement of knee past ankle: $\Delta x_{\text{knee-ankle}} > 0.08$ when $\theta_{\text{knee}} < 130^\circ$.
  - **Cue:** ⚠️ *"Push hips back — prevent knees driving past toes"*
  - **Biomechanical Justification:** Alleviates patellofemoral compressive stress. Penalty: $-0.25$.
- **Shallow Squat Depth:**
  - Ascending before reaching $\le 118^\circ$ knee flexion.
  - **Cue:** ⚠️ *"Incomplete squat — squat deeper to parallel"*

---

### Scientific Rationale: How These Thresholds Were Determined

| Parameter | Clinical Textbook Value | Our Calibration | Engineering & Biomechanical Rationale |
|---|---|---|---|
| **Bicep Curl Full Flexion (UP)** | $35^\circ - 45^\circ$ | **$< 70^\circ$** | In a clinical laboratory with goniometers, direct skin contact allows measuring $< 45^\circ$. However, in front of consumer 2D webcams: (1) clothing adds bulk, (2) users sit or stand with slight perspective foreshortening, and (3) $65^\circ - 70^\circ$ captures peak concentric bicep contraction without requiring wrist-to-shoulder hyperextension. |
| **Bicep Curl Full Extension (DOWN)** | $160^\circ - 180^\circ$ | **$> 135^\circ$** | Forcing patients to reach $> 160^\circ$ can cause hyperextension injury in rehabilitation patients with tight bicep tendons or olecranon impingement. $> 135^\circ$ ensures eccentric control while preventing joint locking. |
| **Squat Depth (DOWN)** | $90^\circ$ (Parallel) | **$< 120^\circ$** | Physical therapy rehabilitation (post-ACL reconstruction, patellar tendonitis, elderly mobility) targets **quarter and half squats** ($100^\circ - 120^\circ$). Full $90^\circ$ squats are contraindicated in early rehabilitation phases. |
| **Squat Standing (UP)** | $175^\circ - 180^\circ$ | **$> 145^\circ$** | Accommodates users who do not fully hyperextend/lock their knees when returning to an upright standing posture. |
| **Debounce Timers** | None | **$0.4\text{s} - 0.5\text{s}$** | Digital video frames occasionally exhibit landmark jitter near boundary thresholds ($134^\circ \leftrightarrow 136^\circ$). A time debounce ensures a rep cannot be multi-counted on consecutive milliseconds. |

---

## 3. Data Architecture & Storage Rationale

### Database Schema & Stored Attributes

Database file location: `backend/data/physio.db` (SQLite 3).

```sql
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    exercise_type TEXT NOT NULL,
    total_reps INTEGER DEFAULT 0,
    avg_form_score REAL DEFAULT 0.0,
    feedback_log TEXT DEFAULT '[]'
);
```

#### Fields Breakdown:
- **`id`**: Unique integer session identifier.
- **`started_at` / `ended_at`**: ISO 8601 UTC timestamps (enables workout duration computation).
- **`exercise_type`**: Identifier (`bicep_curl` or `squat`).
- **`total_reps`**: Cumulative valid repetitions completed during the workout session.
- **`avg_form_score`**: Mean kinematic form compliance score ($0.0 - 1.0$), updated dynamically as:
  $$\text{avg\_score} = \frac{1}{N} \sum_{i=1}^{N} \text{form\_score}_i$$
- **`feedback_log`**: Serialized JSON array of unique corrective feedback cues triggered during the workout (e.g., `["Keep your elbow closer to your body"]`), allowing post-workout clinical review.

---

### Why SQLite with `aiosqlite`?

1. **Embedded & Zero-Configuration:**
   - No external database server (like PostgreSQL or MySQL) needs to be installed, authenticated, or maintained on the host system. The application is completely turnkey.
2. **True Non-Blocking Asynchronous I/O (`aiosqlite`):**
   - Standard Python `sqlite3` makes synchronous blocking system calls. In an async FastAPI event loop processing video frames at $10\text{ FPS}$, a blocking database query would freeze WebSocket frame processing for other coroutines. `aiosqlite` offloads queries to an async worker thread pool.
3. **Atomic Transactions (ACID):**
   - Session finalization happens in the `finally:` block of the WebSocket lifecycle. SQLite's write-ahead log (WAL) guarantees that interrupted or closed connections never leave corrupt session data.
4. **Data Privacy & Healthcare Compliance (HIPAA / GDPR Principles):**
   - Physiotherapy video and pose metrics constitute sensitive biometric health data. Storing data locally on edge hardware ensures user records never leave the client device without explicit patient consent.

---

## 4. Tech Stack & System Design Rationale

### Why FastAPI for the Backend?

1. **Native Async WebSockets (ASGI Standard):**
   - Traditional frameworks (Flask, Django WSGI) are synchronous by default; handling persistent, low-latency duplex streaming requires complicated thread pools or Celery/Redis backends. FastAPI runs on **Uvicorn / Starlette**, supporting native async coroutines (`async def`) that handle WebSocket duplex streaming with sub-millisecond overhead.
2. **Python Ecosystem Domination in Computer Vision:**
   - MediaPipe, OpenCV (`cv2`), and NumPy are native C++ libraries with first-class Python bindings. Running the computer vision engine directly in Python eliminates inter-process serialization overhead.
3. **Automatic OpenAPI/Swagger Documentation:**
   - Every REST endpoint (`/api/sessions`, `/api/sessions/{id}`) has auto-generated interactive documentation at `/docs`.

---

### Why React + TypeScript + Vite for the Frontend?

1. **Vite vs Create-React-App / Webpack:**
   - Vite utilizes native browser ES modules (ESM) and the ultra-fast Go-based `esbuild` compiler. Dev server start takes **250ms** (compared to 15-30s for Webpack), and Hot Module Replacement (HMR) is near-instant.
2. **Hardware-Accelerated HTML5 Video & Canvas:**
   - React's `useRef` provides direct access to the DOM `<video>` and `<canvas>` elements. Frames are rendered with GPU acceleration, bypassing React's virtual DOM reconciliation for raw image pixels to maintain 60 FPS UI rendering.
3. **Type Safety with TypeScript:**
   - WebSocket JSON payloads, landmark coordinates, and session objects are strongly typed with interfaces, eliminating runtime `undefined` errors during presentations.
4. **Tailwind CSS v4:**
   - Uses zero-runtime CSS compilation, resulting in ultra-compact bundles ($35\text{KB}$) with modern fitness-app dark aesthetics and responsive layouts.

---

### Why MediaPipe Pose Tasks API?

1. **Modern Tasks API vs Legacy `mp.solutions.pose`:**
   - Google deprecated the legacy Python solutions in favor of the **MediaPipe Tasks Vision API** (`PoseLandmarker`).
   - The Tasks API utilizes the `pose_landmarker_heavy.task` model bundle ($29.2\text{ MB}$), providing superior 3D keypoint depth accuracy over the older BlazePose models.
2. **`RunningMode.VIDEO` Temporal Smoothing:**
   - Unlike static image detection (`RunningMode.IMAGE`), `RunningMode.VIDEO` takes strictly increasing timestamps (`timestamp_ms`), allowing the model's internal Kalman filters to track landmarks across frames. This virtually eliminates pose flicker and jitter.
3. **33 3D Keypoints:**
   - Maps full-body joints with $(x, y, z)$ coordinates and visibility scores, enabling automatic limb occlusion detection (e.g., automatically identifying whether the user is facing left or right).

---

### Video Pipeline: WebSockets vs WebRTC vs HTTP Polling

| Feature | HTTP REST Polling | WebRTC | **WebSocket (Our Choice)** |
|---|---|---|---|
| **Latency** | High ($500\text{ms} - 2000\text{ms}$) | Ultra-low ($20\text{ms} - 50\text{ms}$) | **Low ($30\text{ms} - 80\text{ms}$)** |
| **Complexity** | Low | High (requires STUN/TURN, SDP signaling) | **Balanced & Lightweight** |
| **Bi-directional Data** | No | Peer-to-peer data channels | **Full-Duplex single TCP connection** |
| **Protocol Overhead** | Repeated HTTP headers | RTP / SRTP packets | **Minimal framing (2 bytes header)** |

**Decision:** WebRTC is designed for peer-to-peer video conferencing between browsers and adds immense architectural overhead (STUN/TURN servers, ICE candidates). WebSockets provide full-duplex TCP streaming with sub-$50\text{ms}$ local latency, allowing synchronous transmission of base64 video frames and bidirectional telemetry (reps, angles, feedback) over a single persistent socket.

---

## 5. Instructor & Examiner Defense Q&A (Viva Preparation)

### Q1: "Why do you send frames from the frontend to the backend instead of running MediaPipe directly in the browser via JavaScript?"
> **Answer:**  
> "Running MediaPipe client-side in JavaScript uses WebAssembly (Wasm) or WebGL, which consumes substantial CPU and battery power on the client's laptop, frequently causing thermal throttling and frame drops.  
> By streaming frames to a Python FastAPI backend:
> 1. We keep the client device lightweight, responsive, and compatible with low-end laptops or mobile tablets.
> 2. The Python backend has direct access to high-performance C++ binaries (OpenCV, TFLite XNNPACK delegates, NumPy).
> 3. Exercise logic, proprietary kinematic algorithms, and clinical datasets remain secure on the server rather than exposed in client-side JavaScript bundles."

---

### Q2: "What happens if a user stands too close to the camera and their legs or hips are not visible?"
> **Answer:**  
> "Our implementation in `exercises.py` includes landmark visibility checking using `_get_visibility()` on every frame.  
> If key anatomical landmarks are missing or their visibility score falls below $0.3$, the state machine gracefully avoids false computations:
> - For Bicep Curls: If hip landmarks are out of frame, the system skips elbow-flare penalties rather than penalizing the user, focusing strictly on shoulder-elbow-wrist flexion.
> - For Squats: If fewer than 29 landmarks are detected, the system outputs `'Subject not fully visible'` and instructs the user to step back so their legs are in frame."

---

### Q3: "Why did you choose 10 FPS for video frame capture instead of 30 or 60 FPS?"
> **Answer:**  
> "Human athletic and physiotherapy movements have a typical cycle period of $1.5\text{ to }3.0\text{ seconds}$ per repetition. At $10\text{ FPS}$ ($100\text{ms}$ sampling period), a 2-second bicep curl provides 20 distinct kinematic sample points, which is more than sufficient to detect the minimum and maximum inflection angles.  
> Capturing at 10 FPS reduces network bandwidth and JSON payload serialization by $66\%$ compared to 30 FPS, preventing WebSocket buffer bloat while ensuring instantaneous sub-$50\text{ms}$ feedback response times."

---

### Q4: "How does the system prevent false repetitions caused by camera shaking or small fidgeting movements?"
> **Answer:**  
> "We implement three distinct layers of filtering:
> 1. **Temporal State Machine (FSM):** A repetition cannot increment until the user has proven entry into both the extrema states (e.g., for curls: fully reaching $\text{UP} < 70^\circ$, followed by returning to $\text{DOWN} > 135^\circ$).
> 2. **State Transition Cooldown (Debounce):** We enforce an explicit time threshold (`now - self._last_rep_time > 0.4s`) ensuring that high-frequency sensor noise cannot trigger multi-counting within fractional seconds.
> 3. **MediaPipe VIDEO Mode:** Temporal tracking with monotonically increasing timestamps (`timestamp_ms`) uses internal exponential smoothing and Kalman filtering on landmark coordinates."

---

### Q5: "How does the application know whether the user is curling their left arm or right arm?"
> **Answer:**  
> "Earlier naive implementations picked whichever arm had a higher visibility score, which broke if the user curled the other arm.  
> Our current implementation in `exercises.py` tracks **both arms simultaneously**:
> - It calculates $\theta_{\text{left}}$ and $\theta_{\text{right}}$ independently.
> - Each arm maintains its own independent state tracker (`_left_state` and `_right_state`).
> - The active angle displayed on the HUD dynamically tracks whichever arm is actively flexed (`min(left_angle, right_angle)`).
> - This architecture flawlessly supports single-arm curls (left or right), alternating curls, and bilateral simultaneous curls without requiring the user to configure settings."

---

### Q6: "What are the limitations of 2D camera pose estimation, and how would you extend this in the future?"
> **Answer:**  
> "The primary limitation of standard 2D webcam analysis is **perspective foreshortening**: if a user does not face perpendicular or parallel to the camera, angles projected onto the 2D image plane appear smaller or larger than the true 3D anatomical angle.  
> In future iterations, we can extend the system by:
> 1. Utilizing MediaPipe's `pose_world_landmarks` (which output metric 3D coordinates in meters centered at the pelvis).
> 2. Adding camera calibration matrices using OpenCV to calculate the user's angle of incidence.
> 3. Integrating audio feedback synthesis (Web Speech API) so patients don't have to look at the screen while performing exercises."
