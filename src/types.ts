export type CallState = "idle" | "ringing" | "calling" | "connected";

export interface SignalData {
  type: 'offer' | 'answer' | 'ice-candidate' | 'reject';
  from: string;
  signal?: any;
  callerName?: string;
}
