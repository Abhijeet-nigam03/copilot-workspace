// ==========================================
// SYNAPSE OS: Full-Stack Backend Server
// Real Data Persistence, REST APIs, File Uploads,
// YouTube Data API v3 & Lecture Note Generator
// ==========================================

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'synapse_db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Load .env file if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let val = (match[2] || '').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    });
  }
} catch (e) {
  console.warn('Could not read .env file:', e.message);
}

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

// --- Seed & In-Memory Database ---
let inMemoryDb = null;

function loadDefaultSeedData() {
  try {
    const dataJsPath = path.join(__dirname, 'js', 'data.js');
    if (fs.existsSync(dataJsPath)) {
      const code = fs.readFileSync(dataJsPath, 'utf8') + '; this.DEFAULT_DATA = DEFAULT_DATA;';
      const ctx = {};
      vm.createContext(ctx);
      vm.runInContext(code, ctx);
      if (ctx.DEFAULT_DATA) {
        return JSON.parse(JSON.stringify(ctx.DEFAULT_DATA));
      }
    }
  } catch (e) {
    console.warn('Failed to load seed from data.js:', e.message);
  }

  return {
    profile: { name: 'Abhijeet', title: 'AI & Systems Learner', totalHoursStudied: 0, streakDays: 1 },
    subjects: [],
    notes: [],
    youtubeVideos: [],
    pdfs: [],
    tasks: [],
    studySessions: [],
    courses: [],
    certifications: [],
    skills: [],
    goals: []
  };
}

function initDatabase() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      inMemoryDb = JSON.parse(raw);
      console.log(`[Database] Loaded persistent data from ${DB_FILE}`);
      return;
    } catch (e) {
      console.error(`[Database] Error reading ${DB_FILE}, rebuilding from seed:`, e.message);
    }
  }

  inMemoryDb = loadDefaultSeedData();
  saveDatabase(inMemoryDb);
  console.log(`[Database] Initialized new persistent database at ${DB_FILE}`);
}

function saveDatabase(data) {
  try {
    inMemoryDb = data;
    const jsonStr = JSON.stringify(data, null, 2);
    // Write atomically
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, jsonStr, 'utf8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (e) {
    console.error('[Database] Failed to write DB file:', e);
    return false;
  }
}

initDatabase();

// --- Helper: Read Request Body ---
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) { // 25MB limit
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

// --- Formatters ---
function parseISO8601Duration(iso) {
  if (!iso) return '';
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const pad = n => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

function formatViewCount(views) {
  const n = parseInt(views, 10);
  if (isNaN(n)) return '';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M views';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K views';
  return n.toLocaleString() + ' views';
}

function formatPublishedAt(dateStr) {
  if (!dateStr) return '';
  const diffSec = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diffSec < 3600) return Math.max(1, Math.floor(diffSec / 60)) + 'm ago';
  if (diffSec < 86400) return Math.floor(diffSec / 3600) + 'h ago';
  if (diffSec < 2592000) return Math.floor(diffSec / 86400) + 'd ago';
  if (diffSec < 31536000) return Math.floor(diffSec / 2592000) + 'mo ago';
  return Math.floor(diffSec / 31536000) + 'y ago';
}

// --- Educational Notes Generator Engine ---
function generateEducationalNotes(title, channel, videoId, mode = 'full') {
  const tLower = title.toLowerCase();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const ytUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : '#';

  let subject = 'Engineering & Computer Science';
  let coreTopics = [];
  let formulas = [];
  let examTips = [];

  if (tLower.includes('math') || tLower.includes('calculus') || tLower.includes('differential') || tLower.includes('algebra') || tLower.includes('pde')) {
    subject = 'Engineering Mathematics';
    coreTopics = [
      '**Order and Degree of Differential Equations**: Formation of PDEs by eliminating arbitrary constants and arbitrary functions.',
      '**Lagrange Linear Partial Differential Equations**: Standard form $P\\,p + Q\\,q = R$ with auxiliary equations $\\frac{dx}{P} = \\frac{dy}{Q} = \\frac{dz}{R}$.',
      '**Non-linear PDEs of First Order**: Charpit\'s Method for finding complete integrals of $f(x, y, z, p, q) = 0$.',
      '**Linear PDEs with Constant Coefficients**: Homogeneous and Non-Homogeneous equations; finding Complementary Function (C.F.) and Particular Integral (P.I.).',
      '**Classification of Second-Order PDEs**: Elliptic ($B^2 - 4AC < 0$), Parabolic ($B^2 - 4AC = 0$), and Hyperbolic ($B^2 - 4AC > 0$).',
      '**Method of Separation of Variables**: Solving one-dimensional wave equation $\\frac{\\partial^2 u}{\\partial t^2} = c^2 \\frac{\\partial^2 u}{\\partial x^2}$ and heat conduction equation $\\frac{\\partial u}{\\partial t} = c^2 \\frac{\\partial^2 u}{\\partial x^2}$.'
    ];
    formulas = [
      'Lagrange Auxiliary Equation: $\\frac{dx}{P} = \\frac{dy}{Q} = \\frac{dz}{R}$',
      'Charpit\'s Auxiliary Equation: $\\frac{dp}{f_x + p f_z} = \\frac{dq}{f_y + q f_z} = \\frac{dz}{-p f_p - q f_q} = \\frac{dx}{-f_p} = \\frac{dy}{-f_q} = \\frac{df}{0}$',
      'One-Dimensional Wave Equation Solution: $u(x, t) = (c_1 \\cos px + c_2 \\sin px)(c_3 \\cos pct + c_4 \\sin pct)$',
      'One-Dimensional Heat Conduction Solution: $u(x, t) = (c_1 \\cos px + c_2 \\sin px) e^{-c^2 p^2 t}$'
    ];
    examTips = [
      'Check if the auxiliary equation yields integrable pairs before trying multipliers.',
      'In Charpit\'s method, always choose the simplest compatible relation between $p$ and $q$.',
      'Verify boundary conditions thoroughly before evaluating Fourier constants $c_n$ and $k_n$.'
    ];
  } else if (tLower.includes('os') || tLower.includes('operating') || tLower.includes('thread') || tLower.includes('process') || tLower.includes('deadlock')) {
    subject = 'Operating Systems';
    coreTopics = [
      '**Process State Lifecycle & PCB**: New, Ready, Running, Waiting, Terminated transitions and Context Switching overhead.',
      '**CPU Scheduling Algorithms**: FCFS, SJF (Preemptive & Non-preemptive), Priority Scheduling, and Round Robin (Quantum tuning).',
      '**Process Synchronization**: Critical Section problem, Peterson\'s Algorithm, Counting & Binary Semaphores, Mutex Locks.',
      '**Deadlocks**: 4 Coffman conditions (Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait); Banker\'s Resource Allocation Algorithm.',
      '**Memory Management**: Paging, TLB hit/miss ratio, Inverted Page Tables, Segmentation, Page Replacement Algorithms (FIFO, LRU, Optimal).'
    ];
    formulas = [
      'Effective Memory Access Time: $\\text{EMAT} = h \\times (t + m) + (1 - h) \\times (t + 2m)$',
      'Turnaround Time: $\\text{TAT} = \\text{Completion Time} - \\text{Arrival Time}$',
      'Waiting Time: $\\text{WT} = \\text{Turnaround Time} - \\text{Burst Time}$'
    ];
    examTips = [
      'Banker\'s algorithm questions are guaranteed 10-markers in university exams — practice matrix subtraction $\\text{Need} = \\text{Max} - \\text{Allocation}$.',
      'Distinguish clearly between User-Level Threads (ULT) and Kernel-Level Threads (KLT) mapping models.'
    ];
  } else {
    subject = 'Computer Science & Engineering';
    coreTopics = [
      '**Core Concept Foundations**: Detailed breakdown of primary mechanisms and architectural components.',
      '**Mathematical & Algorithmic Principles**: Asymptotic complexity analysis, boundary bounds, and state transition properties.',
      '**Practical Implementation**: Tradeoffs, edge cases, error recovery, and benchmark performance.'
    ];
    formulas = [
      'Time Complexity: $\\mathcal{O}(n \\log n)$ average case, $\\mathcal{O}(1)$ auxiliary space',
      'Efficiency Ratio: $\\eta = \\frac{\\text{Actual Throughput}}{\\text{Theoretical Peak}}$'
    ];
    examTips = [
      'Focus on drawing clean architectural diagrams and timing charts during theory papers.',
      'Always state assumptions and initial conditions clearly before writing derivations.'
    ];
  }

  // Generate Mode Outputs
  if (mode === 'concepts') {
    return `# 💡 Core Formulas & Theorems Sheet: ${title}

> **Instructor / Channel:** ${channel}  
> **Source Lecture:** [Watch on YouTube](${ytUrl})  
> **Topic Category:** ${subject} • Generated: ${dateStr}

---

## 📐 Essential Formula Reference & Mathematical Identities

${formulas.map(f => `- **${f}**`).join('\n')}

---

## 🔬 Core Theorem Summaries
${coreTopics.slice(0, 4).map((t, idx) => `### ${idx + 1}. ${t}\n\n*Proof sketch & usage context: Applies directly in syllabus problem sets.*`).join('\n\n')}

---
*Generated by Synapse OS Educational Engine.*
`;
  }

  if (mode === 'exam') {
    return `# ⚠️ High-Frequency Exam Guide & Pitfalls: ${title}

> **Subject:** ${subject} • **Channel:** ${channel} • **Date:** ${dateStr}

---

## 🎯 1. High-Probability University & Competitive Questions
1. **Explain the theoretical underpinnings and write mathematical proof for primary concepts discussed.** (7-10 Marks)
2. **Numerical Problem**: Given boundary conditions and parameters, evaluate the solution state. (5 Marks)
3. **Critical Comparison**: Differentiate between primary algorithms/techniques covered in this lecture. (5 Marks)

---

## 🚨 2. Frequent Student Mistakes & Traps to Avoid
${examTips.map(tip => `- ⚠️ **Common Trap:** ${tip}`).join('\n')}

---

## ⏱️ 3. Quick Revision Checklist
- [ ] Memorize the standard auxiliary equation and boundary forms.
- [ ] Practice at least 2 numerical problems without reference sheets.
- [ ] Verify unit consistency and initial state values.

---
*Curated for university examinations & competitive engineering prep.*
`;
  }

  if (mode === 'quiz') {
    return `# 🎯 Diagnostic Self-Test & Practice Questions: ${title}

> **Subject:** ${subject} | **Source:** ${channel} | **Date:** ${dateStr}

---

### Question 1 (Conceptual)
**What are the governing assumptions and primary prerequisites of the methods presented in this lecture?**
- A) Assumptions hold only for linear, non-homogeneous systems.
- B) System requires continuity and well-defined boundary criteria. *(Correct)*
- C) Applicable solely when time dependency is ignored.
- D) None of the above.

---

### Question 2 (Analytical)
**When applying auxiliary equations, how are independent solutions combined?**
> **Answer Guide:** Complete solution is obtained as $\\Phi(u, v) = 0$ or $u = f(v)$, where $u(x,y,z)=c_1$ and $v(x,y,z)=c_2$ are two independent first integrals.

---

### Question 3 (Derivation Challenge)
Write down the step-by-step procedure to derive the particular solution given Cauchy boundary constraints.
`;
  }

  // Default: Full Syllabus Notes
  return `# 📑 Complete Study Notes: ${title}

> **Lecture:** ${title}  
> **Instructor / Channel:** ${channel}  
> **Subject Domain:** ${subject}  
> **Interactive Lecture Link:** [Watch Video](${ytUrl})  
> **Generated by:** Synapse OS Educational Engine • ${dateStr}

---

## 📌 1. Executive Summary & Syllabus Context
This lecture covers essential fundamentals of **${subject}**, providing students with intuitive conceptual models, formal mathematical derivations, and applied problem-solving methodologies necessary for coursework mastery and exam preparation.

---

## 🧠 2. Core Concepts & Theoretical Framework

${coreTopics.map((topic, i) => `### 2.${i + 1} ${topic}\nIn university curriculum and engineering applications, this topic represents a foundational cornerstone. Students must understand both the algebraic formulation and real-world intuition.`).join('\n\n')}

---

## 📐 3. Formulae & Mathematical Identities

${formulas.map(f => `$$ ${f.replace(/\$/g, '')} $$`).join('\n')}

---

## 💡 4. High-Yield Exam Tips & Traps
${examTips.map(tip => `- 💡 ${tip}`).join('\n')}

---

## 📝 5. Key Review Questions
1. How does the primary equation behave under non-standard boundary constraints?
2. What are the stability criteria for the solution space described in this unit?
3. State and prove the underlying existence and uniqueness conditions.

---
*Notes compiled and synchronized with Synapse OS Workspace.*
`;
}

// --- Official YouTube API v3 ---
function searchYouTubeAPIv3(query, apiKey) {
  return new Promise((resolve, reject) => {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${encodeURIComponent(apiKey)}`;

    https.get(searchUrl, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) {
            reject(new Error(data.error.message || 'YouTube API error'));
            return;
          }

          const items = data.items || [];
          if (items.length === 0) {
            resolve([]);
            return;
          }

          const videoIds = items.map(i => i.id?.videoId).filter(Boolean).join(',');
          const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${encodeURIComponent(apiKey)}`;

          https.get(detailsUrl, (vRes) => {
            let vBody = '';
            vRes.on('data', c => { vBody += c; });
            vRes.on('end', () => {
              try {
                const vData = JSON.parse(vBody);
                const detailsMap = new Map();

                if (vData.items) {
                  vData.items.forEach(vi => {
                    detailsMap.set(vi.id, {
                      duration: parseISO8601Duration(vi.contentDetails?.duration),
                      views: formatViewCount(vi.statistics?.viewCount)
                    });
                  });
                }

                const results = items.map(item => {
                  const id = item.id?.videoId;
                  const snippet = item.snippet || {};
                  const details = detailsMap.get(id) || {};

                  return {
                    videoId: id,
                    title: snippet.title || 'YouTube Video',
                    channel: snippet.channelTitle || 'YouTube Creator',
                    thumbnail: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
                    duration: details.duration || 'Video',
                    views: details.views || '',
                    published: formatPublishedAt(snippet.publishedAt),
                    description: snippet.description || ''
                  };
                });

                resolve(results);
              } catch (e) {
                const results = items.map(item => ({
                  videoId: item.id?.videoId,
                  title: item.snippet?.title || 'YouTube Video',
                  channel: item.snippet?.channelTitle || 'YouTube Creator',
                  thumbnail: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${item.id?.videoId}/hqdefault.jpg`,
                  duration: 'Video',
                  views: '',
                  published: formatPublishedAt(item.snippet?.publishedAt),
                  description: item.snippet?.description || ''
                }));
                resolve(results);
              }
            });
          }).on('error', () => {
            resolve(items.map(item => ({
              videoId: item.id?.videoId,
              title: item.snippet?.title || 'YouTube Video',
              channel: item.snippet?.channelTitle || 'YouTube Creator',
              thumbnail: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${item.id?.videoId}/hqdefault.jpg`,
              duration: 'Video',
              views: '',
              published: formatPublishedAt(item.snippet?.publishedAt),
              description: item.snippet?.description || ''
            })));
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// --- Live Scrape Fallback ---
function searchYouTubeLive(query, type = 'video') {
  return new Promise((resolve, reject) => {
    const spParam = type === 'video' ? '&sp=EgIQAQ%253D%253D' : '';
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}${spParam}`;

    const req = https.get(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    }, (res) => {
      let html = '';
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => {
        try {
          const startMarker = 'ytInitialData = ';
          const idx = html.indexOf(startMarker);
          if (idx === -1) {
            resolve([]);
            return;
          }

          const jsonStart = idx + startMarker.length;
          const endIdx = html.indexOf(';</script>', jsonStart);
          if (endIdx === -1) {
            resolve([]);
            return;
          }

          const jsonStr = html.substring(jsonStart, endIdx);
          const data = JSON.parse(jsonStr);
          const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
          const videos = [];

          for (const sec of sections) {
            const items = sec?.itemSectionRenderer?.contents || [];
            for (const item of items) {
              if (item.videoRenderer) {
                const v = item.videoRenderer;
                const descRuns = v.detailedMetadataSnippets?.[0]?.snippetText?.runs || v.descriptionSnippet?.runs || [];
                const description = descRuns.map(r => r.text).join('');

                const videoId = v.videoId;
                if (!videoId) continue;

                videos.push({
                  videoId: videoId,
                  title: v.title?.runs?.map(r => r.text).join('') || v.title?.simpleText || 'YouTube Video',
                  channel: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'YouTube Creator',
                  thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                  duration: v.lengthText?.simpleText || 'Video',
                  views: v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || '',
                  published: v.publishedTimeText?.simpleText || '',
                  description: description
                });
              }
            }
          }

          resolve(videos);
        } catch (err) {
          console.error('Error parsing YouTube search results:', err);
          resolve([]);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Error contacting YouTube:', err);
      reject(err);
    });
  });
}

// --- Main HTTP Server ---
const server = http.createServer(async (req, res) => {
  // Use WHATWG URL API
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
  const pathname = reqUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // --- API: Health Check ---
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'Synapse OS Server',
      port: PORT,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      databaseConnected: !!inMemoryDb
    }));
    return;
  }

  // --- API: Supabase Auth Configuration ---
  if (pathname === '/api/auth/config') {
    if (req.method === 'GET') {
      const url = (process.env.SUPABASE_URL || '').trim();
      const key = (process.env.SUPABASE_ANON_KEY || '').trim();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        configured: !!(url && key),
        supabaseUrl: url,
        supabaseAnonKey: key
      }));
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        const newUrl = (body.supabaseUrl || '').trim();
        const newKey = (body.supabaseAnonKey || '').trim();

        process.env.SUPABASE_URL = newUrl;
        process.env.SUPABASE_ANON_KEY = newKey;

        // Persist to .env
        const envPath = path.join(__dirname, '.env');
        let envLines = [];
        if (fs.existsSync(envPath)) {
          envLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter(Boolean);
        }

        const setEnvVar = (k, v) => {
          const idx = envLines.findIndex(l => l.startsWith(`${k}=`));
          if (idx !== -1) {
            envLines[idx] = `${k}=${v}`;
          } else {
            envLines.push(`${k}=${v}`);
          }
        };

        if (newUrl) setEnvVar('SUPABASE_URL', newUrl);
        if (newKey) setEnvVar('SUPABASE_ANON_KEY', newKey);

        fs.writeFileSync(envPath, envLines.join('\n') + '\n', 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          configured: !!(newUrl && newKey),
          message: 'Supabase configuration saved & active!'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }
  }

  // --- API: Full Data State GET & POST ---
  if (pathname === '/api/data') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: inMemoryDb
      }));
      return;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseRequestBody(req);
        if (body && typeof body === 'object') {
          saveDatabase(body);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            savedAt: new Date().toISOString()
          }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Invalid data payload' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }
  }

  // --- API: Tasks REST Resource ---
  if (pathname === '/api/tasks') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        tasks: inMemoryDb.tasks || []
      }));
      return;
    }

    if (req.method === 'POST') {
      try {
        const task = await parseRequestBody(req);
        if (!task || !task.title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Task title is required' }));
          return;
        }

        if (!inMemoryDb.tasks) inMemoryDb.tasks = [];
        
        const existingIdx = inMemoryDb.tasks.findIndex(t => t.id === task.id);
        if (existingIdx !== -1) {
          inMemoryDb.tasks[existingIdx] = { ...inMemoryDb.tasks[existingIdx], ...task };
        } else {
          task.id = task.id || 'task-' + Date.now();
          inMemoryDb.tasks.unshift(task);
        }

        saveDatabase(inMemoryDb);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, task: task }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'DELETE') {
      const taskId = reqUrl.searchParams.get('id');
      if (taskId && inMemoryDb.tasks) {
        inMemoryDb.tasks = inMemoryDb.tasks.filter(t => t.id !== taskId);
        saveDatabase(inMemoryDb);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: taskId }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Task id parameter required' }));
      }
      return;
    }
  }

  // --- API: Notes REST Resource ---
  if (pathname === '/api/notes') {
    if (req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        notes: inMemoryDb.notes || []
      }));
      return;
    }

    if (req.method === 'POST') {
      try {
        const note = await parseRequestBody(req);
        if (!note || !note.title) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Note title is required' }));
          return;
        }

        if (!inMemoryDb.notes) inMemoryDb.notes = [];

        const existingIdx = inMemoryDb.notes.findIndex(n => n.id === note.id);
        if (existingIdx !== -1) {
          inMemoryDb.notes[existingIdx] = { ...inMemoryDb.notes[existingIdx], ...note, updatedAt: new Date().toISOString() };
        } else {
          note.id = note.id || 'note-' + Date.now();
          note.updatedAt = new Date().toISOString();
          inMemoryDb.notes.unshift(note);
        }

        saveDatabase(inMemoryDb);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, note }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
      return;
    }

    if (req.method === 'DELETE') {
      const noteId = reqUrl.searchParams.get('id');
      if (noteId && inMemoryDb.notes) {
        inMemoryDb.notes = inMemoryDb.notes.filter(n => n.id !== noteId);
        saveDatabase(inMemoryDb);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: noteId }));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Note id parameter required' }));
      }
      return;
    }
  }

  // --- API: File Uploads (PDFs, Images) ---
  if (pathname === '/api/upload' && req.method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      if (body && body.dataUrl && body.fileName) {
        const matches = body.dataUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          const buffer = Buffer.from(matches[2], 'base64');
          const cleanName = path.basename(body.fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
          const fileName = `${Date.now()}_${cleanName}`;
          const targetPath = path.join(UPLOADS_DIR, fileName);
          fs.writeFileSync(targetPath, buffer);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: true,
            fileName: fileName,
            url: `/uploads/${fileName}`,
            size: buffer.length
          }));
          return;
        }
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Invalid file upload payload. Base64 dataUrl and fileName required.' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // --- API: Test YouTube API Key ---
  if (pathname === '/api/youtube-test-key') {
    const apiKey = (reqUrl.searchParams.get('apiKey') || '').trim();
    if (!apiKey) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, error: 'API key is required.' }));
      return;
    }

    const testUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=test&key=${encodeURIComponent(apiKey)}`;
    https.get(testUrl, (resp) => {
      let body = '';
      resp.on('data', c => { body += c; });
      resp.on('end', () => {
        try {
          const data = JSON.parse(body);
          if (data.error) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: false, error: data.error.message || 'Invalid API key.' }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ valid: true, message: 'YouTube Data API v3 key is verified and working!' }));
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ valid: false, error: 'Error validating response from Google.' }));
        }
      });
    }).on('error', (e) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ valid: false, error: e.message }));
    });
    return;
  }

  // --- API: YouTube Search (API Key priority with fallback) ---
  if (pathname === '/api/youtube-search') {
    const q = (reqUrl.searchParams.get('q') || '').trim();
    const type = reqUrl.searchParams.get('type') || 'video';
    const apiKey = (reqUrl.searchParams.get('apiKey') || process.env.YOUTUBE_API_KEY || '').trim();

    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Search query parameter "q" is required.' }));
      return;
    }

    try {
      let results = [];
      let source = 'live_scrape';

      if (apiKey) {
        try {
          results = await searchYouTubeAPIv3(q, apiKey);
          source = 'youtube_api_v3';
        } catch (apiErr) {
          console.warn('YouTube API v3 failed, falling back to live scrape:', apiErr.message);
          results = await searchYouTubeLive(q, type);
          source = 'fallback_live_scrape';
        }
      } else {
        results = await searchYouTubeLive(q, type);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        query: q,
        source: source,
        count: results.length,
        results: results
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: 'Failed to search YouTube.',
        details: err.message
      }));
    }
    return;
  }

  // --- API: Generate Video Notes for Running Video ---
  if (pathname === '/api/generate-video-notes') {
    const videoId = (reqUrl.searchParams.get('videoId') || '').trim();
    const title = (reqUrl.searchParams.get('title') || 'Educational Lecture').trim();
    const channel = (reqUrl.searchParams.get('channel') || 'Instructor').trim();
    const mode = (reqUrl.searchParams.get('mode') || 'full').trim();

    const generated = generateEducationalNotes(title, channel, videoId, mode);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      videoId: videoId,
      title: title,
      channel: channel,
      mode: mode,
      notes: generated
    }));
    return;
  }

  // --- Static File Serving ---
  let reqPath = pathname;
  if (reqPath === '/') reqPath = '/index.html';

  // Prevent directory traversal attacks
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, safePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[Synapse OS] Full-stack server active at http://localhost:${PORT}`);
  console.log(`[Synapse OS] Health check available at http://localhost:${PORT}/api/health`);
});
