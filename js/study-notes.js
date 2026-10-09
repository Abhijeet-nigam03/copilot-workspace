// ==========================================
// SYNAPSE OS: Subject-Wise Notes Manager
// ==========================================

class NotesManager {
  constructor() {
    this.selectedSubjectId = 'all';
    this.selectedNoteId = null;
    this.searchQuery = '';
    this.viewMode = 'split'; // 'split', 'edit', 'preview'
  }

  init() {
    this.renderSubjectsList();
    this.renderNotesList();
    
    // Select first note by default if available
    if (store.data.notes.length > 0 && !this.selectedNoteId) {
      this.selectNote(store.data.notes[0].id);
    }

    this.bindEvents();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('notes-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderNotesList();
      });
    }

    // New Note button
    const newNoteBtn = document.getElementById('btn-new-note');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => this.createNewNote());
    }

    // Note Title Input
    const noteTitleInput = document.getElementById('note-editor-title');
    if (noteTitleInput) {
      noteTitleInput.addEventListener('input', (e) => {
        if (!this.selectedNoteId) return;
        const note = store.data.notes.find(n => n.id === this.selectedNoteId);
        if (note) {
          note.title = e.target.value;
          note.updatedAt = new Date().toISOString();
          store.saveData();
          this.renderNotesList();
        }
      });
    }

    // Note Textarea
    const textarea = document.getElementById('note-markdown-textarea');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        if (!this.selectedNoteId) return;
        const note = store.data.notes.find(n => n.id === this.selectedNoteId);
        if (note) {
          note.content = e.target.value;
          note.updatedAt = new Date().toISOString();
          store.saveData();
          this.updatePreview();
        }
      });
    }

    // View Mode buttons (Split, Edit, Preview)
    document.querySelectorAll('.note-view-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.setViewMode(mode);
      });
    });

    // Note actions (Delete, Export)
    const deleteBtn = document.getElementById('btn-delete-note');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => this.deleteCurrentNote());
    }

    const exportBtn = document.getElementById('btn-export-note');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportCurrentNote());
    }

    // Add Subject Button
    const addSubjectBtn = document.getElementById('btn-add-subject');
    if (addSubjectBtn) {
      addSubjectBtn.addEventListener('click', () => this.promptAddSubject());
    }
  }

  renderSubjectsList() {
    const container = document.getElementById('notes-subjects-list');
    if (!container) return;

    let html = `
      <div class="subject-item-row ${this.selectedSubjectId === 'all' ? 'active' : ''}" data-subject="all">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="width: 7px; height: 7px; border-radius: 50%; background: var(--accent-primary);"></span>
          <span>All Subjects</span>
        </div>
        <span class="badge badge-neutral">${store.data.notes.length}</span>
      </div>
    `;

    store.data.subjects.forEach(subj => {
      const count = store.data.notes.filter(n => n.subjectId === subj.id).length;
      const isActive = this.selectedSubjectId === subj.id;
      html += `
        <div class="subject-item-row ${isActive ? 'active' : ''}" data-subject="${subj.id}">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${subj.color};"></span>
            <span>${subj.name}</span>
          </div>
          <span class="badge badge-neutral">${count}</span>
        </div>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.subject-item-row').forEach(el => {
      el.addEventListener('click', () => {
        this.selectedSubjectId = el.dataset.subject;
        this.renderSubjectsList();
        this.renderNotesList();
      });
    });
  }

  renderNotesList() {
    const container = document.getElementById('notes-card-list');
    if (!container) return;

    let filtered = store.data.notes;

    if (this.selectedSubjectId !== 'all') {
      filtered = filtered.filter(n => n.subjectId === this.selectedSubjectId);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(n => 
        n.title.toLowerCase().includes(this.searchQuery) ||
        n.content.toLowerCase().includes(this.searchQuery) ||
        (n.tags && n.tags.some(t => t.toLowerCase().includes(this.searchQuery)))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          No notes found.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(note => {
      const subject = store.data.subjects.find(s => s.id === note.subjectId);
      const isSelected = note.id === this.selectedNoteId;
      const dateStr = new Date(note.updatedAt || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      
      const snippet = note.content.replace(/[#*`>\-_]/g, '').trim().substring(0, 90) + '...';

      return `
        <div class="note-item-card ${isSelected ? 'active' : ''}" data-id="${note.id}">
          <div class="note-item-title">${note.title || 'Untitled Note'}</div>
          <div class="note-item-snippet">${snippet}</div>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted); margin-top: 0.35rem;">
            <span style="color: ${subject ? subject.color : 'inherit'}; font-weight: 500;">
              ${subject ? subject.name : 'General'}
            </span>
            <span>${dateStr}</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.note-item-card').forEach(el => {
      el.addEventListener('click', () => {
        this.selectNote(el.dataset.id);
      });
    });
  }

  selectNote(noteId) {
    this.selectedNoteId = noteId;
    const note = store.data.notes.find(n => n.id === noteId);
    if (!note) return;

    const titleInput = document.getElementById('note-editor-title');
    const textarea = document.getElementById('note-markdown-textarea');
    const subjectSelect = document.getElementById('note-subject-select');
    const tagsInput = document.getElementById('note-tags-input');

    if (titleInput) titleInput.value = note.title;
    if (textarea) textarea.value = note.content;
    
    // Populate Subject select
    if (subjectSelect) {
      subjectSelect.innerHTML = store.data.subjects.map(s => `
        <option value="${s.id}" ${s.id === note.subjectId ? 'selected' : ''}>${s.name}</option>
      `).join('');

      subjectSelect.onchange = (e) => {
        note.subjectId = e.target.value;
        store.saveData();
        this.renderSubjectsList();
        this.renderNotesList();
      };
    }

    if (tagsInput) {
      tagsInput.value = (note.tags || []).join(', ');
      tagsInput.onchange = (e) => {
        note.tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
        store.saveData();
      };
    }

    this.updatePreview();
    this.renderNotesList();
  }

  updatePreview() {
    const note = store.data.notes.find(n => n.id === this.selectedNoteId);
    const previewPane = document.getElementById('note-markdown-preview');
    if (!previewPane) return;

    if (note) {
      previewPane.innerHTML = renderMarkdown(note.content);
    } else {
      previewPane.innerHTML = '<p class="text-muted">Select or create a note to preview.</p>';
    }
  }

  setViewMode(mode) {
    this.viewMode = mode;
    const body = document.getElementById('note-editor-body');
    if (!body) return;

    body.classList.remove('preview-only', 'edit-only');
    if (mode === 'preview') body.classList.add('preview-only');
    if (mode === 'edit') body.classList.add('edit-only');

    document.querySelectorAll('.note-view-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  }

  createNewNote(title = "Untitled Note", initialContent = "# New Note\n\nWrite your study notes here...") {
    const newNote = {
      id: 'note-' + Date.now(),
      subjectId: this.selectedSubjectId !== 'all' ? this.selectedSubjectId : (store.data.subjects[0]?.id || 'subj-1'),
      title,
      tags: ["Study"],
      updatedAt: new Date().toISOString(),
      content: initialContent
    };

    store.data.notes.unshift(newNote);
    store.saveData();
    
    this.renderSubjectsList();
    this.selectNote(newNote.id);
    
    const titleInput = document.getElementById('note-editor-title');
    if (titleInput) titleInput.focus();

    showToast("✨ New note created", "success");
  }

  deleteCurrentNote() {
    if (!this.selectedNoteId) return;
    if (!confirm('Are you sure you want to delete this note?')) return;

    store.data.notes = store.data.notes.filter(n => n.id !== this.selectedNoteId);
    store.saveData();
    this.selectedNoteId = store.data.notes[0]?.id || null;
    
    this.renderSubjectsList();
    this.renderNotesList();
    if (this.selectedNoteId) {
      this.selectNote(this.selectedNoteId);
    } else {
      document.getElementById('note-editor-title').value = '';
      document.getElementById('note-markdown-textarea').value = '';
      document.getElementById('note-markdown-preview').innerHTML = '';
    }
    showToast("🗑️ Note deleted", "info");
  }

  exportCurrentNote() {
    const note = store.data.notes.find(n => n.id === this.selectedNoteId);
    if (!note) return;

    const blob = new Blob([note.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("📥 Exported Markdown note", "success");
  }

  promptAddSubject() {
    const name = prompt("Enter new Subject Name (e.g., Computer Vision, Quantum Computing):");
    if (!name || !name.trim()) return;

    const colors = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#f43f5e", "#ec4899", "#3b82f6"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newSubj = {
      id: 'subj-' + Date.now(),
      name: name.trim(),
      color: randomColor,
      icon: "book",
      description: "Custom study subject"
    };

    store.data.subjects.push(newSubj);
    store.saveData();
    this.renderSubjectsList();
    showToast(`📚 Subject "${newSubj.name}" created`, "success");
  }
}

const notesManager = new NotesManager();
