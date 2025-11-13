import { useEffect, useState } from 'react';
import { getLogs } from '../lib/api';
import type { LogEntry } from '../types';

export function LogsTable() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getLogs();
      setLogs(response.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  if (loading) {
    return <div className="logs-loading">Loading logs...</div>;
  }

  if (error) {
    return (
      <div className="logs-error">
        <p>Error: {error}</p>
        <button onClick={fetchLogs} className="btn btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="logs-table">
      <div className="logs-header">
        <h2>Usage Logs</h2>
        <button onClick={fetchLogs} className="btn btn-secondary btn-sm">
          Refresh
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="logs-empty">No logs found.</div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Name</th>
                <th>Tableware</th>
                <th>Action</th>
                <th>Image</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, index) => (
                <tr key={`${log.timestamp}-${index}`}>
                  <td>{formatTimestamp(log.timestamp)}</td>
                  <td>{log.name}</td>
                  <td>{log.tableware}</td>
                  <td>
                    <span className={`action-badge ${log.action}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <img
                      src={log.image}
                      alt={`${log.name} - ${log.tableware}`}
                      className="log-thumbnail"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

