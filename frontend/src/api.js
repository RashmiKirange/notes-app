// In Docker: Vite proxy forwards /notes → backend:8000
// Locally: set VITE_API_URL=http://localhost:8000 or leave empty for proxy
const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getNotes: () => request("/notes"),
  getNote: (id) => request(`/notes/${id}`),
  createNote: (data) => request("/notes", { method: "POST", body: JSON.stringify(data) }),
  updateNote: (id, data) => request(`/notes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),
};
