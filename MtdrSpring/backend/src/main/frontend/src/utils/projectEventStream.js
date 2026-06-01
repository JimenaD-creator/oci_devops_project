import { getApiBase } from './apiBase';
import { getAuthToken, isAuthenticated } from './auth';

const DEFAULT_DEBOUNCE_MS = 800;
const RECONNECT_MS = 15000;
const MAX_RECONNECT_MS = 60000;
const IMMEDIATE_EVENT_TYPES = new Set(['task-deleted', 'task-created', 'task-assigned']);

/**
 * Opens an SSE stream for project task mutations (Telegram / REST → portal sync).
 * Returns an unsubscribe function.
 */
export function subscribeProjectTaskEvents(projectId, onEvent, options = {}) {
  if (typeof window === 'undefined' || !projectId || !isAuthenticated()) {
    return () => {};
  }

  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  let es = null;
  let closed = false;
  let debounceTimer = null;
  let reconnectTimer = null;
  let reconnectDelayMs = RECONNECT_MS;
  let lastPayload = null;

  const flush = () => {
    if (typeof onEvent === 'function') {
      onEvent(lastPayload || {});
    }
  };

  const schedule = (payload) => {
    lastPayload = payload;
    if (IMMEDIATE_EVENT_TYPES.has(payload?.type)) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = null;
      flush();
      return;
    }
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      flush();
    }, debounceMs);
  };

  const buildUrl = () => {
    const base = getApiBase() || '';
    const token = getAuthToken();
    const pid = encodeURIComponent(String(projectId));
    const tok = encodeURIComponent(token);
    return `${base}/api/projects/${pid}/events?access_token=${tok}`;
  };

  const connect = () => {
    if (closed) return;
    try {
      es = new EventSource(buildUrl());
      reconnectDelayMs = RECONNECT_MS;
    } catch {
      reconnectTimer = setTimeout(connect, RECONNECT_MS);
      return;
    }

    es.addEventListener('project-task-event', (ev) => {
      try {
        schedule(JSON.parse(ev.data));
      } catch {
        schedule({ type: 'task-updated' });
      }
    });

    es.addEventListener('ping', () => {});

    es.onerror = () => {
      if (es) {
        es.close();
        es = null;
      }
      if (!closed) {
        reconnectTimer = setTimeout(() => {
          reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_MS);
          connect();
        }, reconnectDelayMs);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectDelayMs = RECONNECT_MS;
    if (es) {
      es.close();
      es = null;
    }
  };
}
