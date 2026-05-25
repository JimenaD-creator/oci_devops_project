import { API_BASE } from './aiInsightsConstants';

/**
 * Server AI readiness (Gemini for insights + manager chat).
 * @returns {Promise<{ geminiConfigured: boolean, managerChatAvailable: boolean, insightsAvailable: boolean, message: string|null }>}
 */
export async function fetchAiStatus() {
  const res = await fetch(`${API_BASE}/api/ai/status`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`AI status HTTP ${res.status}`);
  }
  const data = await res.json();
  const gemini = data?.gemini ?? {};
  return {
    geminiConfigured: Boolean(gemini.configured),
    managerChatAvailable: Boolean(data?.managerChatAvailable ?? gemini.configured),
    insightsAvailable: Boolean(data?.insightsAvailable ?? gemini.configured),
    message: gemini.message ?? null,
    errorCode: gemini.errorCode ?? null,
  };
}
