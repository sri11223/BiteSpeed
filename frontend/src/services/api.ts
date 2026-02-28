import type { IdentifyRequest, IdentifyResponse, HealthResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function identifyContact(data: IdentifyRequest): Promise<IdentifyResponse> {
  const body: Record<string, unknown> = {};
  if (data.email) body.email = data.email;
  if (data.phoneNumber) body.phoneNumber = data.phoneNumber;

  const res = await fetch(`${API_BASE}/identify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}
