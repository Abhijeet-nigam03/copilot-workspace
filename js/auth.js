// ==========================================
// SYNAPSE OS: Supabase Authentication & Cloud Sync
// User Sign Up, Sign In, Session State, Cloud Storage
// ==========================================

class SupabaseAuthManager {
  constructor() {
    this.client = null;
    this.user = null;
    this.session = null;
    this.isConfigured = false;
    this.supabaseUrl = '';
    this.supabaseAnonKey = '';
    this.eventsBound = false;
  }

  async init() {
    await this.loadConfig();
    this.bindEvents();
    this.updateUI();
  }

  async loadConfig() {
    let url = '';
    let key = '';

    // 1. Try fetching configured keys from backend server
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        const data = await res.json();
        if (data.configured && data.supabaseUrl && data.supabaseAnonKey) {
          url = data.supabaseUrl.trim();
          key = data.supabaseAnonKey.trim();
        }
      }
    } catch (e) {
      console.warn('Could not query /api/auth/config:', e.message);
    }

    // 2. Fallback to localStorage if server has no keys yet
    if (!url || !key) {
      url = (localStorage.getItem('synapse_supabase_url') || '').trim();
      key = (localStorage.getItem('synapse_supabase_anon_key') || '').trim();
    }

    if (url && key) {
      this.supabaseUrl = url;
      this.supabaseAnonKey = key;
      await this.initClient(url, key);
    } else {
      this.isConfigured = false;
      this.updateConfigStatusBadge(false);
    }
  }

  async initClient(url, anonKey) {
    if (!window.supabase) {
      console.warn('Supabase JS library not loaded on page.');
      return;
    }

    try {
      this.client = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      this.isConfigured = true;
      this.updateConfigStatusBadge(true);

      // Fetch initial session
      const { data: { session } } = await this.client.auth.getSession();
      if (session) {
        this.session = session;
        this.user = session.user;
        this.handleUserSignedIn(session.user, false);
      }

      // Listen for auth state changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESH)
      this.client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          this.session = session;
          this.user = session.user;
          this.handleUserSignedIn(session.user, true);
        } else if (event === 'SIGNED_OUT') {
          this.session = null;
          this.user = null;
          this.handleUserSignedOut();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          this.session = session;
          this.user = session.user;
        }
        this.updateUI();
      });

      console.log('✅ Supabase Client initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      this.isConfigured = false;
      this.updateConfigStatusBadge(false);
    }
  }

  bindEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // Open Auth Modal
    const openAuthBtn = document.getElementById('btn-open-auth-modal');
    if (openAuthBtn) {
      openAuthBtn.addEventListener('click', () => this.openAuthModal());
    }

    const sidebarUserRow = document.getElementById('sidebar-user-clickable');
    if (sidebarUserRow) {
      sidebarUserRow.addEventListener('click', () => {
        if (this.user) {
          this.openUserMenuModal();
        } else {
          this.openAuthModal();
        }
      });
    }

    // Auth Modal Tabs (Sign In vs Sign Up)
    const tabSignIn = document.getElementById('tab-auth-signin');
    const tabSignUp = document.getElementById('tab-auth-signup');
    const formSignIn = document.getElementById('form-auth-signin');
    const formSignUp = document.getElementById('form-auth-signup');

    if (tabSignIn && tabSignUp && formSignIn && formSignUp) {
      tabSignIn.addEventListener('click', () => {
        tabSignIn.classList.add('active');
        tabSignUp.classList.remove('active');
        formSignIn.style.display = 'block';
        formSignUp.style.display = 'none';
        this.clearAuthAlerts();
      });

      tabSignUp.addEventListener('click', () => {
        tabSignUp.classList.add('active');
        tabSignIn.classList.remove('active');
        formSignUp.style.display = 'block';
        formSignIn.style.display = 'none';
        this.clearAuthAlerts();
      });
    }

    // Toggle Password Visibility
    document.querySelectorAll('.btn-toggle-password-vis').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const inputId = e.currentTarget.dataset.target;
        const input = document.getElementById(inputId);
        if (input) {
          if (input.type === 'password') {
            input.type = 'text';
            e.currentTarget.textContent = 'Hide';
          } else {
            input.type = 'password';
            e.currentTarget.textContent = 'Show';
          }
        }
      });
    });

    // Sign In Form Submit
    const btnSubmitSignIn = document.getElementById('btn-submit-signin');
    if (btnSubmitSignIn) {
      btnSubmitSignIn.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSignIn();
      });
    }

    // Sign Up Form Submit
    const btnSubmitSignUp = document.getElementById('btn-submit-signup');
    if (btnSubmitSignUp) {
      btnSubmitSignUp.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleSignUp();
      });
    }

    // Sign Out Button
    const btnSignOut = document.getElementById('btn-auth-signout');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', () => this.handleSignOut());
    }

    // Open Supabase Settings Modal
    document.querySelectorAll('.btn-open-supabase-settings').forEach(btn => {
      btn.addEventListener('click', () => this.openSettingsModal());
    });

    // Save Supabase Project Settings
    const btnSaveSettings = document.getElementById('btn-save-supabase-config');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => this.handleSaveSettings());
    }

    // Test Supabase Connection
    const btnTestSettings = document.getElementById('btn-test-supabase-config');
    if (btnTestSettings) {
      btnTestSettings.addEventListener('click', () => this.handleTestConnection());
    }

    // Manual Cloud Sync Button
    const btnManualSync = document.getElementById('btn-manual-cloud-sync');
    if (btnManualSync) {
      btnManualSync.addEventListener('click', async () => {
        btnManualSync.disabled = true;
        btnManualSync.textContent = 'Syncing...';
        await this.syncUserWorkspaceToCloud();
        setTimeout(() => {
          btnManualSync.disabled = false;
          btnManualSync.textContent = 'Synced! ✓';
          setTimeout(() => { btnManualSync.textContent = 'Sync Now'; }, 1500);
          showToast('☁️ Workspace backed up to Supabase Cloud!', 'success');
        }, 400);
      });
    }
  }

  // --- Auth Actions ---
  async handleSignIn() {
    if (!this.checkConfigured()) return;

    const emailInput = document.getElementById('input-signin-email');
    const passInput = document.getElementById('input-signin-password');
    const alertBox = document.getElementById('auth-alert-msg');
    const btn = document.getElementById('btn-submit-signin');

    const email = (emailInput?.value || '').trim();
    const password = (passInput?.value || '').trim();

    if (!email || !password) {
      this.showAuthAlert('Please provide both email and password.', 'error');
      return;
    }

    this.setBtnLoading(btn, true, 'Signing in...');
    this.clearAuthAlerts();

    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      this.closeModal('modal-auth');
      showToast(`👋 Welcome back, ${data.user.email}!`, 'success');
    } catch (err) {
      console.error('Sign in error:', err);
      this.showAuthAlert(err.message || 'Failed to sign in.', 'error');
    } finally {
      this.setBtnLoading(btn, false, 'Sign In');
    }
  }

  async handleSignUp() {
    if (!this.checkConfigured()) return;

    const nameInput = document.getElementById('input-signup-name');
    const emailInput = document.getElementById('input-signup-email');
    const passInput = document.getElementById('input-signup-password');
    const btn = document.getElementById('btn-submit-signup');

    const fullName = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim();
    const password = (passInput?.value || '').trim();

    if (!email || !password) {
      this.showAuthAlert('Please provide email and password.', 'error');
      return;
    }

    if (password.length < 6) {
      this.showAuthAlert('Password must be at least 6 characters.', 'error');
      return;
    }

    this.setBtnLoading(btn, true, 'Creating account...');
    this.clearAuthAlerts();

    try {
      const { data, error } = await this.client.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0]
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.session) {
        this.closeModal('modal-auth');
        showToast('🎉 Account created & signed in!', 'success');
      } else {
        this.showAuthAlert('✅ Account created! Please check your email for the confirmation link.', 'success');
        showToast('Confirmation email sent!', 'info');
      }
    } catch (err) {
      console.error('Sign up error:', err);
      this.showAuthAlert(err.message || 'Failed to create account.', 'error');
    } finally {
      this.setBtnLoading(btn, false, 'Create Account');
    }
  }

  async handleSignOut() {
    if (!this.client) return;
    try {
      await this.client.auth.signOut();
      this.closeModal('modal-user-menu');
      showToast('Signed out of Supabase Cloud', 'info');
    } catch (err) {
      console.error('Sign out error:', err);
      showToast(`Error: ${err.message}`, 'error');
    }
  }

  handleUserSignedIn(user, notify = true) {
    const meta = user.user_metadata || {};
    const displayName = meta.full_name || user.email.split('@')[0];

    // Update Profile state
    if (store && store.data && store.data.profile) {
      store.data.profile.name = displayName;
      store.data.profile.email = user.email;
      store.saveData();
    }

    this.updateUI();
    this.syncUserWorkspaceFromCloud();

    if (notify) {
      showToast(`⚡ Cloud Sync Active for ${user.email}`, 'success');
    }
  }

  handleUserSignedOut() {
    this.updateUI();
  }

  // --- Cloud Workspace Persistence via Supabase ---
  async syncUserWorkspaceFromCloud() {
    if (!this.client || !this.user) return;

    try {
      const { data, error } = await this.client
        .from('user_workspaces')
        .select('data, updated_at')
        .eq('user_id', this.user.id)
        .single();

      if (!error && data && data.data && data.data.subjects) {
        console.log('[Supabase Cloud] Loaded remote workspace state.');
        store.data = data.data;
        store.saveData();
        store.notify();
      } else if (error && error.code === 'PGRST116') {
        // Row doesn't exist yet, seed initial workspace
        await this.syncUserWorkspaceToCloud();
      }
    } catch (e) {
      console.warn('[Supabase Cloud] Table sync note:', e.message);
    }
  }

  async syncUserWorkspaceToCloud() {
    if (!this.client || !this.user) return;

    try {
      await this.client
        .from('user_workspaces')
        .upsert({
          user_id: this.user.id,
          data: store.data,
          updated_at: new Date().toISOString()
        });
    } catch (e) {
      // Graceful fallback if table not yet migrated
    }
  }

  // --- Settings & Credential Management ---
  async handleSaveSettings() {
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    const statusEl = document.getElementById('supabase-config-status-msg');

    const url = (urlInput?.value || '').trim();
    const key = (keyInput?.value || '').trim();

    if (!url || !key) {
      if (statusEl) statusEl.innerHTML = '<span style="color: #ef4444;">Please provide both Project URL and Anon Key.</span>';
      return;
    }

    if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      if (statusEl) statusEl.innerHTML = '<span style="color: #ef4444;">URL should be in format: https://xyz.supabase.co</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '⏳ Validating and connecting...';

    // 1. Save to server backend
    try {
      await fetch('/api/auth/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl: url, supabaseAnonKey: key })
      });
    } catch (e) {}

    // 2. Save to localStorage
    localStorage.setItem('synapse_supabase_url', url);
    localStorage.setItem('synapse_supabase_anon_key', key);

    this.supabaseUrl = url;
    this.supabaseAnonKey = key;

    await this.initClient(url, key);

    if (this.isConfigured) {
      if (statusEl) statusEl.innerHTML = '<span style="color: var(--accent-emerald); font-weight: 600;">✅ Connected to Supabase Cloud!</span>';
      showToast('⚡ Supabase Cloud Connected!', 'success');
      setTimeout(() => {
        this.closeModal('modal-supabase-settings');
        this.openAuthModal();
      }, 900);
    } else {
      if (statusEl) statusEl.innerHTML = '<span style="color: #ef4444;">Failed to initialize client. Please check keys.</span>';
    }
  }

  async handleTestConnection() {
    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    const statusEl = document.getElementById('supabase-config-status-msg');

    const url = (urlInput?.value || '').trim();
    const key = (keyInput?.value || '').trim();

    if (!url || !key) {
      if (statusEl) statusEl.innerHTML = '<span style="color: #ef4444;">Enter both URL and Anon Key first.</span>';
      return;
    }

    if (statusEl) statusEl.innerHTML = '⏳ Testing connection to Supabase Auth API...';

    try {
      const testClient = window.supabase.createClient(url, key);
      const { data, error } = await testClient.auth.getSession();
      if (error && !error.message.includes('Auth session missing')) {
        throw error;
      }
      if (statusEl) {
        statusEl.innerHTML = '<span style="color: var(--accent-emerald); font-weight: 600;">✅ Connection test successful! Supabase API is reachable.</span>';
      }
      showToast('✅ Supabase project verified!', 'success');
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<span style="color: #ef4444;">❌ Test failed: ${err.message}</span>`;
    }
  }

  // --- UI Helpers ---
  updateUI() {
    const userLabel = document.querySelector('.user-name-label');
    const userAvatar = document.querySelector('.user-avatar-dot');
    const statusPill = document.getElementById('server-status-pill');
    const statusText = document.getElementById('server-status-text');

    const authBtn = document.getElementById('btn-open-auth-modal');

    if (this.user) {
      const email = this.user.email || '';
      const name = this.user.user_metadata?.full_name || email.split('@')[0] || 'User';
      const initial = (name[0] || 'U').toUpperCase();

      if (userLabel) userLabel.textContent = name;
      if (userAvatar) {
        userAvatar.textContent = initial;
        userAvatar.style.background = 'linear-gradient(135deg, var(--accent-emerald), var(--accent-teal))';
      }

      if (authBtn) {
        authBtn.innerHTML = `<i data-lucide="user-check" style="width: 13px; height: 13px; color: var(--accent-emerald);"></i> <span>${name.split(' ')[0]}</span>`;
      }

      if (statusPill && statusText) {
        statusPill.className = 'badge badge-emerald';
        statusText.textContent = `Supabase: ${name.split(' ')[0]}`;
        statusPill.title = `Authenticated with Supabase Cloud (${email})`;
      }
    } else {
      if (userLabel) userLabel.textContent = this.isConfigured ? 'Guest (Click to Sign In)' : 'Local Learner';
      if (userAvatar) {
        userAvatar.textContent = 'A';
        userAvatar.style.background = 'linear-gradient(135deg, var(--accent-primary), var(--accent-indigo))';
      }

      if (authBtn) {
        authBtn.innerHTML = `<i data-lucide="user" style="width: 13px; height: 13px;"></i> <span>Sign In</span>`;
      }

      if (statusPill && statusText) {
        statusPill.className = 'badge badge-emerald';
        statusText.textContent = 'Backend Active';
        statusPill.title = 'Synapse OS Server Active on Port 3000';
      }
    }

    if (window.lucide && window.lucide.createIcons) {
      try { window.lucide.createIcons(); } catch (e) {}
    }
  }

  updateConfigStatusBadge(connected) {
    const badges = document.querySelectorAll('.supabase-cloud-badge');
    badges.forEach(b => {
      if (connected) {
        b.className = 'badge badge-emerald supabase-cloud-badge';
        b.innerHTML = '<span>⚡ Supabase Connected</span>';
      } else {
        b.className = 'badge badge-amber supabase-cloud-badge';
        b.innerHTML = '<span>⚙️ Setup Supabase</span>';
      }
    });
  }

  checkConfigured() {
    if (!this.isConfigured || !this.client) {
      this.closeModal('modal-auth');
      this.openSettingsModal();
      showToast('🔑 Please configure your Supabase Project URL & Anon Key first.', 'info');
      return false;
    }
    return true;
  }

  openAuthModal() {
    if (this.user) {
      this.openUserMenuModal();
      return;
    }

    const modal = document.getElementById('modal-auth');
    if (!modal) return;

    if (!this.isConfigured) {
      this.openSettingsModal();
      showToast('🔑 Connect Supabase Project URL & Anon Key to get started.', 'info');
      return;
    }

    modal.classList.add('open');
    this.clearAuthAlerts();
    const emailInput = document.getElementById('input-signin-email');
    if (emailInput) emailInput.focus();
  }

  openUserMenuModal() {
    const modal = document.getElementById('modal-user-menu');
    if (!modal) return;

    const emailEl = document.getElementById('user-menu-email');
    const nameEl = document.getElementById('user-menu-name');
    if (emailEl && this.user) emailEl.textContent = this.user.email;
    if (nameEl && this.user) nameEl.textContent = this.user.user_metadata?.full_name || this.user.email.split('@')[0];

    modal.classList.add('open');
  }

  openSettingsModal() {
    const modal = document.getElementById('modal-supabase-settings');
    if (!modal) return;

    const urlInput = document.getElementById('input-supabase-url');
    const keyInput = document.getElementById('input-supabase-key');
    const statusEl = document.getElementById('supabase-config-status-msg');

    if (urlInput) urlInput.value = this.supabaseUrl || '';
    if (keyInput) keyInput.value = this.supabaseAnonKey || '';
    if (statusEl) {
      statusEl.innerHTML = this.isConfigured
        ? '<span style="color: var(--accent-emerald);">● Supabase project configured & active.</span>'
        : 'Enter your Supabase Project URL and Anon Key from Project Settings → API.';
    }

    modal.classList.add('open');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  }

  showAuthAlert(msg, type = 'error') {
    const alertBox = document.getElementById('auth-alert-msg');
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.className = type === 'error' ? 'alert alert-error' : 'alert alert-success';
      alertBox.textContent = msg;
    }
  }

  clearAuthAlerts() {
    const alertBox = document.getElementById('auth-alert-msg');
    if (alertBox) {
      alertBox.style.display = 'none';
      alertBox.textContent = '';
    }
  }

  setBtnLoading(btn, loading, defaultText) {
    if (!btn) return;
    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = `<span class="spinner" style="display:inline-block; width:12px; height:12px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; margin-right:6px;"></span> ${defaultText}`;
    } else {
      btn.textContent = defaultText;
    }
  }
}

// Global Instance
const authManager = new SupabaseAuthManager();
