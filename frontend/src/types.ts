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

// Detection types
export interface Detection {
  id: number;
  class: string;
  confidence: number;
  box: [number, number, number, number]; // [x1, y1, x2, y2]
  in_sink: boolean;
}

export interface TrackedObject {
  id: number;
  class: string;
  time_in_sink: number;
  violation_logged: boolean;
}

export interface FrameData {
  image: string;
  detections: Detection[];
  sink_time: number;
  tracked_count: number;
  detection_enabled: boolean;
  tracked_objects: TrackedObject[];
}

export interface Violation {
  id: string;
  timestamp: string;
  track_id: number;
  class: string;
  duration_seconds: number;
  entry_image?: string;
  violation_image?: string;
  violation_clip?: string;
}

export interface GetViolationsResponse {
  count: number;
  records: Violation[];
}

// Sink region as percentages [x1, y1, x2, y2] where values are 0-1
export type SinkRegion = [number, number, number, number] | null;
