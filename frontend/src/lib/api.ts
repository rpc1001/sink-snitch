import type {
  GetViolationsResponse,
  SinkRegion
} from '../types';

const envApiBase = (import.meta as any)?.env?.VITE_API_BASE_URL;
export const API_BASE = envApiBase || 'http://localhost:5001';

export async function getViolations(): Promise<GetViolationsResponse> {
  const response = await fetch(`${API_BASE}/get_violations`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getSinkRegion(): Promise<{ sink_region: SinkRegion }> {
  const response = await fetch(`${API_BASE}/sink_region`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function setSinkRegion(region: SinkRegion): Promise<{ status: string; sink_region: SinkRegion }> {
  const response = await fetch(`${API_BASE}/sink_region`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sink_region: region }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function getSocketUrl(): string {
  return API_BASE;
}

export async function deleteViolation(id: string): Promise<{ status: string; id: string }> {
  const response = await fetch(`${API_BASE}/violations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getWebhookConfig(): Promise<{ configured: boolean }> {
  const response = await fetch(`${API_BASE}/notification/webhook`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function saveWebhookUrl(webhookUrl: string | null): Promise<{ status: string; configured: boolean }> {
  const response = await fetch(`${API_BASE}/notification/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getViolationThreshold(): Promise<{ violation_threshold_seconds: number }> {
  const response = await fetch(`${API_BASE}/violation_threshold`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function setViolationThreshold(seconds: number): Promise<{ status: string; violation_threshold_seconds: number }> {
  const response = await fetch(`${API_BASE}/violation_threshold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ violation_threshold_seconds: seconds }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function clearViolations(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/violations`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}
