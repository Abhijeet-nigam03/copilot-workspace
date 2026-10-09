// ==========================================
// SYNAPSE OS: Study Tracker & Analytics
// 365-Day Consistency Heatmap, Charts, Session Logs
// ==========================================

class AnalyticsManager {
  constructor() {}

  init() {
    this.renderAnalytics();
    this.bindEvents();
  }

  bindEvents() {
    const logSessionBtn = document.getElementById('btn-open-log-session');
    if (logSessionBtn) {
      logSessionBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-log-session');
        if (modal) modal.classList.add('open');
      });
    }
  }

  renderAnalytics() {
    this.renderHeatmap();
    this.renderSubjectDonut();
    this.renderWeeklyBarChart();
    this.renderRecentSessionsList();
    this.updateStatsCards();
  }

  updateStatsCards() {
    const todayHrs = document.getElementById('analytics-today-hours');
    const totalHrs = document.getElementById('analytics-total-hours');
    const streakDays = document.getElementById('analytics-streak-days');
    const totalSessions = document.getElementById('analytics-total-sessions');

    if (todayHrs) todayHrs.textContent = `${store.data.profile.todayHoursStudied}h`;
    if (totalHrs) totalHrs.textContent = `${store.data.profile.totalHoursStudied}h`;
    if (streakDays) streakDays.textContent = `${store.data.profile.streakDays} Days`;
    if (totalSessions) totalSessions.textContent = store.data.studySessions.length;
  }

  // --- 1. 365-DAY CONSISTENCY HEATMAP (GITHUB STYLE) ---
  renderHeatmap() {
    const container = document.getElementById('study-heatmap-calendar');
    if (!container) return;

    // Aggregate sessions by date: { 'YYYY-MM-DD': totalMinutes }
    const activityMap = {};
    store.data.studySessions.forEach(session => {
      const d = session.date;
      activityMap[d] = (activityMap[d] || 0) + session.durationMinutes;
    });

    // Generate dates for the past 52 weeks (364 days)
    const today = new Date();
    const cells = [];

    // Start 52 weeks ago, aligned to Sunday
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (52 * 7) + (7 - today.getDay()));

    let curr = new Date(startDate);
    while (curr <= today) {
      const dateStr = curr.toISOString().split('T')[0];
      const minutes = activityMap[dateStr] || 0;

      // Determine level (0 to 4)
      let level = 0;
      if (minutes > 0 && minutes < 30) level = 1;
      else if (minutes >= 30 && minutes < 60) level = 2;
      else if (minutes >= 60 && minutes < 120) level = 3;
      else if (minutes >= 120) level = 4;

      const formattedDate = curr.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const tooltip = `${formattedDate}: ${minutes} mins studied`;

      cells.push(`
        <div class="heatmap-cell level-${level}" title="${tooltip}" data-date="${dateStr}"></div>
      `);

      curr.setDate(curr.getDate() + 1);
    }

    container.innerHTML = cells.join('');
  }

  // --- 2. SUBJECT DISTRIBUTION SVG DONUT CHART ---
  renderSubjectDonut() {
    const container = document.getElementById('subject-chart-container');
    if (!container) return;

    // Aggregate minutes per subject
    const subjectMinutes = {};
    store.data.subjects.forEach(s => subjectMinutes[s.id] = 0);

    store.data.studySessions.forEach(session => {
      if (subjectMinutes[session.subjectId] !== undefined) {
        subjectMinutes[session.subjectId] += session.durationMinutes;
      }
    });

    const totalMinutes = Object.values(subjectMinutes).reduce((a, b) => a + b, 0) || 1;

    // Generate SVG donut slices
    const radius = 65;
    const cx = 90;
    const cy = 90;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    let svgPaths = '';
    let legendHtml = '<div style="display: flex; flex-direction: column; gap: 0.5rem; justify-content: center;">';

    store.data.subjects.forEach(subj => {
      const mins = subjectMinutes[subj.id] || 0;
      const percent = (mins / totalMinutes);
      const strokeDasharray = `${percent * circumference} ${circumference}`;
      const strokeDashoffset = -accumulatedAngle * circumference;

      svgPaths += `
        <circle cx="${cx}" cy="${cy}" r="${radius}" 
          fill="none" 
          stroke="${subj.color}" 
          stroke-width="22" 
          stroke-dasharray="${strokeDasharray}" 
          stroke-dashoffset="${strokeDashoffset}"
          transform="rotate(-90 ${cx} ${cy})"
          style="transition: stroke-dasharray 0.5s ease;"
        />
      `;

      accumulatedAngle += percent;

      legendHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; font-size: 0.8rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${subj.color};"></span>
            <span>${subj.name}</span>
          </div>
          <span style="font-weight: 600; color: var(--text-primary); font-family: var(--font-mono);">
            ${Math.round(percent * 100)}% (${Math.round(mins / 60)}h)
          </span>
        </div>
      `;
    });

    legendHtml += '</div>';

    container.innerHTML = `
      <div style="display: flex; align-items: center; gap: 2rem; flex-wrap: wrap;">
        <svg width="180" height="180" viewBox="0 0 180 180">
          <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="var(--bg-secondary)" stroke-width="22" />
          ${svgPaths}
          <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-primary)" font-size="16" font-weight="700">
            ${Math.round(totalMinutes / 60)}h
          </text>
          <text x="${cx}" y="${cy + 18}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-muted)" font-size="10">
            Total
          </text>
        </svg>
        ${legendHtml}
      </div>
    `;
  }

  // --- 3. WEEKLY STUDY ACTIVITY BAR CHART ---
  renderWeeklyBarChart() {
    const container = document.getElementById('weekly-chart-container');
    if (!container) return;

    // Get last 7 days
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const past7Days = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = days[d.getDay()];

      // Sum minutes
      const mins = store.data.studySessions
        .filter(s => s.date === dateStr)
        .reduce((sum, s) => sum + s.durationMinutes, 0);

      past7Days.push({ dateStr, dayName, mins, hours: Number((mins / 60).toFixed(1)) });
    }

    const maxHours = Math.max(...past7Days.map(d => d.hours), 3);

    container.innerHTML = `
      <div style="display: flex; align-items: flex-end; gap: 0.85rem; height: 160px; padding-top: 1rem;">
        ${past7Days.map(d => {
          const heightPercent = Math.min((d.hours / maxHours) * 100, 100);
          const isToday = d.dateStr === today.toISOString().split('T')[0];
          return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; gap: 0.4rem;">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">${d.hours}h</span>
              <div style="width: 100%; height: ${Math.max(heightPercent, 8)}%; background: ${isToday ? 'var(--grad-primary)' : 'var(--bg-secondary)'}; border-radius: 4px; box-shadow: ${isToday ? '0 0 10px var(--accent-violet-glow)' : 'none'};"></div>
              <span style="font-size: 0.75rem; color: ${isToday ? 'var(--accent-violet)' : 'var(--text-muted)'}; font-weight: ${isToday ? '700' : '500'};">${d.dayName}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- 4. RECENT SESSIONS LOG ---
  renderRecentSessionsList() {
    const container = document.getElementById('recent-sessions-list');
    if (!container) return;

    if (store.data.studySessions.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem 0;">No sessions recorded yet.</div>`;
      return;
    }

    container.innerHTML = store.data.studySessions.slice(0, 5).map(session => {
      const subject = store.data.subjects.find(s => s.id === session.subjectId);
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 0.85rem; background: var(--bg-input); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); margin-bottom: 0.4rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <span style="width: 7px; height: 7px; border-radius: 50%; background: ${subject ? subject.color : 'var(--accent-primary)'}; flex-shrink: 0;"></span>
            <div>
              <div style="font-size: 0.84rem; font-weight: 600; color: var(--text-primary);">${session.topic || 'Study Session'}</div>
              <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 0.4rem; margin-top: 0.1rem;">
                <span style="color: ${subject ? subject.color : 'inherit'}; font-weight: 500;">${subject ? subject.name : 'General'}</span>
                <span>•</span>
                <span>${session.date}</span>
              </div>
            </div>
          </div>
          <span class="badge badge-primary" style="font-family: var(--font-mono); font-size: 0.75rem;">
            +${session.durationMinutes}m
          </span>
        </div>
      `;
    }).join('');
  }
}

const analyticsManager = new AnalyticsManager();
