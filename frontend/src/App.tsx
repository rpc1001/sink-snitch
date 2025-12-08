import { useState } from 'react';
import './styles.css';
import { CapturePanel } from './components/CapturePanel';
import { LogsTable } from './components/LogsTable';

function App() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefreshClick = () => {
    setRefreshKey((key) => key + 1);
  };

  // 👉 NEW: called when a log is successfully added
  const handleLogAdded = () => {
    setRefreshKey((key) => key + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <div className="app-logo">
            <span>💧</span>
          </div>
          <div className="app-brand-text">
            <h1 className="app-title">SinkSnitch</h1>
            <p className="app-tagline">
              Keeping your kitchen accountable, one dish at a time
            </p>
          </div>
        </div>

        <button
          type="button"
          className="header-refresh-btn"
          onClick={handleRefreshClick}
        >
          <span className="header-refresh-icon">⟳</span>
          <span>Refresh</span>
        </button>
      </header>

      <main className="app-main">
        {/* LEFT: LOGS */}
        <section className="logs-column">
          <div className="column-header">
            <h2 className="column-title">Logs</h2>
          </div>
          <LogsTable refreshKey={refreshKey} />
        </section>

        {/* RIGHT: SINK CAM */}
        <section className="capture-column">
          <div className="column-header">
            <h2 className="column-title">Sink Cam</h2>
          </div>
          {/* 👇 pass the callback down */}
          <CapturePanel onLogAdded={handleLogAdded} />
        </section>
      </main>
    </div>
  );
}

export default App;
