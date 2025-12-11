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

API will be at url http://localhost:5001


### Environment

`PUBLIC_BASE_URL` (optional) — base URL used when constructing image/clip links in Discord notifications. Defaults to `http://localhost:5001`.
