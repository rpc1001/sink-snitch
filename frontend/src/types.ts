export interface LogEntry {
  timestamp: string;
  name: string;
  tableware: string;
  image: string;
  action: 'enter' | 'exit';
}

export interface LogUsageRequest {
  name: string;
  tableware: string;
  image: string;
  action: 'enter' | 'exit';
}

export interface LogUsageResponse {
  status: string;
  entry: LogEntry;
}

export interface GetLogsResponse {
  count: number;
  records: LogEntry[];
}

