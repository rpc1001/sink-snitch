import type {
  LogUsageRequest,
  LogUsageResponse,
  GetLogsResponse,
} from '../types';

const API_BASE = '/api';

async function handleJsonOrTextError(response: Response): Promise<never> {
  try {
    const data = await response.json();
    const message =
      (data && (data.error || data.message)) ||
      `HTTP error! status: ${response.status}`;
    throw new Error(message);
  } catch {
    const text = await response.text();
    throw new Error(text || `HTTP error (non-JSON) status: ${response.status}`);
  }
}

export async function logUsage(
  data: LogUsageRequest
): Promise<LogUsageResponse> {
  const response = await fetch(`${API_BASE}/log_usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    await handleJsonOrTextError(response);
  }

  return response.json();
}

export async function getLogs(): Promise<GetLogsResponse> {
  const response = await fetch(`${API_BASE}/get_logs`);

  if (!response.ok) {
    await handleJsonOrTextError(response);
  }

  return response.json();
}

export async function deleteLog(timestamp: string): Promise<void> {
  const response = await fetch(`${API_BASE}/delete_log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp }),
  });

  if (!response.ok) {
    await handleJsonOrTextError(response);
  }
}
