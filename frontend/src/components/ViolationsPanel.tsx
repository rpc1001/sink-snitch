import { useEffect, useState } from 'react';
import ReactPlayer from 'react-player';
import { getViolations, API_BASE } from '../lib/api';
import { onViolation } from '../lib/socket';
import type { Violation } from '../types';

export function ViolationsPanel() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<Record<string, string>>({});

  const fetchViolations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getViolations();
      setViolations(response.records.reverse()); // Most recent first
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch violations');
      console.error('Error fetching violations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
    
    // Listen for new violations
    const cleanup = onViolation((violation) => {
      setViolations(prev => [violation, ...prev]);
    });
    
    return cleanup;
  }, []);

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const getImageUrl = (filename: string | undefined) => {
    if (!filename) return null;
    return `${API_BASE}/images/${filename}`;
  };

  // Get video clip URL
  const getClipUrl = (filename: string | undefined) => {
    if (!filename) return null;
    return `${API_BASE}/clips/${filename}`;
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDownload = async (clipUrl: string, id: string) => {
    try {
      setDownloadStatus(prev => ({ ...prev, [id]: 'downloading' }));
      const response = await fetch(clipUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const filename = clipUrl.split('/').pop() || 'violation_clip.mp4';
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadStatus(prev => ({ ...prev, [id]: '' }));
    } catch (err) {
      console.error('Download failed', err);
      setDownloadStatus(prev => ({ ...prev, [id]: 'Download failed' }));
    }
  };

  if (loading) {
    return <div className="violations-loading">Loading violations...</div>;
  }

  if (error) {
    return (
      <div className="violations-error">
        <p>Error: {error}</p>
        <button onClick={fetchViolations} className="btn btn-secondary">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="violations-panel">
      <div className="violations-header">
        <h2>Violations ({violations.length})</h2>
        <button onClick={fetchViolations} className="btn btn-secondary btn-sm">
          Refresh
        </button>
      </div>

      {violations.length === 0 ? (
        <div className="violations-empty">
          <p>No violations recorded yet.</p>
          <p className="hint">Violations occur when objects stay in the sink for more than the threshold time.</p>
        </div>
      ) : (
        <div className="violations-list">
          {violations.map((violation, index) => {
            const id = violation.id || `${violation.timestamp}-${index}`;
            const isExpanded = expandedId === id;
            
            return (
              <div key={id} className={`violation-card ${isExpanded ? 'expanded' : ''}`}>
                <div className="violation-header" onClick={() => toggleExpand(id)}>
                  <div className="violation-icon">⚠️</div>
                  <div className="violation-details">
                    <div className="violation-title">Object #{violation.track_id}</div>
                    <div className="violation-meta">
                      <span className="violation-time">{formatTimestamp(violation.timestamp)}</span>
                      <span className="violation-duration">{formatDuration(violation.duration_seconds)} in sink</span>
                    </div>
                  </div>
                  <div className="violation-expand-icon">
                    {isExpanded ? '▼' : '▶'}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="violation-expanded">
                    <div className="violation-images">
                      <div className="violation-image-container">
                        <h4>Entry (when first detected)</h4>
                        {violation.entry_image ? (
                          <img 
                            src={getImageUrl(violation.entry_image)!} 
                            alt="Entry snapshot"
                            className="violation-image"
                          />
                        ) : (
                          <div className="no-image">No entry image available</div>
                        )}
                      </div>
                      <div className="violation-image-container">
                        <h4>Violation (when threshold exceeded)</h4>
                        {violation.violation_image ? (
                          <img 
                            src={getImageUrl(violation.violation_image)!} 
                            alt="Violation snapshot"
                            className="violation-image"
                          />
                        ) : (
                          <div className="no-image">No violation image available</div>
                        )}
                      </div>
                    </div>
                    {violation.violation_clip && (
                      <div className="violation-video-container">
                        <h4>Violation Clip</h4>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDownload(getClipUrl(violation.violation_clip)!, id)}
                          disabled={downloadStatus[id] === 'downloading'}
                        >
                          {downloadStatus[id] === 'downloading' ? 'Downloading…' : 'Download clip'}
                        </button>
                        {downloadStatus[id] && downloadStatus[id] !== 'downloading' && (
                          <p className="hint">{downloadStatus[id]}</p>
                        )}

                        {/* <h4>OK Garmin</h4>
                        <video 
                          className="violation-video"
                          controls 
                          src={getClipUrl(violation.violation_clip)!}
                        /> */}
                      </div>
                    )}
                    <div className="violation-extra-info">
                      <p><strong>Track ID:</strong> #{violation.track_id}</p>
                      <p><strong>Detected As:</strong> {violation.class}</p>
                      <p><strong>Time in Sink:</strong> {formatDuration(violation.duration_seconds)}</p>
                      <p><strong>Violation Time:</strong> {formatTimestamp(violation.timestamp)}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
