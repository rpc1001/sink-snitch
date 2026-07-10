# Sink Snitch

Point a camera at your sink and it'll call out whoever leaves a dish sitting there
too long. A fine-tuned YOLOv8 model watches a region you draw over the sink, tracks
each dish, and once one has been sitting past your time limit it logs a violation,
saves a short clip, and drops a Discord message about it.

## How it works

- You draw the sink region on the live camera feed and set a time limit.
- The backend runs YOLOv8 detection with ByteTrack, so each dish keeps a stable ID
  frame to frame (even through brief occlusions).
- When a tracked dish stays in the region past the limit, it becomes a violation:
  a snapshot plus a clip (a couple seconds of pre-roll from a rolling buffer, then
  the moment it was left).
- Violations get posted to a Discord webhook and show up in the web UI.

## Stack

- **Backend** — Flask + Socket.IO, OpenCV for capture, Ultralytics YOLOv8, custom
  ByteTrack config. Live frames and controls go over websockets; violations, clips,
  and images are served over REST.
- **Frontend** — React + Vite + TypeScript with `react-player` for clips.
- **Model** — YOLOv8s fine-tuned on dish datasets from Roboflow. Training notebook
  is in `model/`.

## Running it

Backend:

```bash
cd backend
pip install -r requirements.txt
python app.py          # serves on :5001
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Set a Discord webhook from the UI (or leave it off) to get notified when someone
gets snitched on.
