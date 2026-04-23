/** Same rule as sprintConstants: dev → local backend; prod → same origin as the SPA. */
const BASE_URL = process.env.NODE_ENV === 'development' ? 'http://localhost:8080' : '';

export const TODOITEM_API = `${BASE_URL}/api/todolist`;

export const taskAPI = {
  getAll: (projectId) => {
    const q =
      projectId != null && String(projectId).trim() !== ''
        ? `?projectId=${encodeURIComponent(String(projectId).trim())}`
        : '';
    return fetch(`${BASE_URL}/api/tasks${q}`).then((r) => (r.ok ? r.json() : Promise.reject()));
  },
  create: (data) =>
    fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => (r.ok ? r.json() : Promise.reject())),
  update: (id, data) =>
    fetch(`${BASE_URL}/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => (r.ok ? r.json() : Promise.reject())),
  delete: (id) =>
    fetch(`${BASE_URL}/api/tasks/${id}`, { method: 'DELETE' }).then((r) =>
      r.ok ? r.json() : Promise.reject(),
    ),
};
