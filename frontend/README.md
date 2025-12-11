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
- Backend server running on `http://localhost:5001` (see [backend/README.md](../backend/README.md))

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

The frontend uses a Vite proxy to communicate with the backend API. The proxy is configured in `vite.config.ts` to forward `/api/*` requests to `http://localhost:5001`.

If you need to change the backend URL, you can:
- Modify the `target` in `vite.config.ts` server.proxy configuration (defaults to `http://localhost:5001`)
- Or use environment variables (see `.env.example` with `VITE_API_BASE_URL`)

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