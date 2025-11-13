import { useState } from 'react';
import { CameraView } from './CameraView';
import { logUsage } from '../lib/api';
import type { LogUsageRequest } from '../types';

const TABLEWARE_OPTIONS = [
  'Bowl',
  'Coffee cup',
  'Mug',
  'Plate',
  'Spoon',
  'Fork',
  'Knife',
  'Frying pan',
  'Kitchen knife',
  'Cutting board',
  'Ladle',
  'Wok',
];

export function CapturePanel() {
  const [name, setName] = useState('');
  const [tableware, setTableware] = useState('');
  const [action, setAction] = useState<'enter' | 'exit'>('enter');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCapture = (imageData: string) => {
    setCapturedImage(imageData);
    setSubmitStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!capturedImage) {
      setSubmitStatus({ type: 'error', message: 'Please capture an image first' });
      return;
    }

    if (!name.trim() || !tableware) {
      setSubmitStatus({ type: 'error', message: 'Please fill in all fields' });
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const request: LogUsageRequest = {
        name: name.trim(),
        tableware,
        image: capturedImage,
        action,
      };

      await logUsage(request);
      setSubmitStatus({ type: 'success', message: 'Successfully logged!' });
      
      // Clear form
      setName('');
      setTableware('');
      setAction('enter');
      setCapturedImage(null);
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit log entry'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="capture-panel">
      <h2>Log Dish Usage</h2>
      
      <div className="capture-section">
        <CameraView onCapture={handleCapture} />
        
        {capturedImage && (
          <div className="image-preview">
            <p>Captured Image:</p>
            <img src={capturedImage} alt="Captured snapshot" className="preview-image" />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="capture-form">
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tableware">Tableware:</label>
          <select
            id="tableware"
            value={tableware}
            onChange={(e) => setTableware(e.target.value)}
            required
          >
            <option value="">Select tableware</option>
            {TABLEWARE_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="action">Action:</label>
          <select
            id="action"
            value={action}
            onChange={(e) => setAction(e.target.value as 'enter' | 'exit')}
            required
          >
            <option value="enter">Enter (dish put in sink)</option>
            <option value="exit">Exit (dish removed from sink)</option>
          </select>
        </div>

        {submitStatus && (
          <div className={`status-message ${submitStatus.type}`}>
            {submitStatus.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !capturedImage}
          className="btn btn-primary btn-submit"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Log Entry'}
        </button>
      </form>
    </div>
  );
}

