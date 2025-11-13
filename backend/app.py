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


@app.route("/log_usage", methods=["POST"])
def log_usage():
    """Logs a usage entry."""
    data = request.get_json()

    required_fields = ["name", "tableware", "image", "action"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    if data["action"] not in ["enter", "exit"]:
        return jsonify({"error": "Action must be 'enter' or 'exit'"}), 400

    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "name": data["name"],
        "tableware": data["tableware"],
        "image": data["image"],
        "action": data["action"]
    }

    log_to_file(entry)
    return jsonify({"status": "logged", "entry": entry}), 201


@app.route("/get_logs", methods=["GET"])
def get_logs():
    """Returns all logged entries."""
    logs = read_logs()
    return jsonify({"count": len(logs), "records": logs}), 200


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok", "message": "Backend is running"}), 200


if __name__ == "__main__":
    app.run(debug=True)
