import { useState, useCallback } from 'react';
import type { IdentifyRequest, IdentifyResponse, HistoryEntry } from '../types';
import { identifyContact } from '../services/api';

export function useIdentify() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<IdentifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const identify = useCallback(async (request: IdentifyRequest) => {
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const result = await identifyContact(request);
      setResponse(result);

      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          request,
          response: result,
          error: null,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);

      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          request,
          response: null,
          error: message,
          timestamp: new Date(),
        },
        ...prev,
      ]);

      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setResponse(null);
    setError(null);
  }, []);

  return { identify, loading, response, error, history, clearHistory, setResponse, setError };
}
