export interface Detection {
  id: number;
  class: string;
  confidence: number;
  box: [number, number, number, number];
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

export type SinkRegion = [number, number, number, number] | null;
