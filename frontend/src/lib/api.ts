import type { 
  LogUsageRequest, 
  LogUsageResponse, 
  GetLogsResponse,
  GetViolationsResponse,
  SinkRegion 
} from '../types';

export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

export async function logUsage(data: LogUsageRequest): Promise<LogUsageResponse> {
  const response = await fetch(`${API_BASE}/log_usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function getLogs(): Promise<GetLogsResponse> {
  const response = await fetch(`${API_BASE}/get_logs`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

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

export async function getDetectionStatus(): Promise<{ running: boolean; tracked_objects: number }> {
  const response = await fetch(`${API_BASE}/detection/status`);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
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

