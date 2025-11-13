# Sink Snitch Frontend

Frontend application for Sink Snitch - an AI-powered system for detecting dish neglect in shared living spaces.

## Features

- **Live Camera Capture**: Access webcam and capture snapshots
- **Dish Logging**: Submit log entries with name, tableware type, action (enter/exit), and captured image
- **Logs Viewer**: View all logged entries in a table format with timestamps and images

## Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Backend server running on `http://localhost:5000` (see [backend/README.md](../backend/README.md))

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

### Configuration

The frontend uses a Vite proxy to communicate with the backend API. The proxy is configured in `vite.config.ts` to forward `/api/*` requests to `http://localhost:5000`.

If you need to change the backend URL, you can:
- Modify the `target` in `vite.config.ts` server.proxy configuration
- Or use environment variables (see `.env.example`)

## Running

### Development Server

Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the next available port).

Make sure the backend server is running before using the frontend, as API calls will fail otherwise.

### Build for Production

Build the production bundle:
```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:
```bash
npm run preview
```

## Usage

1. **Start Camera**: Click "Start Camera" to access your webcam
2. **Capture Snapshot**: Click "Capture Snapshot" to take a photo
3. **Fill Form**: Enter name, select tableware type, and choose action (enter/exit)
4. **Submit**: Click "Submit Log Entry" to send the data to the backend
5. **View Logs**: Switch to the "Logs" tab to see all logged entries

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── CameraView.tsx      # Webcam component with capture functionality
│   │   ├── CapturePanel.tsx    # Form for logging dish usage
│   │   └── LogsTable.tsx       # Table displaying all logs
│   ├── lib/
│   │   └── api.ts              # API client functions
│   ├── types.ts                # TypeScript type definitions
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # Entry point
│   └── styles.css              # Global styles
├── index.html                  # HTML template
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration with proxy
└── README.md                   # This file
```

## API Integration

The frontend communicates with the backend API through the following endpoints:

- `POST /api/log_usage` - Submit a new log entry
- `GET /api/get_logs` - Retrieve all log entries

See [backend/README.md](../backend/README.md) for detailed API documentation.

## Browser Compatibility

- Modern browsers with support for:
  - ES2020 features
  - MediaDevices API (for camera access)
  - Fetch API

## Future Enhancements

- Video clip recording with MediaRecorder API
- Real-time dish tracking and detection
- Facial recognition integration
- Push notifications for dish violations

