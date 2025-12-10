import { useState, useEffect } from 'react';
import { CapturePanel } from './components/CapturePanel';
import { LogsTable } from './components/LogsTable';
import { LiveDetectionView } from './components/LiveDetectionView';
import { ViolationsPanel } from './components/ViolationsPanel';
import { NotificationSettings } from './components/NotificationSettings';
import { getSocket, disconnectSocket } from './lib/socket';
import './styles.css';

type Tab = 'live' | 'capture' | 'logs' | 'violations' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('live');

  // Initialize socket connection on mount
  useEffect(() => {
    getSocket();
    return () => disconnectSocket();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sink Snitch</h1>
        <nav className="app-nav">
          <button
            className={`nav-button ${activeTab === 'live' ? 'active' : ''}`}
            onClick={() => setActiveTab('live')}
          >
            Live Detection
          </button>
          <button
            className={`nav-button ${activeTab === 'violations' ? 'active' : ''}`}
            onClick={() => setActiveTab('violations')}
          >
            Violations
          </button>
          <button
            className={`nav-button ${activeTab === 'capture' ? 'active' : ''}`}
            onClick={() => setActiveTab('capture')}
          >
            Manual Log
          </button>
          <button
            className={`nav-button ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            All Logs
          </button>
          <button
            className={`nav-button ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </nav>
      </header>

      <main className="app-main">
        {/* Keep LiveDetectionView mounted but hidden to maintain camera/tracking state */}
        <div style={{ display: activeTab === 'live' ? 'block' : 'none' }}>
          <LiveDetectionView />
        </div>
        <div style={{ display: activeTab === 'violations' ? 'block' : 'none' }}>
          <ViolationsPanel />
        </div>
        {activeTab === 'capture' && <CapturePanel />}
        {activeTab === 'logs' && <LogsTable />}
        {activeTab === 'settings' && <NotificationSettings />}
      </main>
    </div>
  );
}

export default App;
