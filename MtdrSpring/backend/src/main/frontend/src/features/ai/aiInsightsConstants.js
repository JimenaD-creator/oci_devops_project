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
  UPSTREAM_TIMEOUT: 'The AI service took too long to respond. Please try again.',
  UPSTREAM_UNAVAILABLE: 'The AI service is temporarily unavailable. Please try again shortly.',
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

/** Gemini `actionableRecommendations[].category` → UI label */
export const RECOMMENDATION_CATEGORY_LABELS = {
  workload_redistribution: 'Workload redistribution',
  estimates: 'Estimates',
  planning: 'Planning',
  training: 'Training',
  blockers: 'Blockers',
};

/** Shown when a sprint insight section has no AI content yet */
export const AI_INSIGHTS_EMPTY = {
  recommendations: 'No recommendations for this sprint yet. Generate insights to populate this list.',
  executive:
    'No executive summary yet. Generate insights to see overview, trends, improvement areas, and next steps.',
  developers:
    'No per-developer rows in the AI response yet. Add developers to the sprint roster or task assignments, then regenerate. Zero completed tasks should still produce rows when team workload data exists.',
  predictions:
    'No predictions yet. Generate insights to see productivity outlook, risks, and delivery estimates.',
};
