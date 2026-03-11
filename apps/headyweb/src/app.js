const state = {
  token: localStorage.getItem('headywebToken') || '',
  selectedFilePath: 'apps/headyweb/src/app.js'
};

function setStatus(text, type = 'info') {
  const node = document.getElementById('status-pill');
  if (!node) return;
  node.textContent = text;
  node.dataset.type = type;
}

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...authHeaders()
    }
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
}

function render() {
  const root = document.getElementById('heady-root');
  root.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <h1>HeadyWeb Control Surface</h1>
        <span id="status-pill" data-type="info">Booting...</span>
      </header>

      <section class="grid">
        <article class="panel auth-panel">
          <h2>Authentication</h2>
          <p>Authenticate before accessing vector workspace, IDE file ops, and chat automation.</p>
          <form id="login-form">
            <label>Email<input id="email" type="email" value="founder@headysystems.com" required /></label>
            <label>Password<input id="password" type="password" value="heady-dev-password" required /></label>
            <button type="submit">Login</button>
          </form>
          <pre id="me-output">Not authenticated.</pre>
        </article>

        <article class="panel">
          <h2>Persistent Vector Workspace</h2>
          <div class="row">
            <input id="vector-text" placeholder="Add semantic memory to your workspace" />
            <button id="add-vector">Add</button>
          </div>
          <div class="row">
            <input id="vector-query" placeholder="Search vectors" />
            <button id="search-vectors">Search</button>
          </div>
          <pre id="vector-output">Awaiting query...</pre>
        </article>

        <article class="panel wide">
          <h2>HeadyAI-IDE File Operations</h2>
          <div class="row">
            <input id="file-path" value="apps/headyweb/src/app.js" />
            <button id="read-file">Read</button>
            <button id="save-file">Save</button>
          </div>
          <textarea id="editor" spellcheck="false"></textarea>
        </article>

        <article class="panel wide">
          <h2>Chat Workspace Controller</h2>
          <p>Commands: <code>READ path/to/file</code> or <code>WRITE path/to/file</code> (newline + content). Any other prompt runs semantic assist against your vector workspace.</p>
          <textarea id="chat-input" placeholder="Type a command or natural-language prompt"></textarea>
          <div class="row"><button id="send-chat">Send</button></div>
          <pre id="chat-output">Chat ready.</pre>
        </article>
      </section>
    </main>
  `;

  bindEvents();
  initializeSession();
}

async function initializeSession() {
  if (!state.token) {
    setStatus('Not authenticated', 'warn');
    return;
  }

  try {
    const profile = await api('/api/auth/me');
    document.getElementById('me-output').textContent = JSON.stringify(profile, null, 2);
    setStatus(`Authenticated: ${profile.email}`, 'ok');
    await refreshVectors();
  } catch {
    state.token = '';
    localStorage.removeItem('headywebToken');
    setStatus('Session expired', 'warn');
  }
}

function bindEvents() {
  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const result = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        headers: {}
      });
      state.token = result.token;
      localStorage.setItem('headywebToken', state.token);
      await initializeSession();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  document.getElementById('add-vector').addEventListener('click', async () => {
    const text = document.getElementById('vector-text').value.trim();
    if (!text) return;
    try {
      const added = await api('/api/workspace/vectors', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      document.getElementById('vector-output').textContent = `Stored vector: ${added.id}`;
      document.getElementById('vector-text').value = '';
      await refreshVectors();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  document.getElementById('search-vectors').addEventListener('click', refreshVectors);

  document.getElementById('read-file').addEventListener('click', async () => {
    const filePath = document.getElementById('file-path').value.trim();
    state.selectedFilePath = filePath;
    try {
      const result = await api('/api/workspace/files/read', {
        method: 'POST',
        body: JSON.stringify({ filePath })
      });
      document.getElementById('editor').value = result.content;
      setStatus(`Loaded ${filePath}`, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  document.getElementById('save-file').addEventListener('click', async () => {
    const filePath = document.getElementById('file-path').value.trim();
    const content = document.getElementById('editor').value;
    try {
      const result = await api('/api/workspace/files/write', {
        method: 'POST',
        body: JSON.stringify({ filePath, content })
      });
      setStatus(`Saved ${result.filePath}`, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  document.getElementById('send-chat').addEventListener('click', async () => {
    const message = document.getElementById('chat-input').value;
    try {
      const result = await api('/api/workspace/chat', {
        method: 'POST',
        body: JSON.stringify({ message })
      });
      document.getElementById('chat-output').textContent = JSON.stringify(result, null, 2);
      if (result.content) {
        document.getElementById('editor').value = result.content;
        document.getElementById('file-path').value = result.filePath || state.selectedFilePath;
      }
      setStatus(`Chat mode: ${result.mode}`, 'ok');
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });
}

async function refreshVectors() {
  const query = document.getElementById('vector-query').value.trim();
  try {
    const result = await api(`/api/workspace/vectors?query=${encodeURIComponent(query)}`);
    document.getElementById('vector-output').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', render);
