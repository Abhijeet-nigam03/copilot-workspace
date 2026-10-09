# 🎓 SIKHSHA COPILOT — Personal Learning & Productivity Workspace

> *"Your Journey. Your Future."*  
> *All-in-one learning platform to plan, learn, track, and achieve more every day.*

**SIKHSHA COPILOT** is a desktop- and mobile-grade learning platform and student workspace engineered to streamline lecture viewing, real-time note-taking, PDF document study, curriculum planning, AI academic diagnostics, task management, and career growth.

---

## ⚡ Architecture & Modules

```
SIKHSHA COPILOT
├── 📊 Dashboard
│   ├── KPI Overview (Courses Enrolled, Classes Today, Assignments Due, Attendance %)
│   ├── Today's Schedule & 1-Click Live Class Launcher
│   ├── Quick Resume Cards (Notes, YouTube, PDF)
│   ├── Overall Performance Donut & Weekly Activity Momentum
│   ├── Study Goals & Milestones Progress
│   └── 🧠 AI Academic Diagnostic & Weak Subject Roadmap (Scrollable Deep-Dive)
│       ├── Academic Health Score & Retention Rate
│       ├── Subject Proficiency Breakdown (Weak vs Moderate vs Strong)
│       ├── Identified Knowledge Gaps & Root-Cause Analyses
│       ├── Actionable Step-by-Step Recovery Roadmap
│       └── 1-Click Planner Integration for Weak Area Fixes
│
├── 📚 Study Hub
│   ├── 📝 Subject Notes (Markdown live preview, syntax highlighting, LaTeX formulas)
│   ├── ▶️ Live Classes & YouTube Study
│   │   ├── Real-time Video Player with Speed & Seek Controls
│   │   ├── 📝 Quick Notes below video (Real-time auto-saving while watching)
│   │   └── ✨ AI Note Generator on right pane (Full Syllabus, Core Concepts, Exam Prep, Quiz)
│   └── 📄 PDF Document Library & Reader
│       ├── In-browser PDF renderer (Mozilla PDF.js)
│       ├── Resizable & responsive document sidebar (draggable divider)
│       └── Side-by-Side Notes Editor with draggable splitter
│
├── 📅 Productivity
│   ├── 🗓️ Today's Planner (Time blocks: Morning, Afternoon, Evening)
│   ├── ✅ Unified Task List (Filter by All, Today, High Priority, Completed)
│   └── 📈 Study Tracker & Heatmap (365-day consistency calendar, Pomodoro timer, ambient Lo-Fi sounds)
│
└── 💼 Personal Growth
    ├── 🎓 Enrolled Courses & Module Trackers
    ├── 🏆 Verified Certifications & Credentials
    ├── ⚡ Skills Competency Matrix
    └── 🎯 Goals & Milestones with Dynamic Progress
```

---

## 🚀 Key Highlights

1. **📝 Subject-Wise Notes**:
   - Organize notes with custom subject badges (e.g. Machine Learning, Algorithms, Systems, Mathematics).
   - Dual-mode Markdown editor with live preview, syntax highlighting, LaTeX-style math notations, checklists, and Markdown file export.

2. **▶️ YouTube Study with Synchronized Notes**:
   - Watch lectures inside the app with YouTube IFrame player.
   - One-click timestamp notes: Pin a note at the current video timestamp (e.g. `[04:23]`).
   - Click any timestamp to instantly seek and resume video playback at that precise moment.

3. **📄 PDF Study Manager**:
   - Mozilla PDF.js integration for reading PDFs directly in-workspace.
   - Split-screen note taking: read slides or research papers on the left, capture notes on the right without switching windows.
   - Pre-loaded with a Machine Learning Essentials guide + local drag-and-drop upload.

4. **⏱️ Web Audio Synthesizer**:
   - Built-in ambient background sound generator for deep focus:
     - 🌧️ Realistic Lo-Fi Rain
     - 🧠 40Hz Gamma Focus Binaural Beats
     - ☕ Brown / Pink Noise
   - Zero external audio files or network latency required.

5. **🔥 365-Day Consistency Heatmap**:
   - GitHub-style contribution calendar tracking daily study intensity, active streak count, and completed sessions.
   - Interactive SVG subject distribution donut chart and 7-day weekly activity bar charts.

6. **⌨️ Global Command Palette (`Ctrl + K`) & Quick Capture (`Ctrl + N`)**:
   - Instant search across all notes, videos, PDFs, courses, and system actions.

7. **💾 Zero-Friction Persistence & Backups**:
   - Automatic `localStorage` synchronization.
   - One-click Full Workspace Export (JSON) and Restore.
   - Reset to initial rich demo data option.

---

## 💻 Running the Backend & Workspace

### Option 1: 1-Click Launch (Windows)
Double-click [`start.bat`](file:///c:/Users/Abhijeet%20Nigam/OneDrive/Desktop/copilot/start.bat) to launch the Node.js server.

### Option 2: Using Node / NPM
```bash
npm start
# or
node server.js
```
Open **[http://localhost:3000](http://localhost:3000)** in any modern web browser.

---

## 🔌 Backend REST API Architecture

| Endpoint | Method | Description |
|---|---|---|
| `/api/health` | `GET` | Server health check, uptime, memory, and database status |
| `/api/data` | `GET`, `POST` | Persistent full workspace state in `data/synapse_db.json` |
| `/api/tasks` | `GET`, `POST`, `DELETE` | Task List REST operations |
| `/api/notes` | `GET`, `POST`, `DELETE` | Subject Notes REST operations |
| `/api/upload` | `POST` | PDF & document upload to `uploads/` directory |
| `/api/youtube-search` | `GET` | Official YouTube Data API v3 search with live scrape fallback |
| `/api/generate-video-notes` | `GET` | AI lecture study notes generator (full, concepts, exam, quiz) |
| `/api/youtube-test-key` | `GET` | Validate Google Cloud YouTube API key |
| `/api/auth/config` | `GET`, `POST` | Supabase Cloud URL & Anon Key configuration & status |

---

## ⚡ Supabase Authentication & Cloud Backend

Synapse OS integrates full authentication & cloud synchronization powered by **Supabase**:

- **User Accounts & Sessions**: Sign Up (email/password with display name), Sign In, and auto-refreshed session persistence.
- **Cloud Workspace Synchronization**: Authenticated users automatically synchronize and backup their notes, tasks, courses, and PDFs to the `public.user_workspaces` table.
- **Easy Setup**: Click **"Setup Supabase"** in the topbar or sidebar footer to connect your Supabase `Project URL` and `Anon Key`. Credentials can also be configured via `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
- **Offline / Local Fallback**: When not signed in or offline, all features continue working seamlessly using `data/synapse_db.json` and browser `localStorage`.

