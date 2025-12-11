import React, { useEffect, useState } from 'react';
import { API_BASE, getViolations, deleteViolation, clearViolations } from '../lib/api';
import { onViolation, onViolationUpdate } from '../lib/socket';
import type { Violation } from '../types';

type Filter = 'active' | 'resolved' | 'all';

interface ViolationsPanelProps {
  violations: Violation[];
  setViolations: React.Dispatch<React.SetStateAction<Violation[]>>;
}

export function ViolationsPanel({
  violations,
  setViolations,
}: ViolationsPanelProps) {
  const MAX_VIOLATIONS = 15;
  const [filter, setFilter] = useState<Filter>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    void refreshFromServer();
  }, []);

  // Listen for real-time violations
  useEffect(() => {
    const cleanup = onViolation((violation) => {
      setViolations(prev => [violation as Violation, ...prev].slice(0, MAX_VIOLATIONS));
    });
    return cleanup;
  }, [setViolations]);

  // listen for violation updates (when clip finishes encoding)
  useEffect(() => {
    const cleanup = onViolationUpdate((updatedViolation) => {
      setViolations(prev =>
        prev.map(v =>
          String((v as any).id) === String((updatedViolation as any).id)
            ? updatedViolation as Violation
            : v
        )
      );
    });
    return cleanup;
  }, [setViolations]);

  const refreshFromServer = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await getViolations();
      // Server returns oldest-first; reverse so newest are on top
      setViolations((resp.records as Violation[]).slice().reverse().slice(0, MAX_VIOLATIONS));
    } catch (err) {
      console.error(err);
      setError('Failed to load violations');
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    const ok = window.confirm('Clear all violations?');
    if (!ok) return;
    try {
      setLoading(true);
      await clearViolations();
      setViolations([]);
      setExpandedId(null);
    } catch (err) {
      console.error(err);
      setError('Failed to clear violations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (
    id: string,
    e: React.MouseEvent<HTMLButtonElement>
  ) => {
    e.stopPropagation(); // don’t toggle expand on click

    const ok = window.confirm('Delete this violation?');
    if (!ok) return;

    try {
      setDeletingId(id);
      await deleteViolation(id);
      setViolations(prev => prev.filter(v => String((v as any).id) !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error(err);
      setError('Failed to delete violation');
    } finally {
      setDeletingId(null);
    }
  };

  const filteredViolations = violations.filter(v => {
    if (filter === 'all') return true;

    const status = (v as any).status;
    if (filter === 'resolved') return status === 'resolved';
    // Active = anything not explicitly resolved
    return status !== 'resolved';
  });

  const totalCount = violations.length;

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  const getStatusClass = (v: Violation) => {
    const status = (v as any).status;
    if (status === 'resolved') return 'violation-status-pill';
    if (status === 'occluded') return 'violation-status-pill buried';
    return 'violation-status-pill active';
  };

  const getStatusLabel = (v: Violation) => {
    const status = (v as any).status;
    if (status === 'resolved') return 'Resolved';
    if (status === 'occluded') return 'Buried';
    return 'Active';
  };

  const getImageUrl = (filename?: string) => {
    if (!filename) return null;
    return `${API_BASE}/images/${filename}`;
  };

  const getClipUrl = (filename?: string) => {
    if (!filename) return null;
    return `${API_BASE}/clips/${filename}`;
  };

  const renderSnapshot = (v: Violation) => {
    const entryImage = (v as any).entry_image as string | undefined;
    if (!entryImage) {
      return (
        <div className="violation-avatar placeholder">
          🧼
        </div>
      );
    }

    const src = `${API_BASE}/images/${entryImage}`;
    return (
      <img
        src={src}
        alt="Entry snapshot"
        className="violation-avatar"
      />
    );
  };

  return (
    <aside className="violations-panel">
      {/* Header + filters */}
      <div className="violations-header">
        <div>
          <h2>Violations</h2>
          <div className="violations-subtitle">
            {totalCount} total dish violations
          </div>
        </div>

        <div className="violations-header-right">
          <div className="violations-filter">
            <button
              type="button"
              className={`filter-pill ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'resolved' ? 'active' : ''}`}
              onClick={() => setFilter('resolved')}
            >
              Resolved
            </button>
            <button
              type="button"
              className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All logs
            </button>
          </div>

          <button
            type="button"
            className="refresh-button refresh-button--small"
            onClick={refreshFromServer}
            disabled={loading}
          >
            ⟳ Refresh
          </button>
          <button
            type="button"
            className="refresh-button refresh-button--small"
            onClick={handleClearAll}
            disabled={loading || !violations.length}
            title="Clear all violations"
          >
            🗑 Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="violations-error">{error}</div>}

      {/* Loading / Empty / List */}
      {loading && !violations.length ? (
        <div className="violations-loading">Loading violations…</div>
      ) : filteredViolations.length === 0 ? (
        <div className="violations-empty">
          No violations recorded yet.
          <div className="hint">
            Objects that remain in the sink past the threshold will appear here.
          </div>
        </div>
      ) : (
        <div className="violations-list">
          {filteredViolations.map(v => {
            const id = String((v as any).id);
            const isExpanded = expandedId === id;
            const duration = (v as any).duration_seconds;
            const statusClass = getStatusClass(v);
            const statusLabel = getStatusLabel(v);

            return (
              <div
                key={id}
                className={`violation-card-modern ${isExpanded ? 'expanded' : ''}`}
                onClick={() => setExpandedId(isExpanded ? null : id)}
              >
                {/* Left: snapshot */}
                <div className="violation-card-left">
                  <div className="violation-avatar-wrapper">
                    {renderSnapshot(v)}
                  </div>
                </div>

                {/* Right: details */}
                <div className="violation-card-main">
                  <div className="violation-main-header">
                    <div>
                      <p className="violation-person">
                        Object #{(v as any).track_id ?? id}
                      </p>
                      <p className="violation-subline">
                        Detected as{' '}
                        <span className="violation-dish">
                          {(v as any).class ?? 'dish'}
                        </span>
                      </p>
                    </div>

                    <div className="violation-header-actions">
                      <span className={statusClass}>{statusLabel}</span>
                      <button
                        type="button"
                        className="violation-delete-btn"
                        onClick={e => handleDelete(id, e)}
                        disabled={deletingId === id}
                        aria-label="Delete violation"
                        title="Delete violation"
                      >
                        🗑
                      </button>
                    </div>
                  </div>

                  <div className="violation-meta-row">
                    <span className="meta-label">Put in sink:</span>
                    <span className="meta-value">
                      {formatTimestamp((v as any).timestamp)}
                    </span>
                  </div>


                  {isExpanded && (
                    <div className="violation-expanded-extra">
                      <p className="violation-extra-text">Violation ID: {id}</p>

                      <div className="violation-expanded-media">
                        <div className="violation-image-container">
                          <h4>Entry (when first detected)</h4>
                          {getImageUrl((v as any).entry_image) ? (
                            <img
                              src={getImageUrl((v as any).entry_image)!}
                              alt="Entry snapshot"
                              className="violation-image"
                            />
                          ) : (
                            <div className="no-image">No entry image available</div>
                          )}
                        </div>
                      </div>

                      {(v as any).processing ? (
                        <div className="violation-video-container">
                          <h4>Violation Clip</h4>
                          <div className="video-pending">
                            <p>Video encoding...</p>
                          </div>
                        </div>
                      ) : getClipUrl((v as any).violation_clip) ? (
                        <div className="violation-video-container">
                          <h4>Violation Clip</h4>
                          <video
                            className="violation-video"
                            controls
                            preload="metadata"
                            src={getClipUrl((v as any).violation_clip)!}
                            poster={
                              getImageUrl(
                                (v as any).entry_image || ''
                              ) || undefined
                            }
                          />
                          <p className="video-hint">
                            If playback is choppy, use the download button in your browser.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export default ViolationsPanel;
