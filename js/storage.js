// ==========================================
// SYNAPSE OS: Storage & State Management
// LocalStorage Caching + Real-Time Backend API Sync
// ==========================================

const STORAGE_KEY = 'synapse_os_data_v1';

class AppStore {
  constructor() {
    this.data = this.loadData();
    this.listeners = [];
    this.backendConnected = false;
    this.syncDebounceTimer = null;

    // Start background sync with backend server
    this.initBackendSync();
  }

  loadData() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // Merge default profile (Ananya Sharma & Learnova metrics)
          parsed.profile = Object.assign({}, DEFAULT_DATA.profile, parsed.profile || {});

          // Merge live videos if missing
          if (Array.isArray(parsed.youtubeVideos)) {
            DEFAULT_DATA.youtubeVideos.forEach(v => {
              if (!parsed.youtubeVideos.some(existing => existing.id === v.id || existing.videoId === v.videoId)) {
                parsed.youtubeVideos.unshift(v);
              }
            });
          } else {
            parsed.youtubeVideos = JSON.parse(JSON.stringify(DEFAULT_DATA.youtubeVideos));
          }

          // Ensure 8 courses are present
          if (!Array.isArray(parsed.courses) || parsed.courses.length < 8) {
            parsed.courses = JSON.parse(JSON.stringify(DEFAULT_DATA.courses));
          }

          // Ensure assignments are present
          if (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
            parsed.tasks = JSON.parse(JSON.stringify(DEFAULT_DATA.tasks));
          }

          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load state from localStorage:', e);
    }
    // Deep clone default data
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  // --- Real-Time Backend Sync Engine ---
  async initBackendSync() {
    try {
      const res = await fetch('/api/data', { cache: 'no-store' });
      if (res.ok) {
        const payload = await res.json();
        if (payload.success && payload.data) {
          this.backendConnected = true;
          this.updateServerPill(true, 'Backend Active');

          // If backend has data, merge or adopt
          if (payload.data.subjects && payload.data.subjects.length > 0) {
            this.data = payload.data;
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
            } catch (e) {}
            this.notify();
          } else {
            // Seed backend with local data if server empty
            this.syncToBackend();
          }
          return;
        }
      }
      this.updateServerPill(false, 'Local Storage');
    } catch (err) {
      this.backendConnected = false;
      this.updateServerPill(false, 'Local Storage');
    }
  }

  syncToBackend() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(async () => {
      try {
        const res = await fetch('/api/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.data)
        });
        if (res.ok) {
          const payload = await res.json();
          if (payload.success) {
            this.backendConnected = true;
            this.updateServerPill(true, 'Backend Synced');
          }
        } else {
          this.updateServerPill(false, 'Sync Offline');
        }
      } catch (err) {
        this.backendConnected = false;
        this.updateServerPill(false, 'Sync Offline');
      }
    }, 400);
  }

  updateServerPill(isOnline, text = 'Backend Active') {
    const pill = document.getElementById('server-status-pill');
    const label = document.getElementById('server-status-text');
    if (!pill || !label) return;

    if (isOnline) {
      pill.className = 'badge badge-emerald';
      pill.innerHTML = `<span>🟢</span><span>${text}</span>`;
      pill.title = 'Connected to Node.js backend server (Port 3000) — All changes saved persistently to server disk';
    } else {
      pill.className = 'badge badge-amber';
      pill.innerHTML = `<span>🟡</span><span>${text}</span>`;
      pill.title = 'Running in offline localStorage fallback mode';
    }
  }

  saveData() {
    try {
      // 1. Instant local persistence for 0ms lag
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      this.notify();

      // 2. Persistent server synchronization
      this.syncToBackend();

      // 3. Supabase Cloud synchronization (when authenticated)
      if (typeof authManager !== 'undefined' && authManager.user && authManager.syncUserWorkspaceToCloud) {
        authManager.syncUserWorkspaceToCloud();
      }
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  resetToDefault() {
    this.data = JSON.parse(JSON.stringify(DEFAULT_DATA));
    this.saveData();
  }

  exportBackup() {
    const jsonStr = JSON.stringify(this.data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `synapse-os-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importBackup(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.profile && parsed.subjects && parsed.notes) {
          this.data = parsed;
          this.saveData();
          if (callback) callback(true);
        } else {
          alert('Invalid backup file structure.');
          if (callback) callback(false);
        }
      } catch (err) {
        alert('Could not parse backup JSON file.');
        if (callback) callback(false);
      }
    };
    reader.readAsText(file);
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.data));
  }

  // --- Profile & Study Progress Helpers ---
  logStudySession(subjectId, durationMinutes, topic) {
    const todayStr = new Date().toISOString().split('T')[0];
    const newSession = {
      id: 'ses-' + Date.now(),
      date: todayStr,
      subjectId,
      durationMinutes,
      topic: topic || 'General Study Session'
    };
    if (!this.data.studySessions) this.data.studySessions = [];
    this.data.studySessions.unshift(newSession);
    this.data.profile.todayHoursStudied = Number((this.data.profile.todayHoursStudied + (durationMinutes / 60)).toFixed(1));
    this.data.profile.totalHoursStudied = Number((this.data.profile.totalHoursStudied + (durationMinutes / 60)).toFixed(1));
    this.saveData();
    return newSession;
  }
}

// Global Store Instance
const store = new AppStore();
