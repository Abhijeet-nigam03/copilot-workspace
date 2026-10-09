// ==========================================
// SYNAPSE OS: Productivity & Task Manager
// Today's Planner, Responsive Task List, Pomodoro Focus
// ==========================================

class ProductivityManager {
  constructor() {
    this.categoryFilter = 'all';
    this.priorityFilter = 'all';
    this.statusFilter = 'all';
    this.searchQuery = '';

    // Pomodoro Timer State
    this.pomoDuration = 25 * 60; // 25 mins default
    this.pomoRemaining = 25 * 60;
    this.pomoRunning = false;
    this.pomoInterval = null;
    this.pomoMode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
    this.pomoSessionsToday = 3;
  }

  init() {
    this.renderTodaysPlanner();
    this.renderUnifiedTasks();
    this.initPomodoro();
    this.bindEvents();
  }

  bindEvents() {
    // Task Search Input
    const searchInput = document.getElementById('task-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = (e.target.value || '').toLowerCase().trim();
        this.renderUnifiedTasks();
      });
    }

    // Category Filter
    const catSelect = document.getElementById('task-category-filter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.categoryFilter = e.target.value;
        this.renderUnifiedTasks();
      });
    }

    // Priority Filter
    const prioritySelect = document.getElementById('task-priority-filter');
    if (prioritySelect) {
      prioritySelect.addEventListener('change', (e) => {
        this.priorityFilter = e.target.value;
        this.renderUnifiedTasks();
      });
    }

    // Status Filter Tabs
    document.querySelectorAll('#task-status-filter-group .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#task-status-filter-group .segment-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.statusFilter = e.currentTarget.dataset.status || 'all';
        this.renderUnifiedTasks();
      });
    });

    // Add Task Button
    const addTaskBtn = document.getElementById('btn-add-task-modal');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => this.openAddTaskModal());
    }

    // Pomodoro Buttons
    const pomoStartBtn = document.getElementById('btn-pomo-start');
    if (pomoStartBtn) {
      pomoStartBtn.addEventListener('click', () => this.togglePomodoro());
    }

    const pomoResetBtn = document.getElementById('btn-pomo-reset');
    if (pomoResetBtn) {
      pomoResetBtn.addEventListener('click', () => this.resetPomodoro());
    }

    document.querySelectorAll('.pomo-mode-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.currentTarget.dataset.mode;
        this.switchPomodoroMode(mode);
      });
    });

    // Ambient Sound Chips
    document.querySelectorAll('.ambient-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const soundType = e.currentTarget.dataset.sound;
        const activeSound = audioSynth.toggleAmbient(soundType);
        
        document.querySelectorAll('.ambient-chip').forEach(b => b.classList.remove('active'));
        if (activeSound) {
          e.currentTarget.classList.add('active');
          showToast(`🎧 Ambient sound playing: ${soundType}`, 'info');
        } else {
          showToast('🔇 Ambient sound paused', 'info');
        }
      });
    });
  }

  // --- 1. TODAY'S PLANNER (TIME BLOCKS) ---
  renderTodaysPlanner() {
    const morningCol = document.getElementById('planner-block-morning');
    const afternoonCol = document.getElementById('planner-block-afternoon');
    const eveningCol = document.getElementById('planner-block-evening');

    if (!morningCol || !afternoonCol || !eveningCol) return;

    const todayTasks = store.data.tasks.filter(t => t.isToday);

    const renderColumnTasks = (timeBlock) => {
      const tasks = todayTasks.filter(t => (t.timeBlock || 'Morning') === timeBlock);
      if (tasks.length === 0) {
        return `<div style="font-size: 0.78rem; color: var(--text-muted); padding: 0.6rem 0;">No tasks scheduled for this block.</div>`;
      }

      return tasks.map(task => {
        const subject = store.data.subjects.find(s => s.id === task.subjectId);
        const isDone = task.status === 'completed';
        const badgeClass = task.priority === 'high' ? 'badge-rose' : task.priority === 'medium' ? 'badge-amber' : 'badge-emerald';

        return `
          <div class="task-row" data-id="${task.id}">
            <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1;">
              <button class="task-checkbox-btn ${isDone ? 'checked' : ''}" data-id="${task.id}">
                ✓
              </button>
              <div>
                <div class="task-title-text ${isDone ? 'done' : ''}">${task.title}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 0.4rem; margin-top: 0.15rem;">
                  <span style="color: ${subject ? subject.color : 'inherit'}; font-weight: 500;">${subject ? subject.name : task.category}</span>
                  <span>•</span>
                  <span>${task.estimatedMins || 30}m</span>
                </div>
              </div>
            </div>
            <span class="badge ${badgeClass}">
              <span class="badge-dot"></span>
              <span>${task.priority}</span>
            </span>
          </div>
        `;
      }).join('');
    };

    morningCol.innerHTML = renderColumnTasks('Morning');
    afternoonCol.innerHTML = renderColumnTasks('Afternoon');
    eveningCol.innerHTML = renderColumnTasks('Evening');

    // Bind checkbox clicks in planner
    document.querySelectorAll('.planner-grid-cols .task-checkbox-btn').forEach(box => {
      box.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.id;
        this.toggleTaskStatus(taskId);
      });
    });
  }

  // --- 2. RESPONSIVE TASK LIST MANAGER (KANBAN REMOVED) ---
  renderUnifiedTasks() {
    const listContainer = document.getElementById('tasks-list-view');
    if (!listContainer) return;

    const allTasks = store.data.tasks || [];

    // Calculate Completion Progress
    const totalCount = allTasks.length;
    const completedCount = allTasks.filter(t => t.status === 'completed').length;
    const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const progressBadge = document.getElementById('task-progress-badge');
    const progressBar = document.getElementById('task-progress-bar-fill');
    if (progressBadge) {
      progressBadge.textContent = `${completedCount} / ${totalCount} completed (${pct}%)`;
    }
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
    }

    // Apply Filters
    let filtered = allTasks;

    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === this.categoryFilter);
    }

    if (this.priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === this.priorityFilter);
    }

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(t => t.status === this.statusFilter);
    }

    if (this.searchQuery) {
      filtered = filtered.filter(t =>
        (t.title && t.title.toLowerCase().includes(this.searchQuery)) ||
        (t.category && t.category.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem; font-size: 0.85rem;">
          <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">📋</div>
          <strong>No tasks found.</strong><br>
          ${this.searchQuery || this.statusFilter !== 'all' || this.categoryFilter !== 'all' ? 'Try adjusting your filters above.' : 'Click "+ New Task" to add your first goal.'}
        </div>
      `;
      return;
    }

    listContainer.innerHTML = filtered.map(task => {
      const isDone = task.status === 'completed';
      const isInProgress = task.status === 'in-progress';
      const subject = store.data.subjects.find(s => s.id === task.subjectId);
      const priorityClass = task.priority === 'high' ? 'badge-rose' : task.priority === 'medium' ? 'badge-amber' : 'badge-emerald';

      let statusBadgeHtml = '';
      if (isDone) {
        statusBadgeHtml = `<span class="badge badge-emerald" style="cursor: pointer;" title="Click to cycle status">✓ Done</span>`;
      } else if (isInProgress) {
        statusBadgeHtml = `<span class="badge badge-primary" style="cursor: pointer;" title="Click to cycle status">⚡ In Progress</span>`;
      } else {
        statusBadgeHtml = `<span class="badge badge-neutral" style="cursor: pointer;" title="Click to cycle status">⏳ Pending</span>`;
      }

      return `
        <div class="task-row" data-id="${task.id}" style="padding: 0.75rem 1rem; transition: background var(--trans-fast); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-surface);">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;">
            <button class="task-checkbox-btn ${isDone ? 'checked' : ''}" data-id="${task.id}" title="${isDone ? 'Mark Pending' : 'Mark Completed'}">
              ✓
            </button>
            <div style="min-width: 0; flex: 1;">
              <div class="task-title-text ${isDone ? 'done' : ''}" style="font-size: 0.88rem; font-weight: 500; word-break: break-word;">${task.title}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; gap: 0.5rem; margin-top: 0.2rem; flex-wrap: wrap; align-items: center;">
                <span class="badge badge-neutral" style="font-size: 0.65rem; padding: 0.1rem 0.4rem;">${task.category}</span>
                <span style="color: ${subject ? subject.color : 'inherit'}; font-weight: 500;">
                  ${subject ? subject.name : 'General'}
                </span>
                <span>•</span>
                <span>Due: ${task.dueDate || 'Today'}</span>
                ${task.estimatedMins ? `<span>• ${task.estimatedMins}m</span>` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
            <!-- Clickable Status Badge (Advances Status) -->
            <div class="btn-cycle-status" data-id="${task.id}" title="Click to cycle status (Pending -> In Progress -> Completed)">
              ${statusBadgeHtml}
            </div>

            <!-- Priority Badge -->
            <span class="badge ${priorityClass}">
              <span class="badge-dot"></span>
              <span>${task.priority}</span>
            </span>

            <!-- Delete Button -->
            <button class="btn-icon btn-delete-task" data-id="${task.id}" title="Delete task" style="width: 26px; height: 26px; font-size: 0.74rem;">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind checkboxes
    listContainer.querySelectorAll('.task-checkbox-btn').forEach(box => {
      box.addEventListener('click', (e) => {
        this.toggleTaskStatus(e.currentTarget.dataset.id);
      });
    });

    // Bind status cycle clicks
    listContainer.querySelectorAll('.btn-cycle-status').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const taskId = e.currentTarget.dataset.id;
        this.advanceTaskStatus(taskId);
      });
    });

    // Bind delete buttons
    listContainer.querySelectorAll('.btn-delete-task').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.deleteTask(e.currentTarget.dataset.id);
      });
    });
  }

  toggleTaskStatus(taskId) {
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = task.status === 'completed' ? 'pending' : 'completed';
    if (task.status === 'completed') {
      store.data.profile.tasksCompletedTotal++;
      showToast('🎉 Task marked completed!', 'success');
    }
    store.saveData();

    this.renderTodaysPlanner();
    this.renderUnifiedTasks();
    this.updateDashboardWidgets();
  }

  advanceTaskStatus(taskId) {
    const task = store.data.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status === 'pending') {
      task.status = 'in-progress';
      showToast('⚡ Task set to In Progress', 'info');
    } else if (task.status === 'in-progress') {
      task.status = 'completed';
      store.data.profile.tasksCompletedTotal++;
      showToast('🎉 Task completed!', 'success');
    } else {
      task.status = 'pending';
      showToast('⏳ Task reset to Pending', 'info');
    }
    store.saveData();

    this.renderTodaysPlanner();
    this.renderUnifiedTasks();
    this.updateDashboardWidgets();
  }

  deleteTask(taskId) {
    store.data.tasks = store.data.tasks.filter(t => t.id !== taskId);
    store.saveData();
    this.renderTodaysPlanner();
    this.renderUnifiedTasks();
    this.updateDashboardWidgets();
    showToast('Task removed', 'info');
  }

  openAddTaskModal() {
    const modal = document.getElementById('modal-add-task');
    if (modal) {
      modal.classList.add('open');
      const input = document.getElementById('input-task-title');
      if (input) input.focus();
    }
  }

  updateDashboardWidgets() {
    // Also re-render dashboard task list & counters
    if (window.renderDashboard) {
      window.renderDashboard();
    }
  }

  // --- 3. POMODORO TIMER & LOGGING ---
  initPomodoro() {
    this.updatePomodoroDisplay();
  }

  switchPomodoroMode(mode) {
    this.pomoMode = mode;
    this.pausePomodoro();

    if (mode === 'focus') {
      this.pomoDuration = 25 * 60;
    } else if (mode === 'shortBreak') {
      this.pomoDuration = 5 * 60;
    } else if (mode === 'longBreak') {
      this.pomoDuration = 15 * 60;
    }

    this.pomoRemaining = this.pomoDuration;
    
    document.querySelectorAll('.pomo-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    this.updatePomodoroDisplay();
  }

  togglePomodoro() {
    if (this.pomoRunning) {
      this.pausePomodoro();
    } else {
      this.startPomodoro();
    }
  }

  startPomodoro() {
    this.pomoRunning = true;
    const startBtn = document.getElementById('btn-pomo-start');
    if (startBtn) startBtn.textContent = 'Pause';

    this.pomoInterval = setInterval(() => {
      if (this.pomoRemaining > 0) {
        this.pomoRemaining--;
        this.updatePomodoroDisplay();
      } else {
        this.completePomodoroSession();
      }
    }, 1000);
  }

  pausePomodoro() {
    this.pomoRunning = false;
    clearInterval(this.pomoInterval);
    const startBtn = document.getElementById('btn-pomo-start');
    if (startBtn) startBtn.textContent = 'Start Focus';
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.pomoRemaining = this.pomoDuration;
    this.updatePomodoroDisplay();
  }

  completePomodoroSession() {
    this.pausePomodoro();
    audioSynth.playCompletionChime();

    if (this.pomoMode === 'focus') {
      this.pomoSessionsToday++;
      // Auto-log completed session (25 mins)
      store.logStudySession(store.data.subjects[0]?.id || 'subj-1', 25, 'Pomodoro Focus Block');
      showToast('🏆 Focus block complete! 25 minutes logged to Study Tracker.', 'success');
      this.switchPomodoroMode('shortBreak');
    } else {
      showToast('☕ Break over! Ready to focus again?', 'info');
      this.switchPomodoroMode('focus');
    }

    if (window.renderDashboard) window.renderDashboard();
    if (window.analyticsManager) window.analyticsManager.renderAnalytics();
  }

  updatePomodoroDisplay() {
    const mins = Math.floor(this.pomoRemaining / 60);
    const secs = this.pomoRemaining % 60;
    const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Update main Pomodoro display
    const textEl = document.getElementById('pomo-timer-text');
    if (textEl) textEl.textContent = timeStr;

    // Update header mini badge
    const headerPomo = document.getElementById('header-pomo-display');
    if (headerPomo) headerPomo.textContent = timeStr;

    // Update circle SVG stroke dashoffset
    const circle = document.getElementById('pomo-svg-circle');
    if (circle) {
      const radius = 88;
      const circumference = 2 * Math.PI * radius;
      const progress = 1 - (this.pomoRemaining / this.pomoDuration);
      circle.style.strokeDashoffset = circumference * (1 - progress);
    }
  }
}

const productivityManager = new ProductivityManager();
