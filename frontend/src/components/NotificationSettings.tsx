import { useEffect, useState } from 'react';
import { getWebhookConfig, saveWebhookUrl } from '../lib/api';

type StatusState = { type: 'success' | 'error'; message: string } | null;

export function NotificationSettings() {
  const [configured, setConfigured] = useState(false);
  const [webhookInput, setWebhookInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<StatusState>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await getWebhookConfig();
        setConfigured(res.configured);
      } catch (err) {
        setStatus({
          type: 'error',
          message: err instanceof Error ? err.message : 'Failed to load webhook status'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setSaving(true);

    try {
      const cleaned = webhookInput.trim();
      const payload = cleaned.length > 0 ? cleaned : null;
      const res = await saveWebhookUrl(payload);
      setConfigured(res.configured);
      setStatus({ type: 'success', message: res.status === 'cleared' ? 'Webhook cleared.' : 'Webhook saved.' });
      if (res.status === 'cleared') {
        setWebhookInput('');
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save webhook'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-panel">
      <h2>Notifications</h2>
      <p className="settings-subtitle">
        Optional: send violations to a Discord channel via webhook. The saved URL is not shown back in the UI; you only see whether one is configured.
      </p>

      <div className="settings-card">
        <form onSubmit={handleSave} className="settings-form">
          <div className="form-group">
            <label htmlFor="webhook">Discord Webhook URL</label>
            <input
              id="webhook"
              type="url"
              placeholder="https://discord.com/api/webhooks/..."
              value={webhookInput}
              onChange={(e) => setWebhookInput(e.target.value)}
              disabled={saving}
            />
            <small className="form-hint">
              Leave blank and Save to clear. Only Discord webhooks are accepted.
            </small>
          </div>

          {status && (
            <div className={`status-message ${status.type}`}>
              {status.message}
            </div>
          )}

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <div className="configured-indicator">
              <span className={`status-dot ${configured ? 'connected' : 'disconnected'}`}></span>
              {loading ? 'Loading...' : configured ? 'Webhook configured' : 'No webhook set'}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
