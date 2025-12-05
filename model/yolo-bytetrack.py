from ultralytics import YOLO
import cv2

model = YOLO("yolov8s.pt")

# Sink region
SINK_BOX = (300, 200, 700, 600)

def is_inside_sink(box, sink_box):
    x1, y1, x2, y2 = map(int, box)
    sx1, sy1, sx2, sy2 = sink_box
    cx = (x1 + x2) // 2
    cy = (y1 + y2) // 2
    return sx1 <= cx <= sx2 and sy1 <= cy <= sy2

track_history = {}
stability_frames = 5
confirmation_frames = 3

# Main loop
results = model.track(
    source=0,
    tracker="bytetrack.yaml",
    stream=True,
    show=False,      # IMPORTANT: disable YOLO window
    verbose=False
)

for frame_result in results:
    frame = frame_result.orig_img.copy()

    # Draw sink region (always visible)
    x1, y1, x2, y2 = SINK_BOX
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 255), 3)

    if frame_result.boxes is not None:
        boxes = frame_result.boxes.xyxy.cpu().numpy()
        ids = frame_result.boxes.id

        if ids is not None:
            ids = ids.cpu().numpy().astype(int)

            for box, tid in zip(boxes, ids):
                bx1, by1, bx2, by2 = map(int, box)

                # Draw YOLO box
                cv2.rectangle(frame, (bx1, by1), (bx2, by2), (0, 255, 0), 2)
                cv2.putText(frame, f"ID {tid}", (bx1, by1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                # Initialize new ID
                if tid not in track_history:
                    track_history[tid] = {
                        "frames_alive": 0,
                        "inside_frames": 0,
                        "state": "outside"
                    }

                h = track_history[tid]
                h["frames_alive"] += 1

                # Skip unstable tracks
                if h["frames_alive"] < stability_frames:
                    continue

                inside = is_inside_sink(box, SINK_BOX)

                if inside:
                    h["inside_frames"] += 1
                    if h["inside_frames"] == confirmation_frames and h["state"] == "outside":
                        print(f"ENTER: object {tid}")
                        h["state"] = "inside"

                else:
                    if h["state"] == "inside":
                        print(f"EXIT: object {tid}")
                    h["inside_frames"] = 0
                    h["state"] = "outside"

    # Show final custom-rendered frame
    cv2.imshow("Sink Monitor", frame)

    # Quit on Q
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cv2.destroyAllWindows()
