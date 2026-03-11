const state = { token: null, user: null };

const byId = (id) => document.getElementById(id);
const sessionEl = byId('session');
const memoryResultEl = byId('memory-result');
const workspaceResultEl = byId('workspace-result');
const chatResultEl = byId('chat-result');
const statusBannerEl = byId('status-banner');

function authHeaders() {
  return state.token ? { Authorization: `Bearer ${state.token}` } : {};
}

function setStatus(text, mode = 'offline') {
  statusBannerEl.textContent = text;
  statusBannerEl.dataset.mode = mode;
}

async function call(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {})
    },
    ...options
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload.error || `Request failed for ${url}`;
    throw new Error(message);
  }
  return payload;
}

function writeJson(target, payload) {
  target.textContent = JSON.stringify(payload, null, 2);
}

function setSession(payload) {
  state.token = payload.token || state.token;
  state.user = payload.user || state.user;
  writeJson(sessionEl, { user: state.user, token: state.token ? '***active***' : null });
  if (state.user) {
    setStatus(`Connected as ${state.user.email}`, 'online');
  }
}

async function runAction(target, action) {
  try {
    const payload = await action();
    writeJson(target, payload);
    return payload;
  } catch (error) {
    writeJson(target, { error: error.message });
    return null;
  }
}

byId('register').onclick = async () => {
  const payload = await runAction(sessionEl, () => call('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: byId('email').value,
      password: byId('password').value,
      name: byId('name').value
    })
  }));
  if (payload) setSession(payload);
};

byId('login').onclick = async () => {
  const payload = await runAction(sessionEl, () => call('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: byId('email').value,
      password: byId('password').value
    })
  }));
  if (payload) setSession(payload);
};

byId('me').onclick = async () => {
  const payload = await runAction(sessionEl, () => call('/api/auth/me'));
  if (payload?.user) {
    setSession(payload);
  }
};

byId('save-memory').onclick = async () => {
  await runAction(memoryResultEl, () => call('/api/memory/upsert', {
    method: 'POST',
    body: JSON.stringify({
      namespace: byId('namespace').value,
      content: byId('content').value,
      metadata: { source: 'headyweb-workspace' }
    })
  }));
};

byId('search-memory').onclick = async () => {
  await runAction(memoryResultEl, () => call('/api/memory/search', {
    method: 'POST',
    body: JSON.stringify({
      namespace: byId('namespace').value,
      query: byId('query').value,
      limit: 10
    })
  }));
};

byId('timeline-memory').onclick = async () => {
  const namespace = encodeURIComponent(byId('namespace').value);
  await runAction(memoryResultEl, () => call(`/api/memory/timeline?namespace=${namespace}&limit=20`));
};

byId('list-files').onclick = async () => {
  const requestedPath = encodeURIComponent(byId('file-path').value);
  await runAction(workspaceResultEl, () => call(`/api/workspace/list?path=${requestedPath}`));
};

byId('read-file').onclick = async () => {
  const requestedPath = encodeURIComponent(byId('file-path').value);
  const payload = await runAction(workspaceResultEl, () => call(`/api/workspace/file?path=${requestedPath}`));
  if (payload?.content !== undefined) {
    byId('file-content').value = payload.content;
  }
};

async function writeFile(mode) {
  const payload = await runAction(workspaceResultEl, () => call('/api/workspace/file', {
    method: 'POST',
    body: JSON.stringify({
      path: byId('file-path').value,
      content: byId('file-content').value,
      mode
    })
  }));

  if (payload) {
    byId('chat-message').value = `/read ${byId('file-path').value}`;
  }
}

byId('write-file').onclick = async () => writeFile('overwrite');
byId('append-file').onclick = async () => writeFile('append');

byId('send-chat').onclick = async () => {
  const payload = await runAction(chatResultEl, () => call('/api/chat/message', {
    method: 'POST',
    body: JSON.stringify({
      message: byId('chat-message').value,
      namespace: byId('namespace').value
    })
  }));

  if (payload?.file?.content !== undefined) {
    byId('file-content').value = payload.file.content;
  }
};

byId('list-tools').onclick = async () => {
  await runAction(chatResultEl, () => call('/mcp/rpc', {
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
  }));
};

byId('whoami').onclick = async () => {
  await runAction(chatResultEl, () => call('/mcp/rpc', {
    method: 'POST',
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'auth.me', arguments: {} }
    })
  }));
};

setStatus('Disconnected', 'offline');
