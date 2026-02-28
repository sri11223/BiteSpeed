/** Shared TypeScript types for the frontend */

export interface IdentifyRequest {
  email?: string | null;
  phoneNumber?: string | null;
}

export interface ContactResponse {
  primaryContatctId: number;
  emails: string[];
  phoneNumbers: string[];
  secondaryContactIds: number[];
}

export interface IdentifyResponse {
  contact: ContactResponse;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
}

export interface ApiError {
  status: string;
  message: string;
}

export interface HistoryEntry {
  id: string;
  request: IdentifyRequest;
  response: IdentifyResponse | null;
  error: string | null;
  timestamp: Date;
}
