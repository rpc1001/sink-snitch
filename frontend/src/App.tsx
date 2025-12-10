import { useState, useEffect } from 'react';
import { CapturePanel } from './components/CapturePanel';
import { LogsTable } from './components/LogsTable';
import { LiveDetectionView } from './components/LiveDetectionView';
import { ViolationsPanel } from './components/ViolationsPanel';
import { NotificationSettings } from './components/NotificationSettings';
import { getSocket, disconnectSocket } from './lib/socket';
import type { Violation } from './types';
import './styles.css';

type Tab = 'live' | 'capture' | 'logs' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('live');

  // 🔥 Shared violation list for EVERY page
  const [violations, setViolations] = useState<Violation[]>([]);

  // Initialize socket connection on mount
  useEffect(() => {
    getSocket();
    return () => disconnectSocket();
  }, []);

  return (
    <div className="app">
      {/* ---------------- TOP HEADER / NAV ---------------- */}
      <header className="app-header">
        <div className="app-header-top">
          <div className="app-brand">
            <div className="app-logo-icon">
              <span>💧</span>
            </div>
            <div className="app-brand-text">
              <h1 className="app-title">SinkSnitch</h1>
              <p className="app-subtitle">
                Keeping your kitchen accountable, one dish at a time
              </p>
            </div>
          </div>

          <button
            className="refresh-button"
            onClick={() => window.location.reload()}
          >
            ⟳ Refresh
          </button>
        </div>

        {/* ---------------- TAB NAVIGATION ---------------- */}
        <nav className="app-tabs">
          <button
            className={`tab-button ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            Live Detection
          </button>

          <button
            className={`tab-button ${activeTab === 'capture' ? 'active' : ''}`}
            onClick={() => setActiveTab('capture')}
          >
            Manual Log
          </button>

          <button
            className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            All Logs
          </button>
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      {/* ---------------- PAGE CONTENT ---------------- */}
      <main className="app-main">

        {/* ========== LIVE DETECTION PAGE (2 columns) ========== */}
        {activeTab === 'live' && (
          <div className="app-two-column">
            <section className="app-column app-column-left">
              <LiveDetectionView />
            </section>

            <section className="app-column app-column-right">
              {/* Pass shared violation list */}
              <ViolationsPanel
                violations={violations}
                setViolations={setViolations}
              />
            </section>
          </div>
        )}

        {/* ========== MANUAL LOG PAGE ========== */}
        {activeTab === 'capture' && (
          <CapturePanel
            onNewViolation={(v: Violation) =>
              setViolations(prev => [v, ...prev])
            }
          />
        )}

        {/* ========== ALL LOGS PAGE ========== */}
        {activeTab === 'logs' && <LogsTable />}
        {activeTab === 'settings' && <NotificationSettings />}
      </main>
    </div>
  );
}

export default App;
