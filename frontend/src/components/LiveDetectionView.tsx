import { useEffect, useState, useRef, useCallback } from 'react';
import { getSinkRegion, getViolationThreshold, setViolationThreshold } from '../lib/api';
import {
  getSocket,
  onFrame,
  onStatus,
  onError,
  onSinkRegion,
  onConnect,
  onDisconnect,
  setSinkRegionSocket,
  startDetection as emitStartDetection,
  stopDetection as emitStopDetection
} from '../lib/socket';
import type { FrameData, SinkRegion } from '../types';

export function LiveDetectionView() {
  const [connected, setConnected] = useState(false);
  const [cameraRunning, setCameraRunning] = useState(false);
  const [detectionEnabled, setDetectionEnabled] = useState(false);
  const [frameData, setFrameData] = useState<FrameData | null>(null);
  const [sinkRegion, setSinkRegion] = useState<SinkRegion>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempRegion, setTempRegion] = useState<SinkRegion>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [violationThresholdSeconds, setViolationThresholdSeconds] = useState<number>(30 * 60);
  const [violationThresholdInput, setViolationThresholdInput] = useState<number>(30);
  const [savingThreshold, setSavingThreshold] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameTimer = useRef<number | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const offStatus = onStatus((data: { message: string; camera_running?: boolean; detection_enabled?: boolean }) => {
      setStatusMessage(data.message);
      if (data.camera_running !== undefined) setCameraRunning(data.camera_running);
      if (data.detection_enabled !== undefined) setDetectionEnabled(data.detection_enabled);
    });
    const offError = onError((data: { message: string }) => setError(data.message));
    const offFrame = onFrame((data: FrameData) => setFrameData(data));
    const offSink = onSinkRegion((data: { sink_region: SinkRegion }) => setSinkRegion(data.sink_region));
    const offConnect = onConnect(() => {
      setConnected(true);
      setError(null);
    });
    const offDisconnect = onDisconnect(() => {
      setConnected(false);
      setCameraRunning(false);
      setDetectionEnabled(false);
      stopFrameLoop();
      stopCamera();
    });

    getSinkRegion()
      .then(data => setSinkRegion(data.sink_region))
      .catch(err => console.error('Failed to load sink region:', err));

    getViolationThreshold()
      .then(data => {
        if (typeof data.violation_threshold_seconds === 'number') {
          setViolationThresholdSeconds(data.violation_threshold_seconds);
          setViolationThresholdInput(data.violation_threshold_seconds / 60);
        }
      })
      .catch(err => console.error('Failed to load violation threshold:', err));

    return () => {
      offStatus();
      offError();
      offFrame();
      offSink();
      offConnect();
      offDisconnect();
      stopFrameLoop();
      stopCamera();
      socket.disconnect();
    };
  }, []);

  const getRelativePosition = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (detectionEnabled) return;
    const pos = getRelativePosition(e);
    if (pos) {
      setIsDrawing(true);
      setDrawStart(pos);
      setTempRegion(null);
    }
  }, [detectionEnabled, getRelativePosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const pos = getRelativePosition(e);
    if (pos) {
      const x1 = Math.min(drawStart.x, pos.x);
      const y1 = Math.min(drawStart.y, pos.y);
      const x2 = Math.max(drawStart.x, pos.x);
      const y2 = Math.max(drawStart.y, pos.y);
      setTempRegion([x1, y1, x2, y2]);
    }
  }, [isDrawing, drawStart, getRelativePosition]);

  const handleMouseUp = useCallback(() => {
    if (isDrawing && tempRegion) {
      const width = tempRegion[2] - tempRegion[0];
      const height = tempRegion[3] - tempRegion[1];
      if (width > 0.05 && height > 0.05) {
        setSinkRegion(tempRegion);
        setSinkRegionSocket(tempRegion);
      }
    }
    setIsDrawing(false);
    setDrawStart(null);
    setTempRegion(null);
  }, [isDrawing, tempRegion]);

  const startCamera = async () => {
    if (cameraRunning) return;
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      getSocket().emit('start_camera');
      setCameraRunning(true);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please allow webcam permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraRunning(false);
  };

  const sendFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    getSocket().emit('client_frame', { image: dataUrl });
  };

  const startFrameLoop = () => {
    if (frameTimer.current !== null) return;
    frameTimer.current = window.setInterval(sendFrame, 200); // ~5 FPS
  };

  const stopFrameLoop = () => {
    if (frameTimer.current !== null) {
      window.clearInterval(frameTimer.current);
      frameTimer.current = null;
    }
  };

  const handleStartDetection = async () => {
    if (!sinkRegion) {
      setError('Please draw the sink region first');
      return;
    }
    if (!cameraRunning) {
      await startCamera();
    }
    emitStartDetection();
    startFrameLoop();
    setDetectionEnabled(true);
  };

  const handleStopDetection = () => {
    stopFrameLoop();
    emitStopDetection();
    setDetectionEnabled(false);
  };

  const handleClearSinkRegion = () => {
    setSinkRegion(null);
    setSinkRegionSocket(null);
  };

  const handleSaveThreshold = async () => {
    const minutes = Math.max(0.01, violationThresholdInput);
    const seconds = minutes * 60;
    setSavingThreshold(true);
    try {
      const resp = await setViolationThreshold(seconds);
      setViolationThresholdSeconds(resp.violation_threshold_seconds);
      setStatusMessage(`Violation time set to ${(resp.violation_threshold_seconds / 60).toFixed(2)} minutes`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save violation time');
    } finally {
      setSavingThreshold(false);
    }
  };

  const displayRegion = sinkRegion;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="live-detection">
      <div className="detection-header">
        <h2>Live Detection</h2>
        <div className="connection-status">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          {connected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {error && (
        <div className="error-message" onClick={() => setError(null)}>{error}</div>
      )}

      {statusMessage && (
        <div className="status-message info">{statusMessage}</div>
      )}

      <div
        ref={containerRef}
        className={`video-container ${isDrawing ? 'drawing' : ''} ${cameraRunning && !detectionEnabled ? 'can-draw' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cameraRunning ? 'detection-feed' : 'detection-feed hidden'}
        />
        <canvas ref={canvasRef} className="hidden" />
        {frameData?.image && (
          <img
            src={frameData.image}
            alt="Annotated feed"
            className="detection-feed overlay"
            draggable={false}
          />
        )}

        {displayRegion && !frameData && (
          <div
            className="sink-region-overlay"
            style={{
              left: `${displayRegion[0] * 100}%`,
              top: `${displayRegion[1] * 100}%`,
              width: `${(displayRegion[2] - displayRegion[0]) * 100}%`,
              height: `${(displayRegion[3] - displayRegion[1]) * 100}%`,
            }}
          >
            <span className="sink-label">SINK AREA</span>
          </div>
        )}

        {tempRegion && (
          <div
            className="sink-region-overlay drawing"
            style={{
              left: `${tempRegion[0] * 100}%`,
              top: `${tempRegion[1] * 100}%`,
              width: `${(tempRegion[2] - tempRegion[0]) * 100}%`,
              height: `${(tempRegion[3] - tempRegion[1]) * 100}%`,
            }}
          >
            <span className="sink-label">DRAWING...</span>
          </div>
        )}

        {cameraRunning && !detectionEnabled && !sinkRegion && frameData && (
          <div className="draw-hint">
            Click and drag to draw sink area
          </div>
        )}

        {!cameraRunning && (
          <div className="video-placeholder">
            <p>Camera not started</p>
            <p className="hint">Click "Start Detection" to begin</p>
          </div>
        )}
      </div>

      <div className="detection-controls">
        {!detectionEnabled ? (
          <>
            <button onClick={handleStartDetection} className="btn btn-success" disabled={!connected || !sinkRegion}>
              Start Detection
            </button>
            <button onClick={handleClearSinkRegion} className="btn btn-secondary" disabled={!sinkRegion}>
              Clear Sink Region
            </button>
            <button onClick={stopCamera} className="btn btn-danger" disabled={!cameraRunning}>
              Stop Camera
            </button>
          </>
        ) : (
          <>
            <button onClick={handleStopDetection} className="btn btn-warning">
              Stop Detection
            </button>
            <button onClick={stopCamera} className="btn btn-danger">
              Stop Camera
            </button>
          </>
        )}
      </div>

      {frameData && detectionEnabled && (
        <div className="detection-stats">
          <div className="stat">
            <span className="stat-label">Objects in Sink:</span>
            <span className="stat-value">{frameData.tracked_count}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Max Time in Sink:</span>
            <span className={`stat-value ${frameData.sink_time > violationThresholdSeconds ? 'warning' : ''}`}>
              {formatTime(frameData.sink_time)}
            </span>
          </div>
        </div>
      )}

      {frameData && detectionEnabled && frameData.tracked_objects && frameData.tracked_objects.length > 0 && (
        <div className="tracked-objects-panel">
          <h4>Tracked Objects in Sink</h4>
          <table className="tracked-objects-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Class</th>
                <th>Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {frameData.tracked_objects.map(obj => (
                <tr key={obj.id} className={obj.violation_logged ? 'violation-row' : ''}>
                  <td>#{obj.id}</td>
                  <td>{obj.class}</td>
                  <td>{formatTime(obj.time_in_sink)}</td>
                  <td>
                    {obj.violation_logged ? (
                      <span className="violation-badge">⚠️ VIOLATION</span>
                    ) : obj.time_in_sink > violationThresholdSeconds ? (
                      <span className="warning-badge">Warning</span>
                    ) : (
                      <span className="ok-badge">Tracking</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="detection-instructions">
        <h4>How to use:</h4>
        <ol>
          <li><strong>Start Detection</strong> - begins webcam capture in your browser and streams frames to backend</li>
          <li><strong>Draw Sink Region</strong> - Click and drag on the video to mark your sink</li>
          <li>Objects in the sink longer than your set violation time trigger a violation alert.</li>
        </ol>
      </div>

      <div className="threshold-control">
        <label htmlFor="violation-threshold">Violation time (minutes)</label>
        <div className="threshold-input-row">
          <input
            id="violation-threshold"
            type="number"
            min={0.01}
            step={0.1}
            value={violationThresholdInput}
            onChange={(e) => setViolationThresholdInput(Number(e.target.value))}
          />
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSaveThreshold}
            disabled={savingThreshold}
          >
            {savingThreshold ? 'Saving…' : 'Save'}
          </button>
          <div className="threshold-hint">
            Currently {(violationThresholdSeconds / 60).toFixed(2)} min
          </div>
        </div>
      </div>
    </div>
  );
}