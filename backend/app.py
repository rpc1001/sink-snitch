from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from datetime import datetime, timezone
from collections import deque
import json
import os
import time
import base64
import cv2
import requests

app = Flask(__name__)
CORS(app)
# socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')
# I switched to threading async mode bcuz I ran into eventlet compatibility issues on newer Python
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# ============== CONFIG ==============
LOG_FILE = "usage_logs.jsonl"
VIOLATIONS_FILE = "violations.jsonl"
CONFIG_FILE = "sink_config.json"
IMAGES_DIR = "violation_images"
VIDEO_CLIPS_DIR = "violation_clips"
NOTIFICATION_CONFIG_FILE = "notification_config.json"
DEFAULT_PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5001")
PRE_ROLL_SECONDS = 5
CLIP_FPS = 15
MAX_CLIP_SECONDS = 12  # keep clips small for Discord attachment limits
MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024  # Discord limit

# Timeouts
OCCLUSION_TIMEOUT = 120     # Keep "buried" objects in memory for 2 minutes
NORMAL_TIMEOUT = 5          # Forget objects outside the sink quickly (5 seconds)

# Create images directory
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(VIDEO_CLIPS_DIR, exist_ok=True)

# Global state
sink_region = None  # (x1, y1, x2, y2) in percentages (0-1)
camera_running = False
detection_enabled = False
model = None
model_loading = False
cap = None
current_frame = None  # Store current frame for violation snapshots

# Tracking state
tracked_objects = {}  # {track_id: {first_seen, last_seen, class, violation_logged, entry_image, box, last_in_sink}}
track_id_mapping = {}  # Maps new track IDs to existing ones if they overlap
VIOLATION_THRESHOLD = 20  # 20 seconds for testing (change to 30 * 60 for production)
IOU_MERGE_THRESHOLD = 0.9  # If IoU > this, consider it the same object (very strict)
video_buffer = deque(maxlen=int(PRE_ROLL_SECONDS * CLIP_FPS)) # Rolling buffer for video clips
active_clips = {}
last_buffer_time = 0.0
notification_config = {"webhook_url": None}

# ============== LOGGING ==============
def log_to_file(entry, filepath=LOG_FILE):
    with open(filepath, "a") as f:
        f.write(json.dumps(entry) + "\n")

def read_logs(filepath=LOG_FILE):
    if not os.path.exists(filepath):
        return []
    with open(filepath, "r") as f:
        return [json.loads(line.strip()) for line in f if line.strip()]

# ============== CONFIG MANAGEMENT ==============
def load_config():
    global sink_region
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                content = f.read().strip()
                if not content:
                    return sink_region
                config = json.loads(content)
                sink_region = config.get("sink_region")
        except json.JSONDecodeError:
            # Ignore malformed/empty config and keep default sink_region
            sink_region = None
    return sink_region

def save_config():
    config = {"sink_region": sink_region}
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f)

# ============== NOTIFICATION CONFIG ==============
def is_valid_discord_webhook(url: str) -> bool:
    if not isinstance(url, str):
        return False
    normalized = url.strip()
    return normalized.startswith("https://discord.com/api/webhooks/") or normalized.startswith("https://discordapp.com/api/webhooks/")

def load_notification_config():
    global notification_config
    if os.path.exists(NOTIFICATION_CONFIG_FILE):
        try:
            with open(NOTIFICATION_CONFIG_FILE, "r") as f:
                content = f.read().strip()
                if content:
                    notification_config = json.loads(content)
        except json.JSONDecodeError:
            notification_config = {"webhook_url": None}
    return notification_config

def save_notification_config():
    with open(NOTIFICATION_CONFIG_FILE, "w") as f:
        json.dump(notification_config, f)

def get_webhook_url():
    return notification_config.get("webhook_url")

# ============== DETECTION LOGIC ==============
def calculate_iou(box1, box2):
    """Calculate Intersection over Union between two boxes."""
    x1_1, y1_1, x2_1, y2_1 = box1
    x1_2, y1_2, x2_2, y2_2 = box2
    
    # Calculate intersection
    x1_i = max(x1_1, x1_2)
    y1_i = max(y1_1, y1_2)
    x2_i = min(x2_1, x2_2)
    y2_i = min(y2_1, y2_2)
    
    if x2_i < x1_i or y2_i < y1_i:
        return 0.0
    
    intersection = (x2_i - x1_i) * (y2_i - y1_i)
    
    # Calculate union
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0

def is_inside_sink(box, frame_shape):
    if sink_region is None:
        return False
    x1, y1, x2, y2 = float(box[0]), float(box[1]), float(box[2]), float(box[3])
    cx = (x1 + x2) / 2
    cy = (y1 + y2) / 2
    h, w = frame_shape[:2]
    sx1 = sink_region[0] * w
    sy1 = sink_region[1] * h
    sx2 = sink_region[2] * w
    sy2 = sink_region[3] * h
    return bool(sx1 <= cx <= sx2 and sy1 <= cy <= sy2)

def save_frame_as_image(frame, prefix, box=None, label=None):
    """Save a frame as a JPEG image with optional bounding box and return the filename."""
    if frame is None:
        return None
    
    # Make a copy to draw on
    img = frame.copy()
    
    # Draw bounding box if provided
    if box is not None:
        x1, y1, x2, y2 = box
        # Draw thick red rectangle
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 0, 255), 3)
        # Add label if provided
        if label:
            # Draw label background
            (text_width, text_height), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.7, 2)
            cv2.rectangle(img, (x1, y1 - text_height - 10), (x1 + text_width + 10, y1), (0, 0, 255), -1)
            cv2.putText(img, label, (x1 + 5, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    filename = f"{prefix}_{timestamp}.jpg"
    filepath = os.path.join(IMAGES_DIR, filename)
    cv2.imwrite(filepath, img)
    return filename

def frame_to_base64(frame):
    """Convert frame to base64 string."""
    if frame is None:
        return None
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return base64.b64encode(buffer).decode('utf-8')

# Video Clipping
def update_video_buffer(frame):
    """ Store frames in a rolling buffer so clips include pre-roll context """
    
    global last_buffer_time
    if frame is None:
        return
    current_time = time.time()
    if current_time - last_buffer_time >= 1.0 / CLIP_FPS:
        video_buffer.append(frame.copy())
        last_buffer_time = current_time

def start_clip_for_track(track_id):
    """ Send a clip with the buffer when a new object enters the sink. """

    if track_id in active_clips:
        return 
    active_clips[track_id] = {"frames": [f.copy() for f in video_buffer]}

def append_frame_to_clip(track_id, frame):
    """ Add the current frame to the active clip for a track. """

    if frame is None:
        return
    if track_id not in active_clips:
        start_clip_for_track(track_id)
    active_clips[track_id]["frames"].append(frame.copy())

def finalize_clip(track_id):
    """ Write a video clip to disk for a track that has violated. """

    clip = active_clips.get(track_id, None)
    if not clip or not clip.get("frames"):
        return None
    frames = clip["frames"]
    # Limit clip length to avoid oversized attachments (Discord 8MB)
    max_frames = int(CLIP_FPS * MAX_CLIP_SECONDS)
    if len(frames) > max_frames:
        frames = frames[-max_frames:]
    h, w = frames[0].shape[:2]

    # prefers H.264/avc1 for better browser compatibility but falls back to mp4v if unavailable
    fourcc_candidates = ['avc1', 'H264', 'mp4v']
    writer = None
    probe_path = os.path.join(VIDEO_CLIPS_DIR, ".codec_probe.mp4")
    for codec in fourcc_candidates:
        try:
            fourcc = cv2.VideoWriter_fourcc(*codec)
            writer = cv2.VideoWriter(probe_path, fourcc, CLIP_FPS, (w, h))
            if writer.isOpened():
                writer.release()
                break
        except Exception:
            writer = None
    if os.path.exists(probe_path):
        try:
            os.remove(probe_path)
        except OSError:
            pass
    # Uses the last computed fourcc even if probing failed, and VideoWriter will signal if it cant open
    fourcc = cv2.VideoWriter_fourcc(*fourcc_candidates[-1]) if writer is None else fourcc

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")
    filename = f"violation_{track_id}_{timestamp}.mp4"
    filepath = os.path.join(VIDEO_CLIPS_DIR, filename)
    writer = cv2.VideoWriter(filepath, fourcc, CLIP_FPS, (w, h))
    for f in frames:
        writer.write(f)
    writer.release()
    return filename

def delete_clip(track_id):
    """ Delete any in-progress clip for a track that exited without violation. """

    if track_id in active_clips:
        del active_clips[track_id]

# ============== NOTIFICATIONS ==============
def build_violation_links(violation):
    """Return (image_url, clip_url) for sharing externally."""
    base_url = os.environ.get("PUBLIC_BASE_URL", DEFAULT_PUBLIC_BASE_URL)
    image_url = None
    clip_url = None
    if violation.get("violation_image"):
        image_url = f"{base_url}/images/{violation['violation_image']}"
    if violation.get("violation_clip"):
        clip_url = f"{base_url}/clips/{violation['violation_clip']}"
    return image_url, clip_url

def send_discord_notification(violation):
    """Post a violation notification to Discord if a webhook is configured."""
    webhook_url = get_webhook_url()
    if not webhook_url:
        return

    image_url, clip_url = build_violation_links(violation)
    content = f"Dish violation: {violation.get('class', 'unknown')} in sink for {violation.get('duration_seconds', 0)}s ({violation.get('status', 'unknown')})."

    embed = {
        "title": "Sink Snitch Violation",
        "description": f"Object #{violation.get('track_id')} exceeded the allowed time in the sink.",
        "fields": [
            {"name": "Duration", "value": f"{violation.get('duration_seconds', 0)} seconds", "inline": True},
            {"name": "Status", "value": violation.get("status", "unknown"), "inline": True},
        ],
    }

    attachments = []
    attachment_files = []

    def attach_file(path, filename, mime):
        if not os.path.exists(path):
            return None
        try:
            size = os.path.getsize(path)
            if size > MAX_ATTACHMENT_BYTES:
                return None
        except OSError:
            return None
        try:
            f = open(path, "rb")
            attachment_files.append(f)
            idx = len(attachments)
            attachments.append((f"files[{idx}]", (filename, f, mime)))
            return f"attachment://{filename}"
        except Exception:
            return None

    # Try to attach image
    image_attachment_url = None
    if violation.get("violation_image"):
        img_path = os.path.join(IMAGES_DIR, violation["violation_image"])
        image_attachment_url = attach_file(img_path, violation["violation_image"], "image/jpeg")

    # Try to attach clip (ensure size/length constraints already enforced in finalize_clip)
    clip_attachment_url = None
    if violation.get("violation_clip"):
        clip_path = os.path.join(VIDEO_CLIPS_DIR, violation["violation_clip"])
        clip_attachment_url = attach_file(clip_path, violation["violation_clip"], "video/mp4")

    # Prefer attachments; fall back to hosted URLs
    final_image_url = image_attachment_url or image_url
    final_clip_url = clip_attachment_url or clip_url

    if final_image_url:
        embed["image"] = {"url": final_image_url}
    if final_clip_url:
        # Only set embed URL for http(s) links (Discord rejects attachment:// here)
        if final_clip_url.startswith("http"):
            embed["url"] = final_clip_url
        clip_label = final_clip_url if final_clip_url.startswith("http") else "Attached clip"
        embed.setdefault("fields", []).append({"name": "Clip", "value": clip_label, "inline": False})

    payload = {"content": content, "embeds": [embed]}

    try:
        if attachments:
            data = {"payload_json": json.dumps(payload)}
            resp = requests.post(webhook_url, data=data, files=attachments, timeout=10)
        else:
            resp = requests.post(webhook_url, json=payload, timeout=5)

        if resp.status_code >= 300:
            print(f"Discord webhook responded with {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"Discord webhook failed: {e}")
    finally:
        for f in attachment_files:
            try:
                f.close()
            except Exception:
                pass

def check_violations():
    global current_frame
    current_time = time.time()
    for track_id, data in list(tracked_objects.items()):
        duration = current_time - data["first_seen"]
        
        # Determine if the object is currently visible or occluded (hidden)
        time_since_last_seen = current_time - data["last_seen"]
        is_occluded = time_since_last_seen > 2.0 # If not seen for 2s, assume occluded

        if duration > VIOLATION_THRESHOLD and not data.get("violation_logged"):
            # Update label to indicate if it's buried
            status_str = "VIOLATION (OCCLUDED)" if is_occluded else "VIOLATION"
            
            # Save violation image with box (using last known position)
            box = data.get("box")
            violation_image = save_frame_as_image(
                current_frame, 
                f"violation_{track_id}",
                box=box,
                label=f"#{track_id} {data['class']} - {status_str} ({int(duration)}s)"
            )
            
            violation = {
                "id": f"{track_id}_{int(current_time)}",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "track_id": int(track_id),
                "class": str(data["class"]),
                "duration_seconds": int(duration),
                "entry_image": data.get("entry_image"),
                "violation_image": violation_image,
                "violation_clip": finalize_clip(track_id),
                "status": "occluded" if is_occluded else "visible"
            }
            log_to_file(violation, VIOLATIONS_FILE)
            tracked_objects[track_id]["violation_logged"] = True
            socketio.emit('violation', violation)
            # Send notification without blocking detection loop
            socketio.start_background_task(send_discord_notification, violation)
            print(f"Violation logged: {violation}")

def load_yolo_model():
    """Load YOLO model - called from background task."""
    global model, model_loading
    model_loading = True
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8s-world.pt")
        model.set_classes([
            "plate", "bowl", "cup", "mug", "glass",
            "pot", "pan", "frying pan", "saucepan",
            "fork", "spoon", "knife", "spatula",
            "bottle", "jar", "tupperware", "container",
            "cutting board", "colander", "strainer"
        ])
        print("YOLO model loaded successfully")
    except Exception as e:
        print(f"Failed to load YOLO model: {e}")
        model = None
    finally:
        model_loading = False

def run_camera_stream():
    """Background thread that streams camera, optionally with YOLO detection."""
    global camera_running, detection_enabled, model, tracked_objects, cap, current_frame
    
    try:
        cap = cv2.VideoCapture(0)
        if not cap.isOpened():
            socketio.emit('error', {"message": "Failed to open camera"})
            camera_running = False
            return
        
        socketio.emit('status', {"message": "Camera started", "camera_running": True, "detection_enabled": False})
        
        while camera_running:
            ret, frame = cap.read()
            if not ret:
                socketio.sleep(0.01)
                continue
            
            detections = []
            sink_time = 0
            tracked_list = []
            
            # Store current frame for violation snapshots
            current_frame = frame.copy()
            update_video_buffer(current_frame)
            
            # Run YOLO detection if enabled and model is loaded
            if detection_enabled and model is not None and sink_region is not None:
                # Use custom ByteTrack config for better tracking stability
                results = model.track(
                    frame, 
                    persist=True, 
                    conf=0.3,  # Higher confidence threshold
                    iou=0.5,   # NMS IoU threshold to reduce duplicates
                    verbose=False, 
                    tracker="custom_bytetrack.yaml"
                )
                current_time = time.time()
                active_ids = set()
                
                if results[0].boxes is not None and results[0].boxes.id is not None:
                    boxes = results[0].boxes.xyxy.cpu().numpy()
                    ids = results[0].boxes.id.cpu().numpy().astype(int)
                    confs = results[0].boxes.conf.cpu().numpy()
                    clss = results[0].boxes.cls.cpu().numpy().astype(int)
                    
                    for box, tid, conf, cls_id in zip(boxes, ids, confs, clss):
                        cls_id_int = int(cls_id)
                        class_name = model.names[cls_id_int]
                        x1, y1, x2, y2 = int(box[0]), int(box[1]), int(box[2]), int(box[3])
                        box_coords = (x1, y1, x2, y2)
                        in_sink = bool(is_inside_sink(box, frame.shape))
                        tid_int = int(tid)
                        
                        # Check if this track should be merged with an existing one
                        effective_tid = tid_int
                        if tid_int in track_id_mapping:
                            # Already mapped, use the mapped ID silently
                            effective_tid = track_id_mapping[tid_int]
                        elif in_sink and tid_int not in tracked_objects:
                            # Check if this new detection overlaps with existing tracked objects
                            for existing_tid, existing_data in tracked_objects.items():
                                if "box" in existing_data:
                                    iou = calculate_iou(box_coords, existing_data["box"])
                                    if iou > IOU_MERGE_THRESHOLD:
                                        # This is likely the same object with a new ID
                                        effective_tid = existing_tid
                                        track_id_mapping[tid_int] = existing_tid
                                        print(f"Merged track #{tid_int} -> #{existing_tid} (IoU={iou:.2f})")
                                        break
                        
                        detections.append({
                            "id": effective_tid,
                            "class": str(class_name),
                            "confidence": float(conf),
                            "box": [x1, y1, x2, y2],
                            "in_sink": in_sink
                        })
                        
                        if in_sink:
                            active_ids.add(effective_tid)
                            if not tracked_objects.get(effective_tid, {}).get("violation_logged"):
                                start_clip_for_track(effective_tid)
                                append_frame_to_clip(effective_tid, current_frame)
                                
                            if effective_tid not in tracked_objects:
                                # New object entering sink - save entry image with box
                                entry_image = save_frame_as_image(
                                    current_frame, 
                                    f"entry_{effective_tid}",
                                    box=box_coords,
                                    label=f"#{effective_tid} {class_name}"
                                )
                                tracked_objects[effective_tid] = {
                                    "first_seen": current_time,
                                    "last_seen": current_time,
                                    "class": str(class_name),
                                    "violation_logged": False,
                                    "entry_image": entry_image,
                                    "box": box_coords,
                                    "last_in_sink": True
                                }
                                print(f"New object #{effective_tid} ({class_name}) entered sink")
                            else:
                                tracked_objects[effective_tid]["last_seen"] = current_time
                                tracked_objects[effective_tid]["box"] = box_coords  # Update box position
                                tracked_objects[effective_tid]["last_in_sink"] = True # Confirmed inside sink
                        else:
                            # Detected but NOT in sink (e.g. removed or on counter)
                            if effective_tid in tracked_objects:
                                tracked_objects[effective_tid]["last_seen"] = current_time
                                tracked_objects[effective_tid]["box"] = box_coords
                                tracked_objects[effective_tid]["last_in_sink"] = False # Confirmed outside sink
                        
                        # Draw detection box with ID and time info
                        color = (0, 0, 255) if in_sink else (0, 255, 0)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                        
                        # Show ID, class, and time in sink if applicable
                        if in_sink and effective_tid in tracked_objects:
                            time_in_sink = int(current_time - tracked_objects[effective_tid]["first_seen"])
                            label = f"ID:{effective_tid} {class_name} ({time_in_sink}s)"
                        else:
                            label = f"ID:{effective_tid} {class_name}"
                        
                        cv2.putText(frame, label, (x1, y1 - 5), 
                                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # Cleanup old tracked objects (handling Occlusion)
                for stored_tid in list(tracked_objects.keys()):
                    if stored_tid not in active_ids:
                        # Time since this object was last seen by the camera
                        time_unseen = current_time - tracked_objects[stored_tid]["last_seen"]
                        
                        # If last seen in sink assume occluded, keep in memory for OCCLUSION_TIMEOUT
                        # if last seen outside the sink, forget it quickly
                        was_in_sink = tracked_objects[stored_tid].get("last_in_sink", False)
                        timeout_limit = OCCLUSION_TIMEOUT if was_in_sink else NORMAL_TIMEOUT
                        
                        if time_unseen > timeout_limit:
                            del tracked_objects[stored_tid]
                            # Also clean up any mappings to this track
                            for k, v in list(track_id_mapping.items()):
                                if v == stored_tid:
                                    del track_id_mapping[k]
                            delete_clip(stored_tid)
                            print(f"Forgot object #{stored_tid} (Unseen for {int(time_unseen)}s, in_sink={was_in_sink})")
                
                check_violations()
                
                # Build list of tracked objects with their times
                tracked_list = []
                if tracked_objects:
                    for tid, data in tracked_objects.items():
                        obj_time = int(current_time - data["first_seen"])
                        # Check if currently occluded
                        is_occluded = (current_time - data["last_seen"]) > 1.0
                        
                        tracked_list.append({
                            "id": int(tid),
                            "class": str(data["class"]),
                            "time_in_sink": obj_time,
                            "violation_logged": bool(data.get("violation_logged", False)),
                            "status": "occluded" if is_occluded else "visible"
                        })
                    oldest = min(data["first_seen"] for data in tracked_objects.values())
                    sink_time = int(current_time - oldest)
            
            # Draw sink region (only from backend to avoid double-drawing)
            if sink_region:
                h, w = frame.shape[:2]
                sx1, sy1 = int(sink_region[0] * w), int(sink_region[1] * h)
                sx2, sy2 = int(sink_region[2] * w), int(sink_region[3] * h)
                # Yellow when not detecting, green when detecting
                color = (0, 255, 0) if detection_enabled else (0, 255, 255)
                cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), color, 3)
                label = "DETECTING" if detection_enabled else "SINK AREA"
                cv2.putText(frame, label, (sx1 + 5, sy1 + 25), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
            
            # Encode and emit frame
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_b64 = base64.b64encode(buffer).decode('utf-8')
            
            # Include tracked_list only when detection is enabled
            tracked_info = tracked_list if detection_enabled else []
            
            socketio.emit('frame', {
                "image": f"data:image/jpeg;base64,{frame_b64}",
                "detections": detections,
                "sink_time": int(sink_time),
                "tracked_count": int(len(tracked_objects)),
                "detection_enabled": bool(detection_enabled),
                "tracked_objects": tracked_info
            })
            
            socketio.sleep(0.033)  # ~30 FPS
        
        cap.release()
        cap = None
        socketio.emit('status', {"message": "Camera stopped", "camera_running": False, "detection_enabled": False})
        
    except Exception as e:
        print(f"Camera error: {e}")
        socketio.emit('error', {"message": str(e)})
        camera_running = False
        if cap:
            cap.release()
            cap = None

# ============== REST ENDPOINTS ==============
@app.route("/log_usage", methods=["POST"])
def log_usage():
    data = request.get_json()
    required_fields = ["name", "tableware", "image", "action"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    if data["action"] not in ["enter", "exit"]:
        return jsonify({"error": "Action must be 'enter' or 'exit'"}), 400
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "name": data["name"],
        "tableware": data["tableware"],
        "image": data["image"],
        "action": data["action"]
    }
    log_to_file(entry)
    return jsonify({"status": "logged", "entry": entry}), 201

@app.route("/get_logs", methods=["GET"])
def get_logs():
    logs = read_logs()
    return jsonify({"count": len(logs), "records": logs}), 200

@app.route("/get_violations", methods=["GET"])
def get_violations():
    violations = read_logs(VIOLATIONS_FILE)
    return jsonify({"count": len(violations), "records": violations}), 200

@app.route("/violations/<violation_id>", methods=["DELETE"])
def delete_violation(violation_id):
    """
    Delete a violation from the JSONL file by its id.
    """
    if not os.path.exists(VIOLATIONS_FILE):
        return jsonify({"error": "No violations file"}), 404

    violations = read_logs(VIOLATIONS_FILE)
    remaining = [v for v in violations if str(v.get("id")) != str(violation_id)]

    if len(remaining) == len(violations):
        return jsonify({"error": "Violation not found"}), 404

    # Rewrite file without the deleted violation
    with open(VIOLATIONS_FILE, "w") as f:
        for v in remaining:
            f.write(json.dumps(v) + "\n")

    # Optionally notify any connected clients
    socketio.emit("violation_deleted", {"id": violation_id})

    return jsonify({"status": "deleted", "id": violation_id}), 200


@app.route("/sink_region", methods=["GET", "POST"])
def handle_sink_region():
    global sink_region
    if request.method == "GET":
        return jsonify({"sink_region": sink_region}), 200
    data = request.get_json()
    if "sink_region" not in data:
        return jsonify({"error": "Missing sink_region field"}), 400
    region = data["sink_region"]
    if region is not None:
        if not (isinstance(region, list) and len(region) == 4):
            return jsonify({"error": "sink_region must be [x1, y1, x2, y2] or null"}), 400
        if not all(0 <= v <= 1 for v in region):
            return jsonify({"error": "sink_region values must be between 0 and 1"}), 400
    sink_region = region
    save_config()
    return jsonify({"status": "updated", "sink_region": sink_region}), 200

@app.route("/notification/webhook", methods=["GET", "POST"])
def notification_webhook():
    if request.method == "GET":
        return jsonify({"configured": bool(get_webhook_url())}), 200

    data = request.get_json(silent=True) or {}
    url = data.get("webhook_url")

    if url is None or (isinstance(url, str) and not url.strip()):
        notification_config["webhook_url"] = None
        save_notification_config()
        return jsonify({"status": "cleared", "configured": False}), 200

    if not is_valid_discord_webhook(url):
        return jsonify({"error": "Invalid webhook URL"}), 400

    notification_config["webhook_url"] = url.strip()
    save_notification_config()
    return jsonify({"status": "saved", "configured": True}), 200

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

@app.route("/images/<filename>", methods=["GET"])
def serve_image(filename):
    """Serve violation images."""
    from flask import send_from_directory
    return send_from_directory(IMAGES_DIR, filename), 200

@app.route("/clips/<filename>", methods=["GET"])
def serve_clip(filename):
    """Serve violation video clips with proper streaming headers."""
    from flask import send_from_directory
    return send_from_directory(
        VIDEO_CLIPS_DIR,
        filename,
        mimetype="video/mp4",
        conditional=True
    )


# ============== WEBSOCKET EVENTS ==============
@socketio.on('connect')
def handle_connect():
    emit('status', {
        "message": "Connected to server", 
        "camera_running": camera_running, 
        "detection_enabled": detection_enabled
    })
    if sink_region:
        emit('sink_region', {"sink_region": sink_region})

@socketio.on('start_camera')
def handle_start_camera():
    global camera_running
    if camera_running:
        emit('status', {"message": "Camera already running", "camera_running": True, "detection_enabled": detection_enabled})
        return
    camera_running = True
    socketio.start_background_task(run_camera_stream)
    emit('status', {"message": "Starting camera...", "camera_running": True, "detection_enabled": False})

@socketio.on('stop_camera')
def handle_stop_camera():
    global camera_running, detection_enabled
    camera_running = False
    detection_enabled = False
    emit('status', {"message": "Stopping camera...", "camera_running": False, "detection_enabled": False})

@socketio.on('start_detection')
def handle_start_detection():
    global detection_enabled, model, tracked_objects, model_loading
    
    if not camera_running:
        emit('error', {"message": "Start the camera first"})
        return
    
    if sink_region is None:
        emit('error', {"message": "Please draw the sink region first"})
        return
    
    if detection_enabled:
        emit('status', {"message": "Detection already running", "camera_running": True, "detection_enabled": True})
        return
    
    if model_loading:
        emit('status', {"message": "Model is still loading, please wait...", "camera_running": True, "detection_enabled": False})
        return
    
    # Load model in background if not loaded
    if model is None:
        emit('status', {"message": "Loading YOLO model (this may take a moment)...", "camera_running": True, "detection_enabled": False})
        socketio.start_background_task(load_model_and_start_detection)
        return
    
    # Model already loaded, start detection immediately
    tracked_objects = {}
    detection_enabled = True
    emit('status', {"message": "Detection started", "camera_running": True, "detection_enabled": True})

def load_model_and_start_detection():
    """Background task to load model then enable detection."""
    global model, detection_enabled, tracked_objects, model_loading
    
    model_loading = True
    socketio.emit('status', {"message": "Loading YOLO model...", "camera_running": True, "detection_enabled": False})
    
    try:
        from ultralytics import YOLO
        # Use fine-tuned dish detector model
        model = YOLO("dish_detector.pt")
        print("Fine-tuned dish detector model loaded successfully")
        print(f"Model classes: {model.names}")
        
        # Now enable detection
        tracked_objects = {}
        track_id_mapping.clear()
        detection_enabled = True
        socketio.emit('status', {"message": "Detection started", "camera_running": True, "detection_enabled": True})
        
    except Exception as e:
        print(f"Failed to load YOLO model: {e}")
        socketio.emit('error', {"message": f"Failed to load model: {str(e)}"})
        model = None
    finally:
        model_loading = False

@socketio.on('stop_detection')
def handle_stop_detection():
    global detection_enabled, tracked_objects
    detection_enabled = False
    tracked_objects = {}
    track_id_mapping.clear()
    emit('status', {"message": "Detection stopped", "camera_running": camera_running, "detection_enabled": False})

@socketio.on('set_sink_region')
def handle_set_sink_region(data):
    global sink_region
    region = data.get("sink_region")
    if region is not None and (not isinstance(region, list) or len(region) != 4):
        emit('error', {"message": "Invalid sink region format"})
        return
    sink_region = region
    save_config()
    emit('sink_region', {"sink_region": sink_region}, broadcast=True)

# ============== STARTUP ==============
load_config()
load_notification_config()

if __name__ == "__main__":
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)
    