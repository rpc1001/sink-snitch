# Sink Snitch Backend

Backend for sink snitch that will likely focus on logging dish actions (possibly notifications), returning logs to frontend, and maybe post processing AI steps (like facial recognition).

- `POST /log_usage` → logs entries (name, tableware, image, action) to a file  
- `GET /get_logs` → retrieves all logged records as JSON  

Logs are stored locally in `usage_logs.jsonl`.


## Setup

### 1. Navigate to backend directory
```bash
cd backend
```

### 2. Create and activate a virtual environment
```bash
python -m venv venv
```
Activate it:

Windows:
```bash
.\venv\Scripts\activate
```
macOS/Linux:
```bash
source venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run Server
```bash
python app.py
```

API will be at url http://localhost:5000


## Endpoints

### 1. `POST /log_usage`

Logs a new usage entry.

Request body (JSON):
```
{
  "name": "Alice",
  "tableware": "Plate",
  "image": "base64string",
  "action": "enter"
}
```


Response (201 Created):
```
{
  "status": "logged",
  "entry": {
    "timestamp": "2025-11-12T12:34:56.789Z",
    "name": "Alice",
    "tableware": "Plate",
    "image": "base64string",
    "action": "enter"
  }
}
```

Example curl command:
```
curl -X POST http://127.0.0.1:5000/log_usage \
     -H "Content-Type: application/json" \
     -d "{\"name\":\"Alice\",\"tableware\":\"Plate\",\"image\":\"base64string\",\"action\":\"enter\"}"
```
### 2. `GET /get_logs`

Retrieves all stored log entries.

Response (200 OK):
```
{
  "count": 2,
  "records": [
    {
      "timestamp": "2025-11-12T12:34:56.789Z",
      "name": "Alice",
      "tableware": "Plate",
      "image": "base64string",
      "action": "enter"
    },
    {
      "timestamp": "2025-11-12T12:35:10.001Z",
      "name": "Bob",
      "tableware": "Cup",
      "image": "base64string",
      "action": "exit"
    }
  ]
}
```

Example curl command:

```curl http://127.0.0.1:5000/get_logs```
