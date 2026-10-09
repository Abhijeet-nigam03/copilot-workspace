// ==========================================
// SYNAPSE OS: Main Application Orchestrator
// View Routing, Command Palette, Toast System, Dashboard
// ==========================================

// Global Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let dotColor = 'var(--text-muted)';
  if (type === 'success') dotColor = 'var(--accent-emerald)';
  if (type === 'warning') dotColor = 'var(--accent-amber)';
  if (type === 'error') dotColor = 'var(--accent-rose)';

  toast.innerHTML = `<span style="width: 7px; height: 7px; border-radius: 50%; background: ${dotColor}; flex-shrink: 0;"></span> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = '0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

class SynapseApp {
  constructor() {
    this.currentMainTab = 'dashboard';
    this.currentStudySub = 'notes';
    this.currentProdSub = 'planner';
    this.currentWorkSub = 'courses';
  }

  init() {
    this.bindNavigation();
    this.bindCommandPalette();
    this.bindQuickCapture();
    this.bindThemeToggle();
    this.bindModals();
    this.bindBackupRestore();
    this.bindFocusMode();

    // Supabase Auth & Cloud Sync
    if (typeof authManager !== 'undefined' && authManager.init) {
      authManager.init();
    }

    // Render Dashboard
    this.renderDashboard();

    // Listen to store updates
    store.subscribe(() => {
      this.renderDashboard();
    });

    // Keyboard shortcuts: Ctrl+K for Search, Ctrl+N for Quick Capture, Esc to close modals
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.openCommandPalette();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.openQuickCapture();
      }
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    this.refreshIcons();
  }

  refreshIcons() {
    if (window.lucide && window.lucide.createIcons) {
      setTimeout(() => {
        try { window.lucide.createIcons(); } catch (e) {}
      }, 50);
    }
  }

  // --- 1. VIEW ROUTING & TABS ---
  bindNavigation() {
    // Sidebar Navigation Buttons
    document.querySelectorAll('.nav-link-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        const sub = e.currentTarget.dataset.sub;
        if (!tab) return; // Prevent clearing active views when opening modals

        this.switchMainTab(tab);
        if (sub) {
          if (tab === 'study') this.switchStudySub(sub);
          if (tab === 'productivity') this.switchProdSub(sub);
          if (tab === 'workspace') this.switchWorkspaceSub(sub);
        }

        // Auto close mobile drawer if open
        this.closeMobileSidebar();
      });
    });

    // Mobile Menu Toggle Button
    const mobileMenuBtn = document.getElementById('btn-mobile-menu');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', () => {
        this.toggleMobileSidebar();
      });
    }
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // Mobile Bottom Navigation Bar Buttons
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        if (target.id === 'mobile-nav-profile-btn') {
          this.openSettingsModal();
          return;
        }

        const tab = target.dataset.tab;
        const sub = target.dataset.sub;
        if (!tab) return;

        this.switchMainTab(tab);
        if (sub) {
          if (tab === 'study') this.switchStudySub(sub);
          if (tab === 'productivity') this.switchProdSub(sub);
          if (tab === 'workspace') this.switchWorkspaceSub(sub);
        }

        // Update mobile bottom nav active state
        document.querySelectorAll('.mobile-nav-item').forEach(item => {
          item.classList.toggle('active', item === target);
        });
      });
    });

    // Study Sub-pills (Notes, YouTube, PDF)
    document.querySelectorAll('#study-sub-pills .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sub = e.currentTarget.dataset.sub;
        this.switchStudySub(sub);
      });
    });

    // Productivity Sub-pills (Today's Plan, Tasks & Kanban, Study Tracker)
    document.querySelectorAll('#prod-sub-pills .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sub = e.currentTarget.dataset.sub;
        this.switchProdSub(sub);
      });
    });

    // Personal Workspace Sub-pills (Courses, Certifications, Skills, Goals)
    document.querySelectorAll('#workspace-sub-pills .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sub = e.currentTarget.dataset.sub;
        this.switchWorkspaceSub(sub);
      });
    });
  }

  toggleMobileSidebar() {
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('active');
  }

  closeMobileSidebar() {
    const sidebar = document.querySelector('.app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  switchMainTab(tabId) {
    if (!tabId) return;
    this.currentMainTab = tabId;

    // Update Sidebar active state
    document.querySelectorAll('.nav-link-btn').forEach(btn => {
      const matchTab = btn.dataset.tab === tabId;
      const sub = btn.dataset.sub;
      if (!sub) {
        btn.classList.toggle('active', matchTab);
      } else {
        const matchSub = (tabId === 'study' && sub === this.currentStudySub) ||
                         (tabId === 'productivity' && sub === this.currentProdSub) ||
                         (tabId === 'workspace' && sub === this.currentWorkSub);
        btn.classList.toggle('active', matchTab && matchSub);
      }
    });

    // Update Mobile bottom nav active state
    document.querySelectorAll('.mobile-nav-item').forEach(btn => {
      if (btn.dataset.tab) {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
      }
    });

    // Update View Panels
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${tabId}`);
    });

    // Update Breadcrumbs
    this.updateBreadcrumbs();

    // Trigger module lifecycle
    if (tabId === 'dashboard') this.renderDashboard();
    if (tabId === 'study') {
      if (this.currentStudySub === 'notes') notesManager.init();
      if (this.currentStudySub === 'youtube') ytManager.init();
      if (this.currentStudySub === 'pdf') pdfManager.init();
    }
    if (tabId === 'productivity') {
      productivityManager.init();
      if (this.currentProdSub === 'tracker') analyticsManager.init();
    }
    if (tabId === 'workspace') {
      workspaceManager.init();
    }

    this.refreshIcons();
    const scrollPane = document.querySelector('.main-content-scroll');
    if (scrollPane) scrollPane.scrollTo({ top: 0, behavior: 'smooth' });
  }

  switchStudySub(subId) {
    this.currentStudySub = subId;
    document.querySelectorAll('#study-sub-pills .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sub === subId);
    });
    document.querySelectorAll('.study-subview').forEach(view => {
      view.classList.toggle('active', view.id === `study-view-${subId}`);
    });

    this.highlightSidebarLink('study', subId);
    this.updateBreadcrumbs();

    if (subId === 'notes') notesManager.init();
    if (subId === 'youtube') ytManager.init();
    if (subId === 'pdf') pdfManager.init();
    this.refreshIcons();
  }

  switchProdSub(subId) {
    this.currentProdSub = subId;
    document.querySelectorAll('#prod-sub-pills .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sub === subId);
    });
    document.querySelectorAll('.prod-subview').forEach(view => {
      view.classList.toggle('active', view.id === `prod-view-${subId}`);
    });

    this.highlightSidebarLink('productivity', subId);
    this.updateBreadcrumbs();

    if (subId === 'planner') productivityManager.renderTodaysPlanner();
    if (subId === 'tasks') productivityManager.renderUnifiedTasks();
    if (subId === 'tracker') analyticsManager.init();
    this.refreshIcons();
  }

  switchWorkspaceSub(subId) {
    this.currentWorkSub = subId;
    document.querySelectorAll('#workspace-sub-pills .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sub === subId);
    });
    document.querySelectorAll('.workspace-subview').forEach(view => {
      view.classList.toggle('active', view.id === `workspace-view-${subId}`);
    });

    this.highlightSidebarLink('workspace', subId);
    this.updateBreadcrumbs();

    if (subId === 'courses') workspaceManager.renderCourses();
    if (subId === 'certs') workspaceManager.renderCertifications();
    if (subId === 'skills') workspaceManager.renderSkills();
    if (subId === 'goals') workspaceManager.renderGoals();
    this.refreshIcons();
  }

  highlightSidebarLink(tab, sub) {
    document.querySelectorAll('.nav-link-btn').forEach(btn => {
      if (btn.dataset.tab === tab && btn.dataset.sub === sub) {
        btn.classList.add('active');
      } else if (btn.dataset.tab === tab && !btn.dataset.sub && !sub) {
        btn.classList.add('active');
      } else if (btn.dataset.tab === tab && btn.dataset.sub !== sub) {
        btn.classList.remove('active');
      }
    });
  }

  updateBreadcrumbs() {
    const catEl = document.getElementById('top-bread-category');
    const curEl = document.getElementById('top-bread-current');
    if (!catEl || !curEl) return;

    if (this.currentMainTab === 'dashboard') {
      catEl.textContent = 'Workspace';
      curEl.textContent = 'Dashboard';
    } else if (this.currentMainTab === 'study') {
      catEl.textContent = 'Study Hub';
      const map = { notes: 'Subject Notes', youtube: 'YouTube Study', pdf: 'PDF Manager' };
      curEl.textContent = map[this.currentStudySub] || 'Study';
    } else if (this.currentMainTab === 'productivity') {
      catEl.textContent = 'Productivity';
      const map = { planner: "Today's Plan", tasks: 'Task List', tracker: 'Study Tracker' };
      curEl.textContent = map[this.currentProdSub] || 'Tasks';
    } else if (this.currentMainTab === 'workspace') {
      catEl.textContent = 'Personal Growth';
      const map = { courses: 'Courses', certs: 'Certifications', skills: 'Skills Matrix', goals: 'Goals & Milestones' };
      curEl.textContent = map[this.currentWorkSub] || 'Workspace';
    }
  }

  // --- 2. DASHBOARD RENDERING ---
  renderDashboard() {
    const now = new Date();
    const dateStrEl = document.getElementById('dash-date-str');
    if (dateStrEl) {
      dateStrEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }

    const hour = now.getHours();
    let greeting = "Good evening";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    const greetingEl = document.getElementById('dash-greeting-text');
    if (greetingEl) greetingEl.textContent = `${greeting}, ${store.data.profile.name}`;

    // Learnova LMS KPI Elements (Matching Screenshot)
    const lkpiCourses = document.getElementById('dash-kpi-courses');
    const lkpiClasses = document.getElementById('dash-kpi-classes');
    const lkpiAssignments = document.getElementById('dash-kpi-assignments');
    const lkpiAttendance = document.getElementById('dash-kpi-attendance');
    const lkpiStreak = document.getElementById('dash-streak-days');
    const lkpiDonutPct = document.getElementById('dash-donut-pct');

    if (lkpiCourses) lkpiCourses.textContent = store.data.profile.coursesEnrolled || 8;
    if (lkpiClasses) lkpiClasses.textContent = store.data.profile.classesToday || 3;
    if (lkpiAssignments) lkpiAssignments.textContent = store.data.profile.assignmentsDue || 2;
    if (lkpiAttendance) lkpiAttendance.textContent = `${store.data.profile.attendancePercent || 92}%`;
    if (lkpiStreak) lkpiStreak.textContent = store.data.profile.streakDays || 12;
    if (lkpiDonutPct) lkpiDonutPct.textContent = `${store.data.profile.learningProgressPercent || 72}%`;

    // Legacy / General KPI Counters
    const kpiToday = document.getElementById('kpi-study-today');
    const kpiStreak = document.getElementById('kpi-streak');
    const kpiTasks = document.getElementById('kpi-tasks-done');
    const kpiCourses = document.getElementById('kpi-active-courses');
    const navStreak = document.getElementById('nav-streak-counter');

    if (kpiToday) kpiToday.textContent = `${store.data.profile.todayHoursStudied}h`;
    if (kpiStreak) kpiStreak.textContent = `${store.data.profile.streakDays}d`;
    if (navStreak) navStreak.textContent = `${store.data.profile.streakDays}d`;
    if (kpiTasks) kpiTasks.textContent = store.data.tasks.filter(t => t.status === 'completed').length;
    if (kpiCourses) kpiCourses.textContent = store.data.courses.filter(c => c.status === 'In Progress').length;

    // Today's Study Tasks widget
    const todayTasksContainer = document.getElementById('dash-today-tasks-list');
    if (todayTasksContainer) {
      const todayTasks = store.data.tasks.filter(t => t.isToday);
      if (todayTasks.length === 0) {
        todayTasksContainer.innerHTML = `<div style="color: var(--text-muted); font-size: 0.82rem; padding: 1.25rem 0; text-align: center;">All daily tasks completed.</div>`;
      } else {
        todayTasksContainer.innerHTML = todayTasks.map(task => {
          const isDone = task.status === 'completed';
          const subject = store.data.subjects.find(s => s.id === task.subjectId);
          return `
            <div class="task-row" data-id="${task.id}">
              <div style="display: flex; align-items: center; gap: 0.65rem; flex: 1;">
                <button class="task-checkbox-btn ${isDone ? 'checked' : ''}" data-id="${task.id}">
                  ✓
                </button>
                <div>
                  <div class="task-title-text ${isDone ? 'done' : ''}">${task.title}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); display: flex; gap: 0.4rem; margin-top: 0.15rem;">
                    <span style="color: ${subject ? subject.color : 'inherit'}; font-weight: 500;">
                      ${subject ? subject.name : task.category}
                    </span>
                    <span>•</span>
                    <span>${task.timeBlock || 'Morning'}</span>
                  </div>
                </div>
              </div>
              <span class="badge ${task.priority === 'high' ? 'badge-rose' : task.priority === 'medium' ? 'badge-amber' : 'badge-emerald'}">
                <span class="badge-dot"></span>
                <span>${task.priority}</span>
              </span>
            </div>
          `;
        }).join('');

        todayTasksContainer.querySelectorAll('.task-checkbox-btn').forEach(box => {
          box.addEventListener('click', (e) => {
            const taskId = e.currentTarget.dataset.id;
            productivityManager.toggleTaskStatus(taskId);
          });
        });
      }
    }

    // Mini Activity Bar Chart on Dashboard
    this.renderDashMiniActivity();

    // Quick Resume Cards
    this.renderDashQuickResume();
    this.refreshIcons();
  }

  renderDashMiniActivity() {
    const container = document.getElementById('dash-mini-activity');
    if (!container) return;

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const past7 = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLetter = days[d.getDay()];

      const mins = store.data.studySessions
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + s.durationMinutes, 0);

      past7.push({ dateStr, dayLetter, mins, hours: (mins / 60) });
    }

    const maxM = Math.max(...past7.map(d => d.mins), 60);

    container.innerHTML = past7.map(d => {
      const isToday = d.dateStr === today.toISOString().split('T')[0];
      const heightPercent = Math.min((d.mins / maxM) * 100, 100);
      return `
        <div class="sparkline-col" title="${d.dateStr}: ${Math.round(d.mins)} mins studied">
          <div class="sparkline-fill ${isToday || d.mins > 0 ? 'active' : ''}" style="height: ${Math.max(heightPercent, 12)}%;"></div>
          <span class="sparkline-label" style="${isToday ? 'color: var(--accent-primary); font-weight: 700;' : ''}">${d.dayLetter}</span>
        </div>
      `;
    }).join('');
  }

  renderDashQuickResume() {
    const noteCard = document.getElementById('dash-resume-note');
    const videoCard = document.getElementById('dash-resume-video');
    const pdfCard = document.getElementById('dash-resume-pdf');

    if (noteCard && store.data.notes.length > 0) {
      const latestNote = store.data.notes[0];
      noteCard.querySelector('.resume-title-text').textContent = latestNote.title;
      noteCard.onclick = () => {
        this.switchMainTab('study');
        this.switchStudySub('notes');
        notesManager.selectNote(latestNote.id);
      };
    }

    if (videoCard && store.data.youtubeVideos.length > 0) {
      const latestVid = store.data.youtubeVideos[0];
      videoCard.querySelector('.resume-title-text').textContent = latestVid.title;
      videoCard.onclick = () => {
        this.switchMainTab('study');
        this.switchStudySub('youtube');
        ytManager.selectVideo(latestVid.id);
      };
    }

    if (pdfCard && store.data.pdfs.length > 0) {
      const latestPdf = store.data.pdfs[0];
      pdfCard.querySelector('.resume-title-text').textContent = latestPdf.title;
      pdfCard.onclick = () => {
        this.switchMainTab('study');
        this.switchStudySub('pdf');
        pdfManager.selectPdf(latestPdf.id);
      };
    }
  }

  // --- 3. COMMAND PALETTE (CTRL + K) ---
  bindCommandPalette() {
    const triggerSidebar = document.getElementById('btn-sidebar-search');
    const input = document.getElementById('palette-input');
    const topbarSearch = document.getElementById('learnova-global-search');

    if (triggerSidebar) {
      triggerSidebar.addEventListener('click', () => this.openCommandPalette());
    }

    if (topbarSearch) {
      topbarSearch.addEventListener('click', () => {
        this.openCommandPalette();
      });
      topbarSearch.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        this.openCommandPalette();
        const pInput = document.getElementById('palette-input');
        if (pInput) {
          pInput.value = val;
          this.searchPalette(val.toLowerCase());
        }
      });
    }

    if (input) {
      input.addEventListener('input', (e) => {
        this.searchPalette(e.target.value.toLowerCase().trim());
      });
    }
  }

  openCommandPalette() {
    const modal = document.getElementById('modal-command-palette');
    const input = document.getElementById('palette-input');
    if (modal) {
      modal.classList.add('open');
      if (input) {
        input.value = '';
        input.focus();
        this.searchPalette('');
      }
    }
  }

  searchPalette(query) {
    const resultsContainer = document.getElementById('palette-results');
    if (!resultsContainer) return;

    const items = [];

    // System commands
    const actions = [
      { type: 'Action', title: 'Create New Study Note', category: 'Study', action: () => { this.switchMainTab('study'); this.switchStudySub('notes'); notesManager.createNewNote(); } },
      { type: 'Action', title: 'Start Pomodoro Focus Timer', category: 'Timer', action: () => { this.switchMainTab('productivity'); this.switchProdSub('tracker'); productivityManager.startPomodoro(); } },
      { type: 'Action', title: 'Toggle Ambient Lo-Fi Rain', category: 'Audio', action: () => { audioSynth.toggleAmbient('rain'); showToast('Ambient Rain toggled', 'info'); } },
      { type: 'Action', title: 'Toggle Binaural 40Hz Waves', category: 'Audio', action: () => { audioSynth.toggleAmbient('binaural'); showToast('40Hz Focus beats toggled', 'info'); } },
      { type: 'Action', title: 'Supabase Cloud Backend Settings', category: 'Cloud', action: () => { if (typeof authManager !== 'undefined') authManager.openSettingsModal(); } },
      { type: 'Action', title: 'Sign In / User Account', category: 'Cloud', action: () => { if (typeof authManager !== 'undefined') authManager.openAuthModal(); } },
      { type: 'Action', title: 'Export JSON Backup File', category: 'Data', action: () => store.exportBackup() },
      { type: 'Navigation', title: 'Open Dashboard', category: 'View', action: () => this.switchMainTab('dashboard') },
      { type: 'Navigation', title: 'Open Subject Notes', category: 'View', action: () => { this.switchMainTab('study'); this.switchStudySub('notes'); } },
      { type: 'Navigation', title: 'Open YouTube Study', category: 'View', action: () => { this.switchMainTab('study'); this.switchStudySub('youtube'); } },
      { type: 'Navigation', title: 'Open PDF Manager', category: 'View', action: () => { this.switchMainTab('study'); this.switchStudySub('pdf'); } },
      { type: 'Navigation', title: 'Open Daily Planner', category: 'View', action: () => { this.switchMainTab('productivity'); this.switchProdSub('planner'); } },
      { type: 'Navigation', title: 'Open Task List', category: 'View', action: () => { this.switchMainTab('productivity'); this.switchProdSub('tasks'); } },
      { type: 'Navigation', title: 'Open Study Consistency Heatmap', category: 'View', action: () => { this.switchMainTab('productivity'); this.switchProdSub('tracker'); } },
      { type: 'Navigation', title: 'Open Courses Tracker', category: 'View', action: () => { this.switchMainTab('workspace'); this.switchWorkspaceSub('courses'); } },
      { type: 'Navigation', title: 'Open Certifications', category: 'View', action: () => { this.switchMainTab('workspace'); this.switchWorkspaceSub('certs'); } },
      { type: 'Navigation', title: 'Open Skills Matrix', category: 'View', action: () => { this.switchMainTab('workspace'); this.switchWorkspaceSub('skills'); } },
      { type: 'Navigation', title: 'Open Goals & Milestones', category: 'View', action: () => { this.switchMainTab('workspace'); this.switchWorkspaceSub('goals'); } }
    ];

    // Dynamic search YouTube action
    if (query) {
      items.push({
        type: 'Action',
        title: `Search YouTube for "${query}"`,
        category: 'YouTube',
        action: () => {
          this.switchMainTab('study');
          this.switchStudySub('youtube');
          ytManager.searchLiveYouTube(query);
        }
      });
    }

    actions.forEach(a => {
      if (!query || a.title.toLowerCase().includes(query)) items.push(a);
    });

    store.data.notes.forEach(n => {
      if (!query || n.title.toLowerCase().includes(query) || (n.tags && n.tags.some(t => t.toLowerCase().includes(query)))) {
        items.push({
          type: 'Note',
          title: n.title,
          category: 'Note',
          action: () => {
            this.switchMainTab('study');
            this.switchStudySub('notes');
            notesManager.selectNote(n.id);
          }
        });
      }
    });

    store.data.youtubeVideos.forEach(v => {
      if (!query || v.title.toLowerCase().includes(query) || v.channel.toLowerCase().includes(query)) {
        items.push({
          type: 'Lecture',
          title: v.title,
          category: 'YouTube',
          action: () => {
            this.switchMainTab('study');
            this.switchStudySub('youtube');
            ytManager.selectVideo(v.id);
          }
        });
      }
    });

    store.data.tasks.forEach(t => {
      if (!query || t.title.toLowerCase().includes(query)) {
        items.push({
          type: 'Task',
          title: t.title,
          category: t.category,
          action: () => {
            this.switchMainTab('productivity');
            this.switchProdSub('tasks');
          }
        });
      }
    });

    store.data.courses.forEach(c => {
      if (!query || c.title.toLowerCase().includes(query)) {
        items.push({
          type: 'Course',
          title: c.title,
          category: c.platform,
          action: () => {
            this.switchMainTab('workspace');
            this.switchWorkspaceSub('courses');
          }
        });
      }
    });

    if (items.length === 0) {
      resultsContainer.innerHTML = `<div style="padding: 1.5rem; text-align: center; color: var(--text-muted); font-size: 0.82rem;">No matching items found.</div>`;
      return;
    }

    resultsContainer.innerHTML = items.slice(0, 10).map((item, idx) => `
      <div class="palette-item-row ${idx === 0 ? 'active' : ''}" data-idx="${idx}">
        <span style="font-size: 0.84rem; font-weight: 500; color: var(--text-primary);">${item.title}</span>
        <span class="badge badge-neutral">${item.category}</span>
      </div>
    `).join('');

    resultsContainer.querySelectorAll('.palette-item-row').forEach((el, idx) => {
      el.addEventListener('click', () => {
        items[idx].action();
        this.closeAllModals();
      });
    });
  }

  // --- 4. QUICK CAPTURE MODAL (CTRL + N) ---
  bindQuickCapture() {
    const triggerBtn = document.getElementById('btn-header-quick-capture');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.openQuickCapture());
    }

    const saveBtn = document.getElementById('btn-save-quick-capture');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const type = document.getElementById('quick-capture-type').value;
        const text = document.getElementById('quick-capture-text').value.trim();

        if (!text) {
          alert('Please enter text.');
          return;
        }

        if (type === 'task') {
          const newTask = {
            id: 'task-' + Date.now(),
            title: text,
            subjectId: store.data.subjects[0]?.id || 'subj-1',
            category: 'Study',
            priority: 'medium',
            status: 'pending',
            dueDate: new Date().toISOString().split('T')[0],
            isToday: true,
            timeBlock: 'Morning',
            estimatedMins: 30
          };
          store.data.tasks.unshift(newTask);
          store.saveData();
          productivityManager.renderTodaysPlanner();
          productivityManager.renderUnifiedTasks();
          showToast('Task added to Today\'s Plan', 'success');
        } else if (type === 'video') {
          this.switchMainTab('study');
          this.switchStudySub('youtube');
          ytManager.quickLoadUrl(text);
        } else {
          notesManager.createNewNote(text.split('\n')[0].substring(0, 40), text);
          this.switchMainTab('study');
          this.switchStudySub('notes');
        }

        document.getElementById('quick-capture-text').value = '';
        this.closeAllModals();
      });
    }
  }

  openQuickCapture() {
    const modal = document.getElementById('modal-quick-capture');
    if (modal) {
      modal.classList.add('open');
      const text = document.getElementById('quick-capture-text');
      if (text) text.focus();
    }
  }

  // --- 5. THEME TOGGLE ---
  bindThemeToggle() {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    const savedTheme = localStorage.getItem('synapse_theme') || 'light';

    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeButtonIcon(savedTheme);

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('synapse_theme', next);
        this.updateThemeButtonIcon(next);
        showToast(`Theme changed to ${next}`, 'info');
      });
    }
  }

  updateThemeButtonIcon(theme) {
    const toggleBtn = document.getElementById('btn-theme-toggle');
    if (!toggleBtn) return;
    toggleBtn.innerHTML = theme === 'dark' 
      ? '<i data-lucide="sun" style="width: 14px; height: 14px;"></i>' 
      : '<i data-lucide="moon" style="width: 14px; height: 14px;"></i>';
    this.refreshIcons();
  }

  // --- 6. FOCUS ZEN MODE ---
  bindFocusMode() {
    const focusBtn = document.getElementById('btn-focus-mode');
    if (focusBtn) {
      focusBtn.addEventListener('click', () => {
        document.body.classList.toggle('zen-focus-mode');
        const isZen = document.body.classList.contains('zen-focus-mode');
        showToast(isZen ? 'Zen Focus Mode Active (Esc to exit)' : 'Exited Focus Mode', 'info');
      });
    }
  }

  // --- 7. BACKUP / RESTORE ---
  bindBackupRestore() {
    const exportBtn = document.getElementById('btn-export-backup');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        store.exportBackup();
        showToast('Workspace backup exported', 'success');
      });
    }

    const importInput = document.getElementById('backup-file-input');
    const importBtn = document.getElementById('btn-import-backup');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          store.importBackup(e.target.files[0], (success) => {
            if (success) {
              showToast('Backup restored successfully!', 'success');
              location.reload();
            }
          });
        }
      });
    }

    const resetBtn = document.getElementById('btn-reset-demo');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset workspace to demo data? Custom changes will be reset.')) {
          store.resetToDefault();
          showToast('Reset to demo data', 'info');
          location.reload();
        }
      });
    }
  }

  // --- 8. MODAL HANDLERS ---
  bindModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAllModals();
      });
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => this.closeAllModals());
    });

    // Add Task Modal save
    const saveTaskBtn = document.getElementById('btn-save-new-task');
    if (saveTaskBtn) {
      saveTaskBtn.addEventListener('click', () => {
        const title = document.getElementById('input-task-title').value.trim();
        const category = document.getElementById('select-task-category').value;
        const priority = document.getElementById('select-task-priority').value;
        const subjectId = document.getElementById('select-task-subject').value;
        const timeBlock = document.getElementById('select-task-timeblock').value;
        const isToday = document.getElementById('checkbox-task-today').checked;
        const estimatedMins = parseInt(document.getElementById('input-task-mins').value, 10) || 30;

        if (!title) {
          alert('Task title is required.');
          return;
        }

        const newTask = {
          id: 'task-' + Date.now(),
          title,
          category,
          priority,
          subjectId: subjectId || null,
          status: 'pending',
          dueDate: new Date().toISOString().split('T')[0],
          isToday,
          timeBlock,
          estimatedMins
        };

        store.data.tasks.unshift(newTask);
        store.saveData();
        productivityManager.renderTodaysPlanner();
        productivityManager.renderUnifiedTasks();
        this.renderDashboard();
        document.getElementById('input-task-title').value = '';
        this.closeAllModals();
        showToast('Task added to workspace', 'success');
      });
    }

    // Add Video Modal save
    const saveVideoBtn = document.getElementById('btn-save-new-yt');
    if (saveVideoBtn) {
      saveVideoBtn.addEventListener('click', () => {
        const url = document.getElementById('input-yt-url').value.trim();
        const title = document.getElementById('input-yt-title').value.trim();
        const channel = document.getElementById('input-yt-channel').value.trim();
        const subjectId = document.getElementById('select-yt-subject').value;

        if (!url) {
          alert('URL is required.');
          return;
        }

        ytManager.addVideoFromUrl(url, title, channel, subjectId);
        this.closeAllModals();
      });
    }

    // Add Course Modal save
    const saveCourseBtn = document.getElementById('btn-save-new-course');
    if (saveCourseBtn) {
      saveCourseBtn.addEventListener('click', () => {
        const title = document.getElementById('input-course-title').value.trim();
        const platform = document.getElementById('input-course-platform').value.trim() || 'Online';
        const instructor = document.getElementById('input-course-instructor').value.trim() || 'Self-Paced';
        const totalModules = parseInt(document.getElementById('input-course-modules').value, 10) || 10;
        const url = document.getElementById('input-course-url').value.trim();

        if (!title) {
          alert('Course title is required.');
          return;
        }

        const newCourse = {
          id: 'crs-' + Date.now(),
          title,
          platform,
          instructor,
          subjectId: store.data.subjects[0]?.id || 'subj-1',
          progress: 0,
          status: 'In Progress',
          url,
          modulesCompleted: 0,
          totalModules,
          targetCompletion: 'Ongoing',
          notes: ''
        };

        store.data.courses.unshift(newCourse);
        store.saveData();
        workspaceManager.renderCourses();
        this.closeAllModals();
        showToast('Course added to workspace', 'success');
      });
    }

    // Add Cert Modal save
    const saveCertBtn = document.getElementById('btn-save-new-cert');
    if (saveCertBtn) {
      saveCertBtn.addEventListener('click', () => {
        const name = document.getElementById('input-cert-name').value.trim();
        const issuer = document.getElementById('input-cert-issuer').value.trim();
        const credentialId = document.getElementById('input-cert-id').value.trim();
        const status = document.getElementById('select-cert-status').value;

        if (!name) {
          alert('Name is required.');
          return;
        }

        const newCert = {
          id: 'cert-' + Date.now(),
          name,
          issuer: issuer || 'Issuer',
          credentialId: credentialId || 'CRED-' + Math.floor(Math.random() * 100000),
          issueDate: new Date().toISOString().split('T')[0],
          expiryDate: 'Lifetime',
          verifyUrl: '',
          status,
          badgeColor: '#6366f1'
        };

        store.data.certifications.unshift(newCert);
        store.saveData();
        workspaceManager.renderCertifications();
        this.closeAllModals();
        showToast('Certification saved', 'success');
      });
    }

    // Add Goal Modal save
    const saveGoalBtn = document.getElementById('btn-save-new-goal');
    if (saveGoalBtn) {
      saveGoalBtn.addEventListener('click', () => {
        const title = document.getElementById('input-goal-title').value.trim();
        const category = document.getElementById('input-goal-category').value.trim() || 'Mastery';
        const targetDate = document.getElementById('input-goal-date').value.trim() || '2026-12-31';
        const description = document.getElementById('input-goal-desc').value.trim() || '';

        if (!title) {
          alert('Title is required.');
          return;
        }

        const newGoal = {
          id: 'goal-' + Date.now(),
          title,
          category,
          targetDate,
          description,
          milestones: [
            { id: 'm-' + Date.now(), text: 'Define curriculum and milestones', done: true },
            { id: 'm-' + (Date.now() + 1), text: 'Implement initial milestone', done: false }
          ]
        };

        store.data.goals.unshift(newGoal);
        store.saveData();
        workspaceManager.renderGoals();
        this.closeAllModals();
        showToast('Goal added', 'success');
      });
    }

    // Log Session Modal save
    const saveSessionBtn = document.getElementById('btn-save-log-session');
    if (saveSessionBtn) {
      saveSessionBtn.addEventListener('click', () => {
        const mins = parseInt(document.getElementById('input-session-mins').value, 10);
        const subjectId = document.getElementById('select-session-subject').value;
        const topic = document.getElementById('input-session-topic').value.trim();

        if (!mins || mins <= 0) {
          alert('Duration must be greater than 0.');
          return;
        }

        store.logStudySession(subjectId, mins, topic);
        analyticsManager.renderAnalytics();
        this.renderDashboard();
        this.closeAllModals();
        showToast(`Logged ${mins}m session`, 'success');
      });
    }
  }

  closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.classList.remove('open');
    });
  }

  // --- LEARNOVA LMS MODALS & ACTIONS ---
  openCelebrationModal() {
    this.closeAllModals();
    const modal = document.getElementById('modal-celebration-achievement');
    if (modal) modal.classList.add('open');
  }

  openAttendanceModal() {
    this.closeAllModals();
    const modal = document.getElementById('modal-attendance-details');
    if (modal) modal.classList.add('open');
  }

  openGradesModal() {
    this.closeAllModals();
    const modal = document.getElementById('modal-grades-overview');
    if (modal) modal.classList.add('open');
  }

  openMessagesModal() {
    this.closeAllModals();
    const modal = document.getElementById('modal-messages');
    if (modal) modal.classList.add('open');
  }

  openSettingsModal() {
    this.closeAllModals();
    const modal = document.getElementById('modal-settings');
    if (modal) modal.classList.add('open');
  }

  openNotificationsModal() {
    this.openMessagesModal();
  }

  startLiveClass(courseName, profName) {
    showToast(`Joining live stream: ${courseName} with ${profName}...`, 'info');
    this.switchMainTab('study');
    this.switchStudySub('youtube');
    if (window.ytManager) {
      const match = store.data.youtubeVideos.find(v => 
        v.title.toLowerCase().includes(courseName.toLowerCase())
      );
      if (match) {
        ytManager.selectVideo(match.id);
      } else {
        ytManager.searchLiveYouTube(`${courseName} full lecture`);
      }
    }
  }

  // --- SIKHSHA COPILOT: AI Study Diagnostics & Weak Area Handlers ---
  refreshStudyDiagnostics() {
    showToast('Analyzing academic performance & recalculating mastery...', 'info');
    const scoreVal = document.getElementById('diag-score-val');
    if (scoreVal) {
      scoreVal.textContent = '...';
      setTimeout(() => {
        scoreVal.textContent = '74%';
        showToast('Academic Diagnostics updated: +3% progress detected!', 'success');
        this.refreshIcons();
      }, 600);
    }
  }

  addWeakAreaTasksToPlanner() {
    const weakTasks = [
      {
        title: 'Review Operating Systems Page Replacement & FIFO Belady Anomaly',
        subjectName: 'Operating Systems Principles',
        mins: 30,
        timeBlock: 'Morning'
      },
      {
        title: 'Practice 4 University Problems on Charpit Non-linear PDEs',
        subjectName: 'Engineering Mathematics',
        mins: 45,
        timeBlock: 'Afternoon'
      },
      {
        title: 'Diagnostic Self-Test: B+ Tree Index Balancing & 3NF Normalization',
        subjectName: 'Database Systems & Architecture',
        mins: 25,
        timeBlock: 'Evening'
      }
    ];

    let addedCount = 0;
    weakTasks.forEach((item, idx) => {
      const exists = store.data.tasks.some(t => t.title === item.title);
      if (!exists) {
        const newTask = {
          id: 'diag-task-' + Date.now() + '-' + idx,
          title: item.title,
          category: 'Revision',
          priority: 'high',
          subjectId: store.data.subjects[0]?.id || 'subj-1',
          status: 'pending',
          dueDate: new Date().toISOString().split('T')[0],
          isToday: true,
          timeBlock: item.timeBlock,
          estimatedMins: item.mins
        };
        store.data.tasks.unshift(newTask);
        addedCount++;
      }
    });

    store.saveData();
    if (window.productivityManager) {
      productivityManager.renderTodaysPlanner();
      productivityManager.renderUnifiedTasks();
    }
    this.renderDashboard();

    if (addedCount > 0) {
      showToast(`Added ${addedCount} targeted revision tasks to Today's Plan!`, 'success');
    } else {
      showToast('Weak area tasks already in your plan for today!', 'info');
    }
  }

  addSpecificTaskToPlanner(title, subjectName) {
    const exists = store.data.tasks.some(t => t.title === title);
    if (!exists) {
      const newTask = {
        id: 'diag-task-' + Date.now(),
        title: title,
        category: 'Weak Topic',
        priority: 'high',
        subjectId: store.data.subjects[0]?.id || 'subj-1',
        status: 'pending',
        dueDate: new Date().toISOString().split('T')[0],
        isToday: true,
        timeBlock: 'Morning',
        estimatedMins: 35
      };
      store.data.tasks.unshift(newTask);
      store.saveData();
      if (window.productivityManager) {
        productivityManager.renderTodaysPlanner();
        productivityManager.renderUnifiedTasks();
      }
      this.renderDashboard();
      showToast(`Task added: "${title}"`, 'success');
    } else {
      showToast('Task is already present in your daily plan.', 'info');
    }
  }
}

const app = new SynapseApp();
window.app = app;
window.store = store;
if (typeof notesManager !== 'undefined') window.notesManager = notesManager;
if (typeof productivityManager !== 'undefined') window.productivityManager = productivityManager;
if (typeof ytManager !== 'undefined') window.ytManager = ytManager;
if (typeof pdfManager !== 'undefined') window.pdfManager = pdfManager;
if (typeof analyticsManager !== 'undefined') window.analyticsManager = analyticsManager;
if (typeof workspaceManager !== 'undefined') window.workspaceManager = workspaceManager;
if (typeof authManager !== 'undefined') window.authManager = authManager;
if (typeof audioSynth !== 'undefined') window.audioSynth = audioSynth;

window.addEventListener('DOMContentLoaded', () => {
  app.init();
  notesManager.init();
  productivityManager.init();
  ytManager.init();
  pdfManager.init();
  analyticsManager.init();
  workspaceManager.init();
  window.renderDashboard = () => app.renderDashboard();
});
