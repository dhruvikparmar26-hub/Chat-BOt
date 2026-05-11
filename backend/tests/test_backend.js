/**
 * Backend Test Script — Tests all features step by step
 * 
 * Prerequisites:
 *   1. MongoDB running locally (mongod)
 *   2. Server running: node server.js
 * 
 * Run: node test_backend.js
 */

const BASE = 'http://localhost:3002';
let TOKEN = '';
let USERNAME = '';
let SESSION_ID = '';

// ── Helpers ────────────────────────────────────────────────────────────────
async function test(name, fn) {
  try {
    const result = await fn();
    console.log(`✅ ${name}`);
    if (result) console.log(`   →`, result);
    return result;
  } catch (err) {
    console.error(`❌ ${name}`);
    console.error(`   →`, err.message || err);
    return null;
  }
}

async function api(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ── Test Suites ────────────────────────────────────────────────────────────
async function runTests() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  CHAT-BOT BACKEND TESTS');
  console.log('══════════════════════════════════════════════════\n');

  // ─── 1. Health Check ───────────────────────────────────────────────────
  console.log('─── 1. HEALTH CHECK ───────────────────────────────');
  await test('GET /health returns ok', async () => {
    const data = await api('GET', '/health');
    if (data.status !== 'ok') throw new Error('Expected status: ok');
    return data;
  });

  // ─── 2. 404 Handler ───────────────────────────────────────────────────
  console.log('\n─── 2. 404 HANDLER ────────────────────────────────');
  await test('GET /api/nonexistent returns 404', async () => {
    try {
      await api('GET', '/api/nonexistent');
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('404')) throw new Error('Expected 404, got: ' + err.message);
      return 'Correctly returns 404';
    }
  });

  // ─── 3. Input Validation ──────────────────────────────────────────────
  console.log('\n─── 3. INPUT VALIDATION ───────────────────────────');
  
  await test('Register with short username fails', async () => {
    try {
      await api('POST', '/api/auth/register', { username: 'ab', email: 'a@b.com', password: 'Test1234' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('400')) throw err;
      return 'Validation caught short username';
    }
  });

  await test('Register with weak password fails', async () => {
    try {
      await api('POST', '/api/auth/register', { username: 'testuser', email: 'a@b.com', password: '123' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('400')) throw err;
      return 'Validation caught weak password';
    }
  });

  await test('Register with invalid email fails', async () => {
    try {
      await api('POST', '/api/auth/register', { username: 'testuser', email: 'not-an-email', password: 'Test1234' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('400')) throw err;
      return 'Validation caught invalid email';
    }
  });

  await test('Login with empty password fails', async () => {
    try {
      await api('POST', '/api/auth/login', { email: 'a@b.com', password: '' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('400')) throw err;
      return 'Validation caught empty password';
    }
  });

  // ─── 4. Registration ─────────────────────────────────────────────────
  console.log('\n─── 4. REGISTRATION ───────────────────────────────');
  
  // Generate unique user to avoid conflicts on re-runs
  const ts = Date.now();
  const testUser = { username: `tester_${ts}`, email: `tester_${ts}@test.com`, password: 'Test1234!' };
  
  await test(`Register new user: ${testUser.username}`, async () => {
    const data = await api('POST', '/api/auth/register', testUser);
    if (!data.token) throw new Error('No token returned');
    if (!data.username) throw new Error('No username returned');
    TOKEN = data.token;
    USERNAME = data.username;
    return `Token: ${TOKEN.substring(0, 20)}... | Username: ${USERNAME}`;
  });

  await test('Duplicate registration fails', async () => {
    try {
      await api('POST', '/api/auth/register', testUser);
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('400')) throw err;
      return 'Correctly blocked duplicate user';
    }
  });

  // ─── 5. Login ─────────────────────────────────────────────────────────
  console.log('\n─── 5. LOGIN ──────────────────────────────────────');
  
  await test('Login with correct credentials', async () => {
    const data = await api('POST', '/api/auth/login', { email: testUser.email, password: testUser.password });
    if (!data.token) throw new Error('No token returned');
    TOKEN = data.token;  // refresh token
    return `Token: ${TOKEN.substring(0, 20)}...`;
  });

  await test('Login with wrong password fails', async () => {
    try {
      await api('POST', '/api/auth/login', { email: testUser.email, password: 'WrongPass1' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('401')) throw err;
      return 'Correctly rejected wrong password';
    }
  });

  await test('Login with non-existent email fails', async () => {
    try {
      await api('POST', '/api/auth/login', { email: 'nobody@test.com', password: 'Test1234!' });
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('401')) throw err;
      return 'Correctly rejected unknown email';
    }
  });

  // ─── 6. Protected Routes ─────────────────────────────────────────────
  console.log('\n─── 6. PROTECTED ROUTES ───────────────────────────');
  
  await test('GET /api/auth/history WITHOUT token → 401', async () => {
    try {
      await api('GET', '/api/auth/history');
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('401')) throw err;
      return 'Correctly blocked unauthenticated request';
    }
  });

  await test('GET /api/auth/history WITH token → success', async () => {
    const data = await api('GET', '/api/auth/history', null, TOKEN);
    return `Found ${data.length} session(s)`;
  });

  await test('GET /api/auth/history with fake token → 401', async () => {
    try {
      await api('GET', '/api/auth/history', null, 'fake.token.here');
      throw new Error('Should have thrown');
    } catch (err) {
      if (!err.message.includes('401')) throw err;
      return 'Correctly rejected fake token';
    }
  });

  // ─── 7. Socket.io Tests ──────────────────────────────────────────────
  console.log('\n─── 7. SOCKET.IO TESTS ────────────────────────────');
  console.log('   (Requires socket.io-client — run separately if not installed)');
  
  let ioModule;
  try {
    ioModule = await import('socket.io-client');
  } catch {
    console.log('   ⚠️  socket.io-client not installed. Skipping socket tests.');
    console.log('   →  Run: npm install -D socket.io-client');
    console.log('   →  Then re-run this script.');
    printSummary();
    return;
  }

  const { io } = ioModule;

  // Helper: create socket connection
  function connectSocket(token = null) {
    return new Promise((resolve, reject) => {
      const socket = io(BASE, {
        auth: token ? { token } : {},
        transports: ['websocket'],
      });
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (err) => reject(err));
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });
  }

  // 7a. Guest connection
  await test('Guest connects successfully', async () => {
    const socket = await connectSocket();
    const result = `Connected as guest: ${socket.id}`;
    socket.disconnect();
    return result;
  });

  // 7b. Authenticated connection
  await test('Authenticated user connects', async () => {
    const socket = await connectSocket(TOKEN);
    const result = `Connected as ${USERNAME}: ${socket.id}`;
    socket.disconnect();
    return result;
  });

  // 7c. Moderation — empty message
  await test('Moderation: empty message blocked', async () => {
    const socket = await connectSocket();
    return new Promise((resolve, reject) => {
      socket.on('chat:error', (data) => {
        socket.disconnect();
        resolve(`Blocked: "${data.message}"`);
      });
      socket.emit('chat:message', { message: '' });
      setTimeout(() => { socket.disconnect(); reject(new Error('No error received')); }, 3000);
    });
  });

  // 7d. Moderation — blocklist word
  await test('Moderation: blocklist word blocked', async () => {
    const socket = await connectSocket();
    return new Promise((resolve, reject) => {
      socket.on('chat:blocked', (data) => {
        socket.disconnect();
        resolve(`Blocked (strike ${data.strikes}): "${data.message}"`);
      });
      socket.emit('chat:message', { message: 'how to hack a website' });
      setTimeout(() => { socket.disconnect(); reject(new Error('No blocked event')); }, 3000);
    });
  });

  // 7e. Moderation — long message
  await test('Moderation: message >1000 chars blocked', async () => {
    const socket = await connectSocket();
    return new Promise((resolve, reject) => {
      socket.on('chat:error', (data) => {
        socket.disconnect();
        resolve(`Blocked: "${data.message}"`);
      });
      socket.emit('chat:message', { message: 'a'.repeat(1001) });
      setTimeout(() => { socket.disconnect(); reject(new Error('No error received')); }, 3000);
    });
  });

  // 7f. Guest message limit (2 messages)
  await test('Guest: 2-message limit enforced', async () => {
    const socket = await connectSocket();
    let chunks = 0;
    let limitHit = false;

    return new Promise((resolve, reject) => {
      socket.on('chat:chunk', () => { chunks++; });
      socket.on('chat:done', () => {
        // Send next message after the first one completes
      });
      socket.on('chat:limit', (data) => {
        limitHit = true;
        socket.disconnect();
        resolve(`Limit hit after messages: "${data.message}"`);
      });

      // Send 3 messages — 3rd should be blocked
      let sent = 0;
      function sendNext() {
        sent++;
        if (sent <= 3) {
          socket.emit('chat:message', { message: `test message ${sent}` });
          // Wait for response before sending next
          if (sent < 3) {
            socket.once('chat:done', () => setTimeout(sendNext, 500));
          }
        }
      }
      sendNext();

      // Timeout
      setTimeout(() => {
        socket.disconnect();
        if (!limitHit) reject(new Error('Guest limit was not enforced within timeout'));
      }, 90000);  // 90s because AI responses can be slow
    });
  });

  // 7g. Authenticated chat + MongoDB save
  await test('Authenticated: chat message + session saved', async () => {
    const socket = await connectSocket(TOKEN);
    return new Promise((resolve, reject) => {
      let gotSession = false;
      
      socket.on('chat:session', (data) => {
        gotSession = true;
        SESSION_ID = data.sessionId;
        socket.disconnect();
        resolve(`Session saved: ${data.sessionId} | Summary: "${data.summary}"`);
      });

      socket.on('chat:error', (data) => {
        socket.disconnect();
        reject(new Error(data.message));
      });

      socket.emit('chat:message', { message: 'Hello, what is 2+2?' });

      setTimeout(() => {
        socket.disconnect();
        if (!gotSession) reject(new Error('No chat:session event received (timeout)'));
      }, 60000);
    });
  });

  // 7h. Verify session appears in history
  if (SESSION_ID) {
    await test('History: session appears in GET /api/auth/history', async () => {
      const sessions = await api('GET', '/api/auth/history', null, TOKEN);
      const found = sessions.find(s => s._id === SESSION_ID);
      if (!found) throw new Error('Session not found in history');
      return `Found session: ${found._id} | Date: ${found.date} | Summary: "${found.summary}"`;
    });

    await test('History: GET single session by ID', async () => {
      const session = await api('GET', `/api/auth/history/${SESSION_ID}`, null, TOKEN);
      if (!session.messages) throw new Error('No messages in session');
      return `Session has ${session.messages.length} messages`;
    });

    // 7i. Authorization: access with wrong user
    await test('Authorization: cannot access other user\'s session', async () => {
      // Register a second user
      const ts2 = Date.now();
      const user2 = await api('POST', '/api/auth/register', {
        username: `other_${ts2}`, email: `other_${ts2}@test.com`, password: 'Other1234!'
      });
      try {
        await api('GET', `/api/auth/history/${SESSION_ID}`, null, user2.token);
        throw new Error('Should have thrown 403');
      } catch (err) {
        if (!err.message.includes('403')) throw err;
        return 'Correctly denied access to other user\'s session';
      }
    });

    // 7j. Delete session
    await test('History: DELETE session', async () => {
      const data = await api('DELETE', `/api/auth/history/${SESSION_ID}`, null, TOKEN);
      return data.message;
    });

    await test('History: deleted session no longer exists', async () => {
      try {
        await api('GET', `/api/auth/history/${SESSION_ID}`, null, TOKEN);
        throw new Error('Should have thrown 404');
      } catch (err) {
        if (!err.message.includes('404')) throw err;
        return 'Session correctly deleted';
      }
    });
  }

  printSummary();
}

function printSummary() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  ALL TESTS COMPLETE');
  console.log('══════════════════════════════════════════════════\n');
}

// Run
runTests().catch(console.error);
