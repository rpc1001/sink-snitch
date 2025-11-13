import { useState } from 'react';
import { CapturePanel } from './components/CapturePanel';
import { LogsTable } from './components/LogsTable';
import './styles.css';

function App() {
  const [activeTab, setActiveTab] = useState<'capture' | 'logs'>('capture');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Sink Snitch</h1>
        <nav className="app-nav">
          <button
            className={`nav-button ${activeTab === 'capture' ? 'active' : ''}`}
            onClick={() => setActiveTab('capture')}
          >
            Capture
          </button>
          <button
            className={`nav-button ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            Logs
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'capture' && <CapturePanel />}
        {activeTab === 'logs' && <LogsTable />}
      </main>
    </div>
  );
}

export default App;

