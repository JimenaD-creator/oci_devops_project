import { useCallback, useEffect, useState } from 'react';
import { fetchAiStatus } from './aiStatusApi';
import { getErrorMessage } from './aiInsightsConstants';

/**
 * Shared hook: block insights generate + manager chat when GEMINI_API_KEY is missing on the server.
 */
export function useGeminiAiStatus({ enabled = true } = {}) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [configured, setConfigured] = useState(true);
  const [message, setMessage] = useState(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return { configured: true, message: null };
    }
    setLoading(true);
    try {
      const status = await fetchAiStatus();
      setConfigured(status.geminiConfigured);
      const msg = status.message ?? (status.errorCode ? getErrorMessage(status.errorCode) : null);
      setMessage(msg);
      return { configured: status.geminiConfigured, message: msg };
    } catch {
      setConfigured(false);
      const msg = 'Could not verify AI configuration. Check that the backend is running.';
      setMessage(msg);
      return { configured: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loading,
    configured,
    message,
    refresh,
    blocked: !loading && !configured,
  };
}
