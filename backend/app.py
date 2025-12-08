from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
import json
import os

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

LOG_FILE = "usage_logs.jsonl"  # JSON Lines format (one JSON per line)


def log_to_file(entry):
    """Append a dictionary entry to the log file."""
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(entry) + "\n")


def read_logs():
    """Read all log entries."""
    if not os.path.exists(LOG_FILE):
        return []
    with open(LOG_FILE, "r") as f:
        return [json.loads(line.strip()) for line in f if line.strip()]


def write_logs(entries):
    """Overwrite the log file with the given list of entries."""
    with open(LOG_FILE, "w") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")


@app.route("/api/log_usage", methods=["POST"])
def log_usage():
    """Logs a usage entry."""
    data = request.get_json() or {}

    required_fields = ["name", "tableware", "image", "action"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    if data.get("action") not in ["enter", "exit"]:
        return jsonify({"error": "Action must be 'enter' or 'exit'"}), 400

    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "name": data["name"],
        "tableware": data["tableware"],
        "image": data["image"],
        "action": data["action"],
    }

    log_to_file(entry)
    return jsonify({"status": "logged", "entry": entry}), 201


@app.route("/api/get_logs", methods=["GET"])
def get_logs():
    """Returns all logged entries."""
    logs = read_logs()
    return jsonify({"count": len(logs), "records": logs}), 200


@app.route("/api/delete_log", methods=["POST"])
def delete_log():
    """Delete a single log entry by timestamp."""
    data = request.get_json() or {}
    ts = data.get("timestamp")

    if not ts:
        return jsonify({"error": "Missing 'timestamp' field"}), 400

    logs = read_logs()
    remaining = [entry for entry in logs if entry.get("timestamp") != ts]

    if len(remaining) == len(logs):
        # No entry matched that timestamp
        return jsonify({"error": "Log entry not found"}), 404

    write_logs(remaining)
    return jsonify(
        {"status": "deleted", "timestamp": ts, "remaining": len(remaining)}
    ), 200


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Backend is running"}), 200


if __name__ == "__main__":
    app.run(debug=True)
