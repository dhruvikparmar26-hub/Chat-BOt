/* ═══════════════════════════════════════════════════════════
   Chat-BOt  —  Frontend Application
   ═══════════════════════════════════════════════════════════ */

// ── API base URL ────────────────────────────────────────────
// In production (same-origin). For dev with separate static server, override:
//   localStorage.setItem('API_URL', 'http://localhost:3001')
const API = localStorage.getItem('API_URL') || window.location.origin;

// ═══════════════════════════════════════════════════════════
//  DOM References
// ═══════════════════════════════════════════════════════════
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  // Auth
  authOverlay:      $('#auth-overlay'),
  authSubtitle:     $('#auth-subtitle'),
  authCloseBtn:     $('#auth-close-btn'),
  loginForm:        $('#login-form'),
  registerForm:     $('#register-form'),
  loginEmail:       $('#login-email'),
  loginPassword:    $('#login-password'),
  loginError:       $('#login-error'),
  loginSubmit:      $('#login-submit'),
  registerUsername: $('#register-username'),
  registerEmail:    $('#register-email'),
  registerPassword: $('#register-password'),
  registerError:    $('#register-error'),
  registerSubmit:   $('#register-submit'),
  authTabs:         $$('.auth-tab'),
  authSwitchBtn:    $('#auth-switch-btn'),
  authFooterText:   $('#auth-footer-text'),

  // Sidebar
  sidebar:          $('#sidebar'),
  sidebarOverlay:   $('#sidebar-overlay'),
  sidebarOpenBtn:   $('#sidebar-open-btn'),
  sidebarCloseBtn:  $('#sidebar-close-btn'),
  newChatBtn:       $('#new-chat-btn'),
  historyList:      $('#history-list'),
  historyEmpty:     $('#history-empty'),
  historyLoginPrompt: $('#history-login-prompt'),
  sidebarLoginBtn:  $('#sidebar-login-btn'),

  // User info
  userInfo:         $('#user-info'),
  guestInfo:        $('#guest-info'),
  userAvatar:       $('#user-avatar'),
  usernameDisplay:  $('#username-display'),
  logoutBtn:        $('#logout-btn'),
  sidebarSigninBtn: $('#sidebar-signin-btn'),

  // Chat
  chatTitle:        $('#chat-title'),
  chatMessages:     $('#chat-messages'),
  welcomeScreen:    $('#welcome-screen'),
  thinkingIndicator:$('#thinking-indicator'),
  thinkingText:     $('#thinking-text'),
  messageInput:     $('#message-input'),
  sendBtn:          $('#send-btn'),

  toastContainer:   $('#toast-container'),

  // Header
  headerLoginBtn:   $('#header-login-btn'),
};


// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════
const state = {
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  socket: null,
  conversationHistory: [],
  currentSessionId: null,
  isStreaming: false,
  currentAiBubble: null,
  currentAiText: '',
};


// ═══════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════
function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });
    return marked.parse(text);
  }
  // Fallback: basic escaping
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  });
}

function autoResizeTextarea() {
  dom.messageInput.style.height = 'auto';
  dom.messageInput.style.height = Math.min(dom.messageInput.scrollHeight, 160) + 'px';
}


// ═══════════════════════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════
function showToast(type, title, message, duration = 5000) {
  const iconMap = {
    error: 'alert-circle',
    warning: 'alert-triangle',
    success: 'check-circle-2',
    info: 'info',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  // Build toast with textContent to prevent XSS from server error messages
  const iconEl = document.createElement('i');
  iconEl.dataset.lucide = iconMap[type];
  iconEl.className = 'toast-icon';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'toast-content';
  const titleDiv = document.createElement('div');
  titleDiv.className = 'toast-title';
  titleDiv.textContent = title;
  const msgDiv = document.createElement('div');
  msgDiv.className = 'toast-message';
  msgDiv.textContent = message;
  contentDiv.append(titleDiv, msgDiv);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '<i data-lucide="x"></i>';

  const progress = document.createElement('div');
  progress.className = 'toast-progress';

  toast.append(iconEl, contentDiv, closeBtn, progress);

  dom.toastContainer.appendChild(toast);
  lucide.createIcons({ nodes: [toast] });

  const dismiss = () => {
    toast.classList.add('toast-leaving');
    setTimeout(() => toast.remove(), 300);
  };

  closeBtn.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}


// ═══════════════════════════════════════════════════════════
//  AUTH MODULE
// ═══════════════════════════════════════════════════════════
function showAuthModal(promptMessage) {
  dom.authOverlay.classList.remove('hidden');
  if (promptMessage) {
    dom.authSubtitle.textContent = promptMessage;
  } else {
    dom.authSubtitle.textContent = 'Sign in to save your conversations';
  }
}

function hideAuthModal() {
  dom.authOverlay.classList.add('hidden');
}

function switchAuthTab(tabName) {
  dom.authTabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  if (tabName === 'login') {
    dom.loginForm.classList.remove('hidden');
    dom.registerForm.classList.add('hidden');
    dom.authFooterText.textContent = "Don't have an account?";
    dom.authSwitchBtn.textContent = 'Sign Up';
  } else {
    dom.loginForm.classList.add('hidden');
    dom.registerForm.classList.remove('hidden');
    dom.authFooterText.textContent = 'Already have an account?';
    dom.authSwitchBtn.textContent = 'Sign In';
  }

  // Clear errors
  dom.loginError.classList.add('hidden');
  dom.registerError.classList.add('hidden');
}

function setAuthLoading(form, loading) {
  const btn = form.querySelector('.auth-submit-btn');
  const span = btn.querySelector('span');
  const loader = btn.querySelector('.btn-loader');

  btn.disabled = loading;
  if (loading) {
    span.style.opacity = '0.5';
    loader.classList.remove('hidden');
  } else {
    span.style.opacity = '1';
    loader.classList.add('hidden');
  }
}

function handleAuthSuccess(data) {
  state.token = data.token;
  state.username = data.username;
  localStorage.setItem('token', data.token);
  localStorage.setItem('username', data.username);
  hideAuthModal();
  updateUIForAuth();
  connectSocket();
  loadHistory();
  showToast('success', 'Welcome!', `Signed in as ${data.username}`);
}

async function handleLogin(e) {
  e.preventDefault();
  dom.loginError.classList.add('hidden');
  setAuthLoading(dom.loginForm, true);

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: dom.loginEmail.value.trim(),
        password: dom.loginPassword.value,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.errors && Array.isArray(data.errors)) {
        throw new Error(data.errors.join('<br>'));
      }
      throw new Error(data.error || 'Login failed');
    }
    handleAuthSuccess(data);
  } catch (err) {
    dom.loginError.innerHTML = err.message;
    dom.loginError.classList.remove('hidden');
  } finally {
    setAuthLoading(dom.loginForm, false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  dom.registerError.classList.add('hidden');
  setAuthLoading(dom.registerForm, true);

  try {
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: dom.registerUsername.value.trim(),
        email: dom.registerEmail.value.trim(),
        password: dom.registerPassword.value,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.errors && Array.isArray(data.errors)) {
        throw new Error(data.errors.join('<br>'));
      }
      throw new Error(data.error || 'Registration failed');
    }
    handleAuthSuccess(data);
  } catch (err) {
    dom.registerError.innerHTML = err.message;
    dom.registerError.classList.remove('hidden');
  } finally {
    setAuthLoading(dom.registerForm, false);
  }
}

function logout() {
  state.token = null;
  state.username = null;
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  if (state.socket) state.socket.disconnect();
  window.location.reload();
}

function updateUIForAuth() {
  const loggedIn = !!state.token;

  // Sidebar user info
  dom.userInfo.classList.toggle('hidden', !loggedIn);
  dom.guestInfo.classList.toggle('hidden', loggedIn);

  // Header sign-in button
  dom.headerLoginBtn.classList.toggle('hidden', loggedIn);

  // Username display
  if (loggedIn && state.username) {
    dom.usernameDisplay.textContent = state.username;
    dom.userAvatar.textContent = state.username.charAt(0).toUpperCase();
  }

  // Sidebar history prompt
  dom.historyLoginPrompt.classList.toggle('hidden', loggedIn);
  if (!loggedIn) {
    dom.historyEmpty.classList.add('hidden');
  }
}


// ═══════════════════════════════════════════════════════════
//  SOCKET MODULE
// ═══════════════════════════════════════════════════════════
function connectSocket() {
  if (state.socket) {
    state.socket.disconnect();
  }

  const opts = {};
  if (state.token) {
    opts.auth = { token: state.token };
  }

  state.socket = io(API, opts);

  state.socket.on('connect', () => {
    console.log('[Socket] Connected:', state.socket.id);
  });

  state.socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  state.socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    if (err.message.includes('AUTH_FAILED')) {
      // Token is invalid, clear and reload
      logout();
    }
  });

  // ── Chat events ──
  state.socket.on('chat:chunk', handleChunk);
  state.socket.on('chat:done', handleDone);
  state.socket.on('chat:sources', handleSources);
  state.socket.on('chat:error', handleChatError);
  state.socket.on('chat:blocked', handleBlocked);
  state.socket.on('chat:limit', handleLimit);
  state.socket.on('chat:status', handleStatus);
  state.socket.on('chat:session', handleSession);
}


// ═══════════════════════════════════════════════════════════
//  CHAT MODULE
// ═══════════════════════════════════════════════════════════
function sendMessage(text) {
  if (!text || state.isStreaming || !state.socket) return;

  // Hide welcome screen
  if (dom.welcomeScreen) {
    dom.welcomeScreen.remove();
  }

  // Append user bubble
  appendMessage('user', text);

  // Add to conversation history
  state.conversationHistory.push({ role: 'user', content: text });

  // Emit to server
  state.socket.emit('chat:message', {
    message: text,
    history: state.conversationHistory.slice(0, -1),
    sessionId: state.currentSessionId,
  });

  // Prepare for AI response
  state.isStreaming = true;
  state.currentAiText = '';
  createAiBubble();
  showThinking(true, 'Thinking...');

  // Clear input
  dom.messageInput.value = '';
  dom.messageInput.style.height = 'auto';

  dom.sendBtn.disabled = true;

  scrollToBottom();
}

function appendMessage(role, content, isMarkdown = false) {
  const row = document.createElement('div');
  row.className = `message-row ${role === 'user' ? 'user-message' : 'ai-message'}`;

  if (role === 'user') {
    row.innerHTML = `
      <div class="message-bubble">${escapeHtml(content)}</div>
    `;
  } else {
    const rendered = isMarkdown ? renderMarkdown(content) : escapeHtml(content);
    row.innerHTML = `
      <div class="message-avatar ai-avatar"><i data-lucide="bot"></i></div>
      <div class="message-bubble">${rendered}</div>
    `;
    lucide.createIcons({ nodes: [row] });
  }

  dom.chatMessages.appendChild(row);
  scrollToBottom();
  return row;
}

function createAiBubble() {
  const row = document.createElement('div');
  row.className = 'message-row ai-message';
  row.innerHTML = `
    <div class="message-avatar ai-avatar"><i data-lucide="bot"></i></div>
    <div class="message-bubble" id="streaming-bubble"></div>
  `;
  lucide.createIcons({ nodes: [row] });
  dom.chatMessages.appendChild(row);
  state.currentAiBubble = row.querySelector('#streaming-bubble');
  scrollToBottom();
}

let _markdownRenderTimer = null;

function handleChunk(data) {
  showThinking(false);
  if (!state.currentAiBubble) return;

  state.currentAiText += data.token;

  // Throttle markdown rendering to every 100ms to avoid O(n²) re-parsing
  if (!_markdownRenderTimer) {
    _markdownRenderTimer = setTimeout(() => {
      if (state.currentAiBubble) {
        state.currentAiBubble.innerHTML = renderMarkdown(state.currentAiText);
        scrollToBottom();
      }
      _markdownRenderTimer = null;
    }, 100);
  }
}

function handleDone() {
  state.isStreaming = false;
  showThinking(false);

  // Clear any pending throttled render and do a final render
  if (_markdownRenderTimer) {
    clearTimeout(_markdownRenderTimer);
    _markdownRenderTimer = null;
  }

  if (state.currentAiBubble) {
    state.currentAiBubble.removeAttribute('id');
    state.currentAiBubble.innerHTML = renderMarkdown(state.currentAiText);
  }

  // Add to conversation history
  if (state.currentAiText) {
    state.conversationHistory.push({ role: 'assistant', content: state.currentAiText });
  }

  state.currentAiBubble = null;
  state.currentAiText = '';
  dom.messageInput.focus();
}

function handleSources(data) {
  if (!state.currentAiBubble || !data.sources?.length) return;

  const sourcesDiv = document.createElement('div');
  sourcesDiv.className = 'sources-section';
  sourcesDiv.innerHTML = `
    <div class="sources-title">Sources</div>
    ${data.sources.map(s => `
      <a href="${s.url}" target="_blank" rel="noopener" class="source-link">
        <i data-lucide="external-link"></i> ${escapeHtml(s.title)}
      </a>
    `).join('')}
  `;
  state.currentAiBubble.appendChild(sourcesDiv);
  lucide.createIcons({ nodes: [sourcesDiv] });
}

function handleChatError(data) {
  state.isStreaming = false;
  showThinking(false);
  showToast('error', 'Error', data.message || 'Something went wrong.');
}

function handleBlocked(data) {
  state.isStreaming = false;
  showThinking(false);
  showToast('warning', `Moderation Warning (Strike ${data.strikes}/3)`, data.message);
}

function handleLimit(data) {
  state.isStreaming = false;
  showThinking(false);

  if (data.type === 'guest_limit') {
    showAuthModal(data.message);
  } else {
    showToast('info', 'Limit Reached', data.message);
  }
}

function handleStatus(data) {
  showThinking(true, data.message);
}

function handleSession(data) {
  state.currentSessionId = data.sessionId;

  // Update sidebar
  addHistoryItem({
    _id: data.sessionId,
    summary: data.summary || 'New Chat',
    createdAt: new Date().toISOString(),
  }, true);
}

function showThinking(show, text) {
  dom.thinkingIndicator.classList.toggle('hidden', !show);
  if (text) dom.thinkingText.textContent = text;
  if (show) scrollToBottom();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// ═══════════════════════════════════════════════════════════
//  HISTORY / SIDEBAR MODULE
// ═══════════════════════════════════════════════════════════
async function loadHistory() {
  if (!state.token) return;

  try {
    const res = await fetch(`${API}/api/auth/history`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) throw new Error('Failed to fetch history');

    const sessions = await res.json();

    dom.historyList.innerHTML = '';

    if (sessions.length === 0) {
      dom.historyEmpty.classList.remove('hidden');
      dom.historyEmpty.textContent = 'No conversations yet';
    } else {
      dom.historyEmpty.classList.add('hidden');
      sessions.forEach(s => addHistoryItem(s));
    }
  } catch (err) {
    console.error('History load failed:', err);
  }
}

function addHistoryItem(session, prepend = false) {
  dom.historyEmpty.classList.add('hidden');

  // Check if already exists and update
  const existing = dom.historyList.querySelector(`[data-session-id="${session._id}"]`);
  if (existing) {
    existing.querySelector('.history-item-text').textContent = session.summary || 'New Chat';
    return;
  }

  const item = document.createElement('div');
  item.className = 'history-item';
  item.dataset.sessionId = session._id;

  item.innerHTML = `
    <div class="history-item-icon"><i data-lucide="message-square"></i></div>
    <span class="history-item-text">${escapeHtml(session.summary || 'New Chat')}</span>
    <span class="history-item-date">${timeAgo(session.createdAt)}</span>
    <button class="history-delete-btn" title="Delete"><i data-lucide="trash-2"></i></button>
  `;

  lucide.createIcons({ nodes: [item] });

  // Click to load
  item.addEventListener('click', (e) => {
    if (e.target.closest('.history-delete-btn')) return;
    loadSession(session._id);
    // Highlight active
    $$('.history-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    // Close sidebar on mobile
    closeSidebar();
  });

  // Delete
  item.querySelector('.history-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSession(session._id, item);
  });

  if (prepend) {
    dom.historyList.prepend(item);
  } else {
    dom.historyList.appendChild(item);
  }
}

async function loadSession(sessionId) {
  try {
    const res = await fetch(`${API}/api/auth/history/${sessionId}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) throw new Error('Failed to load session');

    const session = await res.json();
    state.currentSessionId = sessionId;
    state.conversationHistory = [];

    // Clear chat UI
    clearChat();

    // Render all messages
    session.messages.forEach(msg => {
      const role = msg.role === 'model' ? 'assistant' : msg.role;
      appendMessage(role, msg.content, role === 'assistant');
      state.conversationHistory.push({ role, content: msg.content });
    });

    dom.chatTitle.textContent = session.summary || 'Chat';
  } catch (err) {
    showToast('error', 'Error', 'Failed to load conversation.');
    console.error(err);
  }
}

async function deleteSession(sessionId, element) {
  try {
    const res = await fetch(`${API}/api/auth/history/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` },
    });

    if (!res.ok) throw new Error('Delete failed');

    element.style.transition = 'all 0.3s ease';
    element.style.transform = 'translateX(-100%)';
    element.style.opacity = '0';
    setTimeout(() => {
      element.remove();
      // If was current session, start new chat
      if (state.currentSessionId === sessionId) {
        startNewChat();
      }
      // Show empty message if no sessions
      if (dom.historyList.children.length === 0) {
        dom.historyEmpty.textContent = 'No conversations yet';
        dom.historyEmpty.classList.remove('hidden');
      }
    }, 300);

    showToast('success', 'Deleted', 'Conversation removed.');
  } catch (err) {
    showToast('error', 'Error', 'Failed to delete conversation.');
    console.error(err);
  }
}

function startNewChat() {
  state.currentSessionId = null;
  state.conversationHistory = [];
  state.isStreaming = false;
  state.currentAiBubble = null;
  state.currentAiText = '';

  clearChat();
  showThinking(false);

  // Re-add welcome screen
  const welcome = document.createElement('div');
  welcome.id = 'welcome-screen';
  welcome.className = 'welcome-screen';
  welcome.innerHTML = `
    <div class="welcome-icon"><i data-lucide="sparkles"></i></div>
    <h2>Welcome to Chat-BOt</h2>
    <p>Your AI assistant powered by Google Gemini. Ask me anything!</p>
    <div class="welcome-suggestions">
      <button class="suggestion-chip" data-msg="Explain quantum computing in simple terms">
        <i data-lucide="atom"></i> Explain quantum computing
      </button>
      <button class="suggestion-chip" data-msg="Write a Python function to sort a list">
        <i data-lucide="code-2"></i> Write a Python sort function
      </button>
      <button class="suggestion-chip" data-msg="What are the latest trends in AI?">
        <i data-lucide="trending-up"></i> Latest AI trends
      </button>
      <button class="suggestion-chip" data-msg="Give me a healthy dinner recipe">
        <i data-lucide="chef-hat"></i> Healthy dinner recipe
      </button>
    </div>
  `;
  dom.chatMessages.appendChild(welcome);
  lucide.createIcons({ nodes: [welcome] });
  bindSuggestionChips();

  dom.chatTitle.textContent = 'New Chat';
  $$('.history-item').forEach(i => i.classList.remove('active'));
}

function clearChat() {
  dom.chatMessages.innerHTML = '';
}


// ═══════════════════════════════════════════════════════════
//  SIDEBAR MOBILE TOGGLE
// ═══════════════════════════════════════════════════════════
function openSidebar() {
  dom.sidebar.classList.add('open');
  dom.sidebarOverlay.classList.remove('hidden');
}

function closeSidebar() {
  dom.sidebar.classList.remove('open');
  dom.sidebarOverlay.classList.add('hidden');
}


// ═══════════════════════════════════════════════════════════
//  SUGGESTION CHIPS
// ═══════════════════════════════════════════════════════════
function bindSuggestionChips() {
  $$('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const msg = chip.dataset.msg;
      if (msg) sendMessage(msg);
    });
  });
}


// ═══════════════════════════════════════════════════════════
//  EVENT BINDINGS
// ═══════════════════════════════════════════════════════════
function initEventListeners() {
  // ── Auth ──
  dom.loginForm.addEventListener('submit', handleLogin);
  dom.registerForm.addEventListener('submit', handleRegister);
  dom.authCloseBtn.addEventListener('click', hideAuthModal);

  dom.authTabs.forEach(tab => {
    tab.addEventListener('click', () => switchAuthTab(tab.dataset.tab));
  });

  dom.authSwitchBtn.addEventListener('click', () => {
    const current = document.querySelector('.auth-tab.active').dataset.tab;
    switchAuthTab(current === 'login' ? 'register' : 'login');
  });

  dom.logoutBtn.addEventListener('click', logout);

  // Auth triggers
  dom.headerLoginBtn.addEventListener('click', () => showAuthModal());
  dom.sidebarSigninBtn.addEventListener('click', () => showAuthModal());
  dom.sidebarLoginBtn.addEventListener('click', () => showAuthModal());

  // Close modal on overlay click
  dom.authOverlay.addEventListener('click', (e) => {
    if (e.target === dom.authOverlay) hideAuthModal();
  });

  // ── Sidebar ──
  dom.sidebarOpenBtn.addEventListener('click', openSidebar);
  dom.sidebarCloseBtn.addEventListener('click', closeSidebar);
  dom.sidebarOverlay.addEventListener('click', closeSidebar);
  dom.newChatBtn.addEventListener('click', () => {
    startNewChat();
    closeSidebar();
  });

  // ── Chat Input ──
  dom.sendBtn.addEventListener('click', () => {
    const text = dom.messageInput.value.trim();
    if (text) sendMessage(text);
  });

  dom.messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = dom.messageInput.value.trim();
      if (text && !state.isStreaming) sendMessage(text);
    }
  });

  let limitToastShown = false;
  dom.messageInput.addEventListener('input', () => {
    autoResizeTextarea();
    const len = dom.messageInput.value.length;
    
    if (len >= 1000 && !limitToastShown) {
      showToast('warning', 'Character Limit', 'You can enter a maximum of 1000 characters.');
      limitToastShown = true;
    } else if (len < 1000) {
      limitToastShown = false;
    }

    dom.sendBtn.disabled = len === 0 || state.isStreaming;
  });

  // ── Suggestion chips ──
  bindSuggestionChips();

  // ── Keyboard shortcut: Escape closes modal ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!dom.authOverlay.classList.contains('hidden')) {
        hideAuthModal();
      }
    }
  });
}


// ═══════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════
function init() {
  // Initialize Lucide icons
  lucide.createIcons();

  // Set up event listeners
  initEventListeners();

  // Update UI based on auth state
  updateUIForAuth();

  // Connect socket
  connectSocket();

  // Load history if logged in
  if (state.token) {
    loadHistory();
  }

  // Focus input
  dom.messageInput.focus();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
