import type { LogUsageRequest, LogUsageResponse, GetLogsResponse } from '../types';

// Use environment variable if set, otherwise fall back to proxy path
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

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

