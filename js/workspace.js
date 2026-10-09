// ==========================================
// SYNAPSE OS: Personal Learning Workspace
// Courses, Certifications, Skills Matrix, Goals
// ==========================================

class WorkspaceManager {
  constructor() {
    this.courseStatusFilter = 'all';
  }

  init() {
    this.renderCourses();
    this.renderCertifications();
    this.renderSkills();
    this.renderGoals();
    this.bindEvents();
  }

  bindEvents() {
    // Course Status Filter
    const courseFilter = document.getElementById('course-status-filter');
    if (courseFilter) {
      courseFilter.addEventListener('change', (e) => {
        this.courseStatusFilter = e.target.value;
        this.renderCourses();
      });
    }

    // Modal triggers
    const addCourseBtn = document.getElementById('btn-add-course-modal');
    if (addCourseBtn) {
      addCourseBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-course');
        if (modal) modal.classList.add('open');
      });
    }

    const addCertBtn = document.getElementById('btn-add-cert-modal');
    if (addCertBtn) {
      addCertBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-cert');
        if (modal) modal.classList.add('open');
      });
    }

    const addSkillBtn = document.getElementById('btn-add-skill-modal');
    if (addSkillBtn) {
      addSkillBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-skill');
        if (modal) modal.classList.add('open');
      });
    }

    const addGoalBtn = document.getElementById('btn-add-goal-modal');
    if (addGoalBtn) {
      addGoalBtn.addEventListener('click', () => {
        const modal = document.getElementById('modal-add-goal');
        if (modal) modal.classList.add('open');
      });
    }
  }

  // --- 1. COURSES TRACKER ---
  renderCourses() {
    const container = document.getElementById('courses-cards-grid');
    if (!container) return;

    let list = store.data.courses;
    if (this.courseStatusFilter !== 'all') {
      list = list.filter(c => c.status === this.courseStatusFilter);
    }

    if (list.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem; grid-column: 1/-1; text-align: center;">No courses found in this category.</div>`;
      return;
    }

    container.innerHTML = list.map(course => {
      const isComplete = course.progress === 100;
      return `
        <div class="card" data-id="${course.id}" style="display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
              <span class="badge badge-primary" style="font-size: 0.7rem;">${course.platform}</span>
              <span class="badge ${isComplete ? 'badge-emerald' : 'badge-amber'}" style="font-size: 0.7rem;">
                <span class="badge-dot"></span>
                <span>${course.status}</span>
              </span>
            </div>
            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 0.35rem; line-height: 1.3;">${course.title}</h4>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 0.2rem;">Instructor: ${course.instructor || 'Self-Paced'}</div>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.74rem; margin-bottom: 0.25rem;">
              <span style="color: var(--text-muted);">Syllabus Progress</span>
              <span style="font-weight: 600; color: var(--accent-primary); font-family: var(--font-mono);">${course.progress}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${course.progress}%;"></div>
            </div>
            <div style="font-size: 0.7rem; color: var(--text-faint); margin-top: 0.4rem; display: flex; justify-content: space-between;">
              <span>Modules: ${course.modulesCompleted || 0} / ${course.totalModules || 10}</span>
              <span>Target: ${course.targetCompletion || 'Ongoing'}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.65rem;">
            <div style="display: flex; gap: 0.4rem;">
              <button class="btn btn-secondary btn-step-course" data-id="${course.id}" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;">
                +1 Module
              </button>
              ${course.url ? `<a href="${course.url}" target="_blank" class="btn-icon" style="width: 26px; height: 26px; text-decoration: none;" title="Open Course URL">🔗</a>` : ''}
            </div>
            <button class="btn-icon btn-delete-course" data-id="${course.id}" title="Remove Course" style="width: 24px; height: 24px; font-size: 0.7rem;">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Step course modules (+1)
    container.querySelectorAll('.btn-step-course').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const course = store.data.courses.find(c => c.id === id);
        if (course && course.modulesCompleted < course.totalModules) {
          course.modulesCompleted++;
          course.progress = Math.min(100, Math.round((course.modulesCompleted / course.totalModules) * 100));
          if (course.progress === 100) course.status = 'Completed';
          store.saveData();
          this.renderCourses();
          showToast(`Progress: ${course.title} (${course.progress}%)`, 'success');
        }
      });
    });

    // Delete course
    container.querySelectorAll('.btn-delete-course').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        store.data.courses = store.data.courses.filter(c => c.id !== id);
        store.saveData();
        this.renderCourses();
        showToast('Course removed', 'info');
      });
    });
  }

  // --- 2. CERTIFICATIONS TRACKER ---
  renderCertifications() {
    const container = document.getElementById('certs-cards-grid');
    if (!container) return;

    if (store.data.certifications.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem; grid-column: 1/-1; text-align: center;">No certifications recorded.</div>`;
      return;
    }

    container.innerHTML = store.data.certifications.map(cert => {
      const isActive = cert.status === 'Active';
      return `
        <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; gap: 0.9rem; border-left: 3px solid ${isActive ? 'var(--accent-emerald)' : 'var(--accent-primary)'};">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
              <span class="badge badge-neutral" style="font-size: 0.68rem;">${cert.issuer}</span>
              <span class="badge ${isActive ? 'badge-emerald' : 'badge-amber'}" style="font-size: 0.68rem;">
                <span class="badge-dot"></span>
                <span>${cert.status}</span>
              </span>
            </div>
            <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); margin-top: 0.35rem; line-height: 1.3;">${cert.name}</h4>
            ${cert.credentialId ? `<div style="font-family: var(--font-mono); font-size: 0.68rem; color: var(--text-faint); margin-top: 0.3rem;">ID: ${cert.credentialId}</div>` : ''}
          </div>

          <div style="font-size: 0.72rem; color: var(--text-muted); border-top: 1px solid var(--border-subtle); padding-top: 0.6rem; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div>Issued: ${cert.issueDate}</div>
              <div>Expires: ${cert.expiryDate || 'Lifetime'}</div>
            </div>
            <div style="display: flex; gap: 0.35rem;">
              ${cert.verifyUrl ? `<a href="${cert.verifyUrl}" target="_blank" class="btn-icon" style="width: 24px; height: 24px; text-decoration: none;" title="Verify">🔗</a>` : ''}
              <button class="btn-icon btn-delete-cert" data-id="${cert.id}" style="width: 24px; height: 24px; font-size: 0.7rem;" title="Delete">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.btn-delete-cert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        store.data.certifications = store.data.certifications.filter(c => c.id !== id);
        store.saveData();
        this.renderCertifications();
        showToast('Certification removed', 'info');
      });
    });
  }

  // --- 3. SKILLS MATRIX ---
  renderSkills() {
    const container = document.getElementById('skills-cards-grid');
    if (!container) return;

    if (store.data.skills.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem; grid-column: 1/-1; text-align: center;">No skills defined.</div>`;
      return;
    }

    const levelLabels = ["Novice", "Beginner", "Intermediate", "Advanced", "Master"];

    container.innerHTML = store.data.skills.map(skill => {
      const segmentsHtml = [1, 2, 3, 4, 5].map(lvl => `
        <div class="skill-seg ${lvl <= skill.level ? 'filled' : ''}" data-skill="${skill.id}" data-level="${lvl}" title="Level ${lvl}/5"></div>
      `).join('');

      return `
        <div class="card" data-id="${skill.id}" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="badge badge-primary" style="font-size: 0.68rem; margin-bottom: 0.25rem;">${skill.domain}</span>
              <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">${skill.name}</h4>
            </div>
            <button class="btn-icon btn-delete-skill" data-id="${skill.id}" style="width: 22px; height: 22px; font-size: 0.7rem;">✕</button>
          </div>

          <p style="font-size: 0.78rem; color: var(--text-secondary); line-height: 1.4;">${skill.description || 'Core technical capability.'}</p>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted);">
              <span>Proficiency: <strong style="color: var(--text-primary);">${levelLabels[skill.level - 1] || 'Level ' + skill.level}</strong></span>
              <span>Target: <strong>${levelLabels[skill.targetLevel - 1] || '5'}</strong></span>
            </div>
            <div class="skills-segments-bar">${segmentsHtml}</div>
          </div>

          <div style="font-size: 0.7rem; color: var(--text-faint); border-top: 1px solid var(--border-subtle); padding-top: 0.45rem; display: flex; justify-content: space-between; align-items: center;">
            <span>Practiced: ${skill.lastPracticed || 'Recent'}</span>
            <button class="btn btn-secondary btn-practice-skill" data-id="${skill.id}" style="padding: 0.15rem 0.45rem; font-size: 0.7rem;">
              + Practice
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Click bar segment to change level
    container.querySelectorAll('.skill-seg').forEach(seg => {
      seg.addEventListener('click', (e) => {
        const skillId = e.currentTarget.dataset.skill;
        const newLvl = parseInt(e.currentTarget.dataset.level, 10);
        const skill = store.data.skills.find(s => s.id === skillId);
        if (skill) {
          skill.level = newLvl;
          skill.lastPracticed = 'Today';
          store.saveData();
          this.renderSkills();
          showToast(`${skill.name}: Level ${newLvl}`, 'success');
        }
      });
    });

    // Delete skill
    container.querySelectorAll('.btn-delete-skill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        store.data.skills = store.data.skills.filter(s => s.id !== id);
        store.saveData();
        this.renderSkills();
        showToast('Skill removed', 'info');
      });
    });

    // Log practice
    container.querySelectorAll('.btn-practice-skill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const skill = store.data.skills.find(s => s.id === id);
        if (skill) {
          skill.lastPracticed = 'Today';
          store.saveData();
          this.renderSkills();
          showToast(`Logged practice for ${skill.name}`, 'success');
        }
      });
    });
  }

  // --- 4. GOALS & MILESTONES ---
  renderGoals() {
    const container = document.getElementById('goals-cards-grid');
    if (!container) return;

    if (store.data.goals.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 2rem; grid-column: 1/-1; text-align: center;">No goals set yet.</div>`;
      return;
    }

    container.innerHTML = store.data.goals.map(goal => {
      const totalM = goal.milestones.length;
      const doneM = goal.milestones.filter(m => m.done).length;
      const percent = totalM > 0 ? Math.round((doneM / totalM) * 100) : 0;

      const milestonesHtml = goal.milestones.map(m => `
        <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; color: ${m.done ? 'var(--text-muted)' : 'var(--text-secondary)'}; ${m.done ? 'text-decoration: line-through;' : ''}">
          <button class="task-checkbox-btn ${m.done ? 'checked' : ''}" data-goal="${goal.id}" data-milestone="${m.id}">
            ✓
          </button>
          <span>${m.text}</span>
        </div>
      `).join('');

      return `
        <div class="card" data-id="${goal.id}" style="display: flex; flex-direction: column; gap: 0.85rem;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span class="badge badge-sky" style="font-size: 0.68rem;">${goal.category}</span>
              <span style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">Target: ${goal.targetDate}</span>
            </div>
            <h4 style="font-size: 1rem; font-weight: 700; color: var(--text-primary); margin-top: 0.35rem;">${goal.title}</h4>
            <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">${goal.description}</p>
          </div>

          <div>
            <div style="display: flex; justify-content: space-between; font-size: 0.72rem; margin-bottom: 0.2rem;">
              <span style="color: var(--text-muted);">Milestones Completed (${doneM}/${totalM})</span>
              <span style="font-weight: 600; color: var(--accent-emerald); font-family: var(--font-mono);">${percent}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${percent}%; background: ${percent === 100 ? 'var(--accent-emerald)' : 'var(--accent-primary)'};"></div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.45rem;">
            ${milestonesHtml}
          </div>

          <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.55rem; display: flex; justify-content: space-between; align-items: center;">
            <button class="btn btn-secondary btn-add-milestone" data-id="${goal.id}" style="padding: 0.2rem 0.55rem; font-size: 0.72rem;">
              + Milestone
            </button>
            <button class="btn-icon btn-delete-goal" data-id="${goal.id}" style="width: 22px; height: 22px; font-size: 0.7rem;">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Toggle milestone
    container.querySelectorAll('.task-checkbox-btn').forEach(box => {
      box.addEventListener('click', (e) => {
        const goalId = e.currentTarget.dataset.goal;
        const mId = e.currentTarget.dataset.milestone;
        const goal = store.data.goals.find(g => g.id === goalId);
        if (goal) {
          const m = goal.milestones.find(item => item.id === mId);
          if (m) {
            m.done = !m.done;
            store.saveData();
            this.renderGoals();
            if (m.done) showToast('Milestone completed!', 'success');
          }
        }
      });
    });

    // Add milestone
    container.querySelectorAll('.btn-add-milestone').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const goalId = e.currentTarget.dataset.id;
        const text = prompt('Enter new milestone description:');
        if (text && text.trim()) {
          const goal = store.data.goals.find(g => g.id === goalId);
          if (goal) {
            goal.milestones.push({ id: 'm-' + Date.now(), text: text.trim(), done: false });
            store.saveData();
            this.renderGoals();
            showToast('Milestone added', 'success');
          }
        }
      });
    });

    // Delete goal
    container.querySelectorAll('.btn-delete-goal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        store.data.goals = store.data.goals.filter(g => g.id !== id);
        store.saveData();
        this.renderGoals();
        showToast('Goal removed', 'info');
      });
    });
  }
}

const workspaceManager = new WorkspaceManager();
