import { useEffect, useState } from 'react';
import { getLogs, deleteLog } from '../lib/api';
import type { LogEntry } from '../types';

type ViewFilter = 'active' | 'resolved' | 'all';

interface LogsTableProps {
  refreshKey: number;
}

export function LogsTable({ refreshKey }: LogsTableProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewFilter, setViewFilter] = useState<ViewFilter>('active');
  const [deletingTs, setDeletingTs] = useState<string | null>(null);

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

  // Fetch logs on mount and whenever refreshKey changes
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const handleDelete = async (timestamp: string) => {
    const confirmDelete = window.confirm(
      'Delete this log entry? This cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
      setDeletingTs(timestamp);
      await deleteLog(timestamp);
      // Remove from local state
      setLogs((prev) => prev.filter((log) => log.timestamp !== timestamp));
    } catch (err) {
      console.error('Error deleting log:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to delete log entry'
      );
    } finally {
      setDeletingTs(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const hoursSince = (timestamp: string) => {
    const then = new Date(timestamp).getTime();
    if (Number.isNaN(then)) return 0;
    const now = Date.now();
    return (now - then) / (1000 * 60 * 60);
  };

  const formatTimeAgo = (timestamp: string) => {
    const h = hoursSince(timestamp);
    if (h <= 0) return 'just now';
    if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
    if (h < 24) return `${h.toFixed(1)}h ago`;
    return `${(h / 24).toFixed(1)}d ago`;
  };

  const filteredLogs = logs.filter((log) => {
    if (viewFilter === 'active') return log.action === 'enter';
    if (viewFilter === 'resolved') return log.action === 'exit';
    return true;
  });

  return (
    <div className="logs-page">
      {/* Section header + tabs */}
      <div className="logs-section-header" style={{ marginTop: '0.5rem' }}>
        <h3>Dish Violations</h3>
        <div className="logs-filter-tabs">
          <button
            className={`pill-tab ${viewFilter === 'active' ? 'pill-tab-active' : ''
              }`}
            onClick={() => setViewFilter('active')}
          >
            Active
          </button>
          <button
            className={`pill-tab ${viewFilter === 'resolved' ? 'pill-tab-active' : ''
              }`}
            onClick={() => setViewFilter('resolved')}
          >
            Resolved
          </button>
          <button
            className={`pill-tab ${viewFilter === 'all' ? 'pill-tab-active' : ''
              }`}
            onClick={() => setViewFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      {/* Error banner if delete/fetch fails */}
      {error && (
        <div className="logs-error">
          <p>Error: {error}</p>
        </div>
      )}

      {/* Loading / Empty / Cards */}
      {loading && !logs.length && !error ? (
        <div className="logs-loading">Loading logs...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="logs-empty">
          {error
            ? 'Could not load logs. Check server and retry.'
            : 'No logs found.'}
        </div>
      ) : (
        <div className="logs-list">
          {filteredLogs.map((log, idx) => {
            const status = log.action === 'enter' ? 'Active' : 'Resolved';
            const statusClass =
              log.action === 'enter'
                ? 'status-badge-active'
                : 'status-badge-resolved';

            const isDeleting = deletingTs === log.timestamp;

            return (
              <article key={`${log.timestamp}-${idx}`} className="log-card">
                <div className="log-card-image-wrap">
                  <img
                    src={log.image}
                    alt={`${log.name} - ${log.tableware}`}
                    className="log-card-image"
                  />
                  <span className={`status-badge ${statusClass}`}>
                    {status}
                  </span>
                </div>

                <div className="log-card-body">
                  <header className="log-card-header">
                    <h4 className="log-card-name">{log.name}</h4>
                    <button
                      type="button"
                      className="log-card-delete-btn"
                      onClick={() => handleDelete(log.timestamp)}
                      disabled={isDeleting}
                      aria-label="Delete log entry"
                    >
                      🗑
                    </button>
                  </header>

                  <p className="log-card-desc">
                    {log.action === 'enter' ? 'Left a' : 'Handled a'}{' '}
                    <strong>{log.tableware}</strong>{' '}
                    {log.action === 'enter' ? '· unwashed' : '· resolved'}
                  </p>

                  <div className="log-card-meta">
                    <div className="log-meta-line">
                      <span className="log-meta-label">Put in sink:</span>
                      <span className="log-meta-value">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>

                    <div className="log-meta-line">
                      <span className="log-meta-label">Elapsed:</span>
                      <span className="log-meta-chip">
                        {formatTimeAgo(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
