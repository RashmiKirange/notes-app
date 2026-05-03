import { useState, useEffect, useCallback } from "react";
import { api } from "./api";

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

function NoteCard({ note, onSelect, onDelete, isActive }) {
  return (
    <div
      className={`note-card ${isActive ? "active" : ""}`}
      onClick={() => onSelect(note)}
    >
      <div className="note-card-title">{note.title || "Untitled"}</div>
      <div className="note-card-preview">
        {note.content ? note.content.slice(0, 80) + (note.content.length > 80 ? "…" : "") : "No content"}
      </div>
      <div className="note-card-meta">{formatDate(note.updated_at)} · {note.word_count} words</div>
      <button
        className="note-delete-btn"
        onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
        title="Delete note"
      >
        ✕
      </button>
    </div>
  );
}

function Editor({ note, onSave, onNew }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setWordCount(note?.word_count ?? 0);
  }, [note]);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), content });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <button className="btn btn-secondary" onClick={onNew">
          + New Note
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim()">
          {saving ? "Saving…" : note ? "Update" : "Create"}
        </button>
      </div>
      <input
        className="editor-title"
        placeholder="Note title…"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="editor-content"
        placeholder="Start writing…"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {note && (
        <div className="editor-meta">
          Created: {formatDate(note.created_at)} · Updated: {formatDate(note.updated_at)} · {wordCount} words
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [notes, setNotes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const loadNotes = useCallback(async () => {
    try {
      const data = await api.getNotes();
      setNotes(data);
    } catch (e) {
      setError("Could not load notes. Is the backend running?");
    }
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  async function handleSave(payload) {
    try {
      if (selected) {
        const updated = await api.updateNote(selected.id, payload);
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
        setSelected(updated);
      } else {
        const created = await api.createNote(payload);
        setNotes((prev) => [created, ...prev]);
        setSelected(created);
      }
    } catch (e) {
      setError("Failed to save note.");
    }
  }

  async function handleDelete(id) {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError("Failed to delete note.");
    }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Notes</h1>
          <span className="note-count">{notes.length}</span>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <div className="note-list">
          {notes.length === 0 && (
            <div className="empty-state">No notes yet. Create your first one!</div>
          )}
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onSelect={setSelected}
              onDelete={handleDelete}
              isActive={selected?.id === note.id}
            />
          ))}
        </div>
      </aside>
      <main className="main">
        <Editor note={selected} onSave={handleSave} onNew={() => setSelected(null)} />
      </main>
    </div>
  );
}
