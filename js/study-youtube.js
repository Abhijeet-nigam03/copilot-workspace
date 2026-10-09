// ==========================================
// SYNAPSE OS: Enhanced YouTube Study Manager
// High-Reliability YouTube Data API v3 Integration,
// Live YouTube Search, Instant Playback,
// Synchronized Timestamp Notes, In-Player Controls & Tracker
// ==========================================

class YouTubeStudyManager {
  constructor() {
    this.currentVideoId = null;
    this.playbackTimeEstimate = 0;
    this.playbackTimer = null;
    this.isPlaying = false;
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.selectedTag = null;
    this.isSearchingLive = false;
    this.eventsBound = false;
    this.searchResultsMap = new Map();
    this.currentGenMode = 'full';
    this.isGeneratingNotes = false;
    this.quickNotesSaveTimer = null;

    // Load API Key from localStorage or default to configured key
    const savedKey = (localStorage.getItem('synapse_yt_api_key') || '').trim();
    this.apiKey = savedKey || 'AIzaSyDWZbknHjnZeDzRwNlW5nxodP09ReyFM0k';
    if (!savedKey) {
      try {
        localStorage.setItem('synapse_yt_api_key', this.apiKey);
      } catch (e) {}
    }
  }

  init() {
    this.renderCuratedList();
    this.updateApiKeyUI();
    this.bindEvents();

    // Ensure iframe element exists in DOM
    this.ensureIframe();

    // Select first video if none selected
    if (!this.currentVideoId && store.data.youtubeVideos && store.data.youtubeVideos.length > 0) {
      this.selectVideo(store.data.youtubeVideos[0].id, false);
    } else if (this.currentVideoId) {
      this.selectVideo(this.currentVideoId, false);
    }
  }

  // --- 1. DOM & IFRAME LIFECYCLE MANAGEMENT ---
  ensureIframe() {
    let iframe = document.getElementById('yt-player-iframe');
    const container = document.querySelector('.yt-player-box');
    if (!iframe && container) {
      iframe = document.createElement('iframe');
      iframe.id = 'yt-player-iframe';
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      container.appendChild(iframe);
    }
    return iframe;
  }

  // --- 2. API KEY UI & PERSISTENCE ---
  updateApiKeyUI() {
    const label = document.getElementById('yt-api-key-label');
    const settingsBtn = document.getElementById('btn-yt-api-settings');
    if (!label) return;

    if (this.apiKey) {
      label.textContent = '🟢 API Connected';
      if (settingsBtn) {
        settingsBtn.style.borderColor = 'var(--accent-emerald)';
        settingsBtn.title = 'YouTube Data API v3 Key active and connected';
      }
    } else {
      label.textContent = '🔑 Set API Key';
      if (settingsBtn) {
        settingsBtn.style.borderColor = 'var(--border-subtle)';
        settingsBtn.title = 'Configure YouTube Data API v3 Key';
      }
    }
  }

  openApiKeyModal() {
    const modal = document.getElementById('modal-yt-api-settings');
    const input = document.getElementById('input-yt-api-key');
    const statusMsg = document.getElementById('yt-key-status-msg');

    if (modal) {
      modal.classList.add('open');
      if (input) {
        input.value = this.apiKey;
        input.type = 'password';
        input.focus();
      }
      const showBtn = document.getElementById('btn-toggle-show-yt-key');
      if (showBtn) showBtn.textContent = 'Show';

      if (statusMsg) {
        statusMsg.innerHTML = this.apiKey
          ? '<span style="color: var(--accent-emerald); font-weight: 500;">● Official YouTube API Key configured & active.</span>'
          : 'Saved securely in your browser local storage.';
      }
    }
  }

  async testApiKey(key) {
    const statusMsg = document.getElementById('yt-key-status-msg');
    const cleanKey = (key || '').trim();
    if (!cleanKey) {
      if (statusMsg) statusMsg.innerHTML = '<span style="color: #ef4444;">Please enter an API key to test.</span>';
      return;
    }

    if (statusMsg) statusMsg.innerHTML = '⏳ Validating key with Google YouTube Data API...';

    try {
      const res = await fetch(`/api/youtube-test-key?apiKey=${encodeURIComponent(cleanKey)}`);
      const data = await res.json();
      if (data.valid) {
        if (statusMsg) statusMsg.innerHTML = `<span style="color: var(--accent-emerald); font-weight: 600;">✅ ${data.message}</span>`;
        showToast('✅ YouTube API Key verified successfully!', 'success');
      } else {
        if (statusMsg) statusMsg.innerHTML = `<span style="color: #ef4444;">❌ Validation failed: ${data.error}</span>`;
        showToast(`API Key Error: ${data.error}`, 'error');
      }
    } catch (err) {
      if (statusMsg) statusMsg.innerHTML = `<span style="color: #ef4444;">❌ Network error: ${err.message}</span>`;
    }
  }

  saveApiKey(key) {
    const cleanKey = (key || '').trim();
    this.apiKey = cleanKey;
    if (cleanKey) {
      localStorage.setItem('synapse_yt_api_key', cleanKey);
      showToast('🔑 YouTube Data API Key saved & activated!', 'success');
    } else {
      localStorage.removeItem('synapse_yt_api_key');
      showToast('API Key removed', 'info');
    }
    this.updateApiKeyUI();

    const modal = document.getElementById('modal-yt-api-settings');
    if (modal) modal.classList.remove('open');
  }

  clearApiKey() {
    this.apiKey = '';
    localStorage.removeItem('synapse_yt_api_key');
    const input = document.getElementById('input-yt-api-key');
    if (input) input.value = '';
    const statusMsg = document.getElementById('yt-key-status-msg');
    if (statusMsg) statusMsg.textContent = 'API Key cleared. Searches will use live engine fallback.';
    this.updateApiKeyUI();
    showToast('API Key cleared', 'info');
  }

  // --- 3. URL EXTRACTION & METADATA RESOLUTION ---
  extractVideoId(input) {
    if (!input) return null;
    input = input.trim();

    // Standard and short YouTube links
    const match = input.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
    if (match) return match[1];

    // Explicit 11-char ID (only if strictly matches YouTube ID format and looks like an ID, not plain words)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input) && !/^[a-zA-Z]+$/.test(input)) {
      return input;
    }

    return null;
  }

  async fetchMetadata(videoId) {
    // 1. Try noembed with 3s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const url = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) {
          return {
            title: data.title,
            channel: data.author_name || 'YouTube Creator',
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
          };
        }
      }
    } catch (err) {
      console.warn('Metadata resolution failed, using fallback:', err);
    }

    return {
      title: `Educational Lecture (${videoId})`,
      channel: 'YouTube Academy',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  }

  async quickLoadUrl(urlOrId) {
    const videoId = this.extractVideoId(urlOrId) || (urlOrId.length === 11 ? urlOrId : null);
    if (!videoId) {
      showToast('⚠️ Please enter a valid YouTube video link (e.g. youtube.com/watch?v=...)', 'error');
      return;
    }

    // Check if video already exists in shelf
    const existing = store.data.youtubeVideos.find(v => v.videoId === videoId);
    if (existing) {
      this.selectVideo(existing.id, true);
      showToast(`▶ Loaded: ${existing.title}`, 'info');
      const input = document.getElementById('input-quick-yt-url');
      if (input) input.value = '';
      return;
    }

    showToast('🔍 Loading video into workspace...', 'info');
    const meta = await this.fetchMetadata(videoId);

    const newVideo = {
      id: 'yt-' + Date.now(),
      subjectId: store.data.subjects[0]?.id || 'subj-1',
      title: meta.title,
      channel: meta.channel,
      videoId: videoId,
      thumbnail: meta.thumbnail,
      duration: 'Lecture',
      tags: ['YouTube', 'Study'],
      notes: []
    };

    store.data.youtubeVideos.unshift(newVideo);
    store.saveData();

    this.renderCuratedList();
    this.selectVideo(newVideo.id, true);

    const input = document.getElementById('input-quick-yt-url');
    if (input) input.value = '';

    showToast(`✅ Added & playing: ${newVideo.title}`, 'success');
  }

  // --- 4. LIVE YOUTUBE SEARCH ENGINE (API v3 PRIORITY) ---
  async searchLiveYouTube(query) {
    if (!query || !query.trim()) return;
    query = query.trim();

    // Check if input is actually an explicit URL containing youtube.com or youtu.be
    if (query.includes('youtube.com') || query.includes('youtu.be')) {
      this.quickLoadUrl(query);
      return;
    }

    const panel = document.getElementById('yt-live-search-panel');
    const heading = document.getElementById('yt-search-results-heading');
    const loading = document.getElementById('yt-search-loading');
    const grid = document.getElementById('yt-search-results-grid');

    if (!panel || !grid) return;

    panel.style.display = 'block';
    if (heading) {
      const sourceBadge = this.apiKey
        ? '<span class="badge badge-primary" style="margin-left: 0.5rem; font-size: 0.68rem; font-weight: 600;">⚡ Official YouTube API</span>'
        : '<span class="badge badge-neutral" style="margin-left: 0.5rem; font-size: 0.68rem;">Live Search</span>';
      heading.innerHTML = `YouTube Results for: "${query}" ${sourceBadge}`;
    }

    if (loading) loading.style.display = 'block';
    grid.innerHTML = '';

    // Scroll panel into view smoothly
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    try {
      const apiParam = this.apiKey ? `&apiKey=${encodeURIComponent(this.apiKey)}` : '';
      const res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}&type=video${apiParam}`);
      const data = await res.json();

      if (loading) loading.style.display = 'none';

      if (!data.success || !data.results || data.results.length === 0) {
        grid.innerHTML = `
          <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
            <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">🔍</div>
            <strong>No YouTube results found for "${query}".</strong><br>
            Try refining your keywords or searching a specific subject topic.
          </div>
        `;
        return;
      }

      // Cache all results in memory map for instant 0ms access
      data.results.forEach(video => {
        this.searchResultsMap.set(video.videoId, video);
      });

      grid.innerHTML = data.results.map(video => {
        const isAlreadyInShelf = store.data.youtubeVideos.some(v => v.videoId === video.videoId);

        return `
          <div class="yt-result-card" data-video-id="${video.videoId}">
            <div class="yt-result-media" onclick="ytManager.loadSearchResult('${video.videoId}', true)">
              <img src="${video.thumbnail}" alt="${video.title.replace(/"/g, '&quot;')}" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg'">
              ${video.duration ? `<span class="yt-duration-pill">${video.duration}</span>` : ''}
            </div>
            <div class="yt-result-info">
              <div>
                <div class="yt-result-title" onclick="ytManager.loadSearchResult('${video.videoId}', true)">
                  ${video.title}
                </div>
                <div class="yt-result-channel-meta">
                  <span class="yt-result-channel">👤 ${video.channel}</span>
                  ${video.views ? `<span>•</span> <span>${video.views}</span>` : ''}
                  ${video.published ? `<span>•</span> <span>${video.published}</span>` : ''}
                </div>
                ${video.description ? `<div class="yt-result-desc">${video.description}</div>` : ''}
              </div>
              <div class="yt-result-actions">
                <button class="btn btn-primary" onclick="ytManager.loadSearchResult('${video.videoId}', true)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
                  <span>▶ Play & Study</span>
                </button>
                <button class="btn btn-secondary btn-shelf-add-${video.videoId}" onclick="ytManager.loadSearchResult('${video.videoId}', false)" style="padding: 0.35rem 0.75rem; font-size: 0.76rem;">
                  <span>${isAlreadyInShelf ? '✓ In Library' : '+ Add to Library'}</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      showToast(`🎬 Found ${data.results.length} YouTube lectures!`, 'info');
    } catch (err) {
      console.error('Failed to search YouTube:', err);
      if (loading) loading.style.display = 'none';
      grid.innerHTML = `
        <div style="padding: 1.5rem; text-align: center; color: #ef4444; font-size: 0.85rem;">
          Error connecting to YouTube search engine. Please check your API key or connection.
        </div>
      `;
    }
  }

  closeLiveSearch() {
    const panel = document.getElementById('yt-live-search-panel');
    if (panel) panel.style.display = 'none';
  }

  async loadSearchResult(videoId, playNow = true) {
    let existing = store.data.youtubeVideos.find(v => v.videoId === videoId);

    if (!existing) {
      // Instantly retrieve metadata from cached search results map (0ms network delay)
      const cached = this.searchResultsMap.get(videoId);
      let title = cached ? cached.title : `Educational Lecture (${videoId})`;
      let channel = cached ? cached.channel : 'YouTube Creator';
      let thumbnail = cached ? cached.thumbnail : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      let duration = cached ? cached.duration : 'Lecture';

      existing = {
        id: 'yt-' + Date.now(),
        subjectId: store.data.subjects[0]?.id || 'subj-1',
        title: title,
        channel: channel,
        videoId: videoId,
        thumbnail: thumbnail,
        duration: duration || 'Study Lecture',
        tags: ['YouTube', 'Search'],
        notes: []
      };

      store.data.youtubeVideos.unshift(existing);
      store.saveData();
      this.renderCuratedList();

      // Update button text in search results
      const btn = document.querySelector(`.btn-shelf-add-${videoId}`);
      if (btn) btn.innerHTML = '<span>✓ In Library</span>';
    }

    if (playNow) {
      this.selectVideo(existing.id, true);
      // Smooth scroll to player
      const playerBox = document.querySelector('.yt-player-box');
      if (playerBox) playerBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      showToast(`▶ Now Studying: ${existing.title}`, 'success');
    } else {
      showToast(`✓ Added to Library Shelf: ${existing.title}`, 'success');
    }
  }

  // --- 5. EVENT BINDINGS (GUARDED TO PREVENT DUPLICATES) ---
  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    const quickInput = document.getElementById('input-quick-yt-url');
    const searchBtn = document.getElementById('btn-quick-yt-search');
    const playBtn = document.getElementById('btn-quick-yt-play');

    // API Key Settings Modal trigger
    const apiKeyBtn = document.getElementById('btn-yt-api-settings');
    if (apiKeyBtn) {
      apiKeyBtn.addEventListener('click', () => this.openApiKeyModal());
    }

    // Toggle password visibility in modal
    const toggleKeyBtn = document.getElementById('btn-toggle-show-yt-key');
    const keyInput = document.getElementById('input-yt-api-key');
    if (toggleKeyBtn && keyInput) {
      toggleKeyBtn.addEventListener('click', () => {
        if (keyInput.type === 'password') {
          keyInput.type = 'text';
          toggleKeyBtn.textContent = 'Hide';
        } else {
          keyInput.type = 'password';
          toggleKeyBtn.textContent = 'Show';
        }
      });
    }

    // Test API Key button in modal
    const testKeyBtn = document.getElementById('btn-test-yt-api-key');
    if (testKeyBtn && keyInput) {
      testKeyBtn.addEventListener('click', () => this.testApiKey(keyInput.value));
    }

    // Save API Key button in modal
    const saveKeyBtn = document.getElementById('btn-save-yt-api-key');
    if (saveKeyBtn && keyInput) {
      saveKeyBtn.addEventListener('click', () => this.saveApiKey(keyInput.value));
    }

    // Clear API Key button in modal
    const clearKeyBtn = document.getElementById('btn-clear-yt-api-key');
    if (clearKeyBtn) {
      clearKeyBtn.addEventListener('click', () => this.clearApiKey());
    }

    // Search button
    if (searchBtn && quickInput) {
      searchBtn.addEventListener('click', () => {
        const val = quickInput.value.trim();
        if (val) {
          if (val.includes('youtube.com') || val.includes('youtu.be')) {
            this.quickLoadUrl(val);
          } else {
            this.searchLiveYouTube(val);
          }
        }
      });
    }

    // Play direct URL button
    if (playBtn && quickInput) {
      playBtn.addEventListener('click', () => {
        const val = quickInput.value.trim();
        if (val) {
          this.quickLoadUrl(val);
        }
      });
    }

    // Enter key in search bar
    if (quickInput) {
      quickInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = quickInput.value.trim();
          if (val) {
            if (val.includes('youtube.com') || val.includes('youtu.be')) {
              this.quickLoadUrl(val);
            } else {
              this.searchLiveYouTube(val);
            }
          }
        }
      });
    }

    // Close live search results
    const closeSearchBtn = document.getElementById('btn-close-yt-search');
    if (closeSearchBtn) {
      closeSearchBtn.addEventListener('click', () => this.closeLiveSearch());
    }

    // Suggested Search Query Chips
    document.querySelectorAll('.yt-chip-btn').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const q = e.currentTarget.dataset.query;
        if (quickInput) quickInput.value = q;
        this.searchLiveYouTube(q);
      });
    });

    // Jump 10s buttons
    const rewBtn = document.getElementById('btn-yt-rewind-10');
    if (rewBtn) {
      rewBtn.addEventListener('click', () => this.seekRelative(-10));
    }

    const fwdBtn = document.getElementById('btn-yt-forward-10');
    if (fwdBtn) {
      fwdBtn.addEventListener('click', () => this.seekRelative(10));
    }

    // Playback Speed buttons
    document.querySelectorAll('.yt-speed-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const speed = parseFloat(e.currentTarget.dataset.speed);
        this.setPlaybackRate(speed);
        document.querySelectorAll('.yt-speed-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        showToast(`⚡ Playback speed: ${speed}x`, 'info');
      });
    });

    // Theater Mode Toggle
    const theaterBtn = document.getElementById('btn-yt-theater');
    if (theaterBtn) {
      theaterBtn.addEventListener('click', () => {
        const container = document.getElementById('yt-study-container');
        if (container) {
          container.classList.toggle('theater-mode');
          showToast(container.classList.contains('theater-mode') ? '🎭 Theater Mode Enabled' : 'Exited Theater Mode', 'info');
        }
      });
    }

    // Log 30m Session to Study Tracker
    const logSessionBtn = document.getElementById('btn-yt-log-session');
    if (logSessionBtn) {
      logSessionBtn.addEventListener('click', () => this.logStudySession(30));
    }

    // Export Markdown Notes
    const exportNotesBtn = document.getElementById('btn-yt-export-markdown');
    if (exportNotesBtn) {
      exportNotesBtn.addEventListener('click', () => this.exportNotesMarkdown());
    }

    // Tag Chips selection for new note
    document.querySelectorAll('#yt-tag-chips-group .yt-tag-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const tag = e.currentTarget.dataset.tag;
        if (this.selectedTag === tag) {
          this.selectedTag = null;
          e.currentTarget.classList.remove('active');
        } else {
          document.querySelectorAll('#yt-tag-chips-group .yt-tag-chip').forEach(c => c.classList.remove('active'));
          this.selectedTag = tag;
          e.currentTarget.classList.add('active');
        }
      });
    });

    // Pin Note at timestamp
    const addNoteBtn = document.getElementById('btn-add-yt-note');
    if (addNoteBtn) {
      addNoteBtn.addEventListener('click', () => this.addNoteAtCurrentTime());
    }

    const noteInput = document.getElementById('yt-new-note-text');
    if (noteInput) {
      noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addNoteAtCurrentTime();
        }
      });
    }

    // --- Right-Side Tabs: Generate Notes vs Timestamps ---
    const tabGen = document.getElementById('yt-tab-btn-generate');
    const tabBm = document.getElementById('yt-tab-btn-bookmarks');
    const paneGen = document.getElementById('yt-pane-generate-notes');
    const paneBm = document.getElementById('yt-pane-timestamps');

    if (tabGen && tabBm) {
      tabGen.addEventListener('click', () => {
        tabGen.classList.add('active');
        tabBm.classList.remove('active');
        if (paneGen) paneGen.style.display = 'flex';
        if (paneBm) paneBm.style.display = 'none';
      });
      tabBm.addEventListener('click', () => {
        tabBm.classList.add('active');
        tabGen.classList.remove('active');
        if (paneGen) paneGen.style.display = 'none';
        if (paneBm) paneBm.style.display = 'flex';
      });
    }

    // AI Generation Preset Focus Chips
    document.querySelectorAll('#yt-gen-preset-group .yt-chip-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#yt-gen-preset-group .yt-chip-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentGenMode = e.currentTarget.dataset.mode || 'full';
      });
    });

    // Generate Notes Action Button
    const genBtn = document.getElementById('btn-yt-generate-ai-notes');
    if (genBtn) {
      genBtn.addEventListener('click', () => this.generateNotesForCurrentVideo());
    }

    // Generated Notes Action Toolbar (Copy, Append to Quick, Save to Subject Notes)
    const copyGenBtn = document.getElementById('btn-yt-copy-gen-notes');
    if (copyGenBtn) {
      copyGenBtn.addEventListener('click', () => this.copyGeneratedNotes());
    }

    const appendToQuickBtn = document.getElementById('btn-yt-append-to-quick');
    if (appendToQuickBtn) {
      appendToQuickBtn.addEventListener('click', () => this.appendGeneratedToQuickNotes());
    }

    const saveGenToNotebookBtn = document.getElementById('btn-yt-save-gen-to-notebook');
    if (saveGenToNotebookBtn) {
      saveGenToNotebookBtn.addEventListener('click', () => this.saveGeneratedToNotebook());
    }

    // --- Quick Notes (Below Player) Event Bindings ---
    const quickNotesTextarea = document.getElementById('yt-quick-notes-textarea');
    if (quickNotesTextarea) {
      quickNotesTextarea.addEventListener('input', () => {
        this.handleQuickNotesInput();
      });
    }

    const insertTimeBtn = document.getElementById('btn-yt-insert-timestamp');
    if (insertTimeBtn) {
      insertTimeBtn.addEventListener('click', () => this.insertTimestampIntoQuickNotes());
    }

    const saveQuickToNotebookBtn = document.getElementById('btn-yt-save-to-notebook');
    if (saveQuickToNotebookBtn) {
      saveQuickToNotebookBtn.addEventListener('click', () => this.saveQuickNotesToNotebook());
    }

    const clearQuickNotesBtn = document.getElementById('btn-yt-clear-quick-notes');
    if (clearQuickNotesBtn) {
      clearQuickNotesBtn.addEventListener('click', () => this.clearQuickNotes());
    }

    // Quick notes formatting toolbar buttons
    document.querySelectorAll('.yt-quick-notes-toolbar .yt-fmt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const fmt = e.currentTarget.dataset.fmt;
        this.applyQuickNotesFormatting(fmt);
      });
    });

    // Shelf Subject Filters
    document.querySelectorAll('#yt-shelf-filter-group .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#yt-shelf-filter-group .segment-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.dataset.filter;
        this.renderCuratedList();
      });
    });

    // Shelf Search input
    const shelfSearch = document.getElementById('yt-shelf-search');
    if (shelfSearch) {
      shelfSearch.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.renderCuratedList();
      });
    }

    // Add Video Modal Trigger
    const addVideoBtn = document.getElementById('btn-add-yt-video');
    if (addVideoBtn) {
      addVideoBtn.addEventListener('click', () => this.openAddVideoModal());
    }

    // Auto-fetch in Add Video Modal
    const modalAutofillBtn = document.getElementById('btn-modal-yt-autofill');
    const modalUrlInput = document.getElementById('input-yt-url');
    if (modalAutofillBtn && modalUrlInput) {
      modalAutofillBtn.addEventListener('click', async () => {
        const val = modalUrlInput.value.trim();
        const id = this.extractVideoId(val) || (val.length === 11 ? val : null);
        const statusEl = document.getElementById('modal-yt-fetch-status');
        if (!id) {
          if (statusEl) statusEl.textContent = '⚠️ Invalid YouTube link. Please check URL.';
          return;
        }

        if (statusEl) statusEl.textContent = '⏳ Resolving title and creator from YouTube...';
        const meta = await this.fetchMetadata(id);
        const titleInput = document.getElementById('input-yt-title');
        const channelInput = document.getElementById('input-yt-channel');
        if (titleInput) titleInput.value = meta.title;
        if (channelInput) channelInput.value = meta.channel;
        if (statusEl) statusEl.textContent = '✅ Metadata fetched successfully!';
      });
    }

    // Listen to postMessage from YouTube Iframe for time synchronization
    window.addEventListener('message', (event) => {
      try {
        if (!event.data) return;
        let data = event.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) { return; }
        }

        if (data.event === 'infoDelivery' && data.info) {
          if (typeof data.info.currentTime === 'number') {
            this.playbackTimeEstimate = Math.floor(data.info.currentTime);
            this.updateCurrentTimeBadge();
          }
          if (typeof data.info.playerState === 'number') {
            if (data.info.playerState === 1) { // PLAYING
              this.startPlaybackTracking();
            } else {
              this.stopPlaybackTracking();
            }
          }
        } else if (data.event === 'onStateChange') {
          if (data.info === 1) {
            this.startPlaybackTracking();
          } else {
            this.stopPlaybackTracking();
          }
        }
      } catch (e) {}
    });

    // Global Key shortcuts when study view is active
    document.addEventListener('keydown', (e) => {
      const activePanel = document.querySelector('.view-panel.active');
      const activeSubview = document.querySelector('.study-subview.active');
      if (!activePanel || activePanel.id !== 'view-study' || !activeSubview || activeSubview.id !== 'study-view-youtube') {
        return;
      }

      // Ignore shortcuts if user is typing in an input or textarea
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        this.seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.seekRelative(10);
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        this.togglePlayPause();
      }
    });
  }

  // --- 6. POSTMESSAGE COMMANDS & CONTROLS ---
  sendCommand(func, args = []) {
    const iframe = this.ensureIframe();
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage(JSON.stringify({
          event: 'command',
          func: func,
          args: args
        }), '*');
      } catch (e) {
        console.warn('Could not postMessage to YouTube player:', e);
      }
    }
  }

  startPlaybackTracking() {
    this.isPlaying = true;
    this.stopPlaybackTracking();
    this.playbackTimer = setInterval(() => {
      this.playbackTimeEstimate++;
      this.updateCurrentTimeBadge();
    }, 1000);
  }

  stopPlaybackTracking() {
    this.isPlaying = false;
    if (this.playbackTimer) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  updateCurrentTimeBadge() {
    const badge = document.getElementById('yt-current-time-badge');
    const pill = document.getElementById('yt-insert-time-pill');
    const timeFormatted = this.formatSeconds(this.playbackTimeEstimate);
    if (badge) {
      badge.textContent = timeFormatted;
    }
    if (pill) {
      pill.textContent = `⏱️ ${timeFormatted}`;
    }
  }

  seekRelative(delta) {
    const newTarget = Math.max(0, this.playbackTimeEstimate + delta);
    this.seekToTime(newTarget);
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.sendCommand('pauseVideo');
      this.stopPlaybackTracking();
      showToast('⏸ Video Paused', 'info');
    } else {
      this.sendCommand('playVideo');
      this.startPlaybackTracking();
      showToast('▶ Video Playing', 'info');
    }
  }

  seekToTime(seconds) {
    this.playbackTimeEstimate = seconds;
    this.sendCommand('seekTo', [seconds, true]);
    this.sendCommand('playVideo');
    this.startPlaybackTracking();
    this.updateCurrentTimeBadge();
    showToast(`⏩ Jumped to ${this.formatSeconds(seconds)}`, 'info');
  }

  setPlaybackRate(speed) {
    this.sendCommand('setPlaybackRate', [speed]);
  }

  // --- 7. LECTURE SHELF RENDERING & SELECTION ---
  renderCuratedList() {
    const container = document.getElementById('yt-curated-list');
    const countBadge = document.getElementById('yt-library-count');
    if (!container) return;

    let filtered = store.data.youtubeVideos || [];

    // Filter by subject
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(v => v.subjectId === this.currentFilter);
    }

    // Filter by search query
    if (this.searchQuery) {
      filtered = filtered.filter(v =>
        v.title.toLowerCase().includes(this.searchQuery) ||
        v.channel.toLowerCase().includes(this.searchQuery) ||
        (v.tags && v.tags.some(t => t.toLowerCase().includes(this.searchQuery)))
      );
    }

    if (countBadge) {
      countBadge.textContent = `${filtered.length} Lecture${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 1.25rem; color: var(--text-muted); font-size: 0.82rem; text-align: center; width: 100%;">
          No matching lectures in shelf. Search YouTube above to add one instantly.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(video => {
      const isSelected = video.id === this.currentVideoId;
      const subject = store.data.subjects.find(s => s.id === video.subjectId);
      const notesCount = video.notes ? video.notes.length : 0;

      return `
        <div class="yt-thumb-card ${isSelected ? 'active' : ''}" data-id="${video.id}">
          <button class="yt-thumb-remove-btn" title="Remove from shelf" data-remove-id="${video.id}">✕</button>
          <div class="yt-thumb-media">
            <img src="${video.thumbnail}" alt="${video.title.replace(/"/g, '&quot;')}" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg'">
            <span class="yt-duration-pill">${video.duration || 'Lecture'}</span>
          </div>
          <div class="yt-thumb-title">${video.title}</div>
          <div class="yt-thumb-meta">
            <span>${video.channel}</span>
            <span style="color: ${subject ? subject.color : 'var(--accent-primary)'}; font-weight: 500;">
              ${notesCount ? `📝 ${notesCount}` : ''}
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Select video click
    container.querySelectorAll('.yt-thumb-card').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.yt-thumb-remove-btn')) return;
        this.selectVideo(el.dataset.id, true);
      });
    });

    // Remove video click
    container.querySelectorAll('.yt-thumb-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeId = btn.dataset.removeId;
        this.removeVideo(removeId);
      });
    });
  }

  selectVideo(videoId, autoPlay = true) {
    this.currentVideoId = videoId;
    const video = (store.data.youtubeVideos || []).find(v => v.id === videoId);
    if (!video) return;

    // Update metadata headers
    const titleEl = document.getElementById('yt-current-title');
    const channelEl = document.getElementById('yt-current-channel');
    if (titleEl) titleEl.textContent = video.title;
    if (channelEl) channelEl.textContent = `${video.channel} • ${video.duration || 'Lecture'}`;

    // Update external link if present
    const extLink = document.getElementById('yt-external-link');
    if (extLink) {
      extLink.href = `https://www.youtube.com/watch?v=${video.videoId}`;
    }

    // Load inside iframe with enablejsapi=1
    const iframe = this.ensureIframe();
    if (iframe) {
      const targetSrc = `https://www.youtube.com/embed/${video.videoId}?enablejsapi=1&autoplay=${autoPlay ? '1' : '0'}&rel=0`;
      // Only reassign src if different to prevent unnecessary iframe reload
      if (!iframe.src || !iframe.src.includes(video.videoId)) {
        iframe.src = targetSrc;
      } else if (autoPlay) {
        this.sendCommand('playVideo');
      }
    }

    if (autoPlay) {
      this.startPlaybackTracking();
    } else {
      this.stopPlaybackTracking();
    }

    this.renderNotesList();
    this.renderCuratedList();

    // Reset current time estimate
    this.playbackTimeEstimate = 0;
    this.updateCurrentTimeBadge();

    // Sync Quick Notes for selected video
    const quickNotesTextarea = document.getElementById('yt-quick-notes-textarea');
    if (quickNotesTextarea) {
      quickNotesTextarea.value = video.quickNotes || '';
      this.updateQuickNotesWordCount();
    }
    const saveStatus = document.getElementById('yt-quick-note-save-status');
    if (saveStatus) {
      saveStatus.textContent = '● Auto-saved';
      saveStatus.className = 'badge badge-emerald';
    }

    // Render generated notes if any exist for this video
    this.renderGeneratedNotesForVideo(video);
  }

  removeVideo(videoId) {
    if (!confirm('Remove this video lecture from your workspace?')) return;
    store.data.youtubeVideos = (store.data.youtubeVideos || []).filter(v => v.id !== videoId);
    store.saveData();

    if (this.currentVideoId === videoId) {
      if (store.data.youtubeVideos.length > 0) {
        this.selectVideo(store.data.youtubeVideos[0].id, false);
      } else {
        this.currentVideoId = null;
        const titleEl = document.getElementById('yt-current-title');
        const channelEl = document.getElementById('yt-current-channel');
        if (titleEl) titleEl.textContent = 'No Video Selected';
        if (channelEl) channelEl.textContent = 'Search YouTube above to start studying';
        this.renderNotesList();
      }
    }

    this.renderCuratedList();
    showToast('Video removed from shelf', 'info');
  }

  // --- 8. TIMESTAMPED NOTES MANAGEMENT ---
  renderNotesList() {
    const container = document.getElementById('yt-notes-list');
    if (!container) return;

    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video || !video.notes || video.notes.length === 0) {
      container.innerHTML = `
        <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.82rem; line-height: 1.5;">
          <div style="font-size: 1.6rem; margin-bottom: 0.4rem;">⏱️</div>
          <strong>No timestamp notes yet.</strong><br>
          While watching, type an insight and click <em>Pin Note</em> (or press Enter) to bookmark key moments.
        </div>
      `;
      return;
    }

    const sortedNotes = [...video.notes].sort((a, b) => a.time - b.time);

    container.innerHTML = sortedNotes.map(note => {
      const timeStr = this.formatSeconds(note.time);
      return `
        <div class="note-item-card yt-note-item" data-note-id="${note.id}" style="margin-bottom: 0.45rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <button class="yt-time-pill-btn" data-time="${note.time}" title="Click to jump player to ${timeStr}">
              <span>▶</span> <span>${timeStr}</span>
            </button>
            <button class="btn-icon delete-note-btn" style="width: 20px; height: 20px; font-size: 0.7rem;" title="Delete note">
              ✕
            </button>
          </div>
          <div style="font-size: 0.82rem; color: var(--text-primary); line-height: 1.45;">${note.text}</div>
        </div>
      `;
    }).join('');

    // Bind Jump to Timestamp
    container.querySelectorAll('.yt-time-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const time = parseInt(btn.dataset.time, 10);
        this.seekToTime(time);
      });
    });

    // Bind Delete Note
    container.querySelectorAll('.delete-note-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = e.currentTarget.closest('.yt-note-item');
        const noteId = item.dataset.noteId;
        video.notes = video.notes.filter(n => n.id !== noteId);
        store.saveData();
        this.renderNotesList();
        this.renderCuratedList();
        showToast('Note deleted', 'info');
      });
    });
  }

  addNoteAtCurrentTime() {
    const input = document.getElementById('yt-new-note-text');
    if (!input || !input.value.trim()) return;

    const currentTime = this.playbackTimeEstimate || 0;
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video) {
      showToast('⚠️ No active video selected', 'error');
      return;
    }

    if (!video.notes) video.notes = [];

    let noteText = input.value.trim();
    if (this.selectedTag) {
      noteText = `[${this.selectedTag}] ${noteText}`;
    }

    const newNote = {
      id: 'yn-' + Date.now(),
      time: currentTime,
      text: noteText
    };

    video.notes.push(newNote);
    store.saveData();

    input.value = '';
    this.renderNotesList();
    this.renderCuratedList();
    showToast(`📝 Note pinned at ${this.formatSeconds(currentTime)}`, 'success');
  }

  // --- 9. EXPORT TO MARKDOWN ---
  exportNotesMarkdown() {
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video) return;

    let md = `# Study Notes: ${video.title}\n\n`;
    md += `**Channel / Instructor:** ${video.channel}\n`;
    md += `**Video URL:** https://www.youtube.com/watch?v=${video.videoId}\n`;
    md += `**Exported From:** Synapse OS\n`;
    md += `**Date:** ${new Date().toLocaleDateString()}\n\n`;
    md += `## Timestamped Key Insights\n\n`;

    if (!video.notes || video.notes.length === 0) {
      md += `*No timestamp notes captured yet.*\n`;
    } else {
      const sorted = [...video.notes].sort((a, b) => a.time - b.time);
      sorted.forEach(note => {
        const timeStr = this.formatSeconds(note.time);
        const link = `https://www.youtube.com/watch?v=${video.videoId}&t=${note.time}s`;
        md += `- [${timeStr}](${link}) - ${note.text}\n`;
      });
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${video.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_notes.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📥 Notes exported as Markdown file', 'success');
  }

  // --- 10. LOG STUDY TIME TO TRACKER ---
  logStudySession(minutes = 30) {
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    const subjectId = video ? video.subjectId : (store.data.subjects[0]?.id || 'subj-1');
    const topic = video ? video.title : 'YouTube Study Lecture';

    // Store helper directly logs study session and updates user hours
    store.logStudySession(subjectId, minutes, `[Video] ${topic}`);

    if (window.analyticsManager) {
      analyticsManager.renderStudyLogs();
      analyticsManager.renderMetrics();
    }
    if (window.app) {
      app.renderDashboard();
    }
    showToast(`⏱️ Logged ${minutes}m study time to Tracker!`, 'success');
  }

  formatSeconds(totalSecs) {
    if (!totalSecs || isNaN(totalSecs)) return '00:00';
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const pad = (num) => String(num).padStart(2, '0');

    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }

  openAddVideoModal() {
    const modal = document.getElementById('modal-add-yt-video');
    if (modal) {
      modal.classList.add('open');
      const input = document.getElementById('input-yt-url');
      if (input) {
        input.value = '';
        input.focus();
      }
      const titleInput = document.getElementById('input-yt-title');
      if (titleInput) titleInput.value = '';
      const channelInput = document.getElementById('input-yt-channel');
      if (channelInput) channelInput.value = '';
      const statusEl = document.getElementById('modal-yt-fetch-status');
      if (statusEl) statusEl.textContent = 'Paste link and click Auto-Fetch to automatically resolve title and channel.';
    }
  }

  addVideoFromUrl(urlOrId, title, channel, subjectId) {
    const videoId = this.extractVideoId(urlOrId) || (urlOrId.length === 11 ? urlOrId : null);

    if (!videoId) {
      showToast('⚠️ Please enter a valid YouTube video URL or ID.', 'error');
      return;
    }

    const newVid = {
      id: 'yt-' + Date.now(),
      subjectId: subjectId || store.data.subjects[0]?.id || 'subj-1',
      title: title || `Educational Lecture (${videoId})`,
      channel: channel || 'YouTube Academy',
      videoId: videoId,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      duration: 'Study Session',
      tags: ['Lecture', 'Study'],
      notes: []
    };

    store.data.youtubeVideos.unshift(newVid);
    store.saveData();

    this.renderCuratedList();
    this.selectVideo(newVid.id, true);
    showToast('▶️ Video added to workspace', 'success');
  }

  // --- 11. REAL-TIME QUICK NOTES SYSTEM (BELOW VIDEO) ---
  handleQuickNotesInput() {
    const textarea = document.getElementById('yt-quick-notes-textarea');
    const status = document.getElementById('yt-quick-note-save-status');
    if (!textarea) return;

    this.updateQuickNotesWordCount();

    if (status) {
      status.textContent = '⏳ Saving...';
      status.className = 'badge badge-amber';
    }

    if (this.quickNotesSaveTimer) {
      clearTimeout(this.quickNotesSaveTimer);
    }

    this.quickNotesSaveTimer = setTimeout(() => {
      const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
      if (video) {
        video.quickNotes = textarea.value;
        store.saveData();
      }
      if (status) {
        status.textContent = '● Auto-saved';
        status.className = 'badge badge-emerald';
      }
    }, 400);
  }

  updateQuickNotesWordCount() {
    const textarea = document.getElementById('yt-quick-notes-textarea');
    const counter = document.getElementById('yt-quick-notes-wordcount');
    if (!textarea || !counter) return;

    const text = textarea.value.trim();
    const count = text ? text.split(/\s+/).filter(Boolean).length : 0;
    counter.textContent = `${count} word${count === 1 ? '' : 's'}`;
  }

  insertTimestampIntoQuickNotes() {
    const textarea = document.getElementById('yt-quick-notes-textarea');
    if (!textarea) return;

    const timeStr = this.formatSeconds(this.playbackTimeEstimate || 0);
    const tag = `\n⏱️ [${timeStr}] `;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = textarea.value;

    textarea.value = currentVal.substring(0, start) + tag + currentVal.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    textarea.focus();

    this.handleQuickNotesInput();
    showToast(`⏱️ Timestamp ${timeStr} inserted into Quick Notes`, 'info');
  }

  applyQuickNotesFormatting(fmt) {
    const textarea = document.getElementById('yt-quick-notes-textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;
    const selected = val.substring(start, end);

    let replacement = '';
    let cursorOffset = 0;

    switch (fmt) {
      case 'bold':
        replacement = selected ? `**${selected}**` : `**bold text**`;
        cursorOffset = selected ? replacement.length : 2;
        break;
      case 'italic':
        replacement = selected ? `*${selected}*` : `*italic text*`;
        cursorOffset = selected ? replacement.length : 1;
        break;
      case 'h2':
        replacement = selected ? `\n## ${selected}\n` : `\n## Section Heading\n`;
        cursorOffset = replacement.length;
        break;
      case 'list':
        replacement = selected ? `\n- ${selected}` : `\n- Bullet point`;
        cursorOffset = replacement.length;
        break;
      case 'code':
        replacement = selected ? `\`${selected}\`` : `\`code\``;
        cursorOffset = selected ? replacement.length : 1;
        break;
      case 'quote':
        replacement = selected ? `\n> 💡 ${selected}\n` : `\n> 💡 Key Concept: `;
        cursorOffset = replacement.length;
        break;
      case 'formula':
        replacement = selected ? ` $$ ${selected} $$ ` : ` $$ \\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0} $$ `;
        cursorOffset = replacement.length;
        break;
      default:
        return;
    }

    textarea.value = val.substring(0, start) + replacement + val.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + cursorOffset;
    textarea.focus();

    this.handleQuickNotesInput();
  }

  clearQuickNotes() {
    const textarea = document.getElementById('yt-quick-notes-textarea');
    if (!textarea) return;
    if (!textarea.value.trim()) return;

    if (!confirm('Clear quick notes for this video?')) return;

    textarea.value = '';
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (video) {
      video.quickNotes = '';
      store.saveData();
    }
    this.updateQuickNotesWordCount();
    showToast('Quick notes cleared', 'info');
  }

  saveQuickNotesToNotebook() {
    const textarea = document.getElementById('yt-quick-notes-textarea');
    if (!textarea || !textarea.value.trim()) {
      showToast('⚠️ Quick notes are empty. Write notes first.', 'error');
      return;
    }

    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    const title = video ? `${video.title} (Lecture Notes)` : 'YouTube Lecture Notes';
    const subjectId = video ? video.subjectId : (store.data.subjects[0]?.id || 'subj-1');

    const newNote = {
      id: 'note-' + Date.now(),
      subjectId: subjectId,
      title: title,
      content: textarea.value,
      tags: ['YouTube', 'LectureNotes', 'SelfStudy'],
      updatedAt: new Date().toISOString()
    };

    store.data.notes.unshift(newNote);
    store.saveData();

    if (window.notesManager) {
      window.notesManager.renderNotesList();
    }
    if (window.app) {
      window.app.renderDashboard();
    }

    showToast(`📚 Saved to Subject Notes: "${title}"`, 'success');
  }

  // --- 12. RUNNING VIDEO AI NOTE GENERATOR ---
  async generateNotesForCurrentVideo() {
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video) {
      showToast('⚠️ No active video selected. Please select a video first.', 'error');
      return;
    }

    const loadingEl = document.getElementById('yt-gen-notes-loading');
    const actionsEl = document.getElementById('yt-gen-notes-actions');
    const contentEl = document.getElementById('yt-gen-notes-content');
    const genBtn = document.getElementById('btn-yt-generate-ai-notes');

    if (loadingEl) loadingEl.style.display = 'block';
    if (actionsEl) actionsEl.style.display = 'none';
    if (genBtn) {
      genBtn.disabled = true;
      genBtn.style.opacity = '0.7';
    }

    try {
      const mode = this.currentGenMode || 'full';
      const params = new URLSearchParams({
        title: video.title || 'Educational Lecture',
        channel: video.channel || 'YouTube Academy',
        videoId: video.videoId || '',
        mode: mode
      });

      const res = await fetch(`/api/generate-video-notes?${params.toString()}`);
      const data = await res.json();

      if (!data.success || !data.notes) {
        throw new Error(data.error || 'Failed to generate notes');
      }

      // Save generated notes to video object
      video.generatedNotes = data.notes;
      video.generatedNotesMode = mode;
      store.saveData();

      // Render formatted Markdown
      this.renderGeneratedNotesForVideo(video);

      showToast('✨ Educational notes successfully generated!', 'success');
    } catch (err) {
      console.error('Error generating notes for video:', err);
      if (contentEl) {
        contentEl.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: #ef4444; font-size: 0.85rem;">
            ❌ Note generation failed: ${err.message}<br>
            Please check connection to local workspace server.
          </div>
        `;
      }
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
      if (genBtn) {
        genBtn.disabled = false;
        genBtn.style.opacity = '1';
      }
    }
  }

  renderGeneratedNotesForVideo(video) {
    const actionsEl = document.getElementById('yt-gen-notes-actions');
    const contentEl = document.getElementById('yt-gen-notes-content');
    if (!contentEl) return;

    if (!video || !video.generatedNotes) {
      if (actionsEl) actionsEl.style.display = 'none';
      contentEl.innerHTML = `
        <div style="padding: 2.5rem 1rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
          <div style="font-size: 1.8rem; margin-bottom: 0.4rem;">✨</div>
          <strong>No notes generated yet for this lecture.</strong><br>
          Click <em>"Generate Notes for Running Video"</em> above to get instant structured notes, equations, and exam tips.
        </div>
      `;
      return;
    }

    if (actionsEl) actionsEl.style.display = 'flex';

    if (typeof renderMarkdown === 'function') {
      contentEl.innerHTML = renderMarkdown(video.generatedNotes);
    } else {
      contentEl.innerHTML = `<pre style="white-space: pre-wrap;">${video.generatedNotes}</pre>`;
    }
  }

  copyGeneratedNotes() {
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video || !video.generatedNotes) {
      showToast('⚠️ No generated notes to copy', 'error');
      return;
    }

    navigator.clipboard.writeText(video.generatedNotes).then(() => {
      showToast('📋 Copied generated notes to clipboard!', 'success');
    }).catch(() => {
      showToast('Failed to copy to clipboard', 'error');
    });
  }

  appendGeneratedToQuickNotes() {
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video || !video.generatedNotes) {
      showToast('⚠️ No generated notes to append', 'error');
      return;
    }

    const textarea = document.getElementById('yt-quick-notes-textarea');
    if (!textarea) return;

    const current = textarea.value.trim();
    textarea.value = current ? `${current}\n\n---\n## 🤖 AI Summary Notes\n${video.generatedNotes}` : video.generatedNotes;
    this.handleQuickNotesInput();

    // Smooth scroll to quick notes card
    const notesCard = document.querySelector('.yt-quick-notes-card');
    if (notesCard) notesCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showToast('➕ Added generated notes to Quick Notes below video!', 'success');
  }

  saveGeneratedToNotebook() {
    const video = (store.data.youtubeVideos || []).find(v => v.id === this.currentVideoId);
    if (!video || !video.generatedNotes) {
      showToast('⚠️ No generated notes to save', 'error');
      return;
    }

    const title = `${video.title} — AI Summary Notes`;
    const subjectId = video.subjectId || store.data.subjects[0]?.id || 'subj-1';

    const newNote = {
      id: 'note-' + Date.now(),
      subjectId: subjectId,
      title: title,
      content: video.generatedNotes,
      tags: ['YouTube', 'AI Notes', video.generatedNotesMode || 'Full'],
      updatedAt: new Date().toISOString()
    };

    store.data.notes.unshift(newNote);
    store.saveData();

    if (window.notesManager) {
      window.notesManager.renderNotesList();
    }
    if (window.app) {
      window.app.renderDashboard();
    }

    showToast(`📥 Saved "${title}" to Subject Notes!`, 'success');
  }
}

const ytManager = new YouTubeStudyManager();
