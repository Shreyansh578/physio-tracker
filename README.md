# PhysioTrack — Real-Time Physiotherapy Exercise Recognition

A full-stack web application that uses your webcam to track, recognize, and evaluate physiotherapy exercises with AI-powered body pose detection.

![PhysioTrack](https://img.shields.io/badge/Status-Ready-emerald) ![Python](https://img.shields.io/badge/Python-3.10+-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![MediaPipe](https://img.shields.io/badge/MediaPipe-Pose-green)

## Features

- 🎯 **Real-Time Pose Detection** — MediaPipe PoseLandmarker tracks 33 body landmarks in real-time
- 💪 **Exercise Recognition** — Supports Bicep Curls and Squats with angle-based state machines
- 📊 **Rep Counting** — Automatic repetition counting via state transitions
- ✅ **Form Correction** — Live feedback on posture mistakes (elbow flare, knee alignment, back angle)
- 🖥️ **Interactive HUD** — Skeleton overlay + heads-up display with reps, status, and feedback
- 📝 **Session History** — SQLite-backed session logging with post-workout summaries

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Backend | Python + FastAPI |
| AI/CV | MediaPipe Pose + OpenCV + NumPy |
| Database | SQLite (via aiosqlite) |
| Communication | WebSockets (real-time bidirectional) |

## Project Structure

```
physio-tracker/
├── backend/
│   ├── requirements.txt
│   ├── models/                    # MediaPipe model files (auto-downloaded)
│   ├── data/                      # SQLite database
│   └── app/
│       ├── main.py                # FastAPI app, routes, CORS
│       ├── pose_detector.py       # MediaPipe PoseLandmarker wrapper
│       ├── angle_utils.py         # Joint angle calculations
│       ├── exercises.py           # Bicep Curl + Squat state machines
│       ├── database.py            # Async SQLite operations
│       └── ws_handler.py          # WebSocket frame processing pipeline
├── frontend/
│   ├── package.json
│   ├── vite.config.ts             # Vite + Tailwind + API/WS proxy
│   └── src/
│       ├── App.tsx                # Routes: /, /session, /summary/:id
│       ├── pages/
│       │   ├── Dashboard.tsx      # Exercise selection + session history
│       │   ├── LiveSession.tsx    # Core webcam + tracking + HUD
│       │   └── SessionSummary.tsx # Post-workout report
│       ├── hooks/
│       │   ├── useWebSocket.ts    # WS lifecycle with auto-reconnect
│       │   └── useCamera.ts       # Camera access + frame capture
│       └── components/
│           ├── Layout.tsx         # App shell (sidebar + header)
│           ├── VideoFeed.tsx      # Annotated frame renderer
│           ├── HUD.tsx            # Overlay: reps, status, feedback
│           └── ExerciseCard.tsx   # Exercise selection card
└── README.md
```

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- A webcam

### 1. Backend Setup

```bash
# Navigate to backend
cd physio-tracker/backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download the MediaPipe Pose model (~30MB, auto-downloads on first start)
# Or manually:
mkdir -p models
wget -O models/pose_landmarker_heavy.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task

# Start the backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at `http://localhost:8000`.

### 2. Frontend Setup

```bash
# Navigate to frontend (in a new terminal)
cd physio-tracker/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 3. Start Exercising!

1. Open `http://localhost:5173` in Chrome or Firefox
2. Select an exercise (Bicep Curls or Squats)
3. Click **Start Workout**
4. Allow camera access when prompted
5. Position yourself so your full body is visible
6. Start exercising — watch the rep counter and form feedback!
7. Click **Stop Workout** to see your session summary

## How It Works

### Data Flow (per frame, ~100ms cycle)

```
Browser Camera → Canvas (10 FPS) → Base64 JPEG
    → WebSocket → FastAPI Backend
    → MediaPipe Pose (33 landmarks)
    → Angle Calculation (numpy.arctan2)
    → Exercise State Machine (UP/DOWN transitions)
    → Form Checks (elbow flare, knee position, back angle)
    → Skeleton Overlay (OpenCV drawing)
    → Base64 Annotated Frame + JSON Metrics
    → WebSocket → React Frontend → HUD Update
```

### Exercise Logic

**Bicep Curls:**
- Tracks elbow angle (shoulder → elbow → wrist)
- DOWN: angle > 160° | UP: angle < 40°
- Rep counted on UP → DOWN transition
- Form check: elbow drift from torso (shoulder-elbow-hip angle > 25°)

**Squats:**
- Tracks knee angle (hip → knee → ankle)
- DOWN: angle < 100° | UP: angle > 160°
- Rep counted on DOWN → UP transition
- Form checks: back straightness + knee-over-toes

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/{id}` | GET | Get session details |
| `/ws/video` | WebSocket | Real-time video processing |

### WebSocket Protocol

**Client → Server:**
```json
{ "frame": "<base64_jpeg>", "exercise": "bicep_curl" | "squat" }
```

**Server → Client:**
```json
{
  "rep_count": 5,
  "state": "UP",
  "feedback": ["Keep your elbow closer to your body"],
  "form_score": 0.7,
  "frame": "<base64_annotated_jpeg>"
}
```

## Browser Compatibility

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Fully supported |
| Firefox 90+ | ✅ Fully supported |
| Safari 15+ | ⚠️ Limited (MediaPipe WASM issues) |
| Edge 90+ | ✅ Fully supported |

## License

MIT
