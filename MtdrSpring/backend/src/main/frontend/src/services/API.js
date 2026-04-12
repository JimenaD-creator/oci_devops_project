const BASE_URL = 'http://localhost:8080';

export const TODOITEM_API = `${BASE_URL}/api/todolist`;

export const taskAPI = {
  getAll: () => fetch(`${BASE_URL}/api/tasks`).then(r => r.ok ? r.json() : Promise.reject()),
  create: (data) => fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.ok ? r.json() : Promise.reject()),
  update: (id, data) => fetch(`${BASE_URL}/api/tasks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.ok ? r.json() : Promise.reject()),
  delete: (id) => fetch(`${BASE_URL}/api/tasks/${id}`, { method: 'DELETE' }),
};

export const sprintAPI = {
  getAll: () => fetch(`${BASE_URL}/api/sprints`).then(r => r.ok ? r.json() : Promise.reject()),
};

export default TODOITEM_API;