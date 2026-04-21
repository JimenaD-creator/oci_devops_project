export const API_BASE = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export const pageEase = [0.22, 1, 0.36, 1];

const ERROR_MESSAGES = {
  QUOTA_EXCEEDED:
    'The AI quota for today has been reached. Please try again tomorrow or use a different API key.',
  API_KEY_MISSING: 'Gemini API key is not configured on the server. Contact your administrator.',
  MODEL_NOT_FOUND: 'The AI model is unavailable. Contact your administrator.',
  SPRINT_NOT_FOUND: 'This sprint was not found in the database.',
  NO_PROJECT_ASSIGNED:
    'This sprint has no project assigned. Assign a project before generating insights.',
  GENERATION_FAILED: 'AI generation failed unexpectedly. Please try again.',
};

export function getErrorMessage(code) {
  return ERROR_MESSAGES[code] ?? `Generation failed: ${code}`;
}

export const KPI_LABELS = {
  completionRate: 'Completion Rate',
  onTimeDelivery: 'On-Time Delivery',
  teamParticipation: 'Team Participation',
  workloadBalance: 'Workload Balance',
  productivityScore: 'Productivity Score',
};
