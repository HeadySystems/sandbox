// Heady Chrome Extension v3.1.0 — Popup UI Controller

const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const endpointSelect = document.getElementById('endpoint');
const chatContainer = document.getElementById('chat');
const input = document.getElementById('input');

// Load saved endpoint
chrome.storage.sync.get('endpoint', ({ endpoint }) => {
  if (endpoint) {
    const urlMap = {
      'https://heady-ai-main-1003436179562.us-central1.run.app': 'production',
      'https://headyme.com': 'headyme',
      'https://headysystems.com': 'headysystems',
      'https://headymcp.com': 'headymcp',
      'http://localhost:3300': 'local',
    };
    const key = urlMap[endpoint];
    if (key) endpointSelect.value = key;
  }
});

// Endpoint change
endpointSelect.addEventListener('change', async () => {
  await chrome.runtime.sendMessage({ action: 'switchEndpoint', endpoint: endpointSelect.value });
  updateHealth();
});

// Health check
async function updateHealth() {
  statusText.textContent = 'Checking...';
  statusText.classList.remove('offline');
  const health = await chrome.runtime.sendMessage({ action: 'checkHealth' });
  const activeHealth = health[endpointSelect.value];
  if (activeHealth?.status === 'healthy') {
    statusDot.classList.remove('offline');
    statusText.classList.remove('offline');
    statusText.textContent = 'Connected';
  } else {
    statusDot.classList.add('offline');
    statusText.classList.add('offline');
    statusText.textContent = `Offline — ${activeHealth?.error || 'Connection failed'}`;
  }
}

// Chat
function addMessage(text, type) {
  const msg = document.createElement('div');
  msg.className = `msg ${type}`;
  msg.textContent = text;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function sendChat(query) {
  if (!query.trim()) return;
  addMessage(query, 'user');
  input.value = '';
  const result = await chrome.runtime.sendMessage({ type: 'CHAT', query, context: '' });
  addMessage(result.ok ? result.reply : `⚠️ ${result.error || 'Failed to connect'}`, result.ok ? 'bot' : 'system');
}

// Input handling
document.getElementById('send').addEventListener('click', () => sendChat(input.value));
input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(input.value); });

// Quick actions
document.getElementById('summarize').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  addMessage(`Summarize: ${tab.title}`, 'user');
  const pageContent = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
  const result = await chrome.runtime.sendMessage({ type: 'CHAT', query: `Summarize this page: ${tab.title}`, context: pageContent?.text?.slice(0, 4000) || '' });
  addMessage(result.ok ? result.reply : `⚠️ ${result.error}`, result.ok ? 'bot' : 'system');
});

document.getElementById('explain').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || '' });
  if (result?.result) sendChat(`Explain: ${result.result}`);
  else addMessage('Select text on the page first', 'system');
});

document.getElementById('research').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  sendChat(`Deep research this topic: ${tab.title} (${tab.url})`);
});

document.getElementById('captureTab').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({ action: 'sendToHeady', data: { url: tab.url, title: tab.title, timestamp: new Date().toISOString() } });
  addMessage(result.success ? '✓ Tab captured!' : `⚠️ ${result.error}`, result.success ? 'bot' : 'system');
});

document.getElementById('openDashboard').addEventListener('click', () => {
  const endpoints = { production: 'https://heady-ai-main-1003436179562.us-central1.run.app', headyme: 'https://headyme.com', headysystems: 'https://headysystems.com', headymcp: 'https://headymcp.com', local: 'http://localhost:3300' };
  chrome.tabs.create({ url: endpoints[endpointSelect.value] });
});

document.getElementById('refreshHealth').addEventListener('click', updateHealth);

// Init
updateHealth();
