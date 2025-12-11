import { useState, useEffect } from 'react';
import { LiveDetectionView } from './components/LiveDetectionView';
import { ViolationsPanel } from './components/ViolationsPanel';
import { NotificationSettings } from './components/NotificationSettings';
import { getSocket, disconnectSocket } from './lib/socket';
import type { Violation } from './types';
import './styles.css';

type Tab = 'live' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [violations, setViolations] = useState<Violation[]>([]);

  // Initialize socket connection on mount
  useEffect(() => {
    getSocket();
    return () => disconnectSocket();
  }, []);

  return (
    <div className="app">
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
            Refresh
          </button>
        </div>

        <nav className="app-tabs">
          <button
            className={`tab-button ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            Live Detection
          </button>
          <button
            className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'live' && (
          <div className="app-two-column">
            <section className="app-column app-column-left">
              <LiveDetectionView />
            </section>

            <section className="app-column app-column-right">
              <ViolationsPanel
                violations={violations}
                setViolations={setViolations}
              />
            </section>
          </div>
        )}

        {activeTab === 'settings' && <NotificationSettings />}
      </main>
    </div>
  );
}

export default App;
